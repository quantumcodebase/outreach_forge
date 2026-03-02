import PgBoss from 'pg-boss';
import { prisma } from '@cockpit/db';
import { decrypt } from '@cockpit/shared/src/crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { runCampaignSend, runSchedulerTick } from './scheduler';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const boss = new PgBoss({ connectionString });
const OUTBOUND_MODE = (process.env.OUTBOUND_MODE || 'dry_run').toLowerCase();

type PlainObj = Record<string, unknown>;

function redact(value: string) {
  return value.replace(/(password|pass|auth)\s*[:=]\s*\S+/gi, '$1=***');
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

function classifyInbound(from: string, subject: string, body: string): 'bounce_hard' | 'bounce_soft' | 'reply' {
  const s = `${from} ${subject} ${body}`.toLowerCase();
  if (s.includes('mailer-daemon') || s.includes('delivery status notification') || s.includes('5.1.1') || s.includes('user unknown')) return 'bounce_hard';
  if (s.includes('mailbox full') || s.includes('temporary failure') || s.includes('4.')) return 'bounce_soft';
  return 'reply';
}

async function postWebhook(eventId: string) {
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  if (!WEBHOOK_URL) return;

  const event = await prisma.events.findUnique({ where: { id: eventId }, include: { lead: true } });
  if (!event) return;

  const payload = {
    event_type: event.type,
    event_id: event.id,
    created_at: event.created_at,
    lead_id: event.lead_id,
    email: event.lead?.email || null,
    campaign_id: event.campaign_id,
    enrollment_id: event.enrollment_id,
    ...(event.metadata as PlainObj)
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
  await boss.send('webhook-delivery', { eventId: event.id });
  return event;
}

async function syncAccount(account: any) {
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
      const classification = classifyInbound(sender, subject, preview);

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

      if (existingSent?.enrollment_id && existingSent.enrollment) {
        if (classification === 'reply') {
          await prisma.enrollments.update({ where: { id: existingSent.enrollment_id }, data: { status: 'replied' } });
          await createEvent({
            type: 'reply',
            lead_id: existingSent.enrollment.lead_id,
            campaign_id: existingSent.enrollment.campaign_id,
            enrollment_id: existingSent.enrollment.id,
            metadata: { thread_id: threadId, message_id_header: messageId }
          });
        }
        if (classification === 'bounce_hard' || classification === 'bounce_soft') {
          await prisma.enrollments.update({ where: { id: existingSent.enrollment_id }, data: { status: 'bounced' } });
          if (classification === 'bounce_hard') {
            const lead = await prisma.leads.findUnique({ where: { id: existingSent.enrollment.lead_id } });
            if (lead) {
              await prisma.suppression_list.create({ data: { email: lead.email, reason: 'bounce_hard', source_campaign_id: existingSent.enrollment.campaign_id } }).catch(() => undefined);
            }
          }
          await createEvent({
            type: classification,
            lead_id: existingSent.enrollment.lead_id,
            campaign_id: existingSent.enrollment.campaign_id,
            enrollment_id: existingSent.enrollment.id,
            metadata: { thread_id: threadId, message_id_header: messageId }
          });
        }
      }
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
        console.error(`[worker] imap sync failed account=${account.id}: ${redact(msg)}`);
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

  await boss.schedule('heartbeat-cron', '* * * * *', { ts: Date.now() });
  await boss.schedule('imap-sync-cron', '*/2 * * * *', { ts: Date.now() });
  await boss.schedule('scheduler-tick-cron', '* * * * *', { ts: Date.now() });

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
