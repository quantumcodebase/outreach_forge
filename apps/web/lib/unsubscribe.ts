import crypto from 'crypto';

export type UnsubPayload = {
  leadId: string;
  campaignId: string;
  email: string;
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

export function signUnsubscribe(payload: Omit<UnsubPayload, 'exp'> & { exp?: number }) {
  const secret = process.env.UNSUBSCRIBE_SIGNING_SECRET || 'dev-unsub-secret-change-me';
  const body: UnsubPayload = {
    ...payload,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  };
  const encoded = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', secret).update(encoded).digest());
  return `${encoded}.${sig}`;
}

export function verifyUnsubscribe(token: string): UnsubPayload | null {
  const secret = process.env.UNSUBSCRIBE_SIGNING_SECRET || 'dev-unsub-secret-change-me';
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expected = b64url(crypto.createHmac('sha256', secret).update(encoded).digest());
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(fromB64url(encoded).toString('utf8')) as UnsubPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
