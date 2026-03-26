import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function POST(req: Request, { params }: { params: Promise<{ recipeId: string }> }) {
  const body = await req.json().catch(() => ({}));
  const { recipeId } = await params;
  const enabled = body?.enabled === true;

  const recipe = await prisma.wlr_search_recipes.update({
    where: { id: recipeId },
    data: {
      enabled,
      next_run_at: enabled ? new Date() : null,
      ...(enabled ? {} : { last_failure_message: null })
    }
  });

  return NextResponse.json({ ok: true, recipe: { id: recipe.id, enabled: recipe.enabled } });
}
