import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { encrypt } from '@cockpit/shared/src/crypto';

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
        smtp_user: true
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

    const account = await prisma.email_accounts.create({
      data: {
        label: body.label,
        imap_host: body.imap_host,
        imap_port: Number(body.imap_port),
        imap_user: body.imap_user,
        smtp_host: body.smtp_host,
        smtp_port: Number(body.smtp_port),
        smtp_user: body.smtp_user,
        encrypted_pass: encrypt(body.password),
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
