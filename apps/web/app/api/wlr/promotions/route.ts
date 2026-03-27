import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = (searchParams.get('projectId') || 'intakevault').trim();
  const status = searchParams.get('status')?.trim() || null;
  const recipeId = searchParams.get('recipeId')?.trim() || null;

  const rows = await prisma.wlr_promotion_queue.findMany({
    where: {
      project_id: projectId,
      ...(status ? { promotion_status: status } : {}),
      ...(recipeId ? { recipe_id: recipeId } : {})
    },
    orderBy: [{ promoted_at: 'desc' }],
    take: 200,
  });

  const leadIds = rows.map((r) => r.lead_id);
  const recipeIds = [...new Set(rows.map((r) => r.recipe_id).filter(Boolean))] as string[];
  const qualificationIds = [...new Set(rows.map((r) => r.qualification_id).filter(Boolean))] as string[];

  const [leads, recipes, qualifications] = await Promise.all([
    leadIds.length ? prisma.leads.findMany({ where: { id: { in: leadIds } }, select: { id: true, email: true, company: true, title: true, custom_fields: true } }) : [],
    recipeIds.length ? prisma.wlr_search_recipes.findMany({ where: { id: { in: recipeIds } }, select: { id: true, name: true, offer_name: true, offer_type: true } }) : [],
    qualificationIds.length ? prisma.lead_qualification.findMany({ where: { id: { in: qualificationIds } } }) : [],
  ]);

  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const qualificationMap = new Map(qualifications.map((q) => [q.id, q]));

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      lead: leadMap.get(r.lead_id) || null,
      recipe: r.recipe_id ? recipeMap.get(r.recipe_id) || null : null,
      qualification: r.qualification_id ? qualificationMap.get(r.qualification_id) || null : null,
    }))
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const leadId = String(body?.leadId || '').trim();
  const projectId = String(body?.projectId || 'intakevault').trim();
  const recipeId = body?.recipeId ? String(body.recipeId).trim() : null;
  const qualificationId = body?.qualificationId ? String(body.qualificationId).trim() : null;
  const promotionStatus = String(body?.promotion_status || 'ready').trim();
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!leadId) {
    return NextResponse.json({ error: 'missing_lead_id' }, { status: 400 });
  }

  const validStatuses = new Set(['ready', 'staged', 'paused']);
  if (!validStatuses.has(promotionStatus)) {
    return NextResponse.json({ error: 'invalid_promotion_status' }, { status: 400 });
  }

  const [lead, recipe, qualification] = await Promise.all([
    prisma.leads.findUnique({ where: { id: leadId }, select: { id: true } }),
    recipeId ? prisma.wlr_search_recipes.findUnique({ where: { id: recipeId }, select: { id: true } }) : Promise.resolve(null),
    qualificationId ? prisma.lead_qualification.findUnique({ where: { id: qualificationId }, select: { id: true } }) : Promise.resolve(null),
  ]);

  if (!lead) {
    return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
  }
  if (recipeId && !recipe) {
    return NextResponse.json({ error: 'recipe_not_found' }, { status: 404 });
  }
  if (qualificationId && !qualification) {
    return NextResponse.json({ error: 'qualification_not_found' }, { status: 404 });
  }

  const item = await prisma.wlr_promotion_queue.upsert({
    where: { lead_id: leadId },
    create: {
      lead_id: leadId,
      project_id: projectId,
      recipe_id: recipeId,
      qualification_id: qualificationId,
      promotion_status: promotionStatus,
      notes,
      reviewed_at: new Date(),
    },
    update: {
      project_id: projectId,
      recipe_id: recipeId,
      qualification_id: qualificationId,
      promotion_status: promotionStatus,
      notes,
      reviewed_at: new Date(),
    }
  });

  return NextResponse.json({ ok: true, item });
}
