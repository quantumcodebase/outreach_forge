import PgBoss from 'pg-boss';
import { prisma } from '@cockpit/db';
import { decrypt } from '@cockpit/shared/src/crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { runCampaignSend, runSchedulerTick } from './scheduler';
import { processInboundClassification } from './inbound';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const boss = new PgBoss({ connectionString });
const OUTBOUND_MODE = (process.env.OUTBOUND_MODE || 'dry_run').toLowerCase();

type PlainObj = Record<string, unknown>;

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function redact(value: string) {
  return value.replace(/(password|pass|auth)\s*[:=]\s*\S+/gi, '$1=***');
}

function maskUser(value: string | null | undefined) {
  const safe = String(value || '');
  const [name, domain] = safe.split('@');
  if (!domain) return `${name.slice(0, 1)}***`;
  return `${name.slice(0, 1)}***@${domain}`;
}

function credentialDiagnostics(account: any) {
  const encrypted = String(account.encrypted_pass || '');
  const base64Valid = BASE64_RE.test(encrypted);
  let decodedLength = 0;
  try {
    decodedLength = Buffer.from(encrypted, 'base64').length;
  } catch {
    decodedLength = 0;
  }

  return {
    account_id: account.id,
    label: account.label,
    masked_imap_user: maskUser(account.imap_user),
    encrypted_pass_length: encrypted.length,
    encrypted_pass_base64: base64Valid,
    encrypted_pass_decoded_bytes: decodedLength,
    decrypt_callsite: 'worker.imap-sync.syncAccount'
  };
}

function getDecryptStage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/initialization vector/i.test(message) || /auth(?:entication)? tag/i.test(message) || /unable to authenticate/i.test(message)) {
    return 'decrypt';
  }
  return 'imap';
}

function verifyEncryptionKeyInvariant() {
  const keyRaw = process.env.ENCRYPTION_KEY;
  let decodedLen = 0;
  if (keyRaw) {
    try {
      decodedLen = Buffer.from(keyRaw, 'base64').length;
    } catch {
      decodedLen = 0;
    }
  }
  console.log(`[worker] crypto env ENCRYPTION_KEY present=${Boolean(keyRaw)} decoded_bytes=${decodedLen}`);
}

function deriveThreadId(messageId?: string | null, inReplyTo?: string | null, references?: string | null) {
  const extract = (v: string) => v.match(/<[^>]+>/g) || [];
  if (references) {
    const refs = extract(references);
    if (refs.length) return refs[0];
  }
  if (inReplyTo) {
    const irt = extract(inReplyTo);
    if (irt.length) return irt[0];
    return inReplyTo;
  }
  return messageId || null;
}

async function getPreview(source: Buffer) {
  const parsed = await simpleParser(source);
  const text = parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, ' ') : '');
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}


async function postWebhook(eventId: string) {
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  if (!WEBHOOK_URL) return;

  const event = await prisma.events.findUnique({ where: { id: eventId }, include: { lead: true } });
  if (!event) return;

  const meta = (event.metadata || {}) as PlainObj;
  const payload = {
    event_type: event.type,
    event_id: event.id,
    created_at: event.created_at,
    lead_email: event.lead?.email || null,
    lead_id: event.lead_id,
    campaign_id: event.campaign_id,
    enrollment_id: event.enrollment_id,
    thread_id: (meta.thread_id as string | undefined) || null,
    mode: (meta.mode as string | undefined) || 'dry_run'
  };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
}

async function createEvent(input: {
  type: 'sent' | 'reply' | 'bounce_hard' | 'bounce_soft' | 'unsubscribe' | 'open';
  lead_id?: string | null;
  campaign_id?: string | null;
  enrollment_id?: string | null;
  metadata?: PlainObj;
}) {
  const event = await prisma.events.create({
    data: {
      type: input.type,
      lead_id: input.lead_id || null,
      campaign_id: input.campaign_id || null,
      enrollment_id: input.enrollment_id || null,
      metadata: (input.metadata || {}) as any
    }
  });
  await boss.send('webhook-delivery', { eventId: event.id }, { retryLimit: 5, retryDelay: 30, retryBackoff: true });
  return event;
}

async function syncAccount(account: any) {
  const diag = credentialDiagnostics(account);
  console.log('[worker] decrypt diagnostics', JSON.stringify(diag));

  const pass = decrypt(account.encrypted_pass);
  const imap = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_port === 993,
    auth: { user: account.imap_user, pass },
    logger: false
  });

  await imap.connect();
  await imap.mailboxOpen('INBOX');

  const startUid = Number(account.last_uid_synced ?? 0) + 1;
  let maxProcessedUid = Number(account.last_uid_synced ?? 0);

  for await (const msg of imap.fetch(`${startUid}:*`, { uid: true, envelope: true, source: true })) {
    const env = msg.envelope;
    const messageId = env?.messageId || `<uid-${msg.uid}@${account.id}>`;
    const inReplyTo = env?.inReplyTo || null;
    const references = env?.references?.join(' ') || null;
    const subject = env?.subject || '(no subject)';
    const sender = env?.from?.[0]?.address || 'unknown';
    const preview = await getPreview(msg.source as Buffer);
    const threadId = deriveThreadId(messageId, inReplyTo, references);

    const exists = await prisma.messages.findFirst({ where: { account_id: account.id, message_id_header: messageId } });
    if (!exists) {
      const existingSent = await prisma.messages.findFirst({ where: { direction: 'sent', OR: [{ message_id_header: inReplyTo || '' }, { thread_id: threadId || '' }] }, include: { enrollment: true } });

      await prisma.messages.create({
        data: {
          account_id: account.id,
          enrollment_id: existingSent?.enrollment_id || null,
          direction: 'received',
          message_id_header: messageId,
          in_reply_to: inReplyTo,
          references_header: references,
          thread_id: threadId,
          subject,
          body_preview: `[from: ${sender}] ${preview}`.slice(0, 300),
          received_at: env?.date || new Date()
        }
      });

      await processInboundClassification({
        threadId: threadId || null,
        messageId,
        from: sender,
        subject,
        preview,
        inReplyTo: inReplyTo || null,
        references: references || null
      });
    }

    maxProcessedUid = Math.max(maxProcessedUid, Number(msg.uid));
  }

  await prisma.email_accounts.update({
    where: { id: account.id },
    data: { last_synced_at: new Date(), last_uid_synced: BigInt(maxProcessedUid) }
  });

  await imap.logout();
}


async function main() {
  verifyEncryptionKeyInvariant();
  await prisma.$connect();
  await boss.start();
  console.log('[worker] pg-boss connected');

  await boss.createQueue('heartbeat');
  await boss.createQueue('imap-sync');
  await boss.createQueue('scheduler-tick');
  await boss.createQueue('campaign-send');
  await boss.createQueue('webhook-delivery');

  await boss.work('heartbeat', async () => {
    console.log(`[worker] heartbeat ${new Date().toISOString()} mode=${OUTBOUND_MODE}`);
  });

  await boss.work('imap-sync', async (job: any) => {
    const payload = Array.isArray(job) ? job[0]?.data : job?.data;
    const accountId = (payload as any)?.accountId as string | undefined;
    const where = accountId ? { id: accountId, status: 'active' as const } : { status: 'active' as const };
    const accounts = await prisma.email_accounts.findMany({ where });
    for (const account of accounts) {
      try {
        await syncAccount(account);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const stage = getDecryptStage(error);
        const stack = error instanceof Error ? error.stack : undefined;

        console.error(`[worker] imap sync failed account=${account.id} stage=${stage}: ${redact(msg)}`);
        if (stack) {
          console.error(`[worker] stack account=${account.id}\n${stack}`);
        }

        await prisma.email_accounts.update({
          where: { id: account.id },
          data: { status: 'error' }
        });

        await prisma.events.create({
          data: {
            type: 'open',
            metadata: {
              stage,
              account_id: account.id,
              label: account.label,
              masked_imap_user: maskUser(account.imap_user),
              masked_smtp_user: maskUser(account.smtp_user),
              reason: redact(msg)
            } as any
          }
        });
      }
    }
  });

  await boss.work('scheduler-tick', async () => {
    try {
      await runSchedulerTick(async (enrollmentId, stepId) => {
      await boss.send('campaign-send', { enrollmentId, stepId });
    });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[worker] scheduler tick failed', redact(msg));
    }
  });

  await boss.work('campaign-send', async (job: any) => {
    const data = (Array.isArray(job) ? job[0]?.data : job?.data) as { enrollmentId: string; stepId: string };
    try {
      await runCampaignSend(data.enrollmentId, data.stepId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[worker] campaign send failed', redact(msg));
    }
  });

  await boss.work('webhook-delivery', async (job: any) => {
    try {
      const data = Array.isArray(job) ? job[0]?.data : job?.data;
      await postWebhook((data as any).eventId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[worker] webhook delivery failed', redact(msg));
      throw error;
    }
  });

  await boss.schedule('heartbeat', '* * * * *', { ts: Date.now() });
  await boss.schedule('imap-sync', '*/2 * * * *', { ts: Date.now() });
  await boss.schedule('scheduler-tick', '* * * * *', { ts: Date.now() });

  await boss.send('heartbeat', { startup: true });
  await boss.send('imap-sync', { startup: true });
  await boss.send('scheduler-tick', { startup: true });
}

main().catch(async (error) => {
  console.error('[worker] failed', error);
  await boss.stop().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await boss.stop();
  await prisma.$disconnect();
  process.exit(0);
});
