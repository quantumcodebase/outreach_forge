import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { applyUnsubscribe } from '../../../lib/server/unsubscribe';

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await applyUnsubscribe({ token, prisma });
  if (!result.ok) return new NextResponse(result.error, { status: 400 });

  return new NextResponse('<html><body style="font-family:sans-serif;padding:24px;background:#09090b;color:#fafafa"><h1>Unsubscribed</h1><p>You will not receive further campaign emails from this sender.</p></body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}
