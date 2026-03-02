import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function POST(req: Request) {
  const { messageId, threadId } = await req.json();
  await prisma.events.create({
    data: {
      type: 'open',
      metadata: { kind: 'read', message_id: messageId, thread_id: threadId, source: 'ui' }
    }
  });
  return NextResponse.json({ ok: true });
}
