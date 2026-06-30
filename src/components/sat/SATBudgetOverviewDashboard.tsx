import { useMemo, useState, type CSSProperties } from 'react';
import {
  Building2,
  FileText,
  FilterX,
  Loader2,
  ReceiptText,
  Workflow,
} from 'lucide-react';
import type {
  SATBudgetCompany,
  SATBudgetRow,
  SATBudgetType,
  SATBudgetUsageRow,
  SATBudgetUsageStage,
} from '../../types';
import { useDataStore } from '../../store/dataStore';
import {
  budgetTotals,
  budgetTypeLabel,
  budgetUsageSummary,
  companyLabel,
  isMaskedBudgetRow,
  SAT_BUDGET_COMPANIES,
} from '../../lib/satBudgetLogic';
import { downloadSATBudgetReportPdf } from '../../lib/satBudgetReportPdf';
import {
  isSTADOpexBudgetSource,
  SAT_BUDGET_SOURCES,
} from '../../lib/satBudgetParser';
import { formatDate } from '../../lib/normalize';
import {
  DataTable,
  type DataTableColumn,
} from '../common/DataTable';
import { Modal } from '../common/Modal';

const SOURCE_TYPE_ORDER: SATBudgetType[] = [
  'OPERATIONAL_CAPEX',
  'OPEX',
  'CAPEX',
];

const AZERBAIJAN_COMPANY_THEME: Record<
  SATBudgetCompany,
  {
    color: string;
    soft: string;
    border: string;
    ring: string;
    glow: string;
    gradient: string;
  }
> = {
  PETKIM: {
    color: '#38bdf8',
    soft: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.5)',
    ring: 'rgba(56, 189, 248, 0.24)',
    glow: 'rgba(56, 189, 248, 0.18)',
    gradient: 'linear-gradient(90deg, #38bdf8, #06b6d4)',
  },
  STAR: {
    color: '#ef4444',
    soft: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.5)',
    ring: 'rgba(239, 68, 68, 0.24)',
    glow: 'rgba(239, 68, 68, 0.18)',
    gradient: 'linear-gradient(90deg, #ef4444, #f97316)',
  },
  STAD: {
    color: '#22c55e',
    soft: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.5)',
    ring: 'rgba(34, 197, 94, 0.24)',
    glow: 'rgba(34, 197, 94, 0.18)',
    gradient: 'linear-gradient(90deg, #22c55e, #14b8a6)',
  },
};

type AzerbaijanCompanyTheme =
  (typeof AZERBAIJAN_COMPANY_THEME)[SATBudgetCompany];

const BUDGET_USAGE_CARD_THEMES: AzerbaijanCompanyTheme[] = [
  AZERBAIJAN_COMPANY_THEME.PETKIM,
  AZERBAIJAN_COMPANY_THEME.STAR,
  AZERBAIJAN_COMPANY_THEME.STAD,
];

type UsageStageVisualKey = SATBudgetUsageStage | 'UNUSED';

const USAGE_STAGE_BAR_THEME: Record<
  UsageStageVisualKey,
  { color: string; soft: string }
> = {
  SAT: {
    color: '#38bdf8',
    soft: 'rgba(56, 189, 248, 0.18)',
  },
  SAS: {
    color: '#ef4444',
    soft: 'rgba(239, 68, 68, 0.18)',
  },
  FAT: {
    color: '#22c55e',
    soft: 'rgba(34, 197, 94, 0.18)',
  },
  UNUSED: {
    color: '#64748b',
    soft: 'rgba(100, 116, 139, 0.24)',
  },
};

interface SATBudgetUsageTableRow {
  rowId: string;
  documentDate: Date | null;
  budgetType: SATBudgetType;
  stage: SATBudgetUsageStage;
  satNo: string;
  sasNo: string;
  invoiceNo: string;
  description: string;
  vendor: string;
  amountUsd: number;
  rowCount: number;
  searchText: string;
}

export function SATBudgetOverviewDashboard() {
  const allRows = useDataStore((state) => state.satBudgetRows);
  const usageRows = useDataStore((state) => state.satBudgetUsageRows);
  const usageFile = useDataStore((state) => state.satBudgetUsageFile);
  const [selectedCompany, setSelectedCompany] =
    useState<SATBudgetCompany | null>(null);
  const [selectedBudgetType, setSelectedBudgetType] =
    useState<SATBudgetType | null>(null);
  const [selectedUsageStage, setSelectedUsageStage] =
    useState<SATBudgetUsageStage | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportCompany, setReportCompany] =
    useState<SATBudgetCompany | 'ALL'>('ALL');
  const [reportGenerating, setReportGenerating] = useState(false);

  const visibleRows = useMemo(
    () =>
      selectedCompany
        ? allRows.filter((row) => row.company === selectedCompany)
        : allRows,
    [allRows, selectedCompany],
  );
  const budgetMovementRows = useMemo(
    () =>
      selectedBudgetType
        ? visibleRows.filter((row) => row.budgetType === selectedBudgetType)
        : visibleRows,
    [selectedBudgetType, visibleRows],
  );
  const companySourceSummary = useMemo(
    () => buildCompanySourceSummary(allRows, usageRows),
    [allRows, usageRows],
  );
  const selectedUsageRows = useMemo(
    () =>
      selectedCompany
        ? usageRows.filter(
            (row) =>
              row.company === selectedCompany &&
              (!selectedBudgetType || row.budgetType === selectedBudgetType) &&
              (!selectedUsageStage || row.stage === selectedUsageStage),
          )
        : [],
    [selectedBudgetType, selectedCompany, selectedUsageStage, usageRows],
  );
  const selectedUsageTableRows = useMemo(
    () => buildUsageTableRows(selectedUsageRows, selectedUsageStage),
    [selectedUsageRows, selectedUsageStage],
  );
  const usageSummaries = useMemo(
    () =>
      selectedCompany
        ? budgetUsageSummary(allRows, usageRows, selectedCompany)
        : [],
    [allRows, selectedCompany, usageRows],
  );
  const selectedCompanyTheme = selectedCompany
    ? AZERBAIJAN_COMPANY_THEME[selectedCompany]
    : null;

  function selectCompany(company: SATBudgetCompany | null) {
    setSelectedCompany(company);
    setSelectedBudgetType(null);
    setSelectedUsageStage(null);
  }

  function selectBudgetType(type: SATBudgetType) {
    setSelectedBudgetType((current) => (current === type ? null : type));
    setSelectedUsageStage(null);
  }

  function selectUsageStage(
    type: SATBudgetType,
    stage: SATBudgetUsageStage,
  ) {
    setSelectedBudgetType(type);
    setSelectedUsageStage((current) =>
      selectedBudgetType === type && current === stage ? null : stage,
    );
  }

  function openReportModal() {
    setReportCompany(selectedCompany ?? 'ALL');
    setReportModalOpen(true);
  }

  async function createReport() {
    const company = reportCompany === 'ALL' ? null : reportCompany;
    const budgetRows = company
      ? allRows.filter((row) => row.company === company)
      : allRows;
    const reportUsageRows = company
      ? usageRows.filter((row) => row.company === company)
      : usageRows;
    const scopeLabel = company ? companyLabel(company) : 'Genel';
    setReportGenerating(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSATBudgetReportPdf({
        budgetRows,
        usageRows: reportUsageRows,
        company,
        scopeLabel,
      });
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
              onClick={openReportModal}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:from-cyan-400 hover:to-teal-500"
            >
              <FileText size={15} />
              PDF Raporu Oluştur
            </button>
            <button
              type="button"
              onClick={() => selectCompany(null)}
              disabled={!selectedCompany}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FilterX size={15} />
              Filtreyi Temizle
            </button>
          </div>
        </div>
        <BudgetSourcesOverview
          data={companySourceSummary}
          selectedCompany={selectedCompany}
          onSelectCompany={(company) =>
            selectCompany(selectedCompany === company ? null : company)
          }
        />
      </section>

      {selectedCompany && selectedCompanyTheme && (
        <section
          className="card p-5"
          style={{
            borderColor: selectedCompanyTheme.border,
            boxShadow: `inset 0 1px 0 ${selectedCompanyTheme.glow}`,
          }}
        >
          <div className="mb-5 flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: selectedCompanyTheme.soft,
                color: selectedCompanyTheme.color,
              }}
            >
              <Workflow size={18} />
            </span>
            <div>
              <h2 className="panel-title">
                {companyLabel(selectedCompany)} Bütçe Kullanım Aşamaları
              </h2>
              <p className="panel-subtitle mt-1">
                CAPEX, OPEX ve Operational CAPEX bütçelerinin SAT · SAS · FAT · Kullanılmayan dağılımı
              </p>
            </div>
          </div>
          {usageFile ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {usageSummaries.map((summary, index) => (
                <BudgetUsageBar
                  key={summary.key}
                  summary={summary}
                  active={selectedBudgetType === summary.key}
                  selectedStage={
                    selectedBudgetType === summary.key
                      ? selectedUsageStage
                      : null
                  }
                  theme={
                    BUDGET_USAGE_CARD_THEMES[index] ??
                    BUDGET_USAGE_CARD_THEMES[0]
                  }
                  onSelectType={() => selectBudgetType(summary.key)}
                  onSelectStage={(stage) =>
                    selectUsageStage(summary.key, stage)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-amber-300/25 bg-amber-400/[0.05] px-6 text-center">
              <ReceiptText size={28} className="mb-3 text-amber-300" />
              <div className="text-sm font-semibold text-white/80">
                SAT Bütçe Kullanım Detayı Excel dosyasını yükleyin
              </div>
              <p className="mt-2 max-w-xl text-xs leading-5 text-white/45">
                SAT, SAS ve fatura tutarları yeni dosyadan okunarak bütçe türlerine dağıtılacaktır.
              </p>
            </div>
          )}
        </section>
      )}

      {selectedCompany && usageFile && (
        <section className="card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">
              {selectedBudgetType
                ? `${budgetTypeLabel(selectedBudgetType)} Bütçe Hareketleri`
                : 'SAT · SAS · FAT Belge Bağlantıları'}
            </h2>
            <p className="mt-1 text-xs text-white/45">
              {companyLabel(selectedCompany)}
              {selectedUsageStage ? ` · ${selectedUsageStage}` : ''} ·{' '}
              {selectedUsageStage
                ? `${selectedUsageTableRows.length} belge grubu · ${selectedUsageRows.length} kalem hareketi`
                : `${selectedUsageRows.length} bütçe kullanım hareketi`}
            </p>
          </div>
          <DataTable
            data={selectedUsageTableRows}
            columns={USAGE_COLUMNS}
            rowKey={(row) => row.rowId}
            initialSortKey="date"
            initialSortDir="desc"
            emptyMessage="Seçili şirket için SAT/SAS/FAT bütçe hareketi bulunamadı."
          />
        </section>
      )}

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Bütçe Hareket Detayı</h2>
          <p className="mt-1 text-xs text-white/45">
            {selectedCompany ? companyLabel(selectedCompany) : 'Tüm Şirketler'}
            {selectedBudgetType
              ? ` · ${budgetTypeLabel(selectedBudgetType)}`
              : ''}{' '}
            · {budgetMovementRows.length} hareket
          </p>
        </div>
        <DataTable
          data={budgetMovementRows}
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
          <div>
            <div className="mb-2 text-sm font-semibold text-white/80">
              Rapor kapsamı
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ReportScopeButton
                title="Genel"
                helper={`${allRows.length} bütçe · ${usageRows.length} kullanım hareketi`}
                active={reportCompany === 'ALL'}
                onClick={() => setReportCompany('ALL')}
              />
              {SAT_BUDGET_COMPANIES.map((company) => {
                const companyBudgetRows = allRows.filter(
                  (row) => row.company === company,
                );
                const companyUsageRows = usageRows.filter(
                  (row) => row.company === company,
                );
                return (
                  <ReportScopeButton
                    key={company}
                    title={companyLabel(company)}
                    helper={`${companyBudgetRows.length} bütçe · ${companyUsageRows.length} kullanım hareketi`}
                    active={reportCompany === company}
                    onClick={() => setReportCompany(company)}
                  />
                );
              })}
            </div>
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

type UsageSummary = ReturnType<typeof budgetUsageSummary>[number];

function BudgetUsageBar({
  summary,
  active,
  selectedStage,
  theme,
  onSelectType,
  onSelectStage,
}: {
  summary: UsageSummary;
  active: boolean;
  selectedStage: SATBudgetUsageStage | null;
  theme: AzerbaijanCompanyTheme;
  onSelectType: () => void;
  onSelectStage: (stage: SATBudgetUsageStage) => void;
}) {
  const utilization = summary.totalBudget
    ? Math.round((summary.used / summary.totalBudget) * 100)
    : 0;
  const barBase = Math.max(summary.totalBudget, 1);
  const barSegments = summary.segments.filter((segment) => segment.value > 0);
  return (
    <div
      className="rounded-lg border bg-black/20 p-4 transition"
      style={{
        borderColor: active ? theme.border : 'rgba(255,255,255,0.12)',
        boxShadow: active
          ? `0 0 0 2px ${theme.ring}, 0 18px 38px ${theme.glow}`
          : `inset 0 1px 0 ${theme.glow}`,
      }}
    >
      <button
        type="button"
        onClick={onSelectType}
        aria-pressed={active}
        className="flex w-full items-start justify-between gap-3 rounded-md text-left focus:outline-none focus:ring-2"
        style={{ '--tw-ring-color': theme.ring } as CSSProperties}
      >
        <div>
          <h3 className="text-sm font-semibold text-white">
            {summary.label} - {budgetUsageDisplayLabel(summary.sourceCode)}
          </h3>
          <p className="mt-1 text-[11px] text-white/40">
            {summary.sourceCode} · {summary.rowCount} kullanım hareketi
          </p>
        </div>
        <div className="text-right">
          <div
            className="text-sm font-semibold"
            style={{ color: theme.color }}
          >
            {summary.masked
              ? 'XXX USD'
              : isSTADOpexBudgetSource(summary.sourceCode)
                ? formatUsd(summary.totalBudget)
                : formatCompactUsd(summary.totalBudget)}
          </div>
          <div className="mt-1 text-[10px] text-white/35">Toplam bütçe</div>
        </div>
      </button>

      <div
        className="mt-5 rounded-lg border bg-white/[0.035] p-3"
        style={{ borderColor: theme.border }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium text-white/45">
              Kullanım oranı
            </div>
            <div className="mt-0.5 text-xl font-semibold text-white tabular-nums">
              {summary.masked ? 'XXX' : `%${utilization}`}
            </div>
          </div>
          <div className="text-right text-[11px] text-white/40">
            <div>Kullanılan</div>
            <div className="mt-0.5 font-semibold text-white/75 tabular-nums">
              {formatCompactUsd(summary.used)}
            </div>
          </div>
        </div>

        <div className="h-5 overflow-hidden rounded-full bg-slate-500/25 ring-1 ring-white/10">
          {barSegments.length > 0 ? (
            <div className="flex h-full min-w-0">
              {barSegments.map((segment) => {
                const width = Math.min(100, (segment.value / barBase) * 100);
                const selectable = segment.key !== 'UNUSED';
                const stageTheme =
                  USAGE_STAGE_BAR_THEME[segment.key as UsageStageVisualKey];
                const segmentStyle = {
                  width: `${Math.max(width, width > 0 ? 1 : 0)}%`,
                  backgroundColor: stageTheme.color,
                  opacity: selectedStage && segment.key !== selectedStage ? 0.35 : 1,
                };
                const title = `${segment.label}: ${formatUsd(segment.value)}`;
                return selectable ? (
                  <button
                    key={segment.key}
                    type="button"
                    title={title}
                    aria-label={title}
                    onClick={() => onSelectStage(segment.key as SATBudgetUsageStage)}
                    className="h-full shrink-0 transition hover:brightness-125"
                    style={segmentStyle}
                  />
                ) : (
                  <div
                    key={segment.key}
                    title={title}
                    className="h-full shrink-0"
                    style={segmentStyle}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-white/35">
              Veri yok
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
          <span>0</span>
          <span>{formatCompactUsd(summary.totalBudget)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {summary.segments.map((segment) => {
          const selectable = segment.key !== 'UNUSED';
          const percent = summary.totalBudget
            ? Math.round((segment.value / summary.totalBudget) * 100)
            : 0;
          const stageTheme =
            USAGE_STAGE_BAR_THEME[segment.key as UsageStageVisualKey];
          const rowBarWidth = summary.totalBudget
            ? Math.min(100, (segment.value / summary.totalBudget) * 100)
            : 0;
          const rowBarStyle = {
            width: `${Math.max(rowBarWidth, rowBarWidth > 0 ? 1 : 0)}%`,
            backgroundColor: stageTheme.color,
          };
          const content = (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-3 text-white/55">
                <span className="flex min-w-[128px] items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stageTheme.color }}
                  />
                  <span>{segment.label}</span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
                    %{percent}
                  </span>
                </span>
                <span
                  className="h-2 min-w-20 flex-1 overflow-hidden rounded-full"
                  style={{ backgroundColor: stageTheme.soft }}
                >
                  <span
                    className="block h-full rounded-full transition-all"
                    style={rowBarStyle}
                  />
                </span>
              </span>
              <span className="font-semibold text-white/80 tabular-nums">
                {summary.masked && segment.key === 'UNUSED'
                  ? 'XXX USD'
                  : formatUsd(segment.value)}
              </span>
            </>
          );
          return selectable ? (
            <button
              key={segment.key}
              type="button"
              onClick={() =>
                onSelectStage(segment.key as SATBudgetUsageStage)
              }
              aria-pressed={selectedStage === segment.key}
              className={`flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-xs transition ${
              selectedStage === segment.key
                  ? ''
                  : 'hover:bg-white/[0.05]'
              }`}
              style={
                selectedStage === segment.key
                  ? {
                      backgroundColor: theme.soft,
                      boxShadow: `0 0 0 1px ${theme.border}`,
                    }
                  : undefined
              }
            >
              {content}
            </button>
          ) : (
            <div
              key={segment.key}
              className="flex items-center justify-between gap-3 px-2 py-1.5 text-xs"
            >
              {content}
            </div>
          );
        })}
      </div>

      {summary.totalBudget <= 0 && summary.used <= 0 && (
        <div className="mt-3 flex min-h-16 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.03] text-xs text-white/35">
          Bütçe veya kullanım kaydı yok
        </div>
      )}
      {summary.overrun > 0 && (
        <div className="mt-3 rounded-md border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-[11px] font-medium text-rose-200">
          Bütçe aşımı: {formatUsd(summary.overrun)}
        </div>
      )}
    </div>
  );
}

function BudgetSourcesOverview({
  data,
  selectedCompany,
  onSelectCompany,
}: {
  data: {
    company: SATBudgetCompany;
    label: string;
    total: number;
    masked: boolean;
    sources: {
      key: string;
      label: string;
      displayLabel: string;
      sourceCode: string;
      type: SATBudgetType;
      typeLabel: string;
      value: number;
      count: number;
      masked: boolean;
      used: number;
      unused: number;
      utilizationPercent: number;
      barPercent: number;
    }[];
  }[];
  selectedCompany: SATBudgetCompany | null;
  onSelectCompany: (company: SATBudgetCompany) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-4 flex items-start gap-2">
        <Building2 size={17} className="mt-0.5 text-cyan-300" />
        <div>
          <h3 className="text-sm font-semibold text-white">Bütçe Kaynakları</h3>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Şirket bazında net bütçe kaynakları; Operational CAPEX, OPEX ve CAPEX sırasıyla gösterilir.
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {data.map((company) => {
          const theme = AZERBAIJAN_COMPANY_THEME[company.company];
          const active = selectedCompany === company.company;
          return (
            <button
              type="button"
              key={company.company}
              onClick={() => onSelectCompany(company.company)}
              aria-pressed={active}
              className={`flex h-full w-full flex-col items-stretch justify-start rounded-xl border bg-black/20 p-4 text-left transition hover:-translate-y-0.5 ${
                selectedCompany && !active ? 'opacity-55 hover:opacity-80' : ''
              }`}
              style={{
                borderColor: active ? theme.border : 'rgba(255,255,255,0.12)',
                boxShadow: active
                  ? `0 0 0 2px ${theme.ring}, 0 20px 45px ${theme.glow}`
                  : `inset 0 1px 0 ${theme.glow}`,
              }}
            >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-white">
                  {company.label}
                </h4>
                <div className="mt-1 text-[11px] text-white/35">
                  {company.sources.length} bütçe kaynağı
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: theme.color }}
                >
                  {company.masked ? 'XXX USD' : formatCompactUsd(company.total)}
                </div>
                <div className="mt-1 text-[10px] text-white/35">Net toplam</div>
              </div>
            </div>

            <div className="space-y-2.5">
              {company.sources.map((source) => (
                <div
                  key={source.key}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: theme.border,
                    background: `linear-gradient(135deg, ${theme.soft}, rgba(255,255,255,0.035))`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: theme.color }}
                      >
                        {source.typeLabel}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-medium text-white/80">
                        {source.displayLabel}
                      </div>
                      <div className="mt-1 text-[11px] text-white/35">
                        {source.sourceCode}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-right text-sm font-semibold tabular-nums"
                      style={{ color: source.value < 0 ? '#fda4af' : theme.color }}
                    >
                      {source.masked ? 'XXX USD' : formatUsd(source.value)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
                    <span>{source.count} hareket</span>
                    <span>Net bütçe</span>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                      <span className="font-medium text-white/45">
                        Kullanım oranı
                      </span>
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: theme.color }}
                      >
                        %{source.utilizationPercent} kullanıldı
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-500/25">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${source.barPercent}%`,
                          background: theme.gradient,
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] text-white/35">
                      <span>Kullanılan: {formatCompactUsd(source.used)}</span>
                      <span>Kalan: {formatCompactUsd(source.unused)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}

function buildCompanySourceSummary(
  rows: SATBudgetRow[],
  usageRows: SATBudgetUsageRow[],
) {
  return SAT_BUDGET_COMPANIES.map((company) => {
    const usageByType = new Map(
      budgetUsageSummary(rows, usageRows, company).map((summary) => [
        summary.key,
        summary,
      ]),
    );
    const sources = SAT_BUDGET_SOURCES.filter(
      (source) => source.company === company,
    )
      .sort(
        (a, b) =>
          SOURCE_TYPE_ORDER.indexOf(a.budgetType) -
          SOURCE_TYPE_ORDER.indexOf(b.budgetType),
      )
      .map((source) => {
        const sourceRows = rows.filter(
          (row) =>
            row.company === company &&
            row.budgetType === source.budgetType &&
            row.sourceCode === source.code,
        );
        const totals = budgetTotals(sourceRows);
        const usage = usageByType.get(source.budgetType);
        const totalBudget = Math.max(0, totals.net);
        const used = usage?.used ?? 0;
        const unused = Math.max(0, totalBudget - used);
        const utilization = totalBudget > 0 ? (used / totalBudget) * 100 : 0;
        return {
          key: `${company}-${source.code}`,
          label: source.label,
          displayLabel: sourceDisplayLabel(source.label),
          sourceCode: source.code,
          type: source.budgetType,
          typeLabel: budgetTypeLabel(source.budgetType),
          value: totals.net,
          count: totals.count,
          masked: sourceRows.some(isMaskedBudgetRow),
          used,
          unused,
          utilizationPercent: Math.round(utilization),
          barPercent: clamp(utilization, 0, 100),
        };
      });
    return {
      company,
      label: companyLabel(company),
      total: sources.reduce((total, source) => total + source.value, 0),
      masked: sources.some((source) => source.masked),
      sources,
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sourceDisplayLabel(label: string) {
  return label
    .replace(/^Operational\s+CAPEX\s*\/\s*/i, '')
    .replace(/^CAPEX\s*\/\s*/i, '')
    .replace(/^OPEX\s*\/\s*/i, '')
    .trim();
}

function budgetUsageDisplayLabel(sourceCode: string) {
  const source = SAT_BUDGET_SOURCES.find(
    (item) => item.code.toLocaleUpperCase('tr-TR') === sourceCode.toLocaleUpperCase('tr-TR'),
  );
  return source ? sourceDisplayLabel(source.label) : 'Tanımlı Kaynak Yok';
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
        {isMaskedBudgetRow(row) ? 'XXX USD' : formatSignedUsd(row.amount)}
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

const USAGE_COLUMNS: DataTableColumn<SATBudgetUsageTableRow>[] = [
  {
    key: 'date',
    header: 'Kayıt Tarihi',
    sortValue: (row) => row.documentDate ?? new Date(0),
    searchValue: (row) => formatDate(row.documentDate),
    className: 'whitespace-nowrap',
    render: (row) => formatDate(row.documentDate),
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
    key: 'stage',
    header: 'Aşama',
    sortValue: (row) => row.stage,
    searchValue: (row) => row.stage,
    render: (row) => <UsageStageBadge stage={row.stage} />,
  },
  {
    key: 'satNo',
    header: 'SAT No',
    sortValue: (row) => row.satNo,
    searchValue: (row) => row.satNo,
    className: 'whitespace-nowrap',
    render: (row) => row.satNo || <span className="text-amber-300">Eşleşmedi</span>,
  },
  {
    key: 'sasNo',
    header: 'SAS No',
    sortValue: (row) => row.sasNo,
    searchValue: (row) => row.sasNo,
    className: 'whitespace-nowrap',
    render: (row) => row.sasNo || '—',
  },
  {
    key: 'invoiceNo',
    header: 'Fatura No',
    sortValue: (row) => row.invoiceNo,
    searchValue: (row) => row.invoiceNo,
    className: 'whitespace-nowrap',
    render: (row) => row.invoiceNo || '—',
  },
  {
    key: 'description',
    header: 'Açıklama',
    sortValue: (row) => row.description,
    searchValue: (row) => row.searchText,
    className: 'min-w-72',
    render: (row) => (
      <div>
        <div className="text-white/75">{row.description || '—'}</div>
        <div className="mt-1 text-xs text-white/35">
          {row.vendor || 'Satıcı yok'}
          {row.rowCount > 1 ? ` · ${row.rowCount} kalem toplandı` : ''}
        </div>
      </div>
    ),
  },
  {
    key: 'amount',
    header: 'Bütçe Tutarı',
    sortValue: (row) => row.amountUsd,
    searchValue: (row) => String(row.amountUsd),
    className: 'whitespace-nowrap',
    render: (row) => (
      <span className={`font-semibold ${row.amountUsd < 0 ? 'text-rose-300' : 'text-cyan-300'}`}>
        {formatSignedUsd(row.amountUsd)}
      </span>
    ),
  },
];

function UsageStageBadge({ stage }: { stage: SATBudgetUsageStage }) {
  const config =
    stage === 'SAT'
      ? { color: '#38bdf8', label: 'SAT' }
      : stage === 'SAS'
        ? { color: '#8b5cf6', label: 'SAS' }
        : { color: '#10b981', label: 'FAT' };
  return (
    <span
      className="inline-flex rounded-md border px-2 py-1 text-xs font-semibold"
      style={{
        color: config.color,
        borderColor: `${config.color}45`,
        backgroundColor: `${config.color}14`,
      }}
    >
      {config.label}
    </span>
  );
}

function buildUsageTableRows(
  rows: SATBudgetUsageRow[],
  selectedStage: SATBudgetUsageStage | null,
): SATBudgetUsageTableRow[] {
  if (!selectedStage) {
    return rows.map((row) => usageRowToTableRow(row));
  }

  const groups = new Map<string, SATBudgetUsageTableRow>();
  rows.forEach((row) => {
    const documentNo = usageDocumentNo(row, selectedStage);
    const groupKey = documentNo
      ? `${row.company}|${row.budgetType}|${row.sourceCode}|${selectedStage}|${documentNo}`
      : row.rowId;
    const current = groups.get(groupKey);
    if (!current) {
      groups.set(groupKey, usageRowToTableRow(row, `usage-group-${groupKey}`));
      return;
    }

    current.documentDate = laterDate(current.documentDate, row.documentDate);
    current.amountUsd += row.amountUsd;
    current.rowCount += 1;
    current.satNo = mergeDisplayValues(current.satNo, row.satNo);
    current.sasNo = mergeDisplayValues(current.sasNo, row.sasNo);
    current.invoiceNo = mergeDisplayValues(current.invoiceNo, row.invoiceNo);
    current.description = mergeDescription(current.description, row.description);
    current.vendor = mergeDisplayValues(current.vendor, row.vendor);
    current.searchText = [
      current.searchText,
      row.referenceNo,
      row.previousDocumentNo,
      row.satNo,
      row.sasNo,
      row.invoiceNo,
      row.description,
      row.vendor,
    ]
      .filter(Boolean)
      .join(' ');
  });

  return [...groups.values()];
}

function usageRowToTableRow(
  row: SATBudgetUsageRow,
  rowId = row.rowId,
): SATBudgetUsageTableRow {
  return {
    rowId,
    documentDate: row.documentDate,
    budgetType: row.budgetType,
    stage: row.stage,
    satNo: row.satNo,
    sasNo: row.sasNo,
    invoiceNo: row.invoiceNo,
    description: row.description,
    vendor: row.vendor,
    amountUsd: row.amountUsd,
    rowCount: 1,
    searchText: [
      row.referenceNo,
      row.previousDocumentNo,
      row.satNo,
      row.sasNo,
      row.invoiceNo,
      row.description,
      row.vendor,
      row.user,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

function usageDocumentNo(
  row: SATBudgetUsageRow,
  selectedStage: SATBudgetUsageStage,
) {
  if (selectedStage === 'SAT') return row.satNo || row.referenceNo;
  if (selectedStage === 'SAS') return row.sasNo || row.referenceNo;
  return row.invoiceNo || row.referenceNo;
}

function laterDate(a: Date | null, b: Date | null) {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

function mergeDisplayValues(current: string, next: string) {
  if (!next) return current;
  if (!current) return next;
  const values = current.split(', ').filter(Boolean);
  if (values.includes(next)) return current;
  if (values.length >= 2) return `${values.slice(0, 2).join(', ')} +${values.length - 1}`;
  return `${current}, ${next}`;
}

function mergeDescription(current: string, next: string) {
  if (!current) return next;
  if (!next || current === next) return current;
  return current.includes('kalem toplandı') ? current : current;
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
