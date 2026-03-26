'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const nav = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/leads', label: 'Leads' },
  { href: '/wlr', label: 'WLR Runs' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/suppression', label: 'Suppression' }
];

const titleByPath = new Map<string, string>([
  ['/inbox', 'Inbox'],
  ['/accounts', 'Accounts'],
  ['/campaigns', 'Campaigns'],
  ['/leads', 'Leads'],
  ['/wlr', 'WLR Runs'],
  ['/analytics', 'Analytics'],
  ['/suppression', 'Suppression'],
  ['/', 'Overview']
]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = titleByPath.get(pathname) || (pathname.startsWith('/inbox') ? 'Inbox' : 'Cold Email Cockpit');

  return (
    <div className="min-h-screen text-zinc-100">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,rgba(91,129,211,0.2),transparent_34%),radial-gradient(circle_at_82%_0%,rgba(70,107,168,0.16),transparent_32%),radial-gradient(circle_at_92%_84%,rgba(177,131,66,0.1),transparent_34%)]" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-[1560px] p-4 xl:p-5">
        <aside className="relative w-72 overflow-hidden rounded-2xl border border-slate-400/15 bg-[linear-gradient(180deg,rgba(19,28,43,0.9),rgba(10,16,27,0.96))] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_-1px_0_0_rgba(255,255,255,0.05),0_20px_48px_rgba(2,6,14,0.62)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_10%_0%,rgba(126,164,245,0.22),transparent_52%)]" />
          <div className="pointer-events-none absolute inset-y-4 right-0 w-px bg-gradient-to-b from-white/0 via-white/20 to-white/0" />
          <div className="mb-6 rounded-xl border border-slate-300/15 bg-[linear-gradient(160deg,rgba(78,107,165,0.24),rgba(28,39,58,0.84)_60%,rgba(14,21,33,0.94))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_12px_28px_rgba(6,10,19,0.5)]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Operator Console</p>
            <p className="mt-1 text-sm font-semibold tracking-tight text-slate-100">Cold Email Cockpit</p>
          </div>
          <nav className="space-y-2">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative block rounded-lg border px-3.5 py-2.5 text-sm transition ${active
                    ? 'border-sky-300/35 bg-[linear-gradient(180deg,rgba(94,131,220,0.36),rgba(55,82,137,0.3))] text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_24px_rgba(26,45,86,0.55)]'
                    : 'border-transparent text-zinc-300 hover:border-slate-300/15 hover:bg-[linear-gradient(180deg,rgba(43,58,84,0.42),rgba(22,30,44,0.5))] hover:text-zinc-100 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'}`}
                >
                  <span className={`pointer-events-none absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full transition ${active ? 'bg-sky-300 shadow-[0_0_14px_rgba(121,170,255,0.95)]' : 'bg-transparent group-hover:bg-slate-300/40'}`} />
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-sky-300 shadow-[0_0_12px_rgba(121,170,255,0.9)]' : 'bg-slate-500 group-hover:bg-slate-300'}`} />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="relative ml-4 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300/10 bg-[linear-gradient(180deg,rgba(11,17,29,0.88),rgba(8,13,23,0.95))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_30px_70px_rgba(2,7,14,0.66)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/35 to-transparent" />
          <header className="flex h-16 items-center justify-between border-b border-slate-300/10 bg-[linear-gradient(180deg,rgba(23,33,52,0.84),rgba(11,18,30,0.9))] px-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">OutreachForge</p>
              <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="chip border-sky-300/35 bg-sky-500/10 text-sky-200">Local</span>
              {((process.env.NEXT_PUBLIC_OUTBOUND_MODE || 'dry_run').toLowerCase() === 'live') ? (
                ((process.env.NEXT_PUBLIC_LIVE_SEND_ENABLED || '').toLowerCase() === 'true') ? (
                  <span className="chip border-rose-300/35 bg-rose-500/15 text-rose-200">Live</span>
                ) : (
                  <span className="chip border-rose-300/35 bg-rose-900/40 text-rose-200">Live (Blocked)</span>
                )
              ) : (
                <span className="chip border-amber-300/35 bg-amber-500/15 text-amber-200">Dry Run</span>
              )}
              {pathname.startsWith('/accounts') ? <Link href="/accounts" className="btn px-3 py-1.5">Manage</Link> : null}
              {pathname.startsWith('/inbox') ? <Link href="/inbox" className="btn px-3 py-1.5">Refresh</Link> : null}
            </div>
          </header>
          <main className="shell-canvas flex-1 p-6">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
