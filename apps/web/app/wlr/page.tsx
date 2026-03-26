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

export default function WlrRunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [status, setStatus] = useState<string>('');
  const [projectId, setProjectId] = useState('intakevault');

  async function load() {
    const res = await fetch(`/api/wlr/runs?projectId=${encodeURIComponent(projectId)}&limit=50`);
    const data = await res.json();
    setRuns(data.runs || []);
  }

  async function sync(fullResync = false) {
    setStatus(fullResync ? 'Running full resync…' : 'Running incremental sync…');
    const res = await fetch('/api/wlr/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, fullResync })
    });
    const data = await res.json();
    setStatus(
      `${data.incremental ? 'Incremental' : 'Full'} sync • runs fetched ${data.runsFetched}, runs considered ${data.runsConsideredForLeadSync}, leads created ${data.created}, updated ${data.updated}, skipped conf ${data.skippedLowConfidence}`
    );
    await load();
  }

  async function runSearch() {
    setStatus('Starting WLR run…');
    const res = await fetch('/api/wlr/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, targetMode: 'underserved' })
    });
    const data = await res.json();
    setStatus(`Run queued: ${data.run?.run_id || 'unknown'}`);
    await load();
  }

  useEffect(() => {
    load();
  }, [projectId]);

  return (
    <div className="space-y-4">
      <section className="panel p-4 space-y-3">
        <h2 className="text-xl">WLR Runs</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input className="control w-56" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          <button className="btn px-2 py-1" onClick={runSearch}>Run WLR search</button>
          <button className="btn px-2 py-1" onClick={() => sync(false)}>Incremental sync</button>
          <button className="btn px-2 py-1" onClick={() => sync(true)}>Full resync</button>
          <button className="btn px-2 py-1" onClick={load}>Refresh</button>
        </div>
        {status ? <p className="text-sm text-zinc-400">{status}</p> : null}
      </section>

      <section className="panel p-0 overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-white/10 text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">Run ID</th>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Started</th>
              <th className="px-3 py-2 text-left">Ended</th>
              <th className="px-3 py-2 text-left">Discovered</th>
              <th className="px-3 py-2 text-left">Enriched</th>
              <th className="px-3 py-2 text-left">Deduped</th>
              <th className="px-3 py-2 text-left">Synced</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.run_id} className="border-b border-white/5">
                <td className="px-3 py-2 font-mono text-xs">{run.run_id}</td>
                <td className="px-3 py-2">{run.project_id || '—'}</td>
                <td className="px-3 py-2">{run.status || '—'}</td>
                <td className="px-3 py-2">{run.started_at || '—'}</td>
                <td className="px-3 py-2">{run.ended_at || '—'}</td>
                <td className="px-3 py-2">{run.discovered ?? '—'}</td>
                <td className="px-3 py-2">{run.enriched ?? '—'}</td>
                <td className="px-3 py-2">{run.deduped ?? '—'}</td>
                <td className="px-3 py-2">{run.last_synced_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
