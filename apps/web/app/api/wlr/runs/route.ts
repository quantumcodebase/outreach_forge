import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || 'intakevault';
  const runs = await prisma.wlr_runs.findMany({
    where: { project_id: projectId },
    orderBy: { started_at: 'desc' },
    take: 20
  });
  return NextResponse.json({ runs });
}
