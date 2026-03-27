'use client';

import { useEffect, useMemo, useState } from 'react';

type RunRow = {
  run_id: string;
  project_id: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  discovered: number | null;
  enriched: number | null;
  deduped: number | null;
  last_synced_at: string;
};

type PendingRunStatus = {
  run_id: string;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  error: string | null;
  last_synced_at: string | null;
};

type RecipeRow = {
  id: string;
  project_id: string;
  name: string;
  offer_name: string;
  offer_type: string;
  icp_label: string;
  workflow_label: string;
  geography_label: string;
  cadence_type: string;
  enabled: boolean;
  confidence_threshold: number;
  lead_cap: number;
  last_run_at: string | null;
  last_sync_at: string | null;
  settings_json: Record<string, unknown>;
  next_run_at: string | null;
  lifecycle_status: string | null;
  pending_run_id: string | null;
  pending_run_status?: PendingRunStatus | null;
  last_synced_source_run_id?: string | null;
  last_run_origin: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_message: string | null;
  sync_state?: {
    last_synced_run_id: string | null;
    last_synced_at: string | null;
    last_created_count: number;
    last_updated_count: number;
    last_skipped_count: number;
  } | null;
};

type QualificationRow = {
  id: string;
  lead_id: string;
  recipe_id: string | null;
  qualification_status: 'pursue' | 'nurture' | 'skip';
  total_score: number;
  pain_signal: string | null;
  change_signal: string | null;
  buildability_fit: string | null;
  stakeholder_label: string | null;
  proposed_wedge: string | null;
  rationale_notes: string | null;
  recipe?: { id: string; name: string; offer_name: string; offer_type: string; workflow_label: string } | null;
  lead?: { id: string; email: string; company: string | null; title?: string | null } | null;
  promotion?: { id: string; promotion_status: 'ready' | 'staged' | 'paused'; promoted_at: string; notes: string | null } | null;
};

type PromotionRow = {
  id: string;
  lead_id: string;
  recipe_id: string | null;
  qualification_id: string | null;
  promotion_status: 'ready' | 'staged' | 'paused';
  destination_type: string;
  promoted_at: string;
  notes: string | null;
  lead?: { id: string; email: string; company: string | null; title?: string | null } | null;
  recipe?: { id: string; name: string; offer_name: string; offer_type: string } | null;
  qualification?: QualificationRow | null;
};

function lifecycleLabel(recipe: RecipeRow) {
  const origin = recipe.last_run_origin ? ` · ${recipe.last_run_origin}` : '';
  switch (recipe.lifecycle_status) {
    case 'running_manual':
    case 'running_scheduled':
      return `running${origin}`;
    case 'awaiting_completion':
      return `awaiting completion${origin}`;
    case 'awaiting_sync':
      return `awaiting sync${origin}`;
    case 'synced_manual':
    case 'synced_scheduled':
      return `synced${origin}`;
    case 'run_failed':
      return `failed${origin}`;
    case 'already_synced':
      return `already synced${origin}`;
    case 'waiting_window':
      return 'waiting window';
    case 'waiting_weekday':
      return 'waiting weekday';
    case 'staggered':
      return 'staggered';
    default:
      return recipe.enabled ? (recipe.cadence_type === 'manual' ? 'manual standby' : 'scheduled standby') : 'idle';
  }
}

function healthTone(recipe: RecipeRow) {
  if (recipe.last_failure_at || recipe.lifecycle_status === 'run_failed') return 'text-rose-400';
  if (recipe.pending_run_id) return 'text-amber-300';
  if (recipe.last_sync_at || recipe.lifecycle_status?.startsWith('synced')) return 'text-emerald-400';
  return 'text-zinc-300';
}

export default function WlrRunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [schedulerState, setSchedulerState] = useState<any>(null);
  const [status, setStatus] = useState<string>('');
  const [qualifications, setQualifications] = useState<QualificationRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [projectId, setProjectId] = useState('intakevault');
  const [qualificationStatusFilter, setQualificationStatusFilter] = useState('all');
  const [recipeFilter, setRecipeFilter] = useState('all');
  const [promotionFilter, setPromotionFilter] = useState('all');

  async function load() {
    const qs = new URLSearchParams({ projectId });
    const qualQs = new URLSearchParams({ projectId });
    if (qualificationStatusFilter !== 'all') qualQs.set('status', qualificationStatusFilter);
    if (recipeFilter !== 'all') qualQs.set('recipeId', recipeFilter);
    if (promotionFilter !== 'all') qualQs.set('promotionStatus', promotionFilter);

    const promoQs = new URLSearchParams({ projectId });
    if (recipeFilter !== 'all') promoQs.set('recipeId', recipeFilter);
    if (promotionFilter !== 'all') promoQs.set('status', promotionFilter);

    const [runsRes, recipesRes, summaryRes, qualRes, promoRes] = await Promise.all([
      fetch(`/api/wlr/runs?${qs.toString()}&limit=20`).then((r) => r.json()),
      fetch(`/api/wlr/recipes?${qs.toString()}`).then((r) => r.json()),
      fetch(`/api/wlr/summary?${qs.toString()}`).then((r) => r.json()),
      fetch(`/api/wlr/qualification?${qualQs.toString()}`).then((r) => r.json()).catch(() => ({ items: [] })),
      fetch(`/api/wlr/promotions?${promoQs.toString()}`).then((r) => r.json()).catch(() => ({ items: [] })),
    ]);
    setRuns(runsRes.runs || []);
    setRecipes(recipesRes.recipes || []);
    setSummary(summaryRes || null);
    setSchedulerState(recipesRes.schedulerState || summaryRes?.scheduler || null);
    setQualifications(qualRes.items || []);
    setPromotions(promoRes.items || []);
  }

  async function runNow(recipe: RecipeRow) {
    setStatus(`Running ${recipe.name}…`);
    const res = await fetch(`/api/wlr/recipes/${recipe.id}/run`, { method: 'POST' });
    const data = await res.json();
    setStatus(`Run started for ${recipe.name}: ${data.run?.run_id || 'unknown run id'}`);
    await load();
  }

  async function syncNow(recipe: RecipeRow) {
    setStatus(`Syncing ${recipe.name}…`);
    const res = await fetch(`/api/wlr/recipes/${recipe.id}/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fullResync: false })
    });
    const data = await res.json();
    setStatus(`Sync complete for ${recipe.name}: created ${data.created}, updated ${data.updated}`);
    await load();
  }

  async function toggleEnabled(recipe: RecipeRow) {
    const enabled = !recipe.enabled;
    setStatus(`${enabled ? 'Enabling' : 'Disabling'} ${recipe.name}…`);
    await fetch(`/api/wlr/recipes/${recipe.id}/toggle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    await load();
  }

  async function setQualification(id: string, qualification_status: 'pursue' | 'nurture' | 'skip') {
    await fetch(`/api/wlr/qualification/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qualification_status })
    });
    await load();
  }

  async function promoteLead(q: QualificationRow, promotion_status: 'ready' | 'staged' | 'paused') {
    const existing = q.promotion?.id;
    const url = existing ? `/api/wlr/promotions/${existing}` : '/api/wlr/promotions';
    const body = existing
      ? { promotion_status }
      : { leadId: q.lead_id, projectId, recipeId: q.recipe_id, qualificationId: q.id, promotion_status };

    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    await load();
  }

  useEffect(() => {
    load();
  }, [projectId, qualificationStatusFilter, recipeFilter, promotionFilter]);

  const latestSync = recipes
    .map((r) => r.sync_state?.last_synced_at || r.last_sync_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const recipeOptions = useMemo(() => recipes.filter((r) => r.offer_type === 'custom'), [recipes]);

  return (
    <div className="space-y-4">
      <section className="panel p-4 space-y-3">
        <h2 className="text-xl">WLR Recipe Control Panel</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input className="control w-56" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          <button className="btn px-2 py-1" onClick={load}>Refresh board</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-sm">
          <div className="panel-subtle p-2">Recipes: <b>{summary?.totalRecipes ?? recipes.length}</b></div>
          <div className="panel-subtle p-2">Active: <b>{summary?.activeRecipes ?? recipes.filter((r) => r.enabled).length}</b></div>
          <div className="panel-subtle p-2">Auto-scheduled: <b>{summary?.activeScheduledRecipes ?? 0}</b></div>
          <div className="panel-subtle p-2">Runs (24h): <b>{summary?.runsRecent ?? 0}</b></div>
          <div className="panel-subtle p-2">Last sync: <b>{summary?.lastSyncAt || latestSync || '—'}</b></div>
          <div className="panel-subtle p-2">Promotion queue: <b>{promotions.length}</b></div>
        </div>
        <div className="text-xs text-zinc-500">Scheduler timezone: America/Puerto_Rico. Last tick: {schedulerState?.last_tick_at || schedulerState?.lastTickAt || '—'} {schedulerState?.last_tick_ok === false || schedulerState?.ok === false ? `• error: ${schedulerState?.last_error || schedulerState?.lastError}` : ''}</div>
        {status ? <p className="text-sm text-zinc-400">{status}</p> : null}
      </section>

      <section className="panel p-0 overflow-auto">
        <table className="w-full min-w-[1800px] text-sm">
          <thead className="border-b border-white/10 text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">Recipe</th>
              <th className="px-3 py-2 text-left">Offer</th>
              <th className="px-3 py-2 text-left">ICP</th>
              <th className="px-3 py-2 text-left">Workflow</th>
              <th className="px-3 py-2 text-left">Geo</th>
              <th className="px-3 py-2 text-left">Cadence</th>
              <th className="px-3 py-2 text-left">Enabled</th>
              <th className="px-3 py-2 text-left">Lifecycle</th>
              <th className="px-3 py-2 text-left">Pending health</th>
              <th className="px-3 py-2 text-left">Threshold</th>
              <th className="px-3 py-2 text-left">Cap</th>
              <th className="px-3 py-2 text-left">Next run (UTC)</th>
              <th className="px-3 py-2 text-left">Last run</th>
              <th className="px-3 py-2 text-left">Last sync</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe) => (
              <tr key={recipe.id} className="border-b border-white/5 align-top">
                <td className="px-3 py-2 font-medium">{recipe.name}</td>
                <td className="px-3 py-2">{recipe.offer_name}<div className="text-xs text-zinc-500">{recipe.offer_type}</div></td>
                <td className="px-3 py-2">{recipe.icp_label}</td>
                <td className="px-3 py-2">{recipe.workflow_label}</td>
                <td className="px-3 py-2">{recipe.geography_label}</td>
                <td className="px-3 py-2">{recipe.cadence_type}</td>
                <td className="px-3 py-2">{recipe.enabled ? 'yes' : 'no'}</td>
                <td className={`px-3 py-2 text-xs ${healthTone(recipe)}`}>{lifecycleLabel(recipe)}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {recipe.pending_run_id ? (
                    <div>
                      <div className="font-mono text-[11px] text-zinc-300">{recipe.pending_run_id}</div>
                      <div>WLR: {recipe.pending_run_status?.status || 'pending lookup'}</div>
                      <div>{recipe.pending_run_status?.ended_at ? `ended ${recipe.pending_run_status.ended_at}` : recipe.pending_run_status?.started_at ? `started ${recipe.pending_run_status.started_at}` : 'awaiting completion'}</div>
                    </div>
                  ) : recipe.last_failure_at ? (
                    <div className="text-rose-400">failed{recipe.last_failure_message ? ` • ${recipe.last_failure_message}` : ''}</div>
                  ) : recipe.last_synced_source_run_id ? (
                    <div>
                      <div className="text-emerald-400">synced</div>
                      <div className="font-mono text-[11px]">{recipe.last_synced_source_run_id}</div>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">{recipe.confidence_threshold}</td>
                <td className="px-3 py-2">{recipe.lead_cap}</td>
                <td className="px-3 py-2">{recipe.next_run_at || '—'}</td>
                <td className="px-3 py-2 text-xs">{recipe.last_run_at || '—'}<div className="text-zinc-500">{recipe.last_run_origin || '—'}</div></td>
                <td className="px-3 py-2 text-xs">{recipe.last_sync_at || recipe.sync_state?.last_synced_at || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button className="btn px-2 py-1" onClick={() => toggleEnabled(recipe)}>{recipe.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="btn px-2 py-1" onClick={() => runNow(recipe)}>Run now</button>
                    <button className="btn px-2 py-1" onClick={() => syncNow(recipe)}>Sync now</button>
                  </div>
                  {recipe.sync_state ? (
                    <div className="mt-1 text-xs text-zinc-500">
                      last: +{recipe.sync_state.last_created_count} / ~{recipe.sync_state.last_updated_count} / -{recipe.sync_state.last_skipped_count}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel p-4 text-sm">
        <div className="mb-3 flex flex-wrap gap-2 items-center">
          <h3 className="text-lg mr-4">Lead review</h3>
          <select className="control" value={qualificationStatusFilter} onChange={(e) => setQualificationStatusFilter(e.target.value)}>
            <option value="all">All qualification statuses</option>
            <option value="pursue">Pursue</option>
            <option value="nurture">Nurture</option>
            <option value="skip">Skip</option>
          </select>
          <select className="control" value={recipeFilter} onChange={(e) => setRecipeFilter(e.target.value)}>
            <option value="all">All custom recipes</option>
            {recipeOptions.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
          </select>
          <select className="control" value={promotionFilter} onChange={(e) => setPromotionFilter(e.target.value)}>
            <option value="all">All promotion states</option>
            <option value="unpromoted">Unpromoted</option>
            <option value="ready">Ready for outreach</option>
            <option value="staged">Staged</option>
            <option value="paused">Paused</option>
          </select>
          <div className="text-xs text-zinc-500">Reviewing {qualifications.length} leads</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1500px] text-sm">
            <thead className="border-b border-white/10 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left">Lead</th>
                <th className="px-3 py-2 text-left">Offer / recipe</th>
                <th className="px-3 py-2 text-left">Qualification</th>
                <th className="px-3 py-2 text-left">Signal summary</th>
                <th className="px-3 py-2 text-left">Wedge</th>
                <th className="px-3 py-2 text-left">Promotion</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {qualifications.map((q) => (
                <tr key={q.id} className="border-b border-white/5 align-top">
                  <td className="px-3 py-2">
                    <div>{q.lead?.email || q.lead_id}</div>
                    <div className="text-xs text-zinc-500">{q.lead?.company || '—'}{q.lead?.title ? ` • ${q.lead.title}` : ''}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{q.recipe?.offer_name || '—'}</div>
                    <div className="text-zinc-500">{q.recipe?.name || q.recipe_id || '—'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{q.qualification_status}</div>
                    <div className="text-xs text-zinc-500">score {q.total_score}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    <div>{q.pain_signal || '—'}</div>
                    <div>Change: {q.change_signal || '—'}</div>
                    <div>Fit: {q.buildability_fit || '—'}</div>
                    <div>Buyer: {q.stakeholder_label || '—'}</div>
                    <div className="mt-1 text-zinc-500">{q.rationale_notes || '—'}</div>
                  </td>
                  <td className="px-3 py-2">{q.proposed_wedge || '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {q.promotion ? (
                      <div>
                        <div className="text-emerald-400">{q.promotion.promotion_status}</div>
                        <div className="text-zinc-500">{q.promotion.promoted_at}</div>
                      </div>
                    ) : 'unpromoted'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1 mb-2">
                      <button className="btn px-1 py-0.5 text-xs" onClick={() => setQualification(q.id, 'pursue')}>Pursue</button>
                      <button className="btn px-1 py-0.5 text-xs" onClick={() => setQualification(q.id, 'nurture')}>Nurture</button>
                      <button className="btn px-1 py-0.5 text-xs" onClick={() => setQualification(q.id, 'skip')}>Skip</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button className="btn px-1 py-0.5 text-xs" onClick={() => promoteLead(q, 'ready')}>Ready</button>
                      <button className="btn px-1 py-0.5 text-xs" onClick={() => promoteLead(q, 'staged')}>Stage</button>
                      <button className="btn px-1 py-0.5 text-xs" onClick={() => promoteLead(q, 'paused')}>Pause</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-4 text-sm">
        <h3 className="text-lg mb-2">Promotion queue</h3>
        <div className="overflow-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-white/10 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left">Lead</th>
                <th className="px-3 py-2 text-left">Recipe</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Qualification</th>
                <th className="px-3 py-2 text-left">Promoted</th>
                <th className="px-3 py-2 text-left">Destination</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((item) => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="px-3 py-2">{item.lead?.email || item.lead_id}<div className="text-xs text-zinc-500">{item.lead?.company || '—'}</div></td>
                  <td className="px-3 py-2">{item.recipe?.name || item.recipe_id || '—'}</td>
                  <td className="px-3 py-2">{item.promotion_status}</td>
                  <td className="px-3 py-2">{item.qualification?.qualification_status || '—'}<div className="text-xs text-zinc-500">score {item.qualification?.total_score ?? '—'}</div></td>
                  <td className="px-3 py-2 text-xs">{item.promoted_at}</td>
                  <td className="px-3 py-2 text-xs">{item.destination_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="text-lg mb-2">Recent runs</h3>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-white/10 text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left">Run ID</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Started</th>
                <th className="px-3 py-2 text-left">Ended</th>
                <th className="px-3 py-2 text-left">Discovered</th>
                <th className="px-3 py-2 text-left">Enriched</th>
                <th className="px-3 py-2 text-left">Deduped</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.run_id} className="border-b border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{run.run_id}</td>
                  <td className="px-3 py-2">{run.status || '—'}</td>
                  <td className="px-3 py-2">{run.started_at || '—'}</td>
                  <td className="px-3 py-2">{run.ended_at || '—'}</td>
                  <td className="px-3 py-2">{run.discovered ?? '—'}</td>
                  <td className="px-3 py-2">{run.enriched ?? '—'}</td>
                  <td className="px-3 py-2">{run.deduped ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
