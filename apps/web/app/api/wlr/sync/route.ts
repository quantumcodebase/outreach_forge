import { NextResponse } from 'next/server';
import { syncWlrProject } from '@/lib/server/wlr-bridge';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId || 'intakevault');
  const result = await syncWlrProject(projectId);
  return NextResponse.json({ ok: true, ...result });
}
