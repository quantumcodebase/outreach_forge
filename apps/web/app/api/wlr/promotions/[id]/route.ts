import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_PROMOTION_STATUSES = new Set(['ready', 'staged', 'paused']);
const VALID_ENROLLMENT_INTENTS = new Set(['none', 'campaign_ready', 'hold']);

export async function POST(req: Request, { params }: { params: Promise<{ id?: string }> }) {
  const body = await req.json().catch(() => ({}));
  const routeParams = await params;
  const id = routeParams?.id?.trim();

  if (!id) {
    return NextResponse.json({ error: 'missing_promotion_id' }, { status: 400 });
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_promotion_id' }, { status: 400 });
  }

  const promotionStatus = body?.promotion_status ? String(body.promotion_status).trim() : undefined;
  const enrollmentIntent = body?.enrollment_intent ? String(body.enrollment_intent).trim() : undefined;
  const notes = body?.notes === null ? null : body?.notes ? String(body.notes).trim() : undefined;

  if (promotionStatus && !VALID_PROMOTION_STATUSES.has(promotionStatus)) {
    return NextResponse.json({ error: 'invalid_promotion_status' }, { status: 400 });
  }
  if (enrollmentIntent && !VALID_ENROLLMENT_INTENTS.has(enrollmentIntent)) {
    return NextResponse.json({ error: 'invalid_enrollment_intent' }, { status: 400 });
  }

  try {
    const updated = await prisma.wlr_promotion_queue.update({
      where: { id },
      data: {
        promotion_status: promotionStatus,
        enrollment_intent: enrollmentIntent,
        notes,
        reviewed_at: new Date(),
      }
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'promotion_not_found' }, { status: 404 });
    }
    throw error;
  }
}
