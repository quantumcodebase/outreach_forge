'use client';

import { useEffect, useState } from 'react';

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
  sync_state?: {
    last_synced_run_id: string | null;
    last_synced_at: string | null;
    last_created_count: number;
    last_updated_count: number;
    last_skipped_count: number;
  } | null;
};

export default function WlrRunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [status, setStatus] = useState<string>('');
  const [projectId, setProjectId] = useState('intakevault');

  async function load() {
    const [runsRes, recipesRes, summaryRes] = await Promise.all([
      fetch(`/api/wlr/runs?projectId=${encodeURIComponent(projectId)}&limit=20`).then((r) => r.json()),
      fetch(`/api/wlr/recipes?projectId=${encodeURIComponent(projectId)}`).then((r) => r.json()),
      fetch(`/api/wlr/summary?projectId=${encodeURIComponent(projectId)}`).then((r) => r.json())
    ]);
    setRuns(runsRes.runs || []);
    setRecipes(recipesRes.recipes || []);
    setSummary(summaryRes || null);
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
    setStatus(`Sync complete for ${recipe.name}: created ${data.created}, updated ${data.updated}, skipped ${Number(data.skippedNoEmail || 0) + Number(data.skippedLowConfidence || 0) + Number(data.skippedLowQualityEmail || 0)}`);
    await load();
  }

  useEffect(() => {
    load();
  }, [projectId]);

  const latestSync = recipes
    .map((r) => r.sync_state?.last_synced_at || r.last_sync_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <div className="space-y-4">
      <section className="panel p-4 space-y-3">
        <h2 className="text-xl">WLR Recipe Control Panel</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input className="control w-56" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          <button className="btn px-2 py-1" onClick={load}>Refresh board</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
          <div className="panel-subtle p-2">Recipes: <b>{summary?.totalRecipes ?? recipes.length}</b></div>
          <div className="panel-subtle p-2">Active: <b>{summary?.activeRecipes ?? recipes.filter((r) => r.enabled).length}</b></div>
          <div className="panel-subtle p-2">Runs (24h): <b>{summary?.runsRecent ?? 0}</b></div>
          <div className="panel-subtle p-2">Last sync: <b>{summary?.lastSyncAt || latestSync || '—'}</b></div>
          <div className="panel-subtle p-2">New WLR leads (24h): <b>{summary?.newWlrLeads24h ?? 0}</b></div>
        </div>
        {status ? <p className="text-sm text-zinc-400">{status}</p> : null}
      </section>

      <section className="panel p-0 overflow-auto">
        <table className="w-full min-w-[1350px] text-sm">
          <thead className="border-b border-white/10 text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">Recipe</th>
              <th className="px-3 py-2 text-left">Offer</th>
              <th className="px-3 py-2 text-left">ICP</th>
              <th className="px-3 py-2 text-left">Workflow</th>
              <th className="px-3 py-2 text-left">Geo</th>
              <th className="px-3 py-2 text-left">Cadence</th>
              <th className="px-3 py-2 text-left">Enabled</th>
              <th className="px-3 py-2 text-left">Threshold</th>
              <th className="px-3 py-2 text-left">Cap</th>
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
                <td className="px-3 py-2">{recipe.confidence_threshold}</td>
                <td className="px-3 py-2">{recipe.lead_cap}</td>
                <td className="px-3 py-2">{recipe.last_run_at || '—'}</td>
                <td className="px-3 py-2">{recipe.last_sync_at || recipe.sync_state?.last_synced_at || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
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

      <section className="panel p-4 text-sm">
        <h3 className="text-lg mb-2">Sync summary</h3>
        <p>Last sync: {summary?.lastSyncAt || '—'}</p>
        <p>
          Counts: created {summary?.lastSyncCounts?.created ?? 0}, updated {summary?.lastSyncCounts?.updated ?? 0}, skipped {summary?.lastSyncCounts?.skipped ?? 0}
          {summary?.lastSyncCounts?.runId ? ` • run ${summary.lastSyncCounts.runId}` : ''}
        </p>
      </section>
    </div>
  );
}
