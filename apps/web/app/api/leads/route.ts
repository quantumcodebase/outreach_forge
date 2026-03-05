import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').toLowerCase();
  const source = searchParams.get('source') || 'all';

  const leads = await prisma.leads.findMany({ orderBy: { created_at: 'desc' }, take: 300 });

  const filtered = leads.filter((lead) => {
    const byText = q
      ? `${lead.email} ${lead.first_name || ''} ${lead.company || ''} ${(lead.tags || []).join(' ')}`.toLowerCase().includes(q)
      : true;
    const bySource = source === 'wlr' ? (lead.tags || []).includes('source:wlr') : true;
    return byText && bySource;
  });

  return NextResponse.json({ leads: filtered });
}

export async function POST(req: Request) {
  const body = await req.json();
  const lead = await prisma.leads.upsert({
    where: { email: String(body.email).toLowerCase() },
    update: {
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      company: body.company ?? null,
      title: body.title ?? null,
      city: body.city ?? null,
      tags: body.tags ?? [],
      custom_fields: body.custom_fields ?? {},
      status: body.status ?? 'active'
    },
    create: {
      email: String(body.email).toLowerCase(),
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      company: body.company ?? null,
      title: body.title ?? null,
      city: body.city ?? null,
      tags: body.tags ?? [],
      custom_fields: body.custom_fields ?? {},
      status: body.status ?? 'active'
    }
  });
  return NextResponse.json({ ok: true, lead });
}
