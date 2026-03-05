import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { requireApiKey } from '@/lib/api-key';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  await prisma.campaigns.update({ where: { id }, data: { status: 'active' } });
  return NextResponse.json({ ok: true, campaign_id: id, status: 'active' });
}
