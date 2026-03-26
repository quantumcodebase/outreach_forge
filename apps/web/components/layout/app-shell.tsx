'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const nav = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/leads', label: 'Leads' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/suppression', label: 'Suppression' }
];

const titleByPath = new Map<string, string>([
  ['/inbox', 'Inbox'],
  ['/accounts', 'Accounts'],
  ['/campaigns', 'Campaigns'],
  ['/leads', 'Leads'],
  ['/analytics', 'Analytics'],
  ['/suppression', 'Suppression'],
  ['/', 'Overview']
]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = titleByPath.get(pathname) || (pathname.startsWith('/inbox') ? 'Inbox' : 'Cold Email Cockpit');

  return (
    <div className="min-h-screen text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1520px]">
        <aside className="w-64 border-r border-white/10 bg-[#0b1019]/85 px-4 py-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)]">
          <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Operator Console</p>
            <p className="mt-1 text-sm font-semibold tracking-tight text-zinc-100">Cold Email Cockpit</p>
          </div>
          <nav className="space-y-1.5">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md border px-3 py-2 text-sm transition ${active ? 'border-sky-300/35 bg-sky-500/15 text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.03] hover:text-zinc-100'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#0d121d]/85 px-6 shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <div className="flex items-center gap-2">
              <span className="chip border-sky-400/30 bg-sky-500/10 text-sky-200">Local</span>
              {((process.env.NEXT_PUBLIC_OUTBOUND_MODE || 'dry_run').toLowerCase() === 'live') ? (
                ((process.env.NEXT_PUBLIC_LIVE_SEND_ENABLED || '').toLowerCase() === 'true') ? (
                  <span className="chip border-rose-400/35 bg-rose-500/10 text-rose-200">Live</span>
                ) : (
                  <span className="chip border-rose-400/35 bg-rose-900/30 text-rose-200">Live (Blocked)</span>
                )
              ) : (
                <span className="chip border-amber-400/30 bg-amber-500/10 text-amber-200">Dry Run</span>
              )}
              {pathname.startsWith('/accounts') ? <Link href="/accounts" className="btn px-3 py-1.5">Manage</Link> : null}
              {pathname.startsWith('/inbox') ? <Link href="/inbox" className="btn px-3 py-1.5">Refresh</Link> : null}
            </div>
          </header>
          <main className="flex-1 p-6">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
