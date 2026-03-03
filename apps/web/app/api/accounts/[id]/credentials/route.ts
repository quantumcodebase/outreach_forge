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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const password = String(body.password || '').trim();

    if (!password) {
      return NextResponse.json({ ok: false, error: 'password is required' }, { status: 400 });
    }

    let encryptedPass: string;
    try {
      encryptedPass = encrypt(password);
    } catch (error) {
      console.error('[api/accounts/:id/credentials][PATCH] encrypt failed', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ ok: false, error: 'credential encrypt failed' }, { status: 400 });
    }

    if (!isEncryptedPayloadValid(encryptedPass)) {
      return NextResponse.json({ ok: false, error: 'credential encrypt failed' }, { status: 400 });
    }

    const existing = await prisma.email_accounts.findUnique({ where: { id }, select: { status: true, label: true } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'account not found' }, { status: 404 });
    }

    await prisma.email_accounts.update({
      where: { id },
      data: { encrypted_pass: encryptedPass, status: 'paused' }
    });

    await prisma.events.create({
      data: {
        type: 'open',
        metadata: {
          stage: 'credentials_update',
          account_id: id,
          label: existing.label,
          from_status: existing.status,
          to_status: 'paused'
        } as any
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/accounts/:id/credentials][PATCH] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'failed to update credentials' }, { status: 500 });
  }
}
