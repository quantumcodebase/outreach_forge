import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/api-key';
import { warmLeadRadarAdapter, type WarmLeadRadarPayload } from '@/lib/integrations/lead-sources';
import { importWlrPayload } from '@/lib/server/wlr-import';

export async function POST(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  const payload = (await req.json()) as WarmLeadRadarPayload;
  const valid = warmLeadRadarAdapter.validatePayload(payload);
  if (!valid.ok) return NextResponse.json({ ok: false, error: valid.error }, { status: 400 });

  const counts = await importWlrPayload(payload);
  return NextResponse.json({ ok: true, source: warmLeadRadarAdapter.sourceName(), ...counts });
}
