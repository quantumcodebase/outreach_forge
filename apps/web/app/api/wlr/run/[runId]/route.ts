import { NextResponse } from 'next/server';
import { getWlrRun } from '@/lib/server/wlr-bridge';

export async function GET(_req: Request, { params }: { params: Promise<{ runId?: string }> }) {
  const routeParams = await params;
  const runId = routeParams?.runId?.trim();

  if (!runId) {
    return NextResponse.json({ error: 'missing_run_id' }, { status: 400 });
  }

  const run = await getWlrRun(runId);
  return NextResponse.json({ ok: true, run });
}
