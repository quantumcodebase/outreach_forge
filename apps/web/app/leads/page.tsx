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

  async function load() {
    const [leadData, campaignData] = await Promise.all([
      fetch(`/api/leads?q=${encodeURIComponent(search)}&source=${source}`).then((r) => r.json()),
      fetch('/api/campaigns').then((r) => r.json())
    ]);
    setLeads(leadData.leads || []);
    setCampaigns(campaignData.campaigns || []);
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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium">Create lead</p>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
          <input className="rounded border border-white/15 bg-zinc-900 px-3 py-2" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="rounded border border-white/15 bg-zinc-900 px-3 py-2" placeholder="First name (optional)" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <button
            className="rounded bg-white px-3 py-2 text-black"
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
            Create
          </button>
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
            <select value={source} onChange={(e) => setSource(e.target.value as 'all' | 'wlr')} className="h-9 rounded border border-white/15 bg-zinc-900 px-2">
              <option value="all">All sources</option>
              <option value="wlr">WLR only</option>
            </select>
            <span className="rounded border border-white/15 px-2 py-1 text-zinc-300">WLR in view: {wlrCount}</span>
            <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} className="h-9 rounded border border-white/15 bg-zinc-900 px-2">
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button disabled={!selectedCampaign || selectedIds.length === 0} onClick={enrollSelected} className="rounded border border-white/20 px-2 py-1 disabled:opacity-50">
              Enroll selected
            </button>
            <span className="rounded border border-amber-400/25 px-2 py-1 text-amber-200">Dry run aware</span>
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
              <td className="px-4 py-3">{lead.email}</td>
              <td className="px-4 py-3 text-zinc-300">{lead.company || '—'}</td>
              <td className="px-4 py-3 text-xs">
                {isWlr ? <span className="rounded border border-sky-400/30 px-2 py-1 text-sky-200">WLR</span> : <span className="text-zinc-500">manual</span>}
                {isWlr && wlrMeta.search_id ? <span className="ml-2 text-zinc-500">search {String(wlrMeta.search_id)}</span> : null}
                {isWlr ? <div className="mt-1 text-zinc-500">score {String(wlrMeta.score ?? 'n/a')} • snippets {Array.isArray(wlrMeta.snippets) ? wlrMeta.snippets.length : 0}</div> : null}
              </td>
              <td className="px-4 py-3 text-zinc-400">{lead.status}</td>
              <td className="px-4 py-3"><button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => runLeadBrief(lead.id)}>Lead brief</button></td>
            </tr>
          );
        })}
      </DataTable>

      {bulkResult ? <p className="text-sm text-zinc-300">{bulkResult}</p> : null}
      {leadBrief ? (
        <section className="rounded-xl border border-white/10 p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">Lead brief ({leadBrief.mode})</p>
            <button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(JSON.stringify(leadBrief, null, 2))}>Copy output</button>
          </div>
          <p className="mt-2 text-zinc-300">{leadBrief.summary}</p>
        </section>
      ) : (
        <section className="rounded-xl border border-white/10 p-4 text-sm text-zinc-500">No analysis yet. Generate a thread analysis or reply draft.</section>
      )}
    </div>
  );
}
