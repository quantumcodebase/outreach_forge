'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Health = { ok: boolean; db?: boolean };

type StatState = {
  accounts: number | null;
  threads: number | null;
  health: Health | null;
};

export default function HomePage() {
  const [stats, setStats] = useState<StatState>({ accounts: null, threads: null, health: null });

  useEffect(() => {
    async function load() {
      const [accountsRes, inboxRes, healthRes] = await Promise.allSettled([
        fetch('/api/accounts').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
        fetch('/api/inbox').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
        fetch('/api/health').then((r) => r.json())
      ]);

      setStats({
        accounts: accountsRes.status === 'fulfilled' ? (accountsRes.value.accounts?.length ?? null) : null,
        threads: inboxRes.status === 'fulfilled' ? (inboxRes.value.threads?.length ?? null) : null,
        health: healthRes.status === 'fulfilled' ? healthRes.value : null
      });
    }

    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1>Cold Email Cockpit</h1>
        <p className="mt-1 text-sm text-zinc-400">Phase 1 operator console for accounts, inbox triage, and replies.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Accounts</p>
          <p className="mt-2 text-2xl font-semibold">{stats.accounts ?? '—'}</p>
          <p className="mt-1 text-sm text-zinc-400">connected</p>
          <Link href="/accounts" className="mt-4 inline-flex rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-200">Add account</Link>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Inbox</p>
          <p className="mt-2 text-2xl font-semibold">{stats.threads ?? '—'}</p>
          <p className="mt-1 text-sm text-zinc-400">threads indexed</p>
          <Link href="/inbox" className="mt-4 inline-flex rounded-md border border-white/20 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10">Open inbox</Link>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">System</p>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-center justify-between"><span>Web API</span><span className="text-emerald-300">online</span></p>
            <p className="flex items-center justify-between"><span>Database</span><span className={stats.health?.db ? 'text-emerald-300' : 'text-amber-300'}>{stats.health ? (stats.health.db ? 'healthy' : 'degraded') : '—'}</span></p>
            <p className="flex items-center justify-between"><span>Worker</span><span className="text-zinc-400">check logs</span></p>
          </div>
        </section>
      </div>
    </div>
  );
}
