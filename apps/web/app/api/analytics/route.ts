import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET() {
  const [events, campaigns] = await Promise.all([
    prisma.events.groupBy({ by: ['type'], _count: { type: true } }),
    prisma.campaigns.findMany({ select: { id: true, name: true } })
  ]);

  const byType = Object.fromEntries(events.map((e) => [e.type, e._count.type]));

  const perCampaign = await Promise.all(
    campaigns.map(async (c) => {
      const grouped = await prisma.events.groupBy({ where: { campaign_id: c.id }, by: ['type'], _count: { type: true } });
      const m = Object.fromEntries(grouped.map((g) => [g.type, g._count.type]));
      return {
        campaign_id: c.id,
        campaign_name: c.name,
        sent: m.sent ?? 0,
        reply: m.reply ?? 0,
        bounce_hard: m.bounce_hard ?? 0,
        bounce_soft: m.bounce_soft ?? 0,
        unsubscribe: m.unsubscribe ?? 0
      };
    })
  );

  return NextResponse.json({
    kpis: {
      sent: byType.sent ?? 0,
      reply: byType.reply ?? 0,
      bounce_hard: byType.bounce_hard ?? 0,
      bounce_soft: byType.bounce_soft ?? 0,
      unsubscribe: byType.unsubscribe ?? 0
    },
    campaigns: perCampaign
  });
}
