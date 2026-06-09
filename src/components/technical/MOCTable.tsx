import { DataTable, type DataTableColumn } from '../common/DataTable';
import { TechnicalStatusBadge } from '../common/StatusBadge';
import {
  openTechnicalTerminDates,
  technicalOpinionItems,
  usersWithoutTechnicalOpinion,
} from '../../lib/technicalLogic';
import { formatDate } from '../../lib/normalize';
import type { TechnicalMOC } from '../../types';

interface Props {
  mocs: TechnicalMOC[];
  onRowClick: (m: TechnicalMOC) => void;
  showPendingUsers?: boolean;
  showAllUsers?: boolean;
}

export function MOCTable({
  mocs,
  onRowClick,
  showPendingUsers = false,
  showAllUsers = false,
}: Props) {
  const columns: DataTableColumn<TechnicalMOC>[] = [
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
      key: 'kullanici',
      header: showAllUsers
        ? 'Teknik Görüş Kullanıcıları'
        : showPendingUsers
          ? 'Görüş Vermeyen'
          : 'Kullanıcı Sayısı',
      sortValue: (r) =>
        showAllUsers
          ? technicalOpinionItems(r)
              .map((item) => `${item.kullanici} ${item.durum}`)
              .join(', ')
          : showPendingUsers
          ? usersWithoutTechnicalOpinion(r).join(', ')
          : r.kullanicilar.length,
      searchValue: (r) =>
        showAllUsers
          ? technicalOpinionItems(r)
              .map((item) => `${item.kullanici} ${item.durum}`)
              .join(', ')
          : showPendingUsers
            ? usersWithoutTechnicalOpinion(r).join(', ')
            : '',
      render: (r) => {
        if (showAllUsers) {
          const users = technicalOpinionItems(r);
          return users.length === 0 ? (
            <span className="text-slate-400 italic">-</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {users.map((user) => (
                <span
                  key={`${user.kullanici}-${user.durum}-${user.terminTarihi?.getTime() ?? 'no-date'}`}
                  className="badge bg-violet-50 text-violet-800 border border-violet-200"
                >
                  {user.kullanici}
                  {user.durum ? ` · ${user.durum}` : ''}
                </span>
              ))}
            </div>
          );
        }
        if (!showPendingUsers) return r.kullanicilar.length;
        const users = usersWithoutTechnicalOpinion(r);
        return users.length === 0 ? (
          <span className="text-slate-400 italic">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {users.map((user) => (
              <span
                key={user}
                className="badge bg-amber-50 text-amber-800 border border-amber-200"
              >
                {user}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Durum',
      sortValue: (r) => r.status,
      searchValue: (r) =>
        `${r.status} ${r.bilgiNotuPaylasilmamis ? 'MOC Bilgi Notu Paylaşılmamış' : ''}`,
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <TechnicalStatusBadge status={r.status} />
          {r.bilgiNotuPaylasilmamis && (
            <TechnicalStatusBadge status="bilgi_notu_paylasilmamis" />
          )}
        </div>
      ),
    },
  ];

  if (showPendingUsers || showAllUsers) {
    columns.splice(3, 0, {
      key: 'terminTarihi',
      header: 'Termin Tarihi',
      sortValue: (r) =>
        openTechnicalTerminDates(r)[0]?.getTime() ?? Number.POSITIVE_INFINITY,
      searchValue: (r) =>
        openTechnicalTerminDates(r).map((date) => formatDate(date)).join(', '),
      render: (r) => {
        const dates = openTechnicalTerminDates(r);
        return dates.length === 0 ? (
          <span className="text-slate-400 italic">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {dates.map((date) => (
              <span
                key={date.getTime()}
                className="badge bg-slate-50 text-slate-700 border border-slate-200"
              >
                {formatDate(date)}
              </span>
            ))}
          </div>
        );
      },
    });
  }

  return (
    <DataTable
      data={mocs}
      columns={columns}
      rowKey={(r) => r.mocFormNo}
      onRowClick={onRowClick}
      emptyMessage="Bu kategoride MOC bulunamadı."
    />
  );
}
