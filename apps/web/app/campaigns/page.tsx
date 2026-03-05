'use client';

import { useCallback, useEffect, useState } from 'react';

type Account = { id: string; label: string; smtp_user: string };
type Campaign = { id: string; name: string; status: string; daily_cap: number; timezone: string; _count?: { enrollments: number } };

type Lead = { id: string; email: string; first_name: string | null };

export default function CampaignsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [form, setForm] = useState({ name: '', from_account_id: '', daily_cap: 50, timezone: 'America/Puerto_Rico', sending_window_start: '08:00:00', sending_window_end: '17:00:00' });
  const [step, setStep] = useState({ step_number: 1, subject_template: 'Quick question, {{first_name}}', body_template: 'Hi {{first_name}},\n\nCan we chat?', delay_days: 0 });
  const [diagnostics, setDiagnostics] = useState<any | null>(null);

  const load = useCallback(async () => {
    const [a, c, l] = await Promise.all([fetch('/api/accounts').then((r) => r.json()), fetch('/api/campaigns').then((r) => r.json()), fetch('/api/leads').then((r) => r.json())]);
    setAccounts(a.accounts || []);
    setCampaigns(c.campaigns || []);
    setLeads(l.leads || []);
    if (!form.from_account_id && a.accounts?.[0]?.id) setForm((f) => ({ ...f, from_account_id: a.accounts[0].id }));
  }, [form.from_account_id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <h2>Campaigns</h2>

      <section className="rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium">Create campaign</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <input className="rounded border border-white/15 bg-zinc-900 px-3 py-2" placeholder="Campaign name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <select className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={form.from_account_id} onChange={(e) => setForm((f) => ({ ...f, from_account_id: e.target.value }))}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <input type="number" className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={form.daily_cap} onChange={(e) => setForm((f) => ({ ...f, daily_cap: Number(e.target.value || 50) }))} />
          <input className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={form.sending_window_start} onChange={(e) => setForm((f) => ({ ...f, sending_window_start: e.target.value }))} />
          <input className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={form.sending_window_end} onChange={(e) => setForm((f) => ({ ...f, sending_window_end: e.target.value }))} />
          <button className="rounded bg-white px-3 py-2 text-black" onClick={async () => { await fetch('/api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }); await load(); }}>Create</button>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium">Add / update step</p>
        <div className="grid grid-cols-5 gap-2 text-sm">
          <select className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
            <option value="">Select campaign</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="number" className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={step.step_number} onChange={(e) => setStep((s) => ({ ...s, step_number: Number(e.target.value) }))} />
          <input className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={step.subject_template} onChange={(e) => setStep((s) => ({ ...s, subject_template: e.target.value }))} />
          <input type="number" className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={step.delay_days} onChange={(e) => setStep((s) => ({ ...s, delay_days: Number(e.target.value || 0) }))} />
          <button disabled={!selectedCampaign} className="rounded border border-white/20 px-3 py-2 disabled:opacity-60" onClick={async () => { await fetch(`/api/campaigns/${selectedCampaign}/steps`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(step) }); }}>Save step</button>
        </div>
        <textarea className="h-24 w-full rounded border border-white/15 bg-zinc-900 px-3 py-2 text-sm" value={step.body_template} onChange={(e) => setStep((s) => ({ ...s, body_template: e.target.value }))} />
      </section>

      <section className="rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium">Enroll lead</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <select className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
            <option value="">Select campaign</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={selectedLead} onChange={(e) => setSelectedLead(e.target.value)}>
            <option value="">Select lead</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.email}</option>)}
          </select>
          <button disabled={!selectedCampaign || !selectedLead} className="rounded border border-white/20 px-3 py-2 disabled:opacity-60" onClick={async () => { await fetch('/api/enrollments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId: selectedCampaign, leadIds: [selectedLead] }) }); await load(); }}>Enroll</button>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-4">
        <p className="mb-2 text-sm font-medium">Campaign list</p>
        <p className="mb-2 text-xs text-zinc-500">Dry run mode applies unless explicitly switched to live + enabled.</p>
        <div className="space-y-1 text-sm">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border border-white/10 px-3 py-2">
              <div>{c.name} <span className="text-zinc-500">({c.status})</span></div>
              <div className="flex gap-2">
                <button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={async () => { await fetch(`/api/campaigns/${c.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'active' }) }); await load(); }}>Activate</button>
                <button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={async () => { await fetch(`/api/campaigns/${c.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'paused' }) }); await load(); }}>Pause</button>
                <button className="rounded border border-sky-400/30 px-2 py-1 text-xs text-sky-200" onClick={async () => {
                  const apiKey = window.prompt('Enter API key for assist route (not stored):');
                  if (!apiKey) return;
                  const res = await fetch('/api/v1/assist/campaign-diagnostics', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ campaignId: c.id }) });
                  setDiagnostics(await res.json());
                }}>Diagnose</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {diagnostics ? (
        <section className="rounded-xl border border-white/10 p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">Campaign diagnostics ({diagnostics.mode})</p>
            <button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))}>Copy output</button>
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-300">{JSON.stringify(diagnostics, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
