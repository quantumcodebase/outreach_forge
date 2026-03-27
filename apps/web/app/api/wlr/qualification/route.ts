import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || 'intakevault';
  const status = searchParams.get('status');
  const rows = await prisma.lead_qualification.findMany({
    where: {
      project_id: projectId,
      signal_scope: 'custom_lane',
      ...(status ? { qualification_status: status } : {})
    },
    orderBy: [{ total_score: 'desc' }, { updated_at: 'desc' }],
    take: 200
  });

  const leadIds = rows.map((r) => r.lead_id);
  const leads = leadIds.length ? await prisma.leads.findMany({ where: { id: { in: leadIds } }, select: { id: true, email: true, company: true, custom_fields: true } }) : [];
  const leadMap = new Map(leads.map((l) => [l.id, l]));

  return NextResponse.json({
    items: rows.map((r) => ({ ...r, lead: leadMap.get(r.lead_id) || null }))
  });
}
