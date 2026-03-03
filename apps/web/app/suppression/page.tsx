'use client';

import { useCallback, useEffect, useState } from 'react';

type Row = { id: string; email: string; reason: string; added_at: string };

export default function SuppressionPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('manual');

  const load = useCallback(async (query = q) => {
    const data = await fetch(`/api/suppression?q=${encodeURIComponent(query)}`).then((r) => r.json());
    setRows(data.rows || []);
  }, [q]);

  useEffect(() => {
    load('');
  }, [load]);

  return (
    <div className="space-y-6">
      <h2>Suppression List</h2>
      <section className="rounded-xl border border-white/10 p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2 text-sm">
          <input className="rounded border border-white/15 bg-zinc-900 px-3 py-2" placeholder="Search email" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="rounded border border-white/20 px-3 py-2" onClick={() => load()}>Search</button>
          <input className="rounded border border-white/15 bg-zinc-900 px-3 py-2" placeholder="block@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <select className="rounded border border-white/15 bg-zinc-900 px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="manual">manual</option>
              <option value="unsubscribe">unsubscribe</option>
              <option value="bounce_hard">bounce_hard</option>
              <option value="complaint">complaint</option>
            </select>
            <button className="rounded bg-white px-3 py-2 text-black" onClick={async () => {
              await fetch('/api/suppression', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, reason }) });
              setEmail('');
              await load();
            }}>Add</button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-4">
        <div className="space-y-1 text-sm">
          {rows.length === 0 ? <p className="text-zinc-500">No suppressed addresses.</p> : null}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border border-white/10 px-3 py-2">
              <div>
                <div>{r.email}</div>
                <div className="text-xs text-zinc-500">{r.reason}</div>
              </div>
              <button className="rounded border border-rose-500/30 px-2 py-1 text-xs text-rose-200" onClick={async () => {
                if (!confirm('Remove suppression entry?')) return;
                await fetch('/api/suppression', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
                await load();
              }}>Remove</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
