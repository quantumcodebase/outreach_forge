import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { requireApiKey } from '@/lib/api-key';

export async function POST(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const email = String(body.email || '').toLowerCase();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const lead = await prisma.leads.upsert({
    where: { email },
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
      email,
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

  return NextResponse.json({ ok: true, lead_id: lead.id, email: lead.email });
}
