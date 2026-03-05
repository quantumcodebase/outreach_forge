import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-key';
import { getAssistAdapter } from '@/lib/integrations/assist';
import { persistAssistOutput } from '@/lib/server/assist-events';

export async function POST(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  if (!body.leadId) return NextResponse.json({ ok: false, error: 'leadId required' }, { status: 400 });

  const output = await getAssistAdapter().analyzeLead({ leadId: String(body.leadId) });
  await persistAssistOutput({ assist_type: 'lead_brief', lead_id: String(body.leadId), output });
  return NextResponse.json(output);
}
