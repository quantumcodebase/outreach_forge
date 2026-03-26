import { NextResponse } from 'next/server';
import { syncWlrProject } from '@/lib/server/wlr-bridge';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId || 'intakevault');
  const fullResync = body?.fullResync === true;
  const minEmailConfidence = body?.minEmailConfidence != null ? Number(body.minEmailConfidence) : undefined;
  const result = await syncWlrProject(projectId, { fullResync, minEmailConfidence });
  return NextResponse.json({ ok: true, ...result });
}
