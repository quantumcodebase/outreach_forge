import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { decrypt } from '@cockpit/shared/src/crypto';

const ALLOWED = new Set(['active', 'paused', 'error']);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const status = String(body.status || '').toLowerCase();

    if (!ALLOWED.has(status)) {
      return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 });
    }

    const account = await prisma.email_accounts.findUnique({
      where: { id },
      select: { id: true, label: true, status: true, encrypted_pass: true }
    });

    if (!account) {
      return NextResponse.json({ ok: false, error: 'account not found' }, { status: 404 });
    }

    if (status === 'active') {
      try {
        decrypt(account.encrypted_pass);
      } catch {
        return NextResponse.json({ ok: false, error: 'credentials invalid; update password first' }, { status: 400 });
      }
    }

    await prisma.email_accounts.update({ where: { id }, data: { status: status as any } });

    await prisma.events.create({
      data: {
        type: 'open',
        metadata: {
          stage: 'account_status_change',
          account_id: id,
          label: account.label,
          from_status: account.status,
          to_status: status
        } as any
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/accounts/:id/status][PATCH] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'failed to update status' }, { status: 500 });
  }
}
