import { NextResponse } from 'next/server';
import { requireApiKey } from '../../../../../lib/api-key';
import { getAssistAdapter } from '../../../../../lib/integrations/assist';
import { persistAssistOutput } from '../../../../../lib/server/assist-events';

export async function POST(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  if (!body.campaignId) return NextResponse.json({ ok: false, error: 'campaignId required' }, { status: 400 });

  const output = await getAssistAdapter().diagnoseCampaign({ campaignId: String(body.campaignId) });
  await persistAssistOutput({ assist_type: 'campaign_diagnostics', campaign_id: String(body.campaignId), output });
  return NextResponse.json(output);
}
