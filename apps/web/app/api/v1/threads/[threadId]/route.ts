import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { requireApiKey } from '../../../../../lib/api-key';

export async function GET(req: Request, context: { params: Promise<{ threadId: string }> }) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  const { threadId } = await context.params;

  const messages = await prisma.messages.findMany({ where: { thread_id: threadId }, orderBy: [{ received_at: 'asc' }, { sent_at: 'asc' }] });
  return NextResponse.json({ thread_id: threadId, messages });
}
