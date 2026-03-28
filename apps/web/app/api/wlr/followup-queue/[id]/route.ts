import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function POST(req: Request, { params }: { params: Promise<{ id?: string }> }) {
  const body = await req.json().catch(() => ({}));
  const routeParams = await params;
  const id = routeParams?.id?.trim();

  if (!id) return NextResponse.json({ error: 'missing_followup_id' }, { status: 400 });

  const followupStatus = body?.followup_status ? String(body.followup_status).trim() : undefined;
  const notes = body?.notes === null ? null : body?.notes ? String(body.notes).trim() : undefined;
  const validStatuses = new Set(['ready', 'queued', 'paused']);

  if (followupStatus && !validStatuses.has(followupStatus)) {
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
    if (error?.name === 'PrismaClientValidationError') return NextResponse.json({ error: 'invalid_followup_id' }, { status: 400 });
    throw error;
  }
}
