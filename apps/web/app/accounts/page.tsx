'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/shared/data-table';
import { EmptyState, ErrorState, LoadingSkeleton, StatusBadge } from '../../components/shared/states';
import { useToast } from '../../components/ui/toast';
import type { Account, AccountsResponse, AccountTestResponse } from '../../lib/types';

const defaults = {
  label: '',
  imap_host: 'imap.ionos.com',
  imap_port: 993,
  imap_user: '',
  smtp_host: 'smtp.ionos.com',
  smtp_port: 587,
  smtp_user: '',
  password: '',
  timezone: 'America/Puerto_Rico',
  daily_cap: 50,
  sending_window_start: '08:00:00',
  sending_window_end: '17:00:00'
};

const maskUser = (value: string) => {
  const [name, domain] = value.split('@');
  if (!domain) return value.slice(0, 2) + '***';
  return `${name.slice(0, 2)}***@${domain}`;
};

const scrub = (value: string | null | undefined) => (value || 'Unknown error').replace(/(password|pass|auth)\s*[:=]\s*\S+/gi, '$1=***').slice(0, 220);

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const { push } = useToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts');
      const data: AccountsResponse = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      setError('Unable to load accounts. Check server health and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const list = accounts.filter((a) => `${a.label} ${a.smtp_user}`.toLowerCase().includes(query.toLowerCase()));
    return [...list].sort((a, b) => (sortAsc ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)));
  }, [accounts, query, sortAsc]);

  async function saveAccount() {
    setSaving(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.ok) throw new Error('Save failed');
      push({ kind: 'success', title: 'Account saved', description: `Account ${form.label} was created.` });
      setForm({ ...defaults, imap_user: form.imap_user, smtp_user: form.smtp_user });
      setDrawerOpen(false);
      setTestResult(null);
      await load();
    } catch {
      push({ kind: 'error', title: 'Save failed', description: 'Could not save account. Verify fields and try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch('/api/accounts/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data: AccountTestResponse = await res.json();
      const imap = data.imap.ok ? 'IMAP OK' : `IMAP failed (${scrub(data.imap.error)})`;
      const smtp = data.smtp.ok ? 'SMTP OK' : `SMTP failed (${scrub(data.smtp.error)})`;
      setTestResult(`${imap} • ${smtp}`);
      push({ kind: data.imap.ok && data.smtp.ok ? 'success' : 'error', title: 'Connection test finished', description: `${imap} | ${smtp}` });
    } catch {
      push({ kind: 'error', title: 'Connection test failed', description: 'Unable to reach test endpoint.' });
      setTestResult('Connection test failed.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <DataTable
        title="Email Accounts"
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search label or user"
        rightSlot={
          <button onClick={() => setDrawerOpen(true)} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200">
            Add account
          </button>
        }
        headers={[
          { key: 'label', label: 'Label', sortable: true, onSort: () => setSortAsc((s) => !s) },
          { key: 'status', label: 'Status' },
          { key: 'imap', label: 'IMAP user' },
          { key: 'cap', label: 'Daily cap' },
          { key: 'tz', label: 'Timezone' },
          { key: 'sync', label: 'Last synced' },
          { key: 'actions', label: 'Actions' }
        ]}
      >
        {loading ? (
          <tr><td colSpan={7} className="p-4"><LoadingSkeleton rows={4} /></td></tr>
        ) : error ? (
          <tr><td colSpan={7} className="p-4"><ErrorState title="Could not load accounts" description={error} retry={load} /></td></tr>
        ) : filtered.length === 0 ? (
          <tr>
            <td colSpan={7} className="p-4">
              <EmptyState title="No accounts connected" description="Add an account to start syncing inbox threads." action={<button onClick={() => setDrawerOpen(true)} className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10">Add account</button>} />
            </td>
          </tr>
        ) : (
          filtered.map((a) => (
            <tr key={a.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">{a.label}</td>
              <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
              <td className="px-4 py-3 text-zinc-300">{maskUser(a.smtp_user)}</td>
              <td className="px-4 py-3">{a.daily_cap}</td>
              <td className="px-4 py-3 text-zinc-300">{a.timezone}</td>
              <td className="px-4 py-3 text-zinc-400">{a.last_synced_at ? new Date(a.last_synced_at).toLocaleString() : 'Never'}</td>
              <td className="px-4 py-3">
                <button onClick={() => setDrawerOpen(true)} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">Test</button>
              </td>
            </tr>
          ))
        )}
      </DataTable>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex bg-black/60" role="dialog" aria-modal="true">
          <button className="flex-1" onClick={() => setDrawerOpen(false)} aria-label="Close" />
          <div className="w-full max-w-xl space-y-4 border-l border-white/10 bg-zinc-950 p-6">
            <div className="flex items-center justify-between">
              <h2>Add account</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-sm text-zinc-400 hover:text-zinc-100">Close</button>
            </div>
            <p className="text-sm text-zinc-400">Passwords are never shown after save. Connection tests return only redacted details.</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(form).map(([k, v]) => (
                <label key={k} className="space-y-1">
                  <span className="text-xs text-zinc-400">{k}</span>
                  <input
                    type={k.includes('password') ? 'password' : 'text'}
                    className="h-10 w-full rounded-md border border-white/15 bg-zinc-900 px-3"
                    value={String(v)}
                    onChange={(e) => setForm((prev) => ({ ...prev, [k]: k.includes('port') || k === 'daily_cap' ? Number(e.target.value) : e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveAccount} disabled={saving} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-60">{saving ? 'Saving...' : 'Save account'}</button>
              <button onClick={testConnection} disabled={testing} className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60">{testing ? 'Testing...' : 'Test connection'}</button>
            </div>
            {testResult ? <p className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm">{testResult}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
