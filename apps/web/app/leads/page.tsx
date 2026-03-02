'use client';

import { useEffect, useState } from 'react';

type Lead = { id: string; email: string; first_name: string | null; company: string | null; status: string };

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');

  async function load() {
    const data = await fetch('/api/leads').then((r) => r.json());
    setLeads(data.leads || []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h2>Leads</h2>
      <section className="rounded-xl border border-white/10 p-4 space-y-3">
        <p className="text-sm font-medium">Create lead</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
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

      <section className="rounded-xl border border-white/10 p-4">
        <p className="mb-2 text-sm font-medium">Lead list</p>
        <div className="space-y-1 text-sm">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between rounded border border-white/10 px-3 py-2">
              <div>{lead.email} {lead.first_name ? <span className="text-zinc-500">({lead.first_name})</span> : null}</div>
              <span className="text-xs text-zinc-400">{lead.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
