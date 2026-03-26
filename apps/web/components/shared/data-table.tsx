import type { ReactNode } from 'react';

type Header = { key: string; label: string; onSort?: () => void; sortable?: boolean };

export function DataTable({
  title,
  search,
  onSearch,
  searchPlaceholder,
  rightSlot,
  headers,
  children,
  tableMinWidthClass = 'min-w-max'
}: {
  title: string;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  rightSlot?: ReactNode;
  headers: Header[];
  children: ReactNode;
  tableMinWidthClass?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h2>
        <div className="flex items-center gap-2">
          {onSearch ? (
            <input
              value={search ?? ''}
              onChange={(e) => onSearch(e.target.value)}
              className="control w-56"
              placeholder={searchPlaceholder ?? 'Search'}
            />
          ) : null}
          {rightSlot}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="w-full overflow-x-auto pb-1">
          <table className={`w-full ${tableMinWidthClass} whitespace-nowrap text-left text-sm`}>
            <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-zinc-400">
              <tr>
                {headers.map((h) => (
                  <th key={h.key} className="px-4 py-3 font-medium whitespace-nowrap">
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
            <tbody className="divide-y divide-white/5 [&>tr]:transition-colors [&>tr:hover]:bg-white/[0.02]">{children}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
