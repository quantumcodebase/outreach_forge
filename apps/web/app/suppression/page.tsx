'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable } from '../../components/shared/data-table';

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
      <section className="space-y-3 rounded-xl border border-white/10 p-4">
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

      <DataTable
        title="Suppressed addresses"
        tableMinWidthClass="min-w-[900px]"
        headers={[
          { key: 'email', label: 'Email' },
          { key: 'reason', label: 'Reason' },
          { key: 'added', label: 'Added at' },
          { key: 'actions', label: 'Actions' }
        ]}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">No suppressed addresses.</td>
          </tr>
        ) : rows.map((r) => (
          <tr key={r.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3 whitespace-nowrap">{r.email}</td>
            <td className="px-4 py-3 whitespace-nowrap text-zinc-300">{r.reason}</td>
            <td className="px-4 py-3 whitespace-nowrap text-zinc-400">{new Date(r.added_at).toLocaleString()}</td>
            <td className="px-4 py-3 whitespace-nowrap">
              <button className="rounded border border-rose-500/30 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/10" onClick={async () => {
                if (!confirm('Remove suppression entry?')) return;
                await fetch('/api/suppression', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
                await load();
              }}>Remove</button>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
