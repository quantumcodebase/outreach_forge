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
      <div>
        <h1>Cold Email Cockpit</h1>
        <p className="mt-1 text-sm text-zinc-400">Unified lead-search + outreach cockpit (WLR import + operator assist ready).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">Accounts</p><p className="mt-2 text-2xl font-semibold">{stats.accounts ?? '—'}</p></section>
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">Leads</p><p className="mt-2 text-2xl font-semibold">{stats.leads ?? '—'}</p><p className="text-xs text-zinc-500">WLR: {stats.wlrLeads ?? '—'}</p></section>
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">Campaigns</p><p className="mt-2 text-2xl font-semibold">{stats.activeCampaigns ?? '—'}</p><p className="text-xs text-zinc-500">active</p></section>
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">Mode</p><p className="mt-2 text-2xl font-semibold">{outMode === 'live' ? 'Live' : 'Dry run'}</p><p className="text-xs text-zinc-500">safe by default</p></section>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
        <p className="font-medium">Quick links</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/accounts" className="rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10">IONOS proof flow</Link>
          <Link href="/leads" className="rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10">Leads + WLR imports</Link>
          <Link href="/campaigns" className="rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10">Campaign enrollments</Link>
          <Link href="/inbox" className="rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10">Inbox + assist</Link>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-500">System</p>
        <div className="mt-3 space-y-2 text-sm">
          <p className="flex items-center justify-between"><span>Web API</span><span className="text-emerald-300">online</span></p>
          <p className="flex items-center justify-between"><span>Database</span><span className={stats.health?.db ? 'text-emerald-300' : 'text-amber-300'}>{stats.health ? (stats.health.db ? 'healthy' : 'degraded') : '—'}</span></p>
          <p className="flex items-center justify-between"><span>Threads indexed</span><span>{stats.threads ?? '—'}</span></p>
        </div>
      </section>
    </div>
  );
}
