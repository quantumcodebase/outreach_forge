import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: true, db: false }, { status: 503 });
  }
}
