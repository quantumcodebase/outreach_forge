import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET() {
  const leads = await prisma.leads.findMany({ orderBy: { created_at: 'desc' }, take: 200 });
  return NextResponse.json({ leads });
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
