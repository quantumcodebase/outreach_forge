import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { buildControllerPayload, dispatchControllerEvent } from '@/lib/server/controller-events';

export async function POST(req: Request) {
  const { messageId, threadId, label } = await req.json();
  const event = await prisma.events.create({
    data: {
      type: 'open',
      metadata: { kind: 'label', message_id: messageId, thread_id: threadId, label, source: 'ui' }
    }
  });

  if (String(label || '').toLowerCase() === 'interested') {
    await dispatchControllerEvent(
      buildControllerPayload({
        event_type: 'interested_label',
        event_id: event.id,
        thread_id: threadId || null
      })
    );
  }

  return NextResponse.json({ ok: true });
}
