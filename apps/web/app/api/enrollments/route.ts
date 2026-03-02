import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { computeNextSendAt } from '../../../lib/server/scheduling';

export async function POST(req: Request) {
  const body = await req.json();
  const campaignId = String(body.campaignId);
  const leadIds: string[] = body.leadIds || [];

  const created = [] as string[];
  const campaign = await prisma.campaigns.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });

  for (const leadId of leadIds) {
    const exists = await prisma.enrollments.findUnique({ where: { lead_id_campaign_id: { lead_id: leadId, campaign_id: campaignId } } });
    if (exists) continue;
    const enrollment = await prisma.enrollments.create({
      data: {
        lead_id: leadId,
        campaign_id: campaignId,
        current_step: 1,
        status: 'active',
        next_send_at: computeNextSendAt(new Date(), 0, campaign.sending_window_start, campaign.sending_window_end)
      }
    });
    created.push(enrollment.id);
  }

  return NextResponse.json({ ok: true, createdCount: created.length, ids: created });
}
