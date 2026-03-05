import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { computeNextSendAt } from '@/lib/server/scheduling';
import { requireApiKey } from '@/lib/api-key';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  const body = await req.json();
  const leadIds: string[] = body.lead_ids || [];
  const emails: string[] = body.emails || (body.email ? [body.email] : []);
  let created = 0;
  const campaign = await prisma.campaigns.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });

  const resolvedLeadIds = [...leadIds];
  for (const email of emails) {
    const lead = await prisma.leads.upsert({
      where: { email: String(email).toLowerCase() },
      update: {},
      create: { email: String(email).toLowerCase(), tags: [], custom_fields: {}, status: 'active' }
    });
    resolvedLeadIds.push(lead.id);
  }

  for (const leadId of resolvedLeadIds) {
    const exists = await prisma.enrollments.findUnique({ where: { lead_id_campaign_id: { lead_id: leadId, campaign_id: id } } });
    if (exists) continue;
    await prisma.enrollments.create({
      data: { lead_id: leadId, campaign_id: id, current_step: 1, status: 'active', next_send_at: computeNextSendAt(new Date(), 0, campaign.sending_window_start, campaign.sending_window_end) }
    });
    created++;
  }

  return NextResponse.json({ ok: true, campaign_id: id, created });
}
