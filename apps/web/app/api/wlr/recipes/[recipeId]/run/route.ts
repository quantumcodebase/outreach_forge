import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';
import { triggerWlrRun } from '@/lib/server/wlr-bridge';

export async function POST(_req: Request, { params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params;
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
    await prisma.wlr_search_recipes.update({ where: { id: recipe.id }, data: { last_run_at: new Date() } });
  }

  return NextResponse.json({ ok: true, run, recipeId: recipe.id });
}
