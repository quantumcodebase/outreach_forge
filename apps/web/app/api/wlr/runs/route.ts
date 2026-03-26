import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || 'intakevault';
  const limit = Math.max(1, Math.min(Number(searchParams.get('limit') || '20'), 100));
  const runs = await prisma.wlr_runs.findMany({
    where: { project_id: projectId },
    orderBy: { started_at: 'desc' },
    take: limit
  });
  const latestSynced = runs[0] || null;
  return NextResponse.json({ runs, latestSynced });
}
