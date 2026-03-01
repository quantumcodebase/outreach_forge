'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmptyState, ErrorState, LoadingSkeleton, StatusBadge } from '../../components/shared/states';
import { useToast } from '../../components/ui/toast';
import type { InboxResponse, InboxThread, ThreadMessage, ThreadMessagesResponse } from '../../lib/types';

const labels = ['Interested', 'Not Now', 'Unsubscribe', 'Wrong Person'] as const;
const views = ['All', 'Unread', ...labels] as const;

const scrub = (value: string | null | undefined) => (value || 'Unknown error').replace(/(password|pass|auth)\s*[:=]\s*\S+/gi, '$1=***').slice(0, 200);

export default function InboxPage() {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<(typeof views)[number]>('All');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('<p>Thanks for your reply.</p>');
  const [sending, setSending] = useState(false);
  const { push } = useToast();
  const searchParams = useSearchParams();

  async function loadThreads() {
    setLoadingThreads(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox');
      const data: InboxResponse = await res.json();
      const list = data.threads || [];
      setThreads(list);
      const fromQuery = searchParams.get('threadId');
      setSelectedThreadId((prev) => prev || fromQuery || list[0]?.threadId || null);
    } catch {
      setError('Unable to load inbox.');
    } finally {
      setLoadingThreads(false);
    }
  }

  async function loadMessages(threadId: string) {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/inbox?threadId=${encodeURIComponent(threadId)}`);
      const data: ThreadMessagesResponse = await res.json();
      setMessages(data.messages || []);
      const last = data.messages?.[data.messages.length - 1];
      if (last) {
        await fetch('/api/inbox/read', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId: last.id, threadId })
        });
      }
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (selectedThreadId) loadMessages(selectedThreadId);
  }, [selectedThreadId]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const qMatch = `${t.from} ${t.subject} ${t.preview}`.toLowerCase().includes(search.toLowerCase());
      const vMatch = view === 'All' ? true : view === 'Unread' ? t.unread : t.label === view;
      return qMatch && vMatch;
    });
  }, [threads, search, view]);

  async function addLabel(label: string) {
    const last = messages[messages.length - 1];
    if (!selectedThreadId || !last) return;
    await fetch('/api/inbox/label', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageId: last.id, threadId: selectedThreadId, label })
    });
    push({ kind: 'success', title: 'Thread labeled', description: label });
    await loadThreads();
  }

  async function sendReply() {
    const parent = [...messages].reverse().find((m) => m.direction === 'received' && m.message_id_header);
    if (!parent) {
      push({ kind: 'error', title: 'Reply failed', description: 'No parent message-id available.' });
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ parentMessageId: parent.id, html: draft })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(scrub(data.error));
      push({ kind: 'success', title: 'Reply sent', description: 'Message was added to thread.' });
      if (selectedThreadId) await loadMessages(selectedThreadId);
      await loadThreads();
    } catch (e) {
      push({ kind: 'error', title: 'Send failed', description: scrub(e instanceof Error ? e.message : String(e)) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid min-h-[70vh] grid-cols-12 gap-4">
      <section className="col-span-4 rounded-xl border border-white/10 bg-black/20">
        <div className="space-y-3 border-b border-white/10 p-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search threads" className="h-9 w-full rounded-md border border-white/15 bg-zinc-900 px-3 text-sm" />
          <div className="flex flex-wrap gap-1">
            {views.map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-full border px-2.5 py-1 text-xs ${view === v ? 'border-white/40 bg-white/10 text-white' : 'border-white/15 text-zinc-400 hover:text-zinc-200'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-2">
          {loadingThreads ? (
            <LoadingSkeleton rows={8} />
          ) : error ? (
            <ErrorState title="Inbox unavailable" description={error} retry={loadThreads} />
          ) : filteredThreads.length === 0 ? (
            <EmptyState title={threads.length === 0 ? 'No messages yet' : 'No threads match this view'} description={threads.length === 0 ? 'Waiting for first sync… test account connection to confirm IMAP/SMTP access.' : 'Try a different filter or search term.'} />
          ) : (
            filteredThreads.map((t) => (
              <button key={t.threadId} onClick={() => setSelectedThreadId(t.threadId)} className={`mb-2 w-full rounded-lg border p-3 text-left ${selectedThreadId === t.threadId ? 'border-white/30 bg-white/10' : 'border-white/10 hover:bg-white/[0.03]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{t.subject}</p>
                  <span className="text-xs text-zinc-500">{t.received_at ? new Date(t.received_at).toLocaleTimeString() : '-'}</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-300">{t.from} {t.unread ? <span className="text-sky-300">• unread</span> : null}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{t.preview}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-zinc-300">{t.account}</span>
                  {t.label ? <span className="text-[10px] text-zinc-400">{t.label}</span> : null}
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="col-span-6 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
        {!selectedThreadId ? (
          <EmptyState title="No thread selected" description="Select a thread from the left pane to view messages." />
        ) : loadingMessages ? (
          <LoadingSkeleton rows={6} />
        ) : messages.length === 0 ? (
          <EmptyState title="No messages in this thread" description="This thread is empty right now." />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {labels.map((l) => (
                <button key={l} onClick={() => addLabel(l)} className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10">{l}</button>
              ))}
            </div>
            <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
              {messages.map((m) => (
                <article key={m.id} className="rounded-lg border border-white/10 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                    <StatusBadge status={m.direction === 'received' ? 'active' : 'paused'} />
                    <span>{m.received_at || m.sent_at ? new Date((m.received_at || m.sent_at) as string).toLocaleString() : '-'}</span>
                  </div>
                  <p className="text-sm font-medium">{m.subject || '(no subject)'}</p>
                  <p className="mt-1 text-sm text-zinc-300">{m.body_preview || ''}</p>
                </article>
              ))}
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-sm font-semibold">Reply</p>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="h-32 w-full rounded-md border border-white/15 bg-zinc-900 p-2 text-sm" />
              <button onClick={sendReply} disabled={sending} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-60">{sending ? 'Sending…' : 'Send'}</button>
            </div>
          </>
        )}
      </section>

      <aside className="col-span-2 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
        <p className="text-sm font-semibold text-zinc-100">Thread metadata</p>
        {selectedThreadId ? (
          <>
            <p><span className="text-zinc-500">thread_id</span><br />{selectedThreadId}</p>
            <p><span className="text-zinc-500">messages</span><br />{messages.length}</p>
            <p><span className="text-zinc-500">latest timestamp</span><br />{messages[messages.length - 1]?.received_at || messages[messages.length - 1]?.sent_at || '-'}</p>
          </>
        ) : (
          <p className="text-zinc-500">Select a thread to inspect metadata.</p>
        )}
      </aside>
    </div>
  );
}
