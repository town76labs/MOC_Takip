import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ClipboardList,
  FileText,
  FilterX,
  Loader2,
  PackageSearch,
  ShoppingCart,
} from 'lucide-react';
import type { SATRow, SATStage } from '../../types';
import { useDataStore } from '../../store/dataStore';
import { formatDate, normalize, parseDate } from '../../lib/normalize';
import { downloadSATReportPdf } from '../../lib/satReportPdf';
import {
  DataTable,
  type DataTableColumn,
} from '../common/DataTable';
import { Modal } from '../common/Modal';

const STAGES: {
  key: SATStage;
  label: string;
  shortLabel: string;
  color: string;
}[] = [
  {
    key: 'durum_girilmemis',
    label: 'Durum Girilmemiş',
    shortLabel: 'Durum Yok',
    color: '#94a3b8',
  },
  {
    key: 'mail_onayi',
    label: 'Mail Onayı Bekliyor',
    shortLabel: 'Mail Onayı',
    color: '#f59e0b',
  },
  {
    key: 'sap_onayi',
    label: 'SAP Onayında',
    shortLabel: 'SAP Onayı',
    color: '#f97316',
  },
  {
    key: 'satina_aktarilacak',
    label: 'Satın Almaya Aktarılacak',
    shortLabel: 'Aktarılacak',
    color: '#06b6d4',
  },
  {
    key: 'teklif_bekleniyor',
    label: 'Teklif Bekleniyor',
    shortLabel: 'Teklif Bekliyor',
    color: '#3b82f6',
  },
  {
    key: 'teklif_degerlendiriliyor',
    label: 'Teklif Değerlendiriliyor',
    shortLabel: 'Değerlendiriliyor',
    color: '#8b5cf6',
  },
  {
    key: 'teklif_degerlendirildi',
    label: 'Teklif Değerlendirildi',
    shortLabel: 'Değerlendirildi',
    color: '#6366f1',
  },
  {
    key: 'sas_verildi',
    label: 'SAS Verildi',
    shortLabel: 'SAS Verildi',
    color: '#14b8a6',
  },
  {
    key: 'tamamlandi',
    label: 'Tamamlandı',
    shortLabel: 'Tamamlandı',
    color: '#22c55e',
  },
  {
    key: 'diger',
    label: 'Diğer Durum',
    shortLabel: 'Diğer',
    color: '#f43f5e',
  },
];

type PipelineKey = 'opened' | 'sas' | 'invoice';
type AlertKey = 'sat60' | 'sat90' | 'delivery' | 'approval';
type ReportType = 'general' | 'leadTime' | 'urgentApproval' | 'aging';

const PIPELINE_STAGES: {
  key: PipelineKey;
  label: string;
  helper: string;
  color: string;
}[] = [
  {
    key: 'opened',
    label: 'Açılan SAT',
    helper: 'Bütçeden açılan toplam talep',
    color: '#38bdf8',
  },
  {
    key: 'sas',
    label: "SAS'a Dönen SAT",
    helper: 'Siparişe dönüşen talepler',
    color: '#8b5cf6',
  },
  {
    key: 'invoice',
    label: 'Fatura Kesilen SAS',
    helper: 'Tamamlanan / faturalanan süreç',
    color: '#22c55e',
  },
];

const ALERTS: {
  key: AlertKey;
  label: string;
  helper: string;
  color: string;
}[] = [
  {
    key: 'sat60',
    label: "60+ Gün SAS'a Dönmeyen",
    helper: 'SAT açılmış, 60-89 gün arası bekleyenler',
    color: '#f59e0b',
  },
  {
    key: 'sat90',
    label: "90+ Gün SAS'a Dönmeyen",
    helper: 'SAT açılmış, kritik seviyede bekleyenler',
    color: '#ef4444',
  },
  {
    key: 'delivery',
    label: 'Teslim Tarihi Geçmiş / Fatura Yok',
    helper: 'Malzeme geliş tarihi geçmiş, fatura/tamamlanma görünmüyor',
    color: '#fb7185',
  },
  {
    key: 'approval',
    label: 'Acil Onay Bekleyen',
    helper: '30+ gün açık kalan mail/SAP/onay adımları',
    color: '#f97316',
  },
];

const REPORTS: {
  key: ReportType;
  title: string;
  description: string;
}[] = [
  {
    key: 'general',
    title: 'Genel SAT Takip Raporu',
    description: 'Seçili filtredeki tüm SAT kayıtlarını raporlar.',
  },
  {
    key: 'leadTime',
    title: 'Ortalama İşlem Süresi',
    description: "SAS'a dönmüş talepler üzerinden SAT yaşı ve dönüş performansını çıkarır.",
  },
  {
    key: 'urgentApproval',
    title: 'Acil Onay Bekleyenler',
    description: '30 günü aşmış, onay veya satın alma aksiyonu bekleyen kayıtları listeler.',
  },
  {
    key: 'aging',
    title: 'Yaşlandırma Raporu',
    description: 'Açık talepleri 0-15, 15-30 ve 30+ gün mantığıyla takip eder.',
  },
];

interface BudgetSummary {
  key: string;
  title: string;
  code: string;
  type: string;
  rows: SATRow[];
  totals: CurrencyTotal[];
  opened: number;
  sas: number;
  invoice: number;
}

interface CurrencyTotal {
  currency: string;
  amount: number;
}

interface StatusSummary {
  key: string;
  label: string;
  rows: SATRow[];
}

export function SATDashboard() {
  const rows = useDataStore((state) => state.satRows);
  const [selectedBudgetKey, setSelectedBudgetKey] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineKey | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertKey | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [detail, setDetail] = useState<SATRow | null>(null);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [reportGenerating, setReportGenerating] = useState<ReportType | null>(null);

  const budgetSummaries = useMemo(() => buildBudgetSummaries(rows), [rows]);
  const statusSummary = useMemo(() => buildStatusSummary(rows), [rows]);
  const alertSummary = useMemo(() => buildAlertSummary(rows), [rows]);
  const insights = useMemo(() => buildInsights(rows), [rows]);

  const selectedBudget = useMemo(
    () =>
      selectedBudgetKey
        ? budgetSummaries.find((item) => item.key === selectedBudgetKey) ?? null
        : null,
    [budgetSummaries, selectedBudgetKey],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (selectedBudgetKey && getBudgetKey(row) !== selectedBudgetKey) {
          return false;
        }
        if (selectedPipeline && !matchesPipeline(row, selectedPipeline)) {
          return false;
        }
        if (selectedAlert && !matchesAlert(row, selectedAlert)) {
          return false;
        }
        if (selectedStatus && getStatusKey(row) !== selectedStatus) {
          return false;
        }
        return true;
      }),
    [rows, selectedBudgetKey, selectedPipeline, selectedAlert, selectedStatus],
  );

  const filtersActive = Boolean(
    selectedBudgetKey || selectedPipeline || selectedAlert || selectedStatus,
  );

  function clearFilters() {
    setSelectedBudgetKey(null);
    setSelectedPipeline(null);
    setSelectedAlert(null);
    setSelectedStatus(null);
  }

  function selectBudget(key: string) {
    setSelectedBudgetKey((current) => (current === key ? null : key));
    setSelectedPipeline(null);
    setSelectedAlert(null);
    setSelectedStatus(null);
  }

  function selectPipeline(budgetKey: string, pipeline: PipelineKey) {
    setSelectedBudgetKey(budgetKey);
    setSelectedPipeline((current) =>
      selectedBudgetKey === budgetKey && current === pipeline ? null : pipeline,
    );
    setSelectedAlert(null);
    setSelectedStatus(null);
  }

  function selectAlert(alert: AlertKey) {
    setSelectedAlert((current) => (current === alert ? null : alert));
    setSelectedBudgetKey(null);
    setSelectedPipeline(null);
    setSelectedStatus(null);
  }

  function selectStatus(status: string) {
    setSelectedStatus((current) => (current === status ? null : status));
    setSelectedAlert(null);
  }

  async function createPDFReport(type: ReportType) {
    const prepared = prepareReportRows(type, filteredRows);
    setReportGenerating(type);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSATReportPdf({
        rows: prepared.rows,
        scopeLabel: buildReportScope(type, prepared.rows, filtersActive),
      });
      setReportMenuOpen(false);
    } catch {
      window.alert('SAT PDF raporu oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setReportGenerating(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="panel-title">SAT Takip Operasyon Paneli</h2>
            <p className="panel-subtitle mt-1">
              Bütçe, son durum ve gecikme uyarılarına tıklayarak detay listesini filtreleyin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReportMenuOpen(true)}
              disabled={filteredRows.length === 0 || reportGenerating !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-cyan-400 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reportGenerating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileText size={15} />
              )}
              {reportGenerating ? 'Rapor Hazırlanıyor...' : 'PDF Raporları'}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FilterX size={15} />
              Filtreleri Temizle
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            title="Toplam SAT"
            value={formatNumber(rows.length)}
            helper="Açılan talep"
            color="#38bdf8"
            icon={<ClipboardList size={21} />}
          />
          <MetricCard
            title="SAS'a Dönen"
            value={formatNumber(rows.filter(isSasConverted).length)}
            helper={percent(rows.filter(isSasConverted).length, rows.length)}
            color="#8b5cf6"
            icon={<ShoppingCart size={21} />}
          />
          <MetricCard
            title="Fatura / Tamamlanan"
            value={formatNumber(rows.filter(isInvoiceIssued).length)}
            helper={percent(rows.filter(isInvoiceIssued).length, rows.length)}
            color="#22c55e"
            icon={<CheckCircle2 size={21} />}
          />
          <MetricCard
            title="Ortalama SAT Yaşı"
            value={`${insights.averageAge} gün`}
            helper={`${formatNumber(insights.openRows)} açık kayıt`}
            color="#f59e0b"
            icon={<PackageSearch size={21} />}
          />
        </div>
      </section>

      <BudgetOverview
        summaries={budgetSummaries}
        selectedBudgetKey={selectedBudgetKey}
        selectedPipeline={selectedPipeline}
        onSelectBudget={selectBudget}
        onSelectPipeline={selectPipeline}
      />

      {selectedBudget && (
        <BudgetPipelineBreakdown
          budget={selectedBudget}
          selectedPipeline={selectedPipeline}
          onSelect={(pipeline) => selectPipeline(selectedBudget.key, pipeline)}
        />
      )}

      <AlertOverview
        alerts={alertSummary}
        selectedAlert={selectedAlert}
        onSelect={selectAlert}
      />

      <StatusOverview
        statuses={statusSummary}
        selectedStatus={selectedStatus}
        onSelect={selectStatus}
      />

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">SAT Talep Listesi</h2>
            <p className="mt-1 text-xs text-white/45">
              {filteredRows.length} kayıt · Satıra tıklayarak tüm Excel alanlarını görüntüleyin
            </p>
          </div>
          <ActiveFilterSummary
            selectedBudget={selectedBudget}
            selectedPipeline={selectedPipeline}
            selectedAlert={selectedAlert}
            selectedStatus={selectedStatus}
            statusSummary={statusSummary}
          />
        </div>
        <DataTable
          data={filteredRows}
          columns={SAT_COLUMNS}
          rowKey={(row) => row.rowId}
          initialSortKey="date"
          initialSortDir="desc"
          emptyMessage="Seçili filtrelerde SAT talebi bulunamadı."
          onRowClick={setDetail}
          rowClassName={alertRowClassName}
        />
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.satNo ? `SAT ${detail.satNo}` : 'SAT Numarası Girilmemiş'}
        widthClass="max-w-4xl"
      >
        {detail && <SATDetail row={detail} />}
      </Modal>

      <Modal
        open={reportMenuOpen}
        onClose={() => {
          if (!reportGenerating) setReportMenuOpen(false);
        }}
        title="SAT Takip PDF Raporları"
        widthClass="max-w-3xl"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORTS.map((report) => (
            <button
              key={report.key}
              type="button"
              onClick={() => createPDFReport(report.key)}
              disabled={reportGenerating !== null}
              className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {report.title}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-white/50">
                    {report.description}
                  </div>
                </div>
                {reportGenerating === report.key && (
                  <Loader2 size={17} className="shrink-0 animate-spin text-cyan-300" />
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-white/40">
          Rapor, ekrandaki aktif filtrelere göre hazırlanır. Lead time için ayrı SAS dönüş tarihi
          bulunmadığında SAT açılış tarihinden bugüne kadar olan bekleme yaşı kullanılır.
        </p>
      </Modal>
    </div>
  );
}

function BudgetOverview({
  summaries,
  selectedBudgetKey,
  selectedPipeline,
  onSelectBudget,
  onSelectPipeline,
}: {
  summaries: BudgetSummary[];
  selectedBudgetKey: string | null;
  selectedPipeline: PipelineKey | null;
  onSelectBudget: (key: string) => void;
  onSelectPipeline: (budgetKey: string, pipeline: PipelineKey) => void;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
          <Banknote size={19} />
        </span>
        <div>
          <h2 className="panel-title">Bütçe Bazlı SAT Takibi</h2>
          <p className="panel-subtitle mt-1">
            Bütçeye tıklayın; Açılan SAT, SAS'a dönen SAT ve Fatura kesilen SAS kırılımını görün.
          </p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {summaries.map((budget) => {
          const active = selectedBudgetKey === budget.key;
          return (
            <div
              key={budget.key}
              className={`rounded-xl border bg-black/20 p-4 transition ${
                active
                  ? 'border-cyan-300/70 ring-2 ring-cyan-400/20'
                  : 'border-white/10'
              } ${selectedBudgetKey && !active ? 'opacity-55' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelectBudget(budget.key)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/70">
                      {budget.type || 'Bütçe'}
                    </div>
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                      {budget.title}
                    </h3>
                    <div className="mt-1 text-[11px] text-white/35">
                      {budget.code || 'Kod belirtilmemiş'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-semibold text-white tabular-nums">
                      {budget.rows.length}
                    </div>
                    <div className="text-[10px] text-white/35">SAT</div>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-[11px] text-white/45">
                  {budget.totals.length > 0 ? (
                    budget.totals.map((total) => (
                      <div
                        key={total.currency}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>{total.currency}</span>
                        <span className="font-semibold text-white/70 tabular-nums">
                          {formatAmount(total.amount, total.currency)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div>Tutar bilgisi yok</div>
                  )}
                </div>
              </button>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {PIPELINE_STAGES.map((stage) => {
                  const count = pipelineCount(budget.rows, stage.key);
                  const stageActive = active && selectedPipeline === stage.key;
                  return (
                    <button
                      key={stage.key}
                      type="button"
                      onClick={() => onSelectPipeline(budget.key, stage.key)}
                      className={`rounded-lg border p-2 text-left transition hover:bg-white/[0.08] ${
                        stageActive
                          ? 'border-cyan-300/70 bg-cyan-400/10'
                          : 'border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className="mb-1 block h-1 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <div className="text-lg font-semibold text-white tabular-nums">
                        {count}
                      </div>
                      <div className="mt-1 text-[10px] leading-4 text-white/45">
                        {stage.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BudgetPipelineBreakdown({
  budget,
  selectedPipeline,
  onSelect,
}: {
  budget: BudgetSummary;
  selectedPipeline: PipelineKey | null;
  onSelect: (pipeline: PipelineKey) => void;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="panel-title">{budget.title} · Aşama Kırılımı</h2>
        <p className="panel-subtitle">
          {budget.code || 'Kod yok'} · {budget.rows.length} SAT kaydı
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {PIPELINE_STAGES.map((stage) => {
          const stageRows = budget.rows.filter((row) => matchesPipeline(row, stage.key));
          const active = selectedPipeline === stage.key;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onSelect(stage.key)}
              className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${
                active
                  ? 'border-cyan-300/70 bg-cyan-400/10 ring-2 ring-cyan-400/20'
                  : 'border-white/10 bg-white/[0.045]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {stage.label}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    {stage.helper}
                  </div>
                </div>
                <span
                  className="rounded-lg px-2 py-1 text-lg font-semibold tabular-nums"
                  style={{ color: stage.color, backgroundColor: `${stage.color}18` }}
                >
                  {stageRows.length}
                </span>
              </div>
              <div className="mt-4 space-y-1 text-xs text-white/50">
                {sumByCurrency(stageRows).map((total) => (
                  <div
                    key={total.currency}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{total.currency}</span>
                    <span className="font-semibold text-white/75 tabular-nums">
                      {formatAmount(total.amount, total.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AlertOverview({
  alerts,
  selectedAlert,
  onSelect,
}: {
  alerts: { key: AlertKey; count: number; rows: SATRow[] }[];
  selectedAlert: AlertKey | null;
  onSelect: (key: AlertKey) => void;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
          <AlertTriangle size={19} />
        </span>
        <div>
          <h2 className="panel-title">Aksiyon Gerektiren SAT Uyarıları</h2>
          <p className="panel-subtitle mt-1">
            Kartlara tıklayınca aşağıdaki SAT listesi ilgili uyarıya göre filtrelenir.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ALERTS.map((config) => {
          const item = alerts.find((alert) => alert.key === config.key);
          const active = selectedAlert === config.key;
          return (
            <button
              key={config.key}
              type="button"
              onClick={() => onSelect(config.key)}
              className={`relative min-h-32 overflow-hidden rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${
                active
                  ? 'border-cyan-300/70 bg-cyan-400/10 ring-2 ring-cyan-400/20'
                  : 'border-white/10 bg-white/[0.045]'
              }`}
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: config.color }}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold leading-5 text-white">
                    {config.label}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-white/45">
                    {config.helper}
                  </div>
                </div>
                <div
                  className="rounded-lg px-2 py-1 text-2xl font-semibold tabular-nums"
                  style={{ color: config.color, backgroundColor: `${config.color}16` }}
                >
                  {item?.count ?? 0}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StatusOverview({
  statuses,
  selectedStatus,
  onSelect,
}: {
  statuses: StatusSummary[];
  selectedStatus: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300">
          <BadgeCheck size={19} />
        </span>
        <div>
          <h2 className="panel-title">Satın Alma Son Durum Özeti</h2>
          <p className="panel-subtitle mt-1">
            Varsa SAP satınalma özet durum açıklaması; yoksa SAT durumu/onay durumu kullanılır.
          </p>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {statuses.slice(0, 8).map((status, index) => {
          const active = selectedStatus === status.key;
          return (
            <button
              key={status.key}
              type="button"
              onClick={() => onSelect(status.key)}
              className={`rounded-lg border p-3 text-left transition hover:bg-white/[0.08] ${
                active
                  ? 'border-cyan-300/70 bg-cyan-400/10'
                  : 'border-white/10 bg-white/[0.045]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                    Son durum {index + 1}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-white/70">
                    {status.label}
                  </div>
                </div>
                <div className="text-xl font-semibold text-white tabular-nums">
                  {status.rows.length}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ActiveFilterSummary({
  selectedBudget,
  selectedPipeline,
  selectedAlert,
  selectedStatus,
  statusSummary,
}: {
  selectedBudget: BudgetSummary | null;
  selectedPipeline: PipelineKey | null;
  selectedAlert: AlertKey | null;
  selectedStatus: string | null;
  statusSummary: StatusSummary[];
}) {
  const labels = [
    selectedBudget ? `Bütçe: ${selectedBudget.title}` : '',
    selectedPipeline
      ? `Aşama: ${PIPELINE_STAGES.find((item) => item.key === selectedPipeline)?.label}`
      : '',
    selectedAlert
      ? `Uyarı: ${ALERTS.find((item) => item.key === selectedAlert)?.label}`
      : '',
    selectedStatus
      ? `Son durum: ${statusSummary.find((item) => item.key === selectedStatus)?.label}`
      : '',
  ].filter(Boolean);

  if (labels.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/55">
        <ShoppingCart size={15} />
        Tüm SAT kayıtları
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

const SAT_COLUMNS: DataTableColumn<SATRow>[] = [
  {
    key: 'satNo',
    header: 'SAT No',
    sortValue: (row) => row.satNo,
    searchValue: (row) => row.satNo,
    render: (row) => (
      <div>
        <span className="font-semibold text-white">{row.satNo || 'Eksik'}</span>
        {hasInvalidYear(row) && (
          <span className="ml-2 rounded bg-rose-400/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
            Tarih hatası
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'date',
    header: 'SAT Tarihi',
    sortValue: (row) => row.satTarihi ?? new Date(0),
    searchValue: (row) => formatDate(row.satTarihi),
    render: (row) => formatDate(row.satTarihi),
  },
  {
    key: 'age',
    header: 'Yaş',
    sortValue: (row) => getAgeDays(row) ?? -1,
    searchValue: (row) => String(getAgeDays(row) ?? ''),
    className: 'whitespace-nowrap',
    render: (row) => {
      const age = getAgeDays(row);
      return age === null ? '—' : `${age} gün`;
    },
  },
  {
    key: 'unit',
    header: 'Ünite',
    sortValue: (row) => row.unite,
    searchValue: (row) => row.unite,
    render: (row) => row.unite || '—',
  },
  {
    key: 'owner',
    header: 'Talep Sahibi',
    sortValue: (row) => row.talepSahibi,
    searchValue: (row) => `${row.talepSahibi} ${row.butceSorumlusu}`,
    render: (row) => row.talepSahibi || '—',
  },
  {
    key: 'budget',
    header: 'Bütçe',
    sortValue: (row) => getBudgetTitle(row),
    searchValue: (row) => `${row.butceTuru} ${row.pypKodu} ${row.butceAciklama}`,
    className: 'min-w-56',
    render: (row) => (
      <div>
        <div className="line-clamp-1 font-medium text-white/75">
          {getBudgetTitle(row)}
        </div>
        <div className="mt-1 text-[11px] text-white/35">
          {row.pypKodu || row.butceTuru || '—'}
        </div>
      </div>
    ),
  },
  {
    key: 'description',
    header: 'Talep Açıklaması',
    sortValue: (row) => row.aciklama,
    searchValue: (row) => `${row.aciklama} ${row.notlar}`,
    className: 'min-w-72',
    render: (row) => (
      <span className="line-clamp-2 leading-5 text-white/75">{row.aciklama}</span>
    ),
  },
  {
    key: 'amount',
    header: 'Tutar',
    sortValue: (row) => row.toplamTutar,
    searchValue: (row) => `${row.toplamTutar} ${row.paraBirimi}`,
    className: 'whitespace-nowrap',
    render: (row) => (
      <span className="font-semibold text-white tabular-nums">
        {formatAmount(row.toplamTutar, row.paraBirimi)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Son Durum',
    sortValue: (row) => displayStatus(row),
    searchValue: (row) => `${displayStatus(row)} ${row.onayDurumu} ${row.satDurumu}`,
    className: 'min-w-52',
    render: (row) => <StatusBadge row={row} />,
  },
  {
    key: 'buyer',
    header: 'Satın Alma Sorumlusu',
    sortValue: (row) => row.satinAlmaSorumlusu,
    searchValue: (row) => row.satinAlmaSorumlusu,
    className: 'whitespace-nowrap',
    render: (row) => row.satinAlmaSorumlusu || 'Atanmamış',
  },
];

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
  icon: ReactNode;
}) {
  return (
    <div className="metric-card min-h-32">
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium leading-5 text-white/50">{title}</div>
          <div className="mt-3 truncate text-3xl font-semibold text-white tabular-nums">
            {value}
          </div>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 truncate text-[11px] text-white/35">{helper}</div>
    </div>
  );
}

function StatusBadge({ row }: { row: SATRow }) {
  const label = displayStatus(row);
  const color = statusColor(row);
  return (
    <span
      className="inline-flex max-w-64 rounded-md border px-2 py-1 text-xs font-medium"
      style={{
        color,
        borderColor: `${color}45`,
        backgroundColor: `${color}14`,
      }}
    >
      <span className="line-clamp-2">{label}</span>
    </span>
  );
}

function SATDetail({ row }: { row: SATRow }) {
  const fields = [
    ['Son Durum', displayStatus(row)],
    ['Süreç Aşaması', stageLabel(row.stage)],
    ['SAT Tarihi', formatDate(row.satTarihi)],
    ['SAT Yaşı', getAgeDays(row) === null ? '—' : `${getAgeDays(row)} gün`],
    ['Ünite', row.unite],
    ['Talep Sahibi', row.talepSahibi],
    ['Bütçe Sorumlusu', row.butceSorumlusu],
    ['Satın Alma Sorumlusu', row.satinAlmaSorumlusu],
    ['Toplam Tutar', formatAmount(row.toplamTutar, row.paraBirimi)],
    ['Bütçe Türü', row.butceTuru],
    ['PYP / Mali Merkez', row.pypKodu],
    ['Bütçe Açıklaması', row.butceAciklama],
    ['Onay Durumu', row.onayDurumu],
    ['SAT Durumu', row.satDurumu],
    ['Malzeme Geliş Bilgisi', row.malzemeGelisTarihi],
  ];

  return (
    <div className="space-y-4">
      {rowAlertText(row) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300" />
          <span>{rowAlertText(row)}</span>
        </div>
      )}
      <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
        <div className="text-xs font-medium text-white/40">Talep Açıklaması</div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/85">
          {row.aciklama || '—'}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
            <div className="text-xs font-medium text-white/40">{label}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-white/80">{value || '—'}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
        <div className="text-xs font-medium text-white/40">Notlar</div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/75">
          {row.notlar || '—'}
        </div>
      </div>
    </div>
  );
}

function buildBudgetSummaries(rows: SATRow[]): BudgetSummary[] {
  const map = new Map<string, SATRow[]>();
  rows.forEach((row) => {
    const key = getBudgetKey(row);
    map.set(key, [...(map.get(key) ?? []), row]);
  });

  return [...map.entries()]
    .map(([key, budgetRows]) => ({
      key,
      title: getBudgetTitle(budgetRows[0]),
      code: budgetRows[0]?.pypKodu ?? '',
      type: budgetRows[0]?.butceTuru ?? '',
      rows: budgetRows,
      totals: sumByCurrency(budgetRows),
      opened: budgetRows.length,
      sas: budgetRows.filter(isSasConverted).length,
      invoice: budgetRows.filter(isInvoiceIssued).length,
    }))
    .sort((a, b) => b.rows.length - a.rows.length || a.title.localeCompare(b.title, 'tr'));
}

function buildStatusSummary(rows: SATRow[]): StatusSummary[] {
  const map = new Map<string, StatusSummary>();
  rows.forEach((row) => {
    const key = getStatusKey(row);
    const current = map.get(key);
    if (current) {
      current.rows.push(row);
    } else {
      map.set(key, { key, label: displayStatus(row), rows: [row] });
    }
  });
  return [...map.values()].sort(
    (a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label, 'tr'),
  );
}

function buildAlertSummary(rows: SATRow[]) {
  return ALERTS.map((alert) => {
    const alertRows = rows.filter((row) => matchesAlert(row, alert.key));
    return {
      key: alert.key,
      count: alertRows.length,
      rows: alertRows,
    };
  });
}

function buildInsights(rows: SATRow[]) {
  const openRows = rows.filter((row) => !isInvoiceIssued(row));
  const ages = openRows
    .map(getAgeDays)
    .filter((value): value is number => value !== null && value >= 0);
  const averageAge =
    ages.length > 0
      ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length)
      : 0;
  return { averageAge, openRows: openRows.length };
}

function prepareReportRows(type: ReportType, rows: SATRow[]) {
  if (type === 'leadTime') {
    const converted = rows
      .filter((row) => isSasConverted(row) && getAgeDays(row) !== null)
      .sort((a, b) => (getAgeDays(b) ?? 0) - (getAgeDays(a) ?? 0));
    return { rows: converted.length > 0 ? converted : rows, type };
  }
  if (type === 'urgentApproval') {
    const urgent = rows.filter((row) => matchesAlert(row, 'approval'));
    return { rows: urgent, type };
  }
  if (type === 'aging') {
    return {
      rows: [...rows].sort((a, b) => (getAgeDays(b) ?? -1) - (getAgeDays(a) ?? -1)),
      type,
    };
  }
  return { rows, type };
}

function buildReportScope(type: ReportType, rows: SATRow[], filtersActive: boolean) {
  const report = REPORTS.find((item) => item.key === type);
  const base = report?.title ?? 'SAT Takip Raporu';
  const filterLabel = filtersActive ? 'Aktif ekran filtresi' : 'Tüm SAT kayıtları';

  if (type === 'leadTime') {
    const ages = rows
      .map(getAgeDays)
      .filter((value): value is number => value !== null && value >= 0);
    const average =
      ages.length > 0
        ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length)
        : 0;
    return `${base} · Ortalama ${average} gün · ${filterLabel}`;
  }

  if (type === 'aging') {
    const buckets = buildAgingBuckets(rows);
    return `${base} · 0-15: ${buckets.low} · 15-30: ${buckets.mid} · 30+: ${buckets.high} · ${filterLabel}`;
  }

  return `${base} · ${filterLabel}`;
}

function buildAgingBuckets(rows: SATRow[]) {
  return rows.reduce(
    (acc, row) => {
      const age = getAgeDays(row);
      if (age === null) return acc;
      if (age <= 15) acc.low += 1;
      else if (age <= 30) acc.mid += 1;
      else acc.high += 1;
      return acc;
    },
    { low: 0, mid: 0, high: 0 },
  );
}

function matchesPipeline(row: SATRow, pipeline: PipelineKey) {
  if (pipeline === 'opened') return true;
  if (pipeline === 'sas') return isSasConverted(row);
  return isInvoiceIssued(row);
}

function pipelineCount(rows: SATRow[], pipeline: PipelineKey) {
  return rows.filter((row) => matchesPipeline(row, pipeline)).length;
}

function matchesAlert(row: SATRow, alert: AlertKey) {
  const age = getAgeDays(row);
  if (alert === 'sat60') {
    return age !== null && age >= 60 && age < 90 && !isSasConverted(row);
  }
  if (alert === 'sat90') {
    return age !== null && age >= 90 && !isSasConverted(row);
  }
  if (alert === 'delivery') {
    const deliveryDate = parseMaterialDeliveryDate(row);
    return Boolean(deliveryDate && isPastDate(deliveryDate) && !isInvoiceIssued(row));
  }
  return age !== null && age >= 30 && isApprovalWaiting(row);
}

function isSasConverted(row: SATRow) {
  const procurement = normalize(row.satDurumu);
  const status = normalize(`${row.satDurumu} ${row.onayDurumu} ${displayStatus(row)}`);
  return (
    row.stage === 'sas_verildi' ||
    row.stage === 'tamamlandi' ||
    procurement.includes('sas') ||
    status.includes('satinalma siparis') ||
    status.includes('siparis')
  );
}

function isInvoiceIssued(row: SATRow) {
  const procurement = normalize(row.satDurumu);
  const status = normalize(displayStatus(row));
  return (
    row.stage === 'tamamlandi' ||
    procurement.includes('fatura') ||
    procurement.includes('tamamlandi') ||
    status.includes('fatura') ||
    status.includes('tamamlandi')
  );
}

function isApprovalWaiting(row: SATRow) {
  const approval = normalize(row.onayDurumu);
  if (approval.includes('tamamlandi')) return false;
  return (
    approval.includes('mail') ||
    approval.includes('sap') ||
    approval.includes('onay') ||
    row.stage === 'mail_onayi' ||
    row.stage === 'sap_onayi' ||
    row.stage === 'durum_girilmemis'
  );
}

function displayStatus(row: SATRow) {
  return (
    rawField(row, [
      'satınalma özet durum bilgisi',
      'satinalma ozet durum bilgisi',
      'satın alma özet durum bilgisi',
      'satin alma ozet durum bilgisi',
    ]) ||
    row.satDurumu ||
    row.onayDurumu ||
    stageLabel(row.stage)
  );
}

function rawField(row: SATRow, labels: string[]) {
  const normalizedLabels = labels.map(normalize);
  const found = Object.entries(row.raw).find(([header]) => {
    const cleanHeader = normalize(header);
    return normalizedLabels.some((label) => cleanHeader.includes(label));
  });
  return found?.[1] ?? '';
}

function getStatusKey(row: SATRow) {
  return normalize(displayStatus(row)).replace(/[^a-z0-9]+/g, '-') || 'durum-yok';
}

function statusColor(row: SATRow) {
  if (matchesAlert(row, 'sat90')) return '#ef4444';
  if (matchesAlert(row, 'sat60')) return '#f59e0b';
  if (isInvoiceIssued(row)) return '#22c55e';
  if (isSasConverted(row)) return '#8b5cf6';
  return STAGES.find((item) => item.key === row.stage)?.color ?? '#38bdf8';
}

function getBudgetKey(row: SATRow) {
  const key = `${row.butceAciklama}|${row.pypKodu}|${row.butceTuru}`;
  return normalize(key).replace(/[^a-z0-9]+/g, '-') || 'butce-belirtilmemis';
}

function getBudgetTitle(row: SATRow) {
  return row.butceAciklama || row.pypKodu || row.butceTuru || 'Bütçe belirtilmemiş';
}

function sumByCurrency(rows: SATRow[]): CurrencyTotal[] {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const currency = row.paraBirimi || 'Tutar';
    totals.set(currency, (totals.get(currency) ?? 0) + row.toplamTutar);
  });
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => a.currency.localeCompare(b.currency, 'tr'));
}

function parseMaterialDeliveryDate(row: SATRow) {
  const direct = parseDate(row.malzemeGelisTarihi);
  if (direct) return direct;
  const match = row.malzemeGelisTarihi.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/);
  return match ? parseDate(match[0]) : null;
}

function getAgeDays(row: SATRow) {
  if (!row.satTarihi || hasInvalidYear(row)) return null;
  const start = startOfDay(row.satTarihi);
  const now = startOfDay(new Date());
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
}

function isPastDate(date: Date) {
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function alertRowClassName(row: SATRow) {
  if (matchesAlert(row, 'sat90')) return 'bg-rose-500/[0.08]';
  if (matchesAlert(row, 'delivery')) return 'bg-pink-400/[0.06]';
  if (matchesAlert(row, 'sat60')) return 'bg-amber-400/[0.06]';
  if (matchesAlert(row, 'approval')) return 'bg-orange-400/[0.045]';
  if (hasCriticalIssue(row)) return 'bg-amber-400/[0.035]';
  return '';
}

function rowAlertText(row: SATRow) {
  const issues = [];
  if (!row.satNo) issues.push('SAT numarası eksik');
  if (hasInvalidYear(row)) issues.push(`SAT tarihi şüpheli: ${formatDate(row.satTarihi)}`);
  if (matchesAlert(row, 'sat90')) issues.push("90 günü geçmiş ve SAS'a dönmemiş");
  else if (matchesAlert(row, 'sat60')) issues.push("60 günü geçmiş ve SAS'a dönmemiş");
  if (matchesAlert(row, 'delivery')) {
    issues.push('Malzeme geliş tarihi geçmiş ancak fatura/tamamlanma görünmüyor');
  }
  if (matchesAlert(row, 'approval')) issues.push('30+ gün onay aksiyonu bekliyor');
  return issues.join(' · ');
}

function stageLabel(stage: SATStage) {
  return STAGES.find((item) => item.key === stage)?.label ?? 'Diğer';
}

function hasInvalidYear(row: SATRow) {
  const year = row.satTarihi?.getFullYear();
  return year !== undefined && (year < 2000 || year > 2100);
}

function hasCriticalIssue(row: SATRow) {
  return !row.satNo || hasInvalidYear(row);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatAmount(value: number, currency: string) {
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} ${currency || ''}`.trim();
}

function percent(value: number, total: number) {
  return total ? `%${Math.round((value / total) * 100)}` : '%0';
}
