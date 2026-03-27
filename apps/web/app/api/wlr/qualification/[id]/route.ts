import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function POST(req: Request, { params }: { params: Promise<{ id?: string }> }) {
  const body = await req.json().catch(() => ({}));
  const routeParams = await params;
  const id = routeParams?.id?.trim();

  if (!id) {
    return NextResponse.json({ error: 'missing_qualification_id' }, { status: 400 });
  }

  try {
    const updated = await prisma.lead_qualification.update({
      where: { id },
      data: {
        qualification_status: body?.qualification_status || undefined,
        rationale_notes: body?.rationale_notes || undefined,
      }
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'qualification_not_found' }, { status: 404 });
    }
    if (error?.name === 'PrismaClientValidationError') {
      return NextResponse.json({ error: 'invalid_qualification_id' }, { status: 400 });
    }
    throw error;
  }
}
