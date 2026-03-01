'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const nav = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/accounts', label: 'Accounts' },
  { href: '#', label: 'Campaigns', disabled: true },
  { href: '#', label: 'Leads', disabled: true },
  { href: '#', label: 'Analytics', disabled: true },
  { href: '#', label: 'Settings', disabled: true }
];

const titleByPath = new Map<string, string>([
  ['/inbox', 'Inbox'],
  ['/accounts', 'Accounts'],
  ['/', 'Overview']
]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = titleByPath.get(pathname) || (pathname.startsWith('/inbox') ? 'Inbox' : 'Cold Email Cockpit');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="w-64 border-r border-white/10 p-4">
          <div className="mb-6 px-2">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Operator Console</p>
            <p className="mt-1 text-sm font-semibold">Cold Email Cockpit</p>
          </div>
          <nav className="space-y-1">
            {nav.map((item) => {
              const active = !item.disabled && (pathname === item.href || pathname.startsWith(`${item.href}/`));
              if (item.disabled) {
                return (
                  <div key={item.label} className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-500">
                    <span>{item.label}</span>
                    <span className="text-[10px] uppercase">Soon</span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm transition ${active ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-white/10 px-6">
            <h1 className="text-lg font-semibold">{title}</h1>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200">Local</span>
              {pathname.startsWith('/accounts') ? (
                <Link href="/accounts" className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10">Manage</Link>
              ) : null}
              {pathname.startsWith('/inbox') ? (
                <Link href="/inbox" className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10">Refresh</Link>
              ) : null}
            </div>
          </header>
          <main className="flex-1 p-6">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
