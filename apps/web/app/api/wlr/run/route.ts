import { NextResponse } from 'next/server';
import { triggerWlrRun } from '@/lib/server/wlr-bridge';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const payload = {
    project_id: String(body?.projectId || 'intakevault'),
    use_recommended_hunts: true,
    target_mode: String(body?.targetMode || 'underserved')
  };

  const run = await triggerWlrRun(payload);
  return NextResponse.json({ ok: true, run });
}
