import type { ReactNode } from 'react';

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === 'active' || normalized === 'sent' || normalized === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200'
      : normalized === 'paused' || normalized === 'pending'
        ? 'border-amber-500/35 bg-amber-500/12 text-amber-200'
        : normalized === 'unread' || normalized === 'queued'
          ? 'border-sky-500/35 bg-sky-500/12 text-sky-200'
          : 'border-rose-500/35 bg-rose-500/12 text-rose-200';

  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize tracking-wide ${styles}`}>{status}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="panel-subtle p-8 text-center">
      <h3 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, description, retry }: { title: string; description: string; retry?: () => void }) {
  return (
    <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-xs text-amber-200">!</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-100">{title}</p>
          <p className="mt-0.5 text-xs text-amber-100/80">{description}</p>
          {retry ? (
            <button onClick={retry} className="mt-2 rounded-md border border-amber-100/30 bg-amber-900/30 px-2.5 py-1 text-xs text-amber-50 hover:bg-amber-800/40">
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg border border-white/10 bg-gradient-to-r from-white/[0.04] to-white/[0.02]" />
      ))}
    </div>
  );
}
