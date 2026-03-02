import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const steps = await prisma.steps.findMany({ where: { campaign_id: id }, orderBy: { step_number: 'asc' } });
  return NextResponse.json({ steps });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();
  const step = await prisma.steps.upsert({
    where: { campaign_id_step_number: { campaign_id: id, step_number: Number(body.step_number) } },
    update: {
      subject_template: body.subject_template,
      body_template: body.body_template,
      delay_days: Number(body.delay_days ?? 0)
    },
    create: {
      campaign_id: id,
      step_number: Number(body.step_number),
      subject_template: body.subject_template,
      body_template: body.body_template,
      delay_days: Number(body.delay_days ?? 0)
    }
  });
  return NextResponse.json({ ok: true, step });
}
