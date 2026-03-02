import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function POST(req: Request) {
  const { messageId, threadId, label } = await req.json();
  await prisma.events.create({
    data: {
      type: 'open',
      metadata: { kind: 'label', message_id: messageId, thread_id: threadId, label, source: 'ui' }
    }
  });
  return NextResponse.json({ ok: true });
}
