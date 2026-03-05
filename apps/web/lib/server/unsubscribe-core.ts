import crypto from 'crypto';
import { buildControllerPayload, dispatchControllerEvent } from './controller-events';

export type UnsubPayload = {
  leadId?: string;
  campaignId?: string;
  enrollmentId?: string;
  email: string;
  issued_at: number;
  exp: number;
};

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

function getSecret() {
  return process.env.UNSUBSCRIBE_SIGNING_SECRET || 'dev-unsub-secret-change-me';
}

export function buildUnsubToken(payload: Omit<UnsubPayload, 'exp' | 'issued_at'> & { exp?: number; issued_at?: number }) {
  const body: UnsubPayload = {
    ...payload,
    issued_at: payload.issued_at ?? Math.floor(Date.now() / 1000),
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  };
  const encoded = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', getSecret()).update(encoded).digest());
  return `${encoded}.${sig}`;
}

export function verifyUnsubToken(token: string): UnsubPayload | null {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expected = b64url(crypto.createHmac('sha256', getSecret()).update(encoded).digest());
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const payload = JSON.parse(fromB64url(encoded).toString('utf8')) as UnsubPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function applyUnsubscribe({ token, prisma }: { token: string; prisma: any }) {
  const payload = verifyUnsubToken(token);
  if (!payload) return { ok: false as const, error: 'Invalid or expired unsubscribe link.' };

  await prisma.suppression_list
    .create({
      data: {
        email: payload.email,
        reason: 'unsubscribe',
        source_campaign_id: payload.campaignId
      }
    })
    .catch(() => undefined);

  await prisma.enrollments.updateMany({
    where: {
      ...(payload.leadId ? { lead_id: payload.leadId } : {}),
      ...(payload.campaignId ? { campaign_id: payload.campaignId } : {}),
      ...(payload.enrollmentId ? { id: payload.enrollmentId } : {}),
      status: 'active'
    },
    data: { status: 'unsubscribed' }
  });

  const lead = payload.leadId ? await prisma.leads.findUnique({ where: { id: payload.leadId } }) : null;

  const event = await prisma.events.create({
    data: {
      lead_id: payload.leadId || lead?.id || null,
      campaign_id: payload.campaignId || null,
      enrollment_id: payload.enrollmentId || null,
      type: 'unsubscribe',
      metadata: { source: 'unsubscribe_link', email: payload.email, token_issued_at: payload.issued_at }
    }
  });

  await dispatchControllerEvent(
    buildControllerPayload({
      event_type: 'unsubscribe',
      event_id: event.id,
      lead_email: payload.email,
      lead_id: payload.leadId || null,
      campaign_id: payload.campaignId || null,
      enrollment_id: payload.enrollmentId || null
    })
  );

  return {
    ok: true as const,
    email: payload.email,
    campaignId: payload.campaignId,
    enrollmentId: payload.enrollmentId,
    leadId: payload.leadId
  };
}
