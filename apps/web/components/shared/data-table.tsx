import type { ReactNode } from 'react';

type Header = { key: string; label: string; onSort?: () => void; sortable?: boolean };

export function DataTable({
  title,
  search,
  onSearch,
  searchPlaceholder,
  rightSlot,
  headers,
  children
}: {
  title: string;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  rightSlot?: ReactNode;
  headers: Header[];
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <div className="flex items-center gap-2">
          {onSearch ? (
            <input
              value={search ?? ''}
              onChange={(e) => onSearch(e.target.value)}
              className="h-9 w-56 rounded-md border border-white/15 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder={searchPlaceholder ?? 'Search'}
            />
          ) : null}
          {rightSlot}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              {headers.map((h) => (
                <th key={h.key} className="px-4 py-3 font-medium">
                  {h.sortable ? (
                    <button className="hover:text-zinc-200" onClick={h.onSort}>
                      {h.label}
                    </button>
                  ) : (
                    h.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">{children}</tbody>
        </table>
      </div>
    </section>
  );
}
