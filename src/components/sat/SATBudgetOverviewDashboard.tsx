import { useMemo, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  FileText,
  FilterX,
  Loader2,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import type {
  SATBudgetCompany,
  SATBudgetRow,
} from '../../types';
import { useDataStore } from '../../store/dataStore';
import {
  budgetCompanySummary,
  budgetTotals,
  budgetTypeLabel,
  companyLabel,
  SAT_BUDGET_COMPANIES,
} from '../../lib/satBudgetLogic';
import { downloadSATBudgetReportPdf } from '../../lib/satBudgetReportPdf';
import { formatDate } from '../../lib/normalize';
import {
  DataTable,
  type DataTableColumn,
} from '../common/DataTable';
import { Modal } from '../common/Modal';

const TOOLTIP_STYLE = {
  backgroundColor: '#111111',
  border: '1px solid rgb(255 255 255 / 0.12)',
  borderRadius: 8,
  color: '#f8fafc',
};

export function SATBudgetOverviewDashboard() {
  const allRows = useDataStore((state) => state.satBudgetRows);
  const [selectedCompany, setSelectedCompany] =
    useState<SATBudgetCompany | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportScope, setReportScope] = useState<'filtered' | 'all'>('filtered');
  const [reportGenerating, setReportGenerating] = useState(false);

  const visibleRows = useMemo(
    () =>
      selectedCompany
        ? allRows.filter((row) => row.company === selectedCompany)
        : allRows,
    [allRows, selectedCompany],
  );
  const totals = useMemo(() => budgetTotals(visibleRows), [visibleRows]);
  const companySummaries = useMemo(
    () => budgetCompanySummary(allRows),
    [allRows],
  );
  const sourceSummary = useMemo(() => buildSourceSummary(visibleRows), [visibleRows]);

  async function createReport() {
    const rows = reportScope === 'filtered' ? visibleRows : allRows;
    const scopeLabel =
      reportScope === 'all'
        ? 'Tüm Şirketler'
        : selectedCompany
          ? companyLabel(selectedCompany)
          : 'Mevcut Genel Bakış';
    setReportGenerating(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSATBudgetReportPdf({ rows, scopeLabel });
      setReportModalOpen(false);
    } catch (error) {
      console.error(error);
      window.alert('SAT bütçe PDF raporu oluşturulamadı.');
    } finally {
      setReportGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="panel-title">SAT Bütçe Genel Bakış</h2>
            <p className="panel-subtitle mt-1">
              H sütunundaki tanımlı bütçe kaynakları ve L sütunundaki işaretli USD hareketleri
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:from-cyan-400 hover:to-teal-500"
            >
              <FileText size={15} />
              PDF Raporu Oluştur
            </button>
            <button
              type="button"
              onClick={() => setSelectedCompany(null)}
              disabled={!selectedCompany}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FilterX size={15} />
              Filtreyi Temizle
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <CompanyFilter
            label="Tüm Şirketler"
            value={allRows.length}
            active={selectedCompany === null}
            onClick={() => setSelectedCompany(null)}
          />
          {SAT_BUDGET_COMPANIES.map((company) => (
            <CompanyFilter
              key={company}
              label={companyLabel(company)}
              value={allRows.filter((row) => row.company === company).length}
              active={selectedCompany === company}
              onClick={() =>
                setSelectedCompany((current) =>
                  current === company ? null : company,
                )
              }
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Net Toplam Bütçe"
          value={formatCompactUsd(totals.net)}
          helper={formatUsd(totals.net)}
          color="#38bdf8"
          icon={<WalletCards size={21} />}
        />
        <MetricCard
          title="Toplam Bütçe Girişi"
          value={formatCompactUsd(totals.inflow)}
          helper="Pozitif L sütunu hareketleri"
          color="#10b981"
          icon={<ArrowUpCircle size={21} />}
        />
        <MetricCard
          title="Toplam Bütçe Çıkışı"
          value={formatCompactUsd(totals.outflow)}
          helper="Negatif L sütunu hareketleri"
          color="#f97316"
          icon={<ArrowDownCircle size={21} />}
        />
        <MetricCard
          title="Bütçe Hareketi"
          value={formatNumber(totals.count)}
          helper="Tanımlı kaynak satırı"
          color="#8b5cf6"
          icon={<ReceiptText size={21} />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {companySummaries.map((summary) => (
          <CompanyBudgetDonut
            key={summary.company}
            summary={summary}
            active={selectedCompany === summary.company}
            dimmed={!!selectedCompany && selectedCompany !== summary.company}
            onClick={() =>
              setSelectedCompany((current) =>
                current === summary.company ? null : summary.company,
              )
            }
          />
        ))}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={17} className="text-cyan-300" />
          <div>
            <h2 className="panel-title">Bütçe Kaynakları</h2>
            <p className="panel-subtitle mt-1">
              Kodlar yerine tanımlı bütçe açıklamaları gösterilir; değerler net giriş ve çıkış toplamıdır.
            </p>
          </div>
        </div>
        <SourceBars data={sourceSummary} />
      </section>

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Bütçe Hareket Detayı</h2>
          <p className="mt-1 text-xs text-white/45">
            {selectedCompany ? companyLabel(selectedCompany) : 'Tüm Şirketler'} · {visibleRows.length} hareket
          </p>
        </div>
        <DataTable
          data={visibleRows}
          columns={BUDGET_COLUMNS}
          rowKey={(row) => row.rowId}
          initialSortKey="date"
          initialSortDir="desc"
          emptyMessage="Seçili şirkette bütçe hareketi bulunamadı."
        />
      </section>

      <Modal
        open={reportModalOpen}
        onClose={() => !reportGenerating && setReportModalOpen(false)}
        title="SAT Bütçe PDF Raporu"
        widthClass="max-w-xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            PDF metinleri seçilebilir ve aranabilir olarak oluşturulur.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ReportScopeButton
              title="Mevcut Filtre"
              helper={`${visibleRows.length} hareket · ${formatUsd(totals.net)}`}
              active={reportScope === 'filtered'}
              onClick={() => setReportScope('filtered')}
            />
            <ReportScopeButton
              title="Tüm Veriler"
              helper={`${allRows.length} hareket · ${formatUsd(budgetTotals(allRows).net)}`}
              active={reportScope === 'all'}
              onClick={() => setReportScope('all')}
            />
          </div>
          <button
            type="button"
            onClick={createReport}
            disabled={reportGenerating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-teal-500 disabled:cursor-wait disabled:opacity-60"
          >
            {reportGenerating ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <FileText size={17} />
            )}
            {reportGenerating ? 'Rapor Hazırlanıyor...' : 'PDF Raporunu İndir'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

type CompanySummary = ReturnType<typeof budgetCompanySummary>[number];

function CompanyBudgetDonut({
  summary,
  active,
  dimmed,
  onClick,
}: {
  summary: CompanySummary;
  active: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const chartData = summary.types
    .filter((type) => type.net !== 0)
    .map((type) => ({ ...type, value: Math.abs(type.net) }));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`card min-w-0 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/45 ${
        active ? 'border-cyan-400/70 ring-2 ring-cyan-400/25' : ''
      } ${dimmed ? 'opacity-45' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">{summary.label}</h2>
          <p className="panel-subtitle mt-1">CAPEX · OPEX · Operational CAPEX</p>
        </div>
        <span className="text-lg font-semibold text-cyan-300 tabular-nums">
          {formatCompactUsd(summary.totals.net)}
        </span>
      </div>
      <div className="relative mt-3 h-52 min-w-0">
        {chartData.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="#0d0d0d"
                  strokeWidth={3}
                >
                  {chartData.map((item) => (
                    <Cell key={item.key} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => formatUsd(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-semibold text-white">Net</div>
                <div className="mt-1 text-xs text-white/40">USD</div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="space-y-2">
        {summary.types.map((type) => (
          <div key={type.key} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-white/55">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color }} />
              {type.label}
            </span>
            <span className="font-semibold text-white/80 tabular-nums">
              {formatUsd(type.net)}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

function MetricCard({
  title,
  value,
  helper,
  color,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card min-h-36">
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium leading-5 text-white/50">{title}</div>
          <div className="mt-3 truncate text-2xl font-semibold text-white tabular-nums">{value}</div>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ color, backgroundColor: `${color}20` }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 truncate text-[11px] text-white/35">{helper}</div>
    </div>
  );
}

function CompanyFilter({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`filter-tile min-h-20 ${active ? 'ring-2 ring-cyan-400/45' : ''}`}
    >
      <span className="block text-xs font-medium text-white/50">{label}</span>
      <strong className="mt-2 block text-xl font-semibold text-white tabular-nums">{value}</strong>
    </button>
  );
}

function SourceBars({
  data,
}: {
  data: { label: string; value: number; company: SATBudgetCompany }[];
}) {
  const max = Math.max(...data.map((item) => Math.abs(item.value)), 1);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {data.map((item) => (
        <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white/75">{item.label}</div>
              <div className="mt-1 text-[11px] text-white/35">{companyLabel(item.company)}</div>
            </div>
            <span className={`text-sm font-semibold tabular-nums ${item.value < 0 ? 'text-rose-300' : 'text-cyan-300'}`}>
              {formatUsd(item.value)}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full ${item.value < 0 ? 'bg-rose-400' : 'bg-cyan-400'}`}
              style={{ width: `${Math.max(1, (Math.abs(item.value) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportScopeButton({
  title,
  helper,
  active,
  onClick,
}: {
  title: string;
  helper: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border p-3 text-left transition ${
        active
          ? 'border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/25'
          : 'border-white/10 bg-white/[0.06] hover:bg-white/[0.10]'
      }`}
    >
      <span className="block text-sm font-semibold text-white">{title}</span>
      <span className="mt-1 block text-xs text-white/45">{helper}</span>
    </button>
  );
}

function buildSourceSummary(rows: SATBudgetRow[]) {
  const map = new Map<
    string,
    { label: string; value: number; company: SATBudgetCompany }
  >();
  rows.forEach((row) => {
    const current = map.get(row.sourceLabel) ?? {
      label: row.sourceLabel,
      value: 0,
      company: row.company,
    };
    current.value += row.amount;
    map.set(row.sourceLabel, current);
  });
  return [...map.values()].sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value),
  );
}

const BUDGET_COLUMNS: DataTableColumn<SATBudgetRow>[] = [
  {
    key: 'date',
    header: 'Belge Tarihi',
    sortValue: (row) => row.documentDate ?? new Date(0),
    searchValue: (row) => formatDate(row.documentDate),
    className: 'whitespace-nowrap',
    render: (row) => formatDate(row.documentDate),
  },
  {
    key: 'company',
    header: 'Şirket',
    sortValue: (row) => row.company,
    searchValue: (row) => companyLabel(row.company),
    render: (row) => companyLabel(row.company),
  },
  {
    key: 'type',
    header: 'Bütçe Türü',
    sortValue: (row) => row.budgetType,
    searchValue: (row) => budgetTypeLabel(row.budgetType),
    className: 'whitespace-nowrap',
    render: (row) => budgetTypeLabel(row.budgetType),
  },
  {
    key: 'source',
    header: 'Bütçe Tanımı',
    sortValue: (row) => row.sourceLabel,
    searchValue: (row) => row.sourceLabel,
    className: 'min-w-72',
    render: (row) => row.sourceLabel,
  },
  {
    key: 'transaction',
    header: 'İşlem',
    sortValue: (row) => row.transactionType,
    searchValue: (row) => `${row.transactionType} ${row.description}`,
    render: (row) => row.transactionType || '—',
  },
  {
    key: 'amount',
    header: 'Tutar',
    sortValue: (row) => row.amount,
    searchValue: (row) => String(row.amount),
    className: 'whitespace-nowrap',
    render: (row) => (
      <span className={`font-semibold ${row.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
        {formatSignedUsd(row.amount)}
      </span>
    ),
  },
  {
    key: 'user',
    header: 'Kullanıcı',
    sortValue: (row) => row.user,
    searchValue: (row) => row.user,
    render: (row) => row.user || '—',
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatUsd(value: number) {
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} USD`;
}

function formatCompactUsd(value: number) {
  return `${new Intl.NumberFormat('tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)} USD`;
}

function formatSignedUsd(value: number) {
  return `${value > 0 ? '+' : ''}${formatUsd(value)}`;
}
