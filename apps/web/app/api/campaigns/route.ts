import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET() {
  const campaigns = await prisma.campaigns.findMany({
    include: { from_account: true, steps: true, _count: { select: { enrollments: true } } },
    orderBy: { created_at: 'desc' }
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const body = await req.json();
  const campaign = await prisma.campaigns.create({
    data: {
      name: body.name,
      from_account_id: body.from_account_id,
      daily_cap: Number(body.daily_cap ?? 50),
      sending_window_start: new Date(`1970-01-01T${body.sending_window_start ?? '08:00:00'}.000Z`),
      sending_window_end: new Date(`1970-01-01T${body.sending_window_end ?? '17:00:00'}.000Z`),
      timezone: body.timezone || 'America/Puerto_Rico',
      status: body.status || 'draft'
    }
  });
  return NextResponse.json({ ok: true, campaign });
}
