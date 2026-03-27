import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function POST(req: Request, { params }: { params: Promise<{ id?: string }> }) {
  const body = await req.json().catch(() => ({}));
  const routeParams = await params;
  const id = routeParams?.id?.trim();

  if (!id) {
    return NextResponse.json({ error: 'missing_promotion_id' }, { status: 400 });
  }

  const promotionStatus = body?.promotion_status ? String(body.promotion_status).trim() : undefined;
  const notes = body?.notes === null ? null : body?.notes ? String(body.notes).trim() : undefined;
  const validStatuses = new Set(['ready', 'staged', 'paused']);

  if (promotionStatus && !validStatuses.has(promotionStatus)) {
    return NextResponse.json({ error: 'invalid_promotion_status' }, { status: 400 });
  }

  try {
    const updated = await prisma.wlr_promotion_queue.update({
      where: { id },
      data: {
        promotion_status: promotionStatus,
        notes,
        reviewed_at: new Date(),
      }
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'promotion_not_found' }, { status: 404 });
    }
    if (error?.name === 'PrismaClientValidationError') {
      return NextResponse.json({ error: 'invalid_promotion_id' }, { status: 400 });
    }
    throw error;
  }
}
