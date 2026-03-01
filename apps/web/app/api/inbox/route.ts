import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

function parseFromPreview(preview?: string | null) {
  if (!preview) return { from: 'unknown', preview: '' };
  const m = preview.match(/^\[from:\s([^\]]+)\]\s?(.*)$/s);
  if (!m) return { from: 'unknown', preview };
  return { from: m[1], preview: m[2] || '' };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const threadId = url.searchParams.get('threadId');

    if (threadId) {
      const messages = await prisma.messages.findMany({
        where: { thread_id: threadId },
        orderBy: [{ received_at: 'asc' }, { sent_at: 'asc' }]
      });
      return NextResponse.json({ messages });
    }

    const messages = await prisma.messages.findMany({
      where: { thread_id: { not: null } },
      include: { account: true },
      orderBy: [{ received_at: 'desc' }, { sent_at: 'desc' }]
    });

    const events = await prisma.events.findMany({ where: { type: 'open' }, orderBy: { created_at: 'desc' } });

    const readAtByThread = new Map<string, Date>();
    const labelByThread = new Map<string, string>();

    for (const e of events) {
      const md = e.metadata as Record<string, unknown>;
      const tid = String(md.thread_id ?? '');
      if (!tid) continue;
      if (md.kind === 'read' && !readAtByThread.has(tid)) readAtByThread.set(tid, e.created_at);
      if (md.kind === 'label' && !labelByThread.has(tid) && typeof md.label === 'string') labelByThread.set(tid, md.label);
    }

    const byThread = new Map<string, (typeof messages)[number]>();
    for (const m of messages) {
      if (!m.thread_id) continue;
      if (!byThread.has(m.thread_id)) byThread.set(m.thread_id, m);
    }

    const threads = [...byThread.entries()].map(([tid, m]) => {
      const ts = m.received_at || m.sent_at;
      const readAt = readAtByThread.get(tid);
      const unread = !!(ts && (!readAt || ts > readAt));
      const parsed = parseFromPreview(m.body_preview);
      return {
        threadId: tid,
        messageId: m.id,
        from: parsed.from,
        subject: m.subject || '(no subject)',
        preview: parsed.preview,
        account: m.account.label || m.account.smtp_user,
        received_at: m.received_at,
        unread,
        label: labelByThread.get(tid) || null
      };
    });

    return NextResponse.json({ threads });
  } catch (error) {
    console.error('[api/inbox][GET] failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to load inbox' }, { status: 500 });
  }
}
