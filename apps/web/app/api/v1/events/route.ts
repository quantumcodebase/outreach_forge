import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { requireApiKey } from '../../../../lib/api-key';

export async function GET(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || undefined;

  const events = await prisma.events.findMany({ where: { type: type as any }, orderBy: { created_at: 'desc' }, take: 200 });
  return NextResponse.json({ events });
}
