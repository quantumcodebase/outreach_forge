import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-key';
import { getAssistAdapter } from '@/lib/integrations/assist';
import { persistAssistOutput } from '@/lib/server/assist-events';

export async function POST(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  if (!body.threadId) return NextResponse.json({ ok: false, error: 'threadId required' }, { status: 400 });

  const output = await getAssistAdapter().analyzeThread({ threadId: String(body.threadId) });
  await persistAssistOutput({ assist_type: 'thread_analysis', thread_id: String(body.threadId), output });
  return NextResponse.json(output);
}
