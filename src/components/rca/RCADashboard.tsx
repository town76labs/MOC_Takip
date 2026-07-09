import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  FileSearch,
  FilterX,
  Loader2,
  UserRound,
} from 'lucide-react';
import type { RCACompany, RCARow } from '../../types';
import { useDataStore } from '../../store/dataStore';
import { formatDate } from '../../lib/normalize';
import { downloadRCAReportPdf } from '../../lib/rcaReportPdf';
import {
  DataTable,
  type DataTableColumn,
} from '../common/DataTable';
import { Modal } from '../common/Modal';

const COMPANY_CONFIG: {
  key: RCACompany;
  label: string;
  color: string;
}[] = [
  {
    key: 'PETKIM',
    label: 'Petkim',
    color: '#38bdf8',
  },
  {
    key: 'STAR',
    label: 'Star',
    color: '#ef4444',
  },
  {
    key: 'STAD',
    label: 'STAD',
    color: '#22c55e',
  },
];

export function RCADashboard() {
  const rows = useDataStore((state) => state.rcaRows);
  const [selectedCompany, setSelectedCompany] = useState<RCACompany | ''>('');
  const [detail, setDetail] = useState<RCARow | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const companySummaries = useMemo(
    () =>
      COMPANY_CONFIG.map((company) => {
        const companyRows = rows.filter((row) => row.company === company.key);
        const open = companyRows.filter((row) => row.status === 'open');
        const overdue = open.filter((row) => row.overdue);
        const completed = companyRows.filter((row) => row.status === 'completed');
        return {
          ...company,
          total: companyRows.length,
          open: open.length,
          overdue: overdue.length,
          completed: completed.length,
        };
      }),
    [rows],
  );

  const scopedRows = useMemo(
    () =>
      selectedCompany
        ? rows.filter((row) => row.company === selectedCompany)
        : rows,
    [rows, selectedCompany],
  );
  const openRows = useMemo(
    () => scopedRows.filter((row) => row.status === 'open'),
    [scopedRows],
  );
  const overdueRows = useMemo(
    () => openRows.filter((row) => row.overdue),
    [openRows],
  );
  const completedRows = useMemo(
    () => scopedRows.filter((row) => row.status === 'completed'),
    [scopedRows],
  );
  const ownerLoad = useMemo(() => buildOwnerLoad(openRows), [openRows]);
  const selectedCompanyLabel =
    COMPANY_CONFIG.find((company) => company.key === selectedCompany)?.label ??
    'Genel';

  async function createPDFReport() {
    setGeneratingReport(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadRCAReportPdf({
        rows: scopedRows,
        scopeLabel: selectedCompanyLabel,
      });
    } catch (error) {
      console.error(error);
      window.alert('RCA PDF raporu oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="panel-title">RCA Aksiyon Takip Dashboard</h2>
            <p className="panel-subtitle mt-1">
              Tamamlanmayan ve geciken RCA aksiyonları şirket ve aksiyon sahibi
              bazında izlenir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={createPDFReport}
              disabled={scopedRows.length === 0 || generatingReport}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-700 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:from-amber-400 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-amber-400/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingReport ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileText size={15} />
              )}
              {generatingReport ? 'Rapor Hazırlanıyor...' : 'PDF Raporu Oluştur'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedCompany('')}
              disabled={!selectedCompany}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FilterX size={15} />
              Filtreyi Temizle
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Toplam RCA Aksiyonu"
            value={scopedRows.length}
            helper={`${selectedCompanyLabel} kapsamı`}
            color="#38bdf8"
            icon={<FileSearch size={21} />}
          />
          <SummaryCard
            title="Tamamlanmayan"
            value={openRows.length}
            helper="Ana takip kapsamı"
            color="#f59e0b"
            icon={<Clock3 size={21} />}
          />
          <SummaryCard
            title="Geciken Açık Aksiyon"
            value={overdueRows.length}
            helper="Target Completion Date geçmiş"
            color="#ef4444"
            icon={<AlertTriangle size={21} />}
          />
          <SummaryCard
            title="Tamamlanan"
            value={completedRows.length}
            helper="Sadece sayı olarak takip edilir"
            color="#22c55e"
            icon={<CheckCircle2 size={21} />}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
          {companySummaries.map((company) => {
            const active = selectedCompany === company.key;
            const openRate = percent(company.open, Math.max(company.total, 1));
            const overdueRate = percent(company.overdue, Math.max(company.open, 1));
            return (
              <button
                key={company.key}
                type="button"
                onClick={() =>
                  setSelectedCompany((current) =>
                    current === company.key ? '' : company.key,
                  )
                }
                className={`rounded-2xl border bg-black/20 p-4 text-left transition hover:bg-white/[0.045] ${
                  selectedCompany && !active ? 'opacity-55' : ''
                }`}
                style={{
                  borderColor: active ? company.color : `${company.color}55`,
                  boxShadow: active ? `0 0 0 2px ${company.color}33` : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div
                      className="text-base font-extrabold uppercase tracking-[0.35em] sm:text-lg"
                      style={{ color: company.color }}
                    >
                      {company.label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-white tabular-nums">
                      {company.open}
                    </div>
                    <div className="text-[10px] text-white/35">açık aksiyon</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <CompanyBar
                    label="Tamamlanmayan"
                    value={company.open}
                    total={company.total}
                    color="#f59e0b"
                  />
                  <CompanyBar
                    label="Geciken"
                    value={company.overdue}
                    total={Math.max(company.open, 1)}
                    color="#ef4444"
                  />
                  <CompanyBar
                    label="Tamamlanan"
                    value={company.completed}
                    total={company.total}
                    color="#22c55e"
                  />
                </div>
                <div className="mt-3 flex justify-between text-[10px] text-white/35">
                  <span>Açık oranı: %{Math.round(openRate)}</span>
                  <span>Gecikme oranı: %{Math.round(overdueRate)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="panel-title">Açık RCA Aksiyon Durumu</h2>
            <p className="panel-subtitle mt-1">
              Tamamlanmayan aksiyonların aksiyon sahibi dağılımı. Detaylar
              aşağıdaki tablolarda listelenir.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatusTile
              title="Açık"
              value={openRows.length}
              color="#f59e0b"
              helper="CREATED"
            />
            <StatusTile
              title="Geciken"
              value={overdueRows.length}
              color="#ef4444"
              helper="Hedef tarih geçmiş"
            />
            <StatusTile
              title="Tamamlanan"
              value={completedRows.length}
              color="#22c55e"
              helper="IMPLEMENTED"
            />
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-cyan-300">
              <UserRound size={18} />
            </span>
            <div>
              <h2 className="panel-title">Aksiyon Sahipleri</h2>
              <p className="panel-subtitle mt-1">F sütunu / User ID bazında açık aksiyonlar</p>
            </div>
          </div>
          <div className="space-y-2">
            {ownerLoad.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-white/35">
                Açık aksiyon yok.
              </div>
            ) : (
              ownerLoad.slice(0, 6).map((owner) => (
                <div key={owner.name}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-white/65">{owner.name}</span>
                    <span className="font-semibold text-white tabular-nums">
                      {owner.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-500/25">
                    <div
                      className="h-full rounded-full bg-cyan-300"
                      style={{
                        width: `${Math.max(owner.percent, owner.percent > 0 ? 2 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">
            Geciken RCA Aksiyonları
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Tamamlanmamış ve hedef tamamlanma tarihi geçmiş aksiyonlar.
          </p>
        </div>
        <DataTable
          data={overdueRows}
          columns={RCA_COLUMNS}
          rowKey={(row) => row.rowId}
          initialSortKey="targetDate"
          initialSortDir="asc"
          emptyMessage="Seçili kapsamda geciken RCA aksiyonu yok."
          onRowClick={setDetail}
          rowClassName={(row) => (row.overdue ? 'bg-rose-50/70' : '')}
        />
      </section>

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">
            Tamamlanmayan RCA Aksiyonları
          </h2>
          <p className="mt-1 text-xs text-white/45">
            CREATED durumundaki açık RCA aksiyonları. Satıra tıklayarak detayları görüntüleyin.
          </p>
        </div>
        <DataTable
          data={openRows}
          columns={RCA_COLUMNS}
          rowKey={(row) => row.rowId}
          initialSortKey="targetDate"
          initialSortDir="asc"
          emptyMessage="Seçili kapsamda tamamlanmayan RCA aksiyonu yok."
          onRowClick={setDetail}
          rowClassName={(row) => (row.overdue ? 'bg-rose-50/70' : '')}
        />
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.recommendationId} · RCA Aksiyon Detayı` : 'RCA Detayı'}
        widthClass="max-w-5xl"
      >
        {detail && <RCADetail row={detail} />}
      </Modal>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  color,
  icon,
}: {
  title: string;
  value: number;
  helper: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card min-h-32">
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-white/50">{title}</div>
          <div className="mt-3 text-3xl font-semibold text-white tabular-nums">
            {formatNumber(value)}
          </div>
        </div>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ color, backgroundColor: `${color}20` }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[11px] text-white/35">{helper}</div>
    </div>
  );
}

function CompanyBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const rate = percent(value, Math.max(total, 1));
  return (
    <div className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-xs">
      <span className="truncate text-white/50">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-500/25">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(rate, rate > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </span>
      <span className="text-right font-semibold text-white/65 tabular-nums">
        {value}
      </span>
    </div>
  );
}

function StatusTile({
  title,
  value,
  helper,
  color,
}: {
  title: string;
  value: number;
  helper: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <span className="mb-3 block h-1 rounded-full" style={{ backgroundColor: color }} />
      <div className="text-xs font-medium text-white/45">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-white tabular-nums">
        {formatNumber(value)}
      </div>
      <div className="mt-1 text-[11px] text-white/35">{helper}</div>
    </div>
  );
}

const RCA_COLUMNS: DataTableColumn<RCARow>[] = [
  {
    key: 'recommendationId',
    header: 'Recommendation ID',
    sortValue: (row) => row.recommendationId,
    searchValue: (row) => row.recommendationId,
    render: (row) => (
      <span className="font-semibold text-slate-900">{row.recommendationId}</span>
    ),
  },
  {
    key: 'company',
    header: 'Şirket',
    sortValue: (row) => row.company,
    searchValue: (row) => companyLabel(row.company),
    render: (row) => <CompanyBadge company={row.company} />,
  },
  {
    key: 'headline',
    header: 'Aksiyon',
    sortValue: (row) => row.headline,
    searchValue: (row) => `${row.headline} ${row.description}`,
    render: (row) => (
      <div className="max-w-xl">
        <div className="font-medium text-slate-900">{row.headline || '—'}</div>
        <div className="mt-1 line-clamp-2 text-xs text-slate-500">
          {row.analysisId}
        </div>
      </div>
    ),
  },
  {
    key: 'owner',
    header: 'Aksiyon Sahibi',
    sortValue: (row) => row.owner,
    searchValue: (row) => `${row.owner} ${row.assignedToName}`,
    render: (row) => (
      <div className="whitespace-nowrap">
        <div className="font-medium text-slate-800">{row.owner || '—'}</div>
        <div className="text-xs text-slate-500">{ownerDisplayName(row.assignedToName)}</div>
      </div>
    ),
  },
  {
    key: 'jobTitle',
    header: 'Job Title',
    sortValue: (row) => row.jobTitle,
    searchValue: (row) => row.jobTitle,
    render: (row) => <span className="text-xs text-slate-600">{row.jobTitle}</span>,
  },
  {
    key: 'targetDate',
    header: 'Target Date',
    sortValue: (row) => row.targetCompletionDate ?? new Date(8640000000000000),
    searchValue: (row) => formatDate(row.targetCompletionDate),
    className: 'whitespace-nowrap',
    render: (row) => (
      <span className={row.overdue ? 'font-semibold text-rose-700' : ''}>
        {formatDate(row.targetCompletionDate)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Durum',
    sortValue: (row) => row.status,
    searchValue: (row) => statusLabel(row),
    className: 'whitespace-nowrap',
    render: (row) => <RCAStatusBadge row={row} />,
  },
];

function RCADetail({ row }: { row: RCARow }) {
  const fields = [
    ['Recommendation ID', row.recommendationId],
    ['Analysis ID', row.analysisId],
    ['Şirket', companyLabel(row.company)],
    ['Status', `${row.statusRaw} / ${statusLabel(row)}`],
    ['Target Completion Date', formatDate(row.targetCompletionDate)],
    ['Aksiyon Sahibi F Sütunu', row.owner],
    ['Assigned To Name', row.assignedToName],
    ['Job Title', row.jobTitle],
    ['Recommendation Headline', row.headline],
    ['Recommendation Description', row.description],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {fields.map(([label, value]) => (
        <div
          key={label}
          className={`rounded-lg border p-3 ${
            label.includes('Description') || label.includes('Headline')
              ? 'md:col-span-2'
              : ''
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {value || '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function RCAStatusBadge({ row }: { row: RCARow }) {
  if (row.status === 'completed') {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
        Tamamlanan
      </span>
    );
  }
  if (row.overdue) {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
        Geciken
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
      Tamamlanmayan
    </span>
  );
}

function CompanyBadge({ company }: { company: RCACompany }) {
  const config = COMPANY_CONFIG.find((item) => item.key === company);
  const color = config?.color ?? '#64748b';
  return (
    <span
      className="rounded-full px-2 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {companyLabel(company)}
    </span>
  );
}

function buildOwnerLoad(rows: RCARow[]) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.owner || 'Atanmamış';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const max = Math.max(...counts.values(), 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, percent: (count / max) * 100 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'));
}

function ownerDisplayName(value: string) {
  return value.split('~')[0]?.trim() || '—';
}

function statusLabel(row: RCARow) {
  if (row.status === 'completed') return 'Tamamlanan';
  if (row.overdue) return 'Geciken';
  return 'Tamamlanmayan';
}

function companyLabel(company: RCACompany) {
  if (company === 'PETKIM') return 'Petkim';
  if (company === 'STAR') return 'Star';
  return 'STAD';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function percent(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}
