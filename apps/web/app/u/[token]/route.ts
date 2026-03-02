import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { verifyUnsubscribe } from '../../../lib/unsubscribe';

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const payload = verifyUnsubscribe(token);
  if (!payload) return new NextResponse('Invalid or expired unsubscribe link.', { status: 400 });

  await prisma.suppression_list.create({
    data: {
      email: payload.email,
      reason: 'unsubscribe',
      source_campaign_id: payload.campaignId
    }
  }).catch(() => undefined);

  await prisma.enrollments.updateMany({
    where: { lead_id: payload.leadId, campaign_id: payload.campaignId, status: 'active' },
    data: { status: 'unsubscribed' }
  });

  await prisma.events.create({
    data: {
      lead_id: payload.leadId,
      campaign_id: payload.campaignId,
      type: 'unsubscribe',
      metadata: { source: 'unsubscribe_link' }
    }
  });

  return new NextResponse('<html><body style="font-family:sans-serif;padding:24px;background:#09090b;color:#fafafa"><h1>Unsubscribed</h1><p>You will not receive further campaign emails from this sender.</p></body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}
