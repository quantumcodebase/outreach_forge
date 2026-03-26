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
      <div className="panel-subtle relative overflow-hidden flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/35 to-transparent" />
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
            <thead className="border-b border-slate-300/15 bg-[linear-gradient(180deg,rgba(41,55,82,0.5),rgba(24,33,48,0.45))] text-xs uppercase tracking-[0.08em] text-slate-300">
              <tr>
                {headers.map((h) => (
                  <th key={h.key} className="px-4 py-3 font-medium whitespace-nowrap">
                    {h.sortable ? (
                      <button className="hover:text-zinc-100" onClick={h.onSort}>
                        {h.label}
                      </button>
                    ) : (
                      h.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300/10 [&>tr]:transition-colors [&>tr:hover]:bg-[linear-gradient(90deg,rgba(106,140,208,0.08),rgba(62,86,130,0.06)_35%,rgba(0,0,0,0)_70%)]">{children}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
