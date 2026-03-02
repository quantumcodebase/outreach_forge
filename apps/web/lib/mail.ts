import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';

export type AccountConn = {
  imap_host: string;
  imap_port: number;
  imap_user: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  password: string;
};

export function makeImapClient(conn: AccountConn) {
  return new ImapFlow({
    host: conn.imap_host,
    port: conn.imap_port,
    secure: conn.imap_port === 993,
    auth: { user: conn.imap_user, pass: conn.password },
    logger: false
  });
}

export function makeSmtpTransport(conn: AccountConn) {
  return nodemailer.createTransport({
    host: conn.smtp_host,
    port: conn.smtp_port,
    secure: conn.smtp_port === 465,
    auth: { user: conn.smtp_user, pass: conn.password }
  });
}

export function deriveThreadId(messageId?: string | null, inReplyTo?: string | null, references?: string | null) {
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

export async function previewFromSource(source: Buffer): Promise<string> {
  const parsed = await simpleParser(source);
  const text = parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, ' ') : '');
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function redactError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.replace(/password\s*[:=]\s*\S+/gi, 'password=***');
}
