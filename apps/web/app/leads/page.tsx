'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/shared/data-table';

type Lead = {
  id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  status: string;
  tags: string[];
  custom_fields: Record<string, any>;
};

type Campaign = { id: string; name: string; status: string };

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'all' | 'wlr'>('all');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [leadBrief, setLeadBrief] = useState<any | null>(null);
  const [wlrRuns, setWlrRuns] = useState<any[]>([]);
  const [wlrStatus, setWlrStatus] = useState<string | null>(null);

  async function load() {
    const [leadData, campaignData, runsData] = await Promise.all([
      fetch(`/api/leads?q=${encodeURIComponent(search)}&source=${source}`).then((r) => r.json()),
      fetch('/api/campaigns').then((r) => r.json()),
      fetch('/api/wlr/runs?projectId=intakevault').then((r) => r.json()).catch(() => ({ runs: [] }))
    ]);
    setLeads(leadData.leads || []);
    setCampaigns(campaignData.campaigns || []);
    setWlrRuns(runsData.runs || []);
    setSelectedIds((prev) => prev.filter((id) => (leadData.leads || []).some((l: Lead) => l.id === id)));
    if (!selectedCampaign && campaignData.campaigns?.[0]?.id) setSelectedCampaign(campaignData.campaigns[0].id);
  }

  useEffect(() => {
    load();
  }, [search, source]);

  const wlrCount = useMemo(() => leads.filter((l) => l.tags?.includes('source:wlr')).length, [leads]);

  const toggleLead = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  async function enrollSelected() {
    const payload = { campaignId: selectedCampaign, leadIds: selectedIds };
    const res = await fetch('/api/enrollments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setBulkResult(`Selected ${data.selected} • Enrolled ${data.enrolled} • Skipped existing ${data.skipped_existing} • Skipped invalid ${data.skipped_invalid}`);
  }

  async function runLeadBrief(leadId: string) {
    const apiKey = window.prompt('Enter API key for assist route (not stored):');
    if (!apiKey) return;
    const res = await fetch('/api/v1/assist/lead-brief', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ leadId })
    });
    const data = await res.json();
    setLeadBrief(data);
  }

  async function syncWlr() {
    setWlrStatus('Syncing WLR into OutreachForge…');
    const res = await fetch('/api/wlr/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'intakevault' })
    });
    const data = await res.json();
    setWlrStatus(`Synced runs ${data.runsSynced}, leads created ${data.created}, updated ${data.updated}, skipped(no email) ${data.skippedNoEmail}`);
    await load();
  }

  async function runWlrSearch() {
    setWlrStatus('Starting WLR run…');
    const res = await fetch('/api/wlr/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'intakevault', targetMode: 'underserved' })
    });
    const data = await res.json();
    setWlrStatus(`Run started: ${data.run?.run_id || 'unknown run id'}. Use Sync WLR after completion.`);
    await load();
  }

  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(125,160,230,0.16),transparent_44%),radial-gradient(circle_at_0%_100%,rgba(194,150,90,0.1),transparent_40%)]" />
        <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Lead Intake</p>
            <h2 className="mt-1 text-xl">Create lead</h2>
            <p className="mt-1 text-sm text-slate-300">Add direct prospects or import from Warm Lead Radar, then enroll in active campaigns.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <input className="control" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="control" placeholder="First name (optional)" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <button
              className="btn btn-primary"
              onClick={async () => {
                await fetch('/api/leads', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ email, first_name: firstName })
                });
                setEmail('');
                setFirstName('');
                await load();
              }}
            >
              Create lead
            </button>
          </div>
        </div>
      </section>

      <section className="panel p-4 text-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn px-2 py-1" onClick={runWlrSearch}>Run WLR search</button>
          <button className="btn px-2 py-1" onClick={syncWlr}>Sync WLR → OutreachForge</button>
          {wlrStatus ? <span className="text-zinc-400">{wlrStatus}</span> : null}
        </div>
        <div className="text-xs text-zinc-500">
          Recent WLR runs in Postgres visibility layer: {wlrRuns.length}
          {wlrRuns[0] ? ` • latest ${wlrRuns[0].run_id} (${wlrRuns[0].status || 'unknown'})` : ''}
        </div>
      </section>

      <DataTable
        title="Leads"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search email/company/tag"
        tableMinWidthClass="min-w-[1150px]"
        rightSlot={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select value={source} onChange={(e) => setSource(e.target.value as 'all' | 'wlr')} className="control px-2">
              <option value="all">All sources</option>
              <option value="wlr">WLR only</option>
            </select>
            <span className="chip rounded-md">WLR in view: {wlrCount}</span>
            <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} className="control px-2">
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button disabled={!selectedCampaign || selectedIds.length === 0} onClick={enrollSelected} className="btn px-2 py-1 disabled:opacity-50">
              Enroll selected
            </button>
            <span className="chip border-amber-400/25 text-amber-200">Dry run aware</span>
          </div>
        }
        headers={[
          { key: 'select', label: '' },
          { key: 'email', label: 'Email' },
          { key: 'company', label: 'Company' },
          { key: 'source', label: 'Source' },
          { key: 'status', label: 'Status' },
          { key: 'actions', label: 'Actions' }
        ]}
      >
        {leads.length === 0 ? (
          <tr><td colSpan={6} className="px-4 py-6 text-sm text-zinc-500">No leads yet. Import from Warm Lead Radar or add a lead manually.</td></tr>
        ) : leads.map((lead) => {
          const isWlr = lead.tags?.includes('source:wlr');
          const wlrMeta = (lead.custom_fields?.wlr || {}) as Record<string, any>;
          return (
            <tr key={lead.id}>
              <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleLead(lead.id)} /></td>
              <td className="px-4 py-3 text-slate-100">{lead.email}</td>
              <td className="px-4 py-3 text-zinc-300">{lead.company || '—'}</td>
              <td className="px-4 py-3 text-xs">
                {isWlr ? <span className="chip border-sky-400/30 bg-sky-500/15 px-2 py-1 text-sky-200">WLR</span> : <span className="text-zinc-500">manual</span>}
                {isWlr && wlrMeta.search_id ? <span className="ml-2 text-zinc-500">search {String(wlrMeta.search_id)}</span> : null}
                {isWlr ? <div className="mt-1 text-zinc-500">score {String(wlrMeta.score ?? 'n/a')} • snippets {Array.isArray(wlrMeta.snippets) ? wlrMeta.snippets.length : 0}</div> : null}
              </td>
              <td className="px-4 py-3 text-zinc-300">{lead.status}</td>
              <td className="px-4 py-3"><button className="btn px-2 py-1 text-xs" onClick={() => runLeadBrief(lead.id)}>Lead brief</button></td>
            </tr>
          );
        })}
      </DataTable>

      {bulkResult ? <p className="text-sm text-slate-300">{bulkResult}</p> : null}
      {leadBrief ? (
        <section className="panel p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">Lead brief ({leadBrief.mode})</p>
            <button className="btn px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(JSON.stringify(leadBrief, null, 2))}>Copy output</button>
          </div>
          <p className="mt-2 text-zinc-300">{leadBrief.summary}</p>
        </section>
      ) : (
        <section className="panel-subtle p-4 text-sm text-zinc-500">No analysis yet. Generate a lead brief to evaluate fit and personalization cues.</section>
      )}
    </div>
  );
}
