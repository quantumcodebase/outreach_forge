import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { triggerWlrRun } from '@/lib/server/wlr-bridge';

export async function POST(_req: Request, { params }: { params: Promise<{ recipeId?: string }> }) {
  const routeParams = await params;
  const recipeId = routeParams?.recipeId?.trim();

  if (!recipeId) {
    return NextResponse.json({ error: 'missing_recipe_id' }, { status: 400 });
  }

  const recipe = await prisma.wlr_search_recipes.findUnique({ where: { id: recipeId } });
  if (!recipe) return NextResponse.json({ error: 'recipe_not_found' }, { status: 404 });

  const settings = (recipe.settings_json || {}) as Record<string, unknown>;
  const payload = {
    project_id: recipe.project_id,
    use_recommended_hunts: true,
    target_mode: String(settings.target_mode || 'underserved'),
    run_preset: String(settings.run_preset || 'fast'),
    include_contact_form_only: Boolean(settings.include_contact_form_only ?? true),
    min_email_confidence: recipe.confidence_threshold,
    campaign_id: String(settings.campaign_id || `${recipe.project_id}-${recipe.id.slice(0, 8)}`)
  };

  const run = await triggerWlrRun(payload);
  if (run?.ok) {
    try {
      await prisma.wlr_search_recipes.update({
        where: { id: recipeId },
        data: {
          last_run_at: new Date(),
          last_run_origin: 'manual',
          lifecycle_status: 'running_manual',
          pending_run_id: String(run?.run_id || ''),
          pending_run_started_at: new Date(),
          last_failure_at: null,
          last_failure_message: null,
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
  }

  return NextResponse.json({ ok: true, run, recipeId });
}
