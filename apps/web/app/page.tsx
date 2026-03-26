'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Health = { ok: boolean; db?: boolean };

type StatState = {
  accounts: number | null;
  threads: number | null;
  leads: number | null;
  wlrLeads: number | null;
  activeCampaigns: number | null;
  health: Health | null;
};

export default function HomePage() {
  const [stats, setStats] = useState<StatState>({ accounts: null, threads: null, leads: null, wlrLeads: null, activeCampaigns: null, health: null });

  useEffect(() => {
    async function load() {
      const [accountsRes, inboxRes, healthRes, leadsRes, campaignsRes] = await Promise.allSettled([
        fetch('/api/accounts').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
        fetch('/api/inbox').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
        fetch('/api/health').then((r) => r.json()),
        fetch('/api/leads').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
        fetch('/api/campaigns').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      ]);

      const leads = leadsRes.status === 'fulfilled' ? (leadsRes.value.leads || []) : [];
      const campaigns = campaignsRes.status === 'fulfilled' ? (campaignsRes.value.campaigns || []) : [];

      setStats({
        accounts: accountsRes.status === 'fulfilled' ? (accountsRes.value.accounts?.length ?? null) : null,
        threads: inboxRes.status === 'fulfilled' ? (inboxRes.value.threads?.length ?? null) : null,
        leads: leadsRes.status === 'fulfilled' ? leads.length : null,
        wlrLeads: leadsRes.status === 'fulfilled' ? leads.filter((l: any) => (l.tags || []).includes('source:wlr')).length : null,
        activeCampaigns: campaignsRes.status === 'fulfilled' ? campaigns.filter((c: any) => c.status === 'active').length : null,
        health: healthRes.status === 'fulfilled' ? healthRes.value : null
      });
    }

    load();
  }, []);

  const outMode = (process.env.NEXT_PUBLIC_OUTBOUND_MODE || 'dry_run').toLowerCase();

  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(118,156,238,0.16),transparent_44%),radial-gradient(circle_at_0%_100%,rgba(196,153,90,0.1),transparent_38%)]" />
        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Operator Surface</p>
          <h1 className="mt-1">Cold Email Cockpit</h1>
          <p className="mt-1 text-sm text-slate-300">Unified lead-search + outreach cockpit (WLR import + operator assist ready).</p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <section className="metric-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Accounts</p>
          <p className="mt-2 text-3xl font-semibold text-slate-50">{stats.accounts ?? '—'}</p>
        </section>
        <section className="metric-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Leads</p>
          <p className="mt-2 text-3xl font-semibold text-slate-50">{stats.leads ?? '—'}</p>
          <p className="mt-1 text-xs text-slate-400">WLR: {stats.wlrLeads ?? '—'}</p>
        </section>
        <section className="metric-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Campaigns</p>
          <p className="mt-2 text-3xl font-semibold text-slate-50">{stats.activeCampaigns ?? '—'}</p>
          <p className="mt-1 text-xs text-slate-400">active</p>
        </section>
        <section className="metric-card">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Mode</p>
          <p className="mt-2 text-3xl font-semibold text-slate-50">{outMode === 'live' ? 'Live' : 'Dry run'}</p>
          <p className="mt-1 text-xs text-slate-400">safe by default</p>
        </section>
      </div>

      <section className="panel p-4 text-sm">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Quick links</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/accounts" className="btn btn-primary px-3 py-1.5">IONOS proof flow</Link>
          <Link href="/leads" className="btn px-3 py-1.5">Leads + WLR imports</Link>
          <Link href="/campaigns" className="btn px-3 py-1.5">Campaign enrollments</Link>
          <Link href="/inbox" className="btn px-3 py-1.5">Inbox + assist</Link>
        </div>
      </section>

      <section className="panel p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">System</p>
        <div className="mt-3 space-y-2 text-sm text-slate-200">
          <p className="flex items-center justify-between"><span>Web API</span><span className="chip border-emerald-300/30 bg-emerald-500/10 text-emerald-200">online</span></p>
          <p className="flex items-center justify-between"><span>Database</span><span className={stats.health?.db ? 'chip border-emerald-300/30 bg-emerald-500/10 text-emerald-200' : 'chip border-amber-300/30 bg-amber-500/10 text-amber-200'}>{stats.health ? (stats.health.db ? 'healthy' : 'degraded') : '—'}</span></p>
          <p className="flex items-center justify-between"><span>Threads indexed</span><span className="font-medium text-slate-100">{stats.threads ?? '—'}</span></p>
        </div>
      </section>
    </div>
  );
}
