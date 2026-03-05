import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { requireApiKey } from '@/lib/api-key';

export async function GET(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  const messages = await prisma.messages.findMany({
    where: { thread_id: { not: null } },
    include: { account: true },
    orderBy: [{ received_at: 'desc' }, { sent_at: 'desc' }]
  });

  const seen = new Set<string>();
  const threads = [] as Array<{ thread_id: string; subject: string; preview: string; account: string; timestamp: string | null }>;
  for (const m of messages) {
    if (!m.thread_id || seen.has(m.thread_id)) continue;
    seen.add(m.thread_id);
    threads.push({
      thread_id: m.thread_id,
      subject: m.subject || '(no subject)',
      preview: m.body_preview || '',
      account: m.account.label,
      timestamp: (m.received_at || m.sent_at)?.toISOString() ?? null
    });
  }

  return NextResponse.json({ threads });
}
