import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();
  const allowed = new Set(['draft', 'active', 'paused', 'finished']);
  if (!allowed.has(body.status)) return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 });

  await prisma.campaigns.update({ where: { id }, data: { status: body.status } });
  return NextResponse.json({ ok: true });
}
