import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_FOLLOWUP_STATUSES = new Set(['ready', 'queued', 'paused']);

export async function POST(req: Request, { params }: { params: Promise<{ id?: string }> }) {
  const body = await req.json().catch(() => ({}));
  const routeParams = await params;
  const id = routeParams?.id?.trim();

  if (!id) return NextResponse.json({ error: 'missing_followup_id' }, { status: 400 });
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid_followup_id' }, { status: 400 });

  const followupStatus = body?.followup_status ? String(body.followup_status).trim() : undefined;
  const notes = body?.notes === null ? null : body?.notes ? String(body.notes).trim() : undefined;

  if (followupStatus && !VALID_FOLLOWUP_STATUSES.has(followupStatus)) {
    return NextResponse.json({ error: 'invalid_followup_status' }, { status: 400 });
  }

  try {
    const item = await prisma.wlr_followup_queue.update({
      where: { id },
      data: {
        followup_status: followupStatus,
        notes,
        reviewed_at: new Date(),
      }
    });
    return NextResponse.json({ ok: true, item });
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ error: 'followup_not_found' }, { status: 404 });
    throw error;
  }
}
