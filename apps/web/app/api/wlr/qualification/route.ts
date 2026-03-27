import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = (searchParams.get('projectId') || 'intakevault').trim();
  const status = searchParams.get('status')?.trim() || null;
  const recipeId = searchParams.get('recipeId')?.trim() || null;
  const offerType = searchParams.get('offerType')?.trim() || null;
  const promotionStatus = searchParams.get('promotionStatus')?.trim() || null;

  const rows = await prisma.lead_qualification.findMany({
    where: {
      project_id: projectId,
      signal_scope: 'custom_lane',
      ...(status ? { qualification_status: status } : {}),
      ...(recipeId ? { recipe_id: recipeId } : {}),
    },
    orderBy: [{ total_score: 'desc' }, { updated_at: 'desc' }],
    take: 200
  });

  const leadIds = rows.map((r) => r.lead_id);
  const recipeIds = [...new Set(rows.map((r) => r.recipe_id).filter(Boolean))] as string[];
  const [leads, recipes, promotions] = await Promise.all([
    leadIds.length ? await prisma.leads.findMany({ where: { id: { in: leadIds } }, select: { id: true, email: true, company: true, title: true, custom_fields: true } }) : [],
    recipeIds.length ? await prisma.wlr_search_recipes.findMany({ where: { id: { in: recipeIds }, ...(offerType ? { offer_type: offerType } : {}) }, select: { id: true, name: true, offer_name: true, offer_type: true, workflow_label: true } }) : [],
    leadIds.length ? await prisma.wlr_promotion_queue.findMany({ where: { lead_id: { in: leadIds } } }) : [],
  ]);

  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const promotionMap = new Map(promotions.map((p) => [p.lead_id, p]));

  const items = rows
    .map((r) => ({
      ...r,
      recipe: r.recipe_id ? recipeMap.get(r.recipe_id) || null : null,
      lead: leadMap.get(r.lead_id) || null,
      promotion: promotionMap.get(r.lead_id) || null,
    }))
    .filter((item) => (offerType ? item.recipe?.offer_type === offerType : true))
    .filter((item) => (promotionStatus ? (item.promotion?.promotion_status || 'unpromoted') === promotionStatus : true));

  return NextResponse.json({ items });
}
