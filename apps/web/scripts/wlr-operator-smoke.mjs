const base = process.env.WLR_BASE_URL || 'http://127.0.0.1:3001';
const projectId = process.env.WLR_PROJECT_ID || 'intakevault';

async function json(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { res, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const recipes = await json(`${base}/api/wlr/recipes?projectId=${projectId}`);
assert(recipes.res.ok, 'recipes route failed');
assert(Array.isArray(recipes.data.recipes), 'recipes payload missing recipes');
assert(recipes.data.recipes.some((r) => 'pending_run_status' in r), 'pending_run_status missing from recipe payload');

const qualifications = await json(`${base}/api/wlr/qualification?projectId=${projectId}`);
assert(qualifications.res.ok, 'qualification route failed');
assert(Array.isArray(qualifications.data.items), 'qualification payload missing items');

const promotions = await json(`${base}/api/wlr/promotions?projectId=${projectId}`);
assert(promotions.res.ok, 'promotions route failed');
assert(Array.isArray(promotions.data.items), 'promotions payload missing items');

const followups = await json(`${base}/api/wlr/followup-queue?projectId=${projectId}`);
assert(followups.res.ok, 'followup queue route failed');
assert(Array.isArray(followups.data.items), 'followup queue payload missing items');

const badPromotion = await json(`${base}/api/wlr/promotions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ projectId })
});
assert(badPromotion.res.status === 400, 'promotion route should reject missing lead id');
assert(badPromotion.data?.error === 'missing_lead_id', 'promotion route wrong missing lead id error');

const badFollowup = await json(`${base}/api/wlr/followup-queue`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ leadId: 'dec60559-b141-445e-aba8-29afd9fd3838', projectId })
});
assert(badFollowup.res.status === 400, 'followup route should reject missing promotion id');
assert(badFollowup.data?.error === 'missing_promotion_id', 'followup route wrong missing promotion error');

const readyQualificationSlice = await json(`${base}/api/wlr/qualification?projectId=${projectId}&promotionStatus=ready`);
assert(readyQualificationSlice.res.ok, 'ready qualification slice failed');
assert(Array.isArray(readyQualificationSlice.data.items), 'ready qualification slice missing items');

console.log(JSON.stringify({
  ok: true,
  recipes: recipes.data.recipes.length,
  qualifications: qualifications.data.items.length,
  promotions: promotions.data.items.length,
  followups: followups.data.items.length,
  readyQualificationSlice: readyQualificationSlice.data.items.length,
}, null, 2));
