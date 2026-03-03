import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { encrypt } from '@cockpit/shared/src/crypto';

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isEncryptedPayloadValid(value: string) {
  if (!value || !BASE64_RE.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').length >= 28;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const accounts = await prisma.email_accounts.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        label: true,
        status: true,
        daily_cap: true,
        timezone: true,
        last_synced_at: true,
        smtp_user: true,
        imap_user: true,
        imap_host: true,
        imap_port: true,
        smtp_host: true,
        smtp_port: true
      }
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('[api/accounts][GET] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let encryptedPass: string;
    try {
      encryptedPass = encrypt(body.password || '');
    } catch (error) {
      console.error('[api/accounts][POST] credential encrypt failed', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ ok: false, error: 'credential encrypt failed' }, { status: 400 });
    }

    if (!isEncryptedPayloadValid(encryptedPass)) {
      console.error('[api/accounts][POST] credential encrypt failed invalid payload');
      return NextResponse.json({ ok: false, error: 'credential encrypt failed' }, { status: 400 });
    }

    const account = await prisma.email_accounts.create({
      data: {
        label: body.label,
        imap_host: body.imap_host,
        imap_port: Number(body.imap_port),
        imap_user: body.imap_user,
        smtp_host: body.smtp_host,
        smtp_port: Number(body.smtp_port),
        smtp_user: body.smtp_user,
        encrypted_pass: encryptedPass,
        daily_cap: Number(body.daily_cap ?? 50),
        sending_window_start: new Date(`1970-01-01T${body.sending_window_start ?? '08:00:00'}.000Z`),
        sending_window_end: new Date(`1970-01-01T${body.sending_window_end ?? '17:00:00'}.000Z`),
        timezone: body.timezone || 'UTC',
        status: 'active'
      }
    });

    return NextResponse.json({ ok: true, accountId: account.id });
  } catch (error) {
    console.error('[api/accounts][POST] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'Failed to create account' }, { status: 500 });
  }
}
