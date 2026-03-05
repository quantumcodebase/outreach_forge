import { NextResponse } from 'next/server';
import { makeImapClient, makeSmtpTransport, redactError } from '@/lib/mail';

type StageResult = { ok: boolean; stage: string; error: string | null; hint: string | null };

function result(ok: boolean, stage: string, error: string | null, hint: string | null): StageResult {
  return { ok, stage, error, hint };
}

export async function POST(req: Request) {
  const body = await req.json();
  const conn = {
    imap_host: body.imap_host,
    imap_port: Number(body.imap_port),
    imap_user: body.imap_user,
    smtp_host: body.smtp_host,
    smtp_port: Number(body.smtp_port),
    smtp_user: body.smtp_user,
    password: String(body.password || '').trim()
  };

  let imap = result(false, 'connect', null, null);
  let smtp = result(false, 'smtp_auth', null, null);

  try {
    const client = makeImapClient(conn);
    await client.connect();
    imap = result(true, 'auth', null, null);
    try {
      await client.mailboxOpen('INBOX');
      imap = result(true, 'select', null, null);
    } catch (error) {
      imap = result(false, 'select', redactError(error), 'Authenticated but unable to select INBOX.');
    }
    await client.logout();
  } catch (error) {
    const msg = redactError(error);
    const stage = /ENOTFOUND|EAI_AGAIN/i.test(msg) ? 'dns' : /ECONNREFUSED|ETIMEDOUT/i.test(msg) ? 'connect' : /SSL|TLS/i.test(msg) ? 'tls' : 'auth';
    imap = result(false, stage, msg, 'Verify IMAP host/port, TLS, and credentials.');
  }

  try {
    const transport = makeSmtpTransport(conn);
    await transport.verify();
    smtp = result(true, 'smtp_auth', null, null);
  } catch (error) {
    const msg = redactError(error);
    const stage = /ENOTFOUND|EAI_AGAIN/i.test(msg)
      ? 'dns'
      : /ECONNREFUSED|ETIMEDOUT/i.test(msg)
        ? 'connect'
        : /SSL|TLS|STARTTLS/i.test(msg)
          ? 'tls'
          : 'smtp_auth';
    smtp = result(false, stage, msg, 'Verify SMTP host/port, STARTTLS, and credentials.');
  }

  return NextResponse.json({ imap, smtp });
}
