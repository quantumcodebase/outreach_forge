import { NextResponse } from 'next/server';
import { getRecipes, DEFAULT_PROJECT_ID } from '@/lib/server/wlr-recipes';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  const recipes = await getRecipes(projectId);

  const [syncStates, schedulerState] = await Promise.all([
    prisma.wlr_sync_state.findMany({ where: { project_id: projectId } }),
    prisma.wlr_scheduler_state.findUnique({ where: { project_id: projectId } })
  ]);
  const syncByRecipe = new Map(syncStates.map((s) => [s.recipe_id || '', s]));

  const merged = recipes.map((r) => ({
    ...r,
    sync_state: syncByRecipe.get(r.id) || null
  }));

  return NextResponse.json({ recipes: merged, schedulerState });
}
