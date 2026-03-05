import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { computeNextSendAt } from '@/lib/server/scheduling';

export async function POST(req: Request) {
  const body = await req.json();
  const campaignId = String(body.campaignId);
  const leadIds: string[] = body.leadIds || [];

  const campaign = await prisma.campaigns.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });

  let enrolled = 0;
  let skipped_existing = 0;
  let skipped_invalid = 0;

  for (const leadId of leadIds) {
    const lead = await prisma.leads.findUnique({ where: { id: leadId } });
    if (!lead || !lead.email) {
      skipped_invalid += 1;
      continue;
    }

    const exists = await prisma.enrollments.findUnique({ where: { lead_id_campaign_id: { lead_id: leadId, campaign_id: campaignId } } });
    if (exists) {
      skipped_existing += 1;
      continue;
    }

    await prisma.enrollments.create({
      data: {
        lead_id: leadId,
        campaign_id: campaignId,
        current_step: 1,
        status: 'active',
        next_send_at: computeNextSendAt(new Date(), 0, campaign.sending_window_start, campaign.sending_window_end)
      }
    });
    enrolled += 1;
  }

  return NextResponse.json({ ok: true, selected: leadIds.length, enrolled, skipped_existing, skipped_invalid });
}
