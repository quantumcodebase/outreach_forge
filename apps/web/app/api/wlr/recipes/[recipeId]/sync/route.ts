import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { syncWlrProject } from '@/lib/server/wlr-bridge';

export async function POST(req: Request, { params }: { params: Promise<{ recipeId: string }> }) {
  const body = await req.json().catch(() => ({}));
  const { recipeId } = await params;
  const recipe = await prisma.wlr_search_recipes.findUnique({ where: { id: recipeId } });
  if (!recipe) return NextResponse.json({ error: 'recipe_not_found' }, { status: 404 });

  const fullResync = body?.fullResync === true;
  const result = await syncWlrProject(recipe.project_id, {
    fullResync,
    minEmailConfidence: recipe.confidence_threshold,
  });

  const skipped = Number(result.skippedNoEmail || 0) + Number(result.skippedLowConfidence || 0) + Number(result.skippedLowQualityEmail || 0);

  await prisma.wlr_sync_state.upsert({
    where: { project_id_recipe_id: { project_id: recipe.project_id, recipe_id: recipe.id } },
    create: {
      project_id: recipe.project_id,
      recipe_id: recipe.id,
      last_synced_run_id: result.latestSyncedRunId || null,
      last_synced_at: new Date(),
      last_created_count: Number(result.created || 0),
      last_updated_count: Number(result.updated || 0),
      last_skipped_count: skipped,
    },
    update: {
      last_synced_run_id: result.latestSyncedRunId || null,
      last_synced_at: new Date(),
      last_created_count: Number(result.created || 0),
      last_updated_count: Number(result.updated || 0),
      last_skipped_count: skipped,
    }
  });

  await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { last_sync_at: new Date() } });

  return NextResponse.json({ ok: true, recipeId: recipe.id, ...result });
}
