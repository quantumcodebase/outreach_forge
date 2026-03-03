import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').toLowerCase();
  const rows = await prisma.suppression_list.findMany({
    where: q ? { email: { contains: q } } : undefined,
    orderBy: { added_at: 'desc' },
    take: 200
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email || '').toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
  const reason = body.reason || 'manual';
  const row = await prisma.suppression_list.create({ data: { email, reason } });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  await prisma.suppression_list.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
