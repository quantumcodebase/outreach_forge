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
  const [syncing, setSyncing] = useState(false);
  const [fixing, setFixing] = useState<Account | null>(null);
  const [fixPassword, setFixPassword] = useState('');
  const [fixSaving, setFixSaving] = useState(false);
  const [fixTesting, setFixTesting] = useState(false);
  const [fixActivating, setFixActivating] = useState(false);
  const [fixTestOk, setFixTestOk] = useState(false);
  const [fixTestResult, setFixTestResult] = useState<string | null>(null);
  const { push } = useToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts');
      if (!res.ok) {
        setError(`Server responded with ${res.status}.`);
        setAccounts([]);
        return;
      }
      const data: AccountsResponse = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      setError('Server responded with an invalid payload.');
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

  async function syncNow(accountId?: string) {
    setSyncing(true);
    try {
      const res = await fetch('/api/accounts/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(accountId ? { accountId } : {}) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('Failed to queue sync');
      push({ kind: 'success', title: 'Sync queued', description: 'Worker will process inbox updates shortly.' });
    } catch {
      push({ kind: 'error', title: 'Sync failed', description: 'Could not queue IMAP sync. Check worker logs.' });
    } finally {
      setSyncing(false);
    }
  }

  function openFix(account: Account) {
    setFixing(account);
    setFixPassword('');
    setFixTestOk(false);
    setFixTestResult(null);
  }

  async function saveFixedCredentials() {
    if (!fixing || !fixPassword.trim()) return;
    setFixSaving(true);
    try {
      const res = await fetch(`/api/accounts/${fixing.id}/credentials`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: fixPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update credentials');
      push({ kind: 'success', title: 'Credentials updated', description: 'Saved securely. Testing connection now…' });
      await testFixedConnection();
      await load();
    } catch {
      push({ kind: 'error', title: 'Update failed', description: 'Could not save credentials.' });
    } finally {
      setFixSaving(false);
    }
  }

  async function testFixedConnection() {
    if (!fixing || !fixPassword.trim()) return;
    setFixTesting(true);
    try {
      const res = await fetch('/api/accounts/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imap_host: fixing.imap_host,
          imap_port: fixing.imap_port,
          imap_user: fixing.imap_user,
          smtp_host: fixing.smtp_host,
          smtp_port: fixing.smtp_port,
          smtp_user: fixing.smtp_user,
          password: fixPassword
        })
      });
      const data: AccountTestResponse = await res.json();
      const ok = data.imap.ok && data.smtp.ok;
      setFixTestOk(ok);
      const imap = data.imap.ok ? 'IMAP OK' : `IMAP failed (${scrub(data.imap.error)})`;
      const smtp = data.smtp.ok ? 'SMTP OK' : `SMTP failed (${scrub(data.smtp.error)})`;
      setFixTestResult(`${imap} • ${smtp}`);
    } catch {
      setFixTestOk(false);
      setFixTestResult('Connection test failed.');
    } finally {
      setFixTesting(false);
    }
  }

  async function activateFixedAccount() {
    if (!fixing) return;
    setFixActivating(true);
    try {
      const res = await fetch(`/api/accounts/${fixing.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Activation failed');
      push({ kind: 'success', title: 'Account activated', description: 'Sync can run now.' });
      setFixing(null);
      setFixPassword('');
      await load();
    } catch {
      push({ kind: 'error', title: 'Activation failed', description: 'Credentials are still invalid or account failed validation.' });
    } finally {
      setFixActivating(false);
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
          <div className="flex gap-2">
            <button onClick={() => syncNow()} disabled={syncing} className="rounded-md border border-white/20 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-60">
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button onClick={() => setDrawerOpen(true)} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200">
              Add account
            </button>
          </div>
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
          <tr><td colSpan={7} className="p-4"><ErrorState title="Couldn’t load accounts" description={error} retry={load} /></td></tr>
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
              <td className="px-4 py-3 space-x-2">
                <button onClick={() => setDrawerOpen(true)} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">Test</button>
                <button onClick={() => syncNow(a.id)} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">Sync now</button>
                {a.status === 'error' ? <button onClick={() => openFix(a)} className="rounded border border-amber-400/50 px-2 py-1 text-xs text-amber-200 hover:bg-amber-400/10">Fix</button> : null}
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
              <h2 className="text-xl">Add account</h2>
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

      {fixing ? (
        <div className="fixed inset-0 z-40 flex bg-black/60" role="dialog" aria-modal="true">
          <button className="flex-1" onClick={() => setFixing(null)} aria-label="Close" />
          <div className="w-full max-w-lg space-y-4 border-l border-white/10 bg-zinc-950 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Fix credentials</h2>
              <button onClick={() => setFixing(null)} className="text-sm text-zinc-400 hover:text-zinc-100">Close</button>
            </div>
            <p className="text-sm text-zinc-400">{fixing.label} • {maskUser(fixing.smtp_user)}</p>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-zinc-400">Mailbox password</span>
              <input type="password" className="h-10 w-full rounded-md border border-white/15 bg-zinc-900 px-3" value={fixPassword} onChange={(e) => setFixPassword(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={saveFixedCredentials} disabled={fixSaving || !fixPassword.trim()} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-60">{fixSaving ? 'Saving…' : 'Save credentials'}</button>
              <button onClick={testFixedConnection} disabled={fixTesting || !fixPassword.trim()} className="rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60">{fixTesting ? 'Testing…' : 'Test connection'}</button>
              <button onClick={activateFixedAccount} disabled={fixActivating || !fixTestOk} className="rounded-md border border-emerald-400/50 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50">{fixActivating ? 'Activating…' : 'Activate'}</button>
            </div>
            {fixTestResult ? <p className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-sm">{fixTestResult}</p> : null}
            {!fixTestOk ? <p className="text-xs text-zinc-500">Activate unlocks after IMAP + SMTP test pass.</p> : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-4 text-sm text-zinc-300">
        <p className="mb-2 font-medium text-zinc-100">Phase 1 real mailbox checklist</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create mailbox in IONOS (use mailbox password, not IONOS account login).</li>
          <li>Username must be full email address.</li>
          <li>IMAP: imap.ionos.com:993 SSL • SMTP: smtp.ionos.com:587 STARTTLS.</li>
          <li>Add/fix account → Test connection (IMAP OK + SMTP OK) → Activate.</li>
          <li>Click Sync now, confirm Inbox has at least one thread, then reply from cockpit.</li>
        </ul>
      </div>
    </div>
  );
}
