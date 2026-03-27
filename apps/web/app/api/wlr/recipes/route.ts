import { NextResponse } from 'next/server';
import { getRecipes, DEFAULT_PROJECT_ID } from '@/lib/server/wlr-recipes';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  const recipes = await getRecipes(projectId);

  const pendingRunIds = recipes.map((r) => r.pending_run_id).filter(Boolean) as string[];
  const [syncStates, schedulerState, pendingRuns] = await Promise.all([
    prisma.wlr_sync_state.findMany({ where: { project_id: projectId } }),
    prisma.wlr_scheduler_state.findUnique({ where: { project_id: projectId } }),
    pendingRunIds.length ? prisma.wlr_runs.findMany({ where: { run_id: { in: pendingRunIds } }, select: { run_id: true, status: true, started_at: true, ended_at: true, error: true, last_synced_at: true } }) : []
  ]);
  const syncByRecipe = new Map(syncStates.map((s) => [s.recipe_id || '', s]));
  const pendingRunMap = new Map(pendingRuns.map((r) => [r.run_id, r]));

  const merged = recipes.map((r) => ({
    ...r,
    sync_state: syncByRecipe.get(r.id) || null,
    pending_run_status: r.pending_run_id ? pendingRunMap.get(r.pending_run_id) || null : null,
  }));

  return NextResponse.json({ recipes: merged, schedulerState });
}
