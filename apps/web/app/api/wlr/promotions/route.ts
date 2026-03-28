import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_PROMOTION_STATUSES = new Set(['ready', 'staged', 'paused']);
const VALID_ENROLLMENT_INTENTS = new Set(['none', 'campaign_ready', 'hold']);

function isUuid(value: string) {
  return UUID_RE.test(value);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = (searchParams.get('projectId') || 'intakevault').trim();
  const status = searchParams.get('status')?.trim() || null;
  const recipeId = searchParams.get('recipeId')?.trim() || null;
  const enrollmentIntent = searchParams.get('enrollmentIntent')?.trim() || null;

  if (recipeId && !isUuid(recipeId)) {
    return NextResponse.json({ error: 'invalid_recipe_id' }, { status: 400 });
  }
  if (enrollmentIntent && !VALID_ENROLLMENT_INTENTS.has(enrollmentIntent)) {
    return NextResponse.json({ error: 'invalid_enrollment_intent' }, { status: 400 });
  }

  const rows = await prisma.wlr_promotion_queue.findMany({
    where: {
      project_id: projectId,
      ...(status ? { promotion_status: status } : {}),
      ...(recipeId ? { recipe_id: recipeId } : {}),
      ...(enrollmentIntent ? { enrollment_intent: enrollmentIntent } : {}),
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
  const enrollmentIntent = String(body?.enrollment_intent || 'none').trim();
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!leadId) {
    return NextResponse.json({ error: 'missing_lead_id' }, { status: 400 });
  }
  if (!isUuid(leadId)) {
    return NextResponse.json({ error: 'invalid_lead_id' }, { status: 400 });
  }
  if (recipeId && !isUuid(recipeId)) {
    return NextResponse.json({ error: 'invalid_recipe_id' }, { status: 400 });
  }
  if (qualificationId && !isUuid(qualificationId)) {
    return NextResponse.json({ error: 'invalid_qualification_id' }, { status: 400 });
  }

  if (!VALID_PROMOTION_STATUSES.has(promotionStatus)) {
    return NextResponse.json({ error: 'invalid_promotion_status' }, { status: 400 });
  }
  if (!VALID_ENROLLMENT_INTENTS.has(enrollmentIntent)) {
    return NextResponse.json({ error: 'invalid_enrollment_intent' }, { status: 400 });
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
      enrollment_intent: enrollmentIntent,
      notes,
      reviewed_at: new Date(),
    },
    update: {
      project_id: projectId,
      recipe_id: recipeId,
      qualification_id: qualificationId,
      promotion_status: promotionStatus,
      enrollment_intent: enrollmentIntent,
      notes,
      reviewed_at: new Date(),
    }
  });

  return NextResponse.json({ ok: true, item });
}
