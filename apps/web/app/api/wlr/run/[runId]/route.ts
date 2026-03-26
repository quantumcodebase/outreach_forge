import { NextResponse } from 'next/server';
import { getWlrRun } from '@/lib/server/wlr-bridge';

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = await getWlrRun(runId);
  return NextResponse.json({ ok: true, run });
}
