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
  const [statusFilter, setStatusFilter] = useState<'default' | 'all' | 'active' | 'paused' | 'error'>('default');
  const [syncing, setSyncing] = useState(false);
  const [proofAccountId, setProofAccountId] = useState('');
  const [fixing, setFixing] = useState<Account | null>(null);
  const [fixPassword, setFixPassword] = useState('');
  const [fixSaving, setFixSaving] = useState(false);
  const [fixTesting, setFixTesting] = useState(false);
  const [fixActivating, setFixActivating] = useState(false);
  const [fixTestOk, setFixTestOk] = useState(false);
  const [fixTestResult, setFixTestResult] = useState<string | null>(null);

  const [editing, setEditing] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editTesting, setEditTesting] = useState(false);
  const [editActivating, setEditActivating] = useState(false);
  const [editTestOk, setEditTestOk] = useState(false);
  const [editTestResult, setEditTestResult] = useState<string | null>(null);
  const [editTestPassword, setEditTestPassword] = useState('');
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

  useEffect(() => {
    if (!accounts.length) {
      setProofAccountId('');
      return;
    }
    if (!proofAccountId || !accounts.some((a) => a.id === proofAccountId)) {
      setProofAccountId(accounts[0]?.id ?? '');
    }
  }, [accounts, proofAccountId]);

  const filtered = useMemo(() => {
    const searched = accounts.filter((a) => `${a.label} ${a.smtp_user}`.toLowerCase().includes(query.toLowerCase()));
    const visible = searched.filter((a) => {
      if (statusFilter === 'default') return a.status === 'active' || a.status === 'paused';
      if (statusFilter === 'all') return true;
      return a.status === statusFilter;
    });
    return [...visible].sort((a, b) => (sortAsc ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)));
  }, [accounts, query, sortAsc, statusFilter]);

  const hiddenErrorCount = useMemo(() => {
    if (statusFilter !== 'default') return 0;
    return accounts.filter((a) => a.status === 'error').length;
  }, [accounts, statusFilter]);

  const selectedProofAccount = useMemo(() => {
    if (!proofAccountId) return accounts[0] ?? null;
    return accounts.find((a) => a.id === proofAccountId) ?? null;
  }, [accounts, proofAccountId]);

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
    const account = accountId ? accounts.find((a) => a.id === accountId) : null;
    if (account && account.status !== 'active') {
      const ok = window.confirm('This account is not active. Sync may fail and mark error. Continue anyway?');
      if (!ok) return;
    }

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

  function openEdit(account: Account) {
    setEditing(account);
    const toHms = (v: string | undefined, fallback: string) => (v && v.includes('T') ? v.slice(11, 19) : (v || fallback));
    setEditForm({
      label: account.label,
      imap_host: account.imap_host,
      imap_port: account.imap_port,
      imap_user: account.imap_user,
      smtp_host: account.smtp_host,
      smtp_port: account.smtp_port,
      smtp_user: account.smtp_user,
      timezone: account.timezone,
      daily_cap: account.daily_cap,
      sending_window_start: toHms(account.sending_window_start, defaults.sending_window_start),
      sending_window_end: toHms(account.sending_window_end, defaults.sending_window_end)
    });
    setEditTestPassword('');
    setEditTestOk(false);
    setEditTestResult(null);
  }

  function applyIonosDefaults() {
    if (!editForm) return;
    const user = editForm.imap_user || editForm.smtp_user || '';
    setEditForm((prev: any) => ({
      ...prev,
      imap_host: 'imap.ionos.com',
      imap_port: 993,
      smtp_host: 'smtp.ionos.com',
      smtp_port: 587,
      imap_user: user,
      smtp_user: user
    }));
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

  async function saveSettings() {
    if (!editing || !editForm) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/accounts/${editing.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save settings');
      push({ kind: 'success', title: 'Settings saved', description: 'Account moved to paused. Test and activate when ready.' });
      await load();
    } catch {
      push({ kind: 'error', title: 'Save failed', description: 'Could not update connection settings.' });
    } finally {
      setEditSaving(false);
    }
  }

  async function testEditedConnection() {
    if (!editForm || !editTestPassword.trim()) return;
    setEditTesting(true);
    try {
      const res = await fetch('/api/accounts/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...editForm, password: editTestPassword })
      });
      const data: AccountTestResponse = await res.json();
      const ok = data.imap.ok && data.smtp.ok;
      setEditTestOk(ok);
      const imap = data.imap.ok ? 'IMAP OK' : `IMAP failed (${scrub(data.imap.error)})`;
      const smtp = data.smtp.ok ? 'SMTP OK' : `SMTP failed (${scrub(data.smtp.error)})`;
      setEditTestResult(`${imap} • ${smtp}`);
    } catch {
      setEditTestOk(false);
      setEditTestResult('Connection test failed.');
    } finally {
      setEditTesting(false);
    }
  }

  async function activateEditedAccount() {
    if (!editing) return;
    setEditActivating(true);
    try {
      const res = await fetch(`/api/accounts/${editing.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Activation failed');
      push({ kind: 'success', title: 'Account activated', description: 'Sync can run now.' });
      setEditing(null);
      await load();
    } catch {
      push({ kind: 'error', title: 'Activation failed', description: 'Stored credentials are invalid. Use Fix to re-enter password.' });
    } finally {
      setEditActivating(false);
    }
  }

  async function copySafeDebug() {
    if (!selectedProofAccount) return;
    const payload = {
      account_id: selectedProofAccount.id,
      status: selectedProofAccount.status,
      imap_host: selectedProofAccount.imap_host,
      imap_port: selectedProofAccount.imap_port,
      smtp_host: selectedProofAccount.smtp_host,
      smtp_port: selectedProofAccount.smtp_port,
      masked_user: maskUser(selectedProofAccount.smtp_user || selectedProofAccount.imap_user || ''),
      last_synced_at: selectedProofAccount.last_synced_at
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      push({ kind: 'success', title: 'Safe debug copied', description: 'Redacted account snapshot copied to clipboard.' });
    } catch {
      push({ kind: 'error', title: 'Copy failed', description: 'Clipboard access was blocked by the browser.' });
    }
  }

  async function copyProofChecklistTemplate() {
    if (!selectedProofAccount) return;

    const redactedAccountId = `${selectedProofAccount.id.slice(0, 6)}…`;
    const template = `# Phase 1 Proof Capture\n\n- Account ID (redacted): ${redactedAccountId}\n- IMAP/SMTP test result (stage + ok): \n- Activation status: \n- Sync timestamp: \n- Inbox thread count: \n- Reply stored (yes/no): \n`;

    try {
      await navigator.clipboard.writeText(template);
      push({ kind: 'success', title: 'Proof template copied', description: 'Safe proof checklist copied to clipboard.' });
    } catch {
      push({ kind: 'error', title: 'Copy failed', description: 'Clipboard access was blocked by the browser.' });
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
          <div className="flex flex-wrap items-center gap-2">
            {statusFilter === 'default' ? <span className="text-xs text-zinc-400">Default: Active + Paused</span> : null}
            <div className="inline-flex rounded-md border border-white/15 bg-[#101722]/80 p-0.5 text-xs">
              <button onClick={() => setStatusFilter('all')} className={`rounded px-2 py-1 ${statusFilter === 'all' ? 'bg-sky-500/20 text-sky-100' : 'text-zinc-300 hover:bg-white/10'}`}>All</button>
              <button onClick={() => setStatusFilter('active')} className={`rounded px-2 py-1 ${statusFilter === 'active' ? 'bg-sky-500/20 text-sky-100' : 'text-zinc-300 hover:bg-white/10'}`}>Active</button>
              <button onClick={() => setStatusFilter('paused')} className={`rounded px-2 py-1 ${statusFilter === 'paused' ? 'bg-sky-500/20 text-sky-100' : 'text-zinc-300 hover:bg-white/10'}`}>Paused</button>
              <button onClick={() => setStatusFilter('error')} className={`rounded px-2 py-1 ${statusFilter === 'error' ? 'bg-sky-500/20 text-sky-100' : 'text-zinc-300 hover:bg-white/10'}`}>Error</button>
            </div>
            {hiddenErrorCount > 0 ? (
              <button onClick={() => setStatusFilter('error')} className="text-xs text-amber-300 underline underline-offset-2 hover:text-amber-200">
                  {hiddenErrorCount} error accounts hidden · View
              </button>
            ) : null}
            <button onClick={() => syncNow()} disabled={syncing} className="btn disabled:opacity-60">
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button onClick={() => setDrawerOpen(true)} className="btn btn-primary">
              Add account
            </button>
          </div>
        }
        tableMinWidthClass="min-w-[1200px]"
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
              <EmptyState title="No accounts connected" description="Add an account to start syncing inbox threads." action={<button onClick={() => setDrawerOpen(true)} className="btn">Add account</button>} />
            </td>
          </tr>
        ) : (
          filtered.map((a) => (
            <tr key={a.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 whitespace-nowrap">{a.label}</td>
              <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={a.status} /></td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-300">{maskUser(a.smtp_user)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{a.daily_cap}</td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-300">{a.timezone}</td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-400">{a.last_synced_at ? new Date(a.last_synced_at).toLocaleString() : 'Never'}</td>
              <td className="px-4 py-3 whitespace-nowrap space-x-2">
                <button onClick={() => openEdit(a)} className="btn px-2 py-1 text-xs">Test + activate</button>
                <button onClick={() => openEdit(a)} className="btn px-2 py-1 text-xs">Edit</button>
                <button onClick={() => syncNow(a.id)} className="btn px-2 py-1 text-xs">Sync now</button>
                {a.status === 'error' ? <button onClick={() => openFix(a)} className="btn border-amber-400/50 bg-amber-400/10 px-2 py-1 text-xs text-amber-200">Fix</button> : null}
              </td>
            </tr>
          ))
        )}
      </DataTable>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex bg-black/60" role="dialog" aria-modal="true">
          <button className="flex-1" onClick={() => setDrawerOpen(false)} aria-label="Close" />
          <div className="w-full max-w-xl space-y-4 border-l border-white/10 bg-[#0a0f18] p-6">
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
                    className="h-10 w-full rounded-md border px-3"
                    value={String(v)}
                    onChange={(e) => setForm((prev) => ({ ...prev, [k]: k.includes('port') || k === 'daily_cap' ? Number(e.target.value) : e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveAccount} disabled={saving} className="btn btn-primary disabled:opacity-60">{saving ? 'Saving...' : 'Save account'}</button>
              <button onClick={testConnection} disabled={testing} className="btn disabled:opacity-60">{testing ? 'Testing...' : 'Test connection'}</button>
            </div>
            {testResult ? <p className="panel-subtle rounded-md p-3 text-sm">{testResult}</p> : null}
          </div>
        </div>
      ) : null}

      {fixing ? (
        <div className="fixed inset-0 z-40 flex bg-black/60" role="dialog" aria-modal="true">
          <button className="flex-1" onClick={() => setFixing(null)} aria-label="Close" />
          <div className="w-full max-w-lg space-y-4 border-l border-white/10 bg-[#0a0f18] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Fix credentials</h2>
              <button onClick={() => setFixing(null)} className="text-sm text-zinc-400 hover:text-zinc-100">Close</button>
            </div>
            <p className="text-sm text-zinc-400">{fixing.label} • {maskUser(fixing.smtp_user)}</p>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-zinc-400">Mailbox password</span>
              <input type="password" className="h-10 w-full rounded-md border px-3" value={fixPassword} onChange={(e) => setFixPassword(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={saveFixedCredentials} disabled={fixSaving || !fixPassword.trim()} className="btn btn-primary disabled:opacity-60">{fixSaving ? 'Saving…' : 'Save credentials'}</button>
              <button onClick={testFixedConnection} disabled={fixTesting || !fixPassword.trim()} className="btn disabled:opacity-60">{fixTesting ? 'Testing…' : 'Test connection'}</button>
              <button onClick={activateFixedAccount} disabled={fixActivating || !fixTestOk} className="btn border-emerald-400/50 bg-emerald-500/10 text-emerald-200 disabled:opacity-50">{fixActivating ? 'Activating…' : 'Activate'}</button>
            </div>
            {fixTestResult ? <p className="panel-subtle rounded-md p-3 text-sm">{fixTestResult}</p> : null}
            {!fixTestOk ? <p className="text-xs text-zinc-500">Activate unlocks after IMAP + SMTP test pass.</p> : null}
          </div>
        </div>
      ) : null}

      {editing && editForm ? (
        <div className="fixed inset-0 z-40 flex bg-black/60" role="dialog" aria-modal="true">
          <button className="flex-1" onClick={() => setEditing(null)} aria-label="Close" />
          <div className="w-full max-w-2xl space-y-4 border-l border-white/10 bg-[#0a0f18] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Edit account settings</h2>
              <button onClick={() => setEditing(null)} className="text-sm text-zinc-400 hover:text-zinc-100">Close</button>
            </div>
            <p className="text-sm text-zinc-400">Username must be full email address; password is mailbox password.</p>
            <button onClick={applyIonosDefaults} className="btn px-3 py-1 text-xs">Use IONOS defaults</button>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(editForm).map(([k, v]) => (
                <label key={k} className="space-y-1">
                  <span className="text-xs text-zinc-400">{k}</span>
                  <input
                    type="text"
                    className="h-10 w-full rounded-md border px-3"
                    value={String(v)}
                    onChange={(e) => setEditForm((prev: any) => ({ ...prev, [k]: ['imap_port', 'smtp_port', 'daily_cap'].includes(k) ? Number(e.target.value) : e.target.value }))}
                  />
                </label>
              ))}
            </div>

            <label className="space-y-1 text-sm">
              <span className="text-xs text-zinc-400">Mailbox password (for test only)</span>
              <input type="password" className="h-10 w-full rounded-md border px-3" value={editTestPassword} onChange={(e) => setEditTestPassword(e.target.value)} />
            </label>

            <div className="flex flex-wrap gap-2">
              <button onClick={saveSettings} disabled={editSaving} className="btn btn-primary disabled:opacity-60">{editSaving ? 'Saving…' : 'Save settings'}</button>
              <button onClick={testEditedConnection} disabled={editTesting || !editTestPassword.trim()} className="btn disabled:opacity-60">{editTesting ? 'Testing…' : 'Test connection'}</button>
              <button onClick={activateEditedAccount} disabled={editActivating || !editTestOk} className="btn border-emerald-400/50 bg-emerald-500/10 text-emerald-200 disabled:opacity-50">{editActivating ? 'Activating…' : 'Activate'}</button>
            </div>
            {editTestResult ? <p className="panel-subtle rounded-md p-3 text-sm">{editTestResult}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="panel rounded-lg p-4 text-sm text-zinc-300">
        <p className="mb-2 font-medium text-zinc-100">Proof checklist (Phase 1 real mailbox)</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Use IONOS defaults.</li>
          <li>Use full email address as username.</li>
          <li>Fix credentials with mailbox password.</li>
          <li>Test connection → Activate → Sync now.</li>
          <li>Verify <code>/inbox</code> has threads and send one reply.</li>
        </ol>

        <div className="panel-subtle mt-4 flex flex-wrap items-center gap-2 rounded-md p-3">
          <span className="text-xs uppercase tracking-wide text-zinc-400">Safe debug</span>
          <select
            value={selectedProofAccount?.id ?? ''}
            onChange={(e) => setProofAccountId(e.target.value)}
            className="h-9 min-w-[220px] rounded-md border px-3 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label} ({a.status})</option>
            ))}
          </select>
          <button
            onClick={copySafeDebug}
            disabled={!selectedProofAccount}
            className="btn px-3 py-2 text-xs disabled:opacity-50"
          >
            Copy safe debug
          </button>
          <button
            onClick={copyProofChecklistTemplate}
            disabled={!selectedProofAccount}
            className="btn px-3 py-2 text-xs disabled:opacity-50"
          >
            Copy proof checklist template
          </button>
        </div>
      </div>
    </div>
  );
}
