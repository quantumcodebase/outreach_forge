import type { ReactNode } from 'react';

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === 'active'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : normalized === 'paused'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-rose-500/15 text-rose-300 border-rose-500/30';

  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles}`}>{status}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
      <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, description, retry }: { title: string; description: string; retry?: () => void }) {
  return (
    <div className="rounded-xl border border-rose-500/25 bg-rose-950/20 p-6">
      <h3 className="text-base font-semibold text-rose-200">{title}</h3>
      <p className="mt-1 text-sm text-rose-100/80">{description}</p>
      {retry ? (
        <button onClick={retry} className="mt-4 rounded-md border border-rose-300/30 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-900/30">
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />
      ))}
    </div>
  );
}
