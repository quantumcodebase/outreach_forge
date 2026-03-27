import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { syncWlrProject } from '@/lib/server/wlr-bridge';

export async function POST(req: Request, { params }: { params: Promise<{ recipeId?: string }> }) {
  const body = await req.json().catch(() => ({}));
  const routeParams = await params;
  const recipeId = routeParams?.recipeId?.trim();

  if (!recipeId) {
    return NextResponse.json({ error: 'missing_recipe_id' }, { status: 400 });
  }

  const recipe = await prisma.wlr_search_recipes.findUnique({ where: { id: recipeId } });
  if (!recipe) return NextResponse.json({ error: 'recipe_not_found' }, { status: 404 });

  const fullResync = body?.fullResync === true;
  const result = await syncWlrProject(recipe.project_id, {
    fullResync,
    minEmailConfidence: recipe.confidence_threshold,
    recipeId: recipe.id,
    offerType: recipe.offer_type,
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

  try {
    await prisma.wlr_search_recipes.update({
      where: { id: recipeId },
      data: {
        last_sync_at: new Date(),
        lifecycle_status: 'synced_manual',
        pending_run_id: null,
        pending_run_started_at: null,
        last_synced_source_run_id: result.latestSyncedRunId || null,
        last_success_at: new Date(),
        last_failure_at: null,
        last_failure_message: null
      }
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'recipe_not_found' }, { status: 404 });
    }
    if (error?.name === 'PrismaClientValidationError') {
      return NextResponse.json({ error: 'invalid_recipe_id' }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, recipeId, ...result });
}
