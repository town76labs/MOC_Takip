import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Sıralama için kullanılacak ham değer. Yoksa render değerine düşer. */
  sortValue?: (row: T) => string | number | Date;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Arama yapılırken bu kolon değerleri taranır. Yoksa kolon araması yok. */
  searchValue?: (row: T) => string;
  sortable?: boolean;
}

interface Props<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  /** Her satır için unique key. */
  rowKey: (row: T) => string;
  emptyMessage?: string;
  searchable?: boolean;
  initialSortKey?: string;
  initialSortDir?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  emptyMessage = 'Sonuç bulunamadı.',
  searchable = true,
  initialSortKey,
  initialSortDir = 'asc',
  onRowClick,
  rowClassName,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.trim().toLocaleLowerCase('tr');
    return data.filter((row) =>
      columns.some((c) => {
        if (!c.searchValue) return false;
        return c.searchValue(row).toLocaleLowerCase('tr').includes(q);
      }),
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      let cmp: number;
      if (va instanceof Date && vb instanceof Date) cmp = va.getTime() - vb.getTime();
      else if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'tr');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, columns]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tabloda ara..."
            className="input pl-9"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/90">
            <tr>
              {columns.map((c) => {
                const canSort = c.sortable !== false && !!c.sortValue;
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    className={`px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 ${
                      c.className ?? ''
                    } ${canSort ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => canSort && toggleSort(c.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.header}
                      {canSort && active && (sortDir === 'asc' ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition ${
                    onRowClick ? 'cursor-pointer hover:bg-brand-50/35' : ''
                  } ${
                    rowClassName ? rowClassName(row) : ''
                  }`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3.5 text-sm text-slate-700 ${c.className ?? ''}`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
