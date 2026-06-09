import { DataTable, type DataTableColumn } from '../common/DataTable';
import type { ActionCategory, ActionMOC } from '../../types';
import { eq, formatDate, isPastDue } from '../../lib/normalize';

interface Props {
  mocs: ActionMOC[];
  category: ActionCategory;
  onRowClick: (m: ActionMOC) => void;
  sorumluFilter?: string[];
}

export function ActionCategoryTable({
  mocs,
  category,
  onRowClick,
  sorumluFilter = [],
}: Props) {
  const visibleSorumlular = (r: ActionMOC) => {
    if (sorumluFilter.length === 0) return r.sorumlular;
    return r.sorumlular.filter((s) =>
      sorumluFilter.some((selected) => eq(selected, s)),
    );
  };

  const columns: DataTableColumn<ActionMOC>[] = [
    {
      key: 'mocFormNo',
      header: 'MOC No',
      sortValue: (r) => r.mocFormNo,
      searchValue: (r) => r.mocFormNo,
      render: (r) => (
        <span className="font-medium text-brand-700 hover:underline">{r.mocFormNo}</span>
      ),
    },
    {
      key: 'sirket',
      header: 'Şirket',
      sortValue: (r) => r.sirket,
      searchValue: (r) => r.sirket,
      render: (r) => r.sirket,
    },
    {
      key: 'sorumlular',
      header: 'Sorumlular',
      searchValue: (r) => visibleSorumlular(r).join(', '),
      sortValue: (r) => visibleSorumlular(r).join(', '),
      render: (r) => {
        const names = visibleSorumlular(r);
        return names.length === 0 ? (
          <span className="text-slate-400 italic">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {names.map((s) => (
              <span
                key={s}
                className="badge bg-slate-100 text-slate-700 border border-slate-200"
              >
                {s}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'hedefTarih',
      header: 'Hedef Tarih',
      sortValue: (r) => (r.hedefTarih ? r.hedefTarih : new Date(9999, 0, 1)),
      render: (r) => {
        const overdue = isPastDue(r.hedefTarih);
        return (
          <span
            className={
              overdue
                ? 'text-rose-700 font-medium'
                : 'text-slate-700'
            }
          >
            {formatDate(r.hedefTarih)}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      data={mocs}
      columns={columns}
      rowKey={(r) => r.rowId}
      onRowClick={onRowClick}
      emptyMessage="Bu kategoride MOC bulunamadı."
      // Gecikmiş tablosunda satırı kırmızı yapma (badge'i zaten Hedef Tarih sütunu gösteriyor)
      rowClassName={
        category === 'gecikmis'
          ? () => 'bg-rose-50/40'
          : undefined
      }
    />
  );
}
