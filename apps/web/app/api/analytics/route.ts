import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET() {
  const [events, campaigns] = await Promise.all([
    prisma.events.groupBy({ by: ['type', 'campaign_id'], _count: { type: true } }),
    prisma.campaigns.findMany({ select: { id: true, name: true } })
  ]);

  const overall: Record<string, number> = {};
  for (const e of events) overall[e.type] = (overall[e.type] || 0) + e._count.type;

  const byCampaign: Record<string, Record<string, number>> = {};
  for (const e of events) {
    const key = e.campaign_id || 'none';
    byCampaign[key] = byCampaign[key] || {};
    byCampaign[key][e.type] = (byCampaign[key][e.type] || 0) + e._count.type;
  }

  const rows = campaigns.map((c) => {
    const m = byCampaign[c.id] || {};
    const sent = m.sent || 0;
    const reply = m.reply || 0;
    const bounce_hard = m.bounce_hard || 0;
    const unsubscribe = m.unsubscribe || 0;
    return {
      campaign_id: c.id,
      campaign_name: c.name,
      sent,
      reply,
      bounce_hard,
      bounce_soft: m.bounce_soft || 0,
      unsubscribe,
      reply_rate: sent ? Number(((reply / sent) * 100).toFixed(2)) : 0,
      bounce_rate: sent ? Number((((bounce_hard + (m.bounce_soft || 0)) / sent) * 100).toFixed(2)) : 0,
      unsub_rate: sent ? Number(((unsubscribe / sent) * 100).toFixed(2)) : 0
    };
  });

  return NextResponse.json({
    kpis: {
      sent: overall.sent || 0,
      reply: overall.reply || 0,
      bounce_hard: overall.bounce_hard || 0,
      bounce_soft: overall.bounce_soft || 0,
      unsubscribe: overall.unsubscribe || 0
    },
    campaigns: rows
  });
}
