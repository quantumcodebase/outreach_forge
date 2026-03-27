import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function POST(req: Request, { params }: { params: Promise<{ recipeId?: string }> }) {
  const body = await req.json().catch(() => ({}));
  const routeParams = await params;
  const recipeId = routeParams?.recipeId?.trim();
  const enabled = body?.enabled === true;

  if (!recipeId) {
    return NextResponse.json({ error: 'missing_recipe_id' }, { status: 400 });
  }

  try {
    const recipe = await prisma.wlr_search_recipes.update({
      where: { id: recipeId },
      data: {
        enabled,
        next_run_at: enabled ? new Date() : null,
        ...(enabled ? {} : { last_failure_message: null })
      }
    });

    return NextResponse.json({ ok: true, recipe: { id: recipe.id, enabled: recipe.enabled } });
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
