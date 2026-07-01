import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileCheck2,
  FileText,
  FilterX,
  Loader2,
} from 'lucide-react';
import type {
  SATBudgetCompany,
  SATBudgetRow,
  SATBudgetType,
  SATBudgetUsageRow,
  SATBudgetUsageStage,
  SATExportRow,
} from '../../types';
import { useDataStore } from '../../store/dataStore';
import { formatDate, normalize } from '../../lib/normalize';
import {
  getUniqueSATItemRows,
  sumSATItemUsd,
} from '../../lib/satExportMetrics';
import {
  DataTable,
  type DataTableColumn,
} from '../common/DataTable';
import { Modal } from '../common/Modal';
import {
  downloadSATExportReportPdf,
  type SATExportReportType,
} from '../../lib/satExportReportPdf';
import {
  budgetTotals,
  budgetTypeLabel,
  companyLabel,
} from '../../lib/satBudgetLogic';
import {
  isSTADOpexBudgetSource,
  SAT_BUDGET_SOURCES,
} from '../../lib/satBudgetParser';

const EMPTY_STATUS = '__empty_status__';
const UNASSIGNED = '__unassigned__';
const STATUS_CONFIG = [
  { key: EMPTY_STATUS, label: 'Durum Girilmemiş', color: '#94a3b8' },
  { key: 'SAT İŞLEME ALINDI', label: 'SAT İşleme Alındı', color: '#06b6d4' },
  { key: 'TEKNIK DEĞERLENDIRME', label: 'Teknik Değerlendirme', color: '#3b82f6' },
  { key: 'TEKLIF AŞAMASI', label: 'Teklif Aşaması', color: '#8b5cf6' },
  { key: 'TICARI DEĞERLENDIRME', label: 'Ticari Değerlendirme', color: '#6366f1' },
  { key: 'SATINALMADA', label: 'Satın Almada', color: '#f59e0b' },
  { key: 'REVIZE SAT', label: 'Revize SAT', color: '#f97316' },
  { key: 'SIPARIŞ AŞAMASI', label: 'Sipariş Aşaması', color: '#10b981' },
] as const;

interface SATDocument {
  satNo: string;
  satCreator: string;
  totalSatUsd: number;
  createdAt: Date | null;
  summaryStatus: string;
  approvalStatusDescription: string;
  rows: SATExportRow[];
  sasUsdTotal: number;
  sasCreators: string[];
}

type ExportPipelineStage = SATBudgetUsageStage;
type ExportAlertKey = 'sat60' | 'sat90' | 'deliveryNoInvoice' | 'approvalWaiting';

interface BudgetUsageCardData {
  key: string;
  title: string;
  subtitle: string;
  code: string;
  company?: SATBudgetCompany;
  budgetType?: SATBudgetType;
  totalBudget: number;
  satNos: Set<string>;
  stageSatNos: Record<ExportPipelineStage, Set<string>>;
  stageAmounts: Record<ExportPipelineStage, number>;
  fallback: boolean;
}

const BUDGET_USAGE_COMPANIES: {
  key: SATBudgetCompany;
  label: string;
  color: string;
}[] = [
  { key: 'PETKIM', label: 'Petkim', color: '#38bdf8' },
  { key: 'STAR', label: 'Star', color: '#ef4444' },
  { key: 'STAD', label: 'STAD', color: '#22c55e' },
];

const BUDGET_USAGE_TYPE_ORDER: SATBudgetType[] = [
  'OPERATIONAL_CAPEX',
  'OPEX',
  'CAPEX',
];

const FALLBACK_BUDGET_THEME = {
  label: 'Kaynak',
  color: '#38bdf8',
};

const BUDGET_USAGE_BAR_ROWS: {
  key: ExportPipelineStage | 'UNUSED';
  label: string;
  color: string;
}[] = [
  { key: 'SAT', label: 'SAT', color: '#38bdf8' },
  { key: 'SAS', label: 'SAS', color: '#ef4444' },
  { key: 'FAT', label: 'FAT', color: '#22c55e' },
  { key: 'UNUSED', label: 'Kullanılmayan', color: '#64748b' },
];

const EXPORT_PIPELINE_STAGES: {
  key: ExportPipelineStage;
  label: string;
  helper: string;
  color: string;
}[] = [
  {
    key: 'SAT',
    label: 'Açılan SAT',
    helper: 'Bütçeden açılan satın alma talepleri',
    color: '#38bdf8',
  },
  {
    key: 'SAS',
    label: "SAS'a Dönen SAT",
    helper: 'Siparişe dönüşen SAT belgeleri',
    color: '#8b5cf6',
  },
  {
    key: 'FAT',
    label: 'Fatura Kesilen SAS',
    helper: 'Fatura aşamasına gelen süreçler',
    color: '#10b981',
  },
];

const EXPORT_ALERTS: {
  key: ExportAlertKey;
  title: string;
  helper: string;
  color: string;
}[] = [
  {
    key: 'sat60',
    title: "60+ Gün SAS'a Dönmeyen",
    helper: 'SAT açılmış, 60-89 gündür siparişe dönmemiş',
    color: '#f59e0b',
  },
  {
    key: 'sat90',
    title: "90+ Gün SAS'a Dönmeyen",
    helper: 'SAT açılmış, 90 günü geçmiş kritik kayıtlar',
    color: '#ef4444',
  },
  {
    key: 'deliveryNoInvoice',
    title: 'Teslim Tarihi Geçmiş / Fatura Yok',
    helper: 'Teslim tarihi geçmiş, son fatura işareti yok',
    color: '#fb7185',
  },
  {
    key: 'approvalWaiting',
    title: 'Acil Onay Bekleyen',
    helper: '30+ gün açık kalan onay / revize adımları',
    color: '#f97316',
  },
];

const REPORT_OPTIONS: {
  type: SATExportReportType;
  title: string;
  description: string;
  format: string;
}[] = [
  {
    type: 'executive',
    title: 'Genel SAT Takip Raporu',
    description: 'KPI, süreç hunisi ve öncelikli açık SAT belgeleri.',
    format: 'Kısa · Dikey',
  },
  {
    type: 'performance',
    title: 'Ortalama İşlem Süresi / Yaşlandırma',
    description: 'Bekleme yaşı, aylık trend ve SAT → SAS dönüşüm performansı.',
    format: 'Analiz · Dikey',
  },
  {
    type: 'delivery_risk',
    title: 'Acil Onay ve Teslimat Riski',
    description: 'Onayda bekleyen, geciken ve fatura kapanışı olmayan kalemler.',
    format: 'Operasyon · Yatay',
  },
  {
    type: 'detail',
    title: 'Detaylı SAT Dökümü',
    description: 'SAT ve SAS alanlarını içeren çok sayfalı kalem listesi.',
    format: 'Detay · Yatay',
  },
];

export function SATExportDashboard() {
  const allRows = useDataStore((state) => state.satExportRows);
  const budgetUsageRows = useDataStore((state) => state.satBudgetUsageRows);
  const budgetRows = useDataStore((state) => state.satBudgetRows);
  const allItemRows = useMemo(() => getUniqueSATItemRows(allRows), [allRows]);
  const [selectedCreator, setSelectedCreator] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSasCreator, setSelectedSasCreator] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedApproval, setSelectedApproval] = useState('');
  const [selectedBudgetKey, setSelectedBudgetKey] = useState('');
  const [selectedPipelineStage, setSelectedPipelineStage] =
    useState<ExportPipelineStage | ''>('');
  const [selectedAlert, setSelectedAlert] = useState<ExportAlertKey | ''>('');
  const [detail, setDetail] = useState<SATExportRow | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportScope, setReportScope] = useState<'filtered' | 'all'>('filtered');
  const [reportGenerating, setReportGenerating] =
    useState<SATExportReportType | null>(null);

  const options = useMemo(
    () => ({
      creators: unique(allRows.map((row) => row.satCreator)),
      statuses: unique(allRows.map((row) => row.summaryStatus)).map((value) => ({
        value,
        label: value,
      })),
      sasCreators: withUnassigned(allRows.map((row) => row.sasCreator)),
      vendors: withUnassigned(allRows.map((row) => row.vendorName)),
      approvals: unique(allRows.map((row) => row.approvalStatusDescription)),
    }),
    [allRows],
  );
  const statusOptions = useMemo(
    () => [
      ...(allRows.some((row) => !row.summaryStatus)
        ? [{ value: EMPTY_STATUS, label: 'Durum Girilmemiş' }]
        : []),
      ...options.statuses,
    ],
    [allRows, options.statuses],
  );

  const partyFilteredRows = useMemo(
    () =>
      allRows.filter(
        (row) =>
          (!selectedCreator || row.satCreator === selectedCreator) &&
          (!selectedSasCreator ||
            (selectedSasCreator === UNASSIGNED
              ? !row.sasCreator
              : row.sasCreator === selectedSasCreator)) &&
          (!selectedVendor ||
            (selectedVendor === UNASSIGNED
              ? !row.vendorName
              : row.vendorName === selectedVendor)) &&
          (!selectedApproval ||
            row.approvalStatusDescription === selectedApproval),
      ),
    [
      allRows,
      selectedCreator,
      selectedSasCreator,
      selectedVendor,
      selectedApproval,
    ],
  );
  const statusFilteredRows = useMemo(
    () =>
      partyFilteredRows.filter((row) => {
        if (!selectedStatus) return true;
        if (selectedStatus === EMPTY_STATUS) return !row.summaryStatus;
        return row.summaryStatus === selectedStatus;
      }),
    [partyFilteredRows, selectedStatus],
  );
  const statusBaseRows = partyFilteredRows;
  const budgetUsageCards = useMemo(
    () => buildBudgetUsageCards(budgetUsageRows, allRows, budgetRows),
    [budgetUsageRows, allRows, budgetRows],
  );
  const selectedBudget = selectedBudgetKey
    ? budgetUsageCards.find((item) => item.key === selectedBudgetKey) ?? null
    : null;

  const baseVisibleRows = statusFilteredRows;
  const visibleRows = useMemo(
    () =>
      applyOperationalFilters(
        baseVisibleRows,
        selectedBudget,
        selectedPipelineStage,
        selectedAlert,
      ),
    [baseVisibleRows, selectedBudget, selectedPipelineStage, selectedAlert],
  );
  const visibleItemRows = useMemo(
    () => getUniqueSATItemRows(visibleRows),
    [visibleRows],
  );
  const documents = useMemo(() => buildDocuments(visibleRows), [visibleRows]);
  const statusOperationalRows = useMemo(
    () =>
      applyOperationalFilters(
        statusBaseRows,
        selectedBudget,
        selectedPipelineStage,
        selectedAlert,
      ),
    [statusBaseRows, selectedBudget, selectedPipelineStage, selectedAlert],
  );
  const baseDocuments = useMemo(
    () => buildDocuments(statusOperationalRows),
    [statusOperationalRows],
  );

  const statusSummary = useMemo(
    () =>
      STATUS_CONFIG.map((status) => {
        const docs = baseDocuments.filter((doc) =>
          status.key === EMPTY_STATUS
            ? !doc.summaryStatus
            : doc.summaryStatus === status.key,
        );
        return {
          ...status,
          count: docs.length,
          totalUsd: sum(docs.map((doc) => doc.totalSatUsd)),
        };
      }),
    [baseDocuments],
  );

  const detailDocumentTotal = useMemo(
    () =>
      detail
        ? sumSATItemUsd(allRows.filter((row) => row.satNo === detail.satNo))
        : 0,
    [allRows, detail],
  );

  const alertSummary = useMemo(
    () => buildExportAlertSummary(baseVisibleRows),
    [baseVisibleRows],
  );
  const filtersActive = Boolean(
    selectedCreator ||
      selectedStatus ||
      selectedSasCreator ||
      selectedVendor ||
      selectedApproval ||
      selectedBudgetKey ||
      selectedPipelineStage ||
      selectedAlert,
  );

  function clearFilters() {
    setSelectedCreator('');
    setSelectedStatus('');
    setSelectedSasCreator('');
    setSelectedVendor('');
    setSelectedApproval('');
    setSelectedBudgetKey('');
    setSelectedPipelineStage('');
    setSelectedAlert('');
  }

  function selectBudget(key: string) {
    setSelectedBudgetKey((current) => (current === key ? '' : key));
    setSelectedPipelineStage('');
    setSelectedAlert('');
  }

  function selectAlert(key: ExportAlertKey) {
    setSelectedAlert((current) => (current === key ? '' : key));
    setSelectedBudgetKey('');
    setSelectedPipelineStage('');
  }

  async function createPDFReport(type: SATExportReportType) {
    const rows = reportScope === 'filtered' ? visibleRows : allRows;
    const filterLabels = [
      selectedCreator ? `SAT Yaratan: ${selectedCreator}` : '',
      selectedStatus
        ? `Durum: ${
            selectedStatus === EMPTY_STATUS
              ? 'Durum Girilmemiş'
              : selectedStatus
          }`
        : '',
      selectedSasCreator
        ? `SAS Yaratan: ${selectedSasCreator === UNASSIGNED ? 'Atanmamış' : selectedSasCreator}`
        : '',
      selectedVendor
        ? `Satıcı: ${selectedVendor === UNASSIGNED ? 'Atanmamış' : selectedVendor}`
        : '',
      selectedApproval ? `Onay: ${selectedApproval}` : '',
      selectedBudget ? `Bütçe/Kaynak: ${selectedBudget.title}` : '',
      selectedPipelineStage
        ? `Aşama: ${
            EXPORT_PIPELINE_STAGES.find((item) => item.key === selectedPipelineStage)
              ?.label
          }`
        : '',
      selectedAlert
        ? `Uyarı: ${EXPORT_ALERTS.find((item) => item.key === selectedAlert)?.title}`
        : '',
    ].filter(Boolean);
    const scopeLabel =
      reportScope === 'all'
        ? 'Tüm SAP Export Verisi'
        : filterLabels.join(' · ') || 'Mevcut Dashboard Görünümü';

    setReportGenerating(type);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSATExportReportPdf({ rows, type, scopeLabel });
      setReportModalOpen(false);
    } catch (error) {
      console.error(error);
      window.alert('PDF raporu oluşturulamadı. Lütfen tekrar deneyin.');
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
              Bütçe ve gecikme uyarılarına tıklayarak aşağıdaki SAT listesini filtreleyin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              disabled={allRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-cyan-400 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText size={17} />
              PDF Raporları
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FilterX size={15} />
              Filtreleri Temizle
            </button>
          </div>
        </div>

        <BudgetUsageOverview
          cards={budgetUsageCards}
          selectedBudgetKey={selectedBudgetKey}
          onSelectBudget={selectBudget}
        />
      </section>

      <section className="card p-5">
        <StatusFlowBars
          statuses={statusSummary}
          selectedStatus={selectedStatus}
          onSelect={(status) =>
            setSelectedStatus(selectedStatus === status ? '' : status)
          }
        />
      </section>

      <ExportAlertOverview
        alerts={alertSummary}
        selectedAlert={selectedAlert}
        onSelect={selectAlert}
      />

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">SAT Malzeme Kalemleri</h2>
            <p className="mt-1 text-xs text-white/45">
              {documents.length} SAT belgesi · {visibleItemRows.length} tekil kalem ·{' '}
              {visibleRows.length} SAT/SAS satırı
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/55">
            <FileCheck2 size={15} />
            Satıra tıklayarak tüm takip alanlarını görüntüleyin
          </div>
        </div>
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Detay Filtreleri</h3>
              <p className="mt-1 text-xs text-white/40">
                Aşağıdaki SAT/SAS/FAT detay listesini ayrıntılı daraltmak için kullanın.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ExportSelect
              label="SAT Yaratan"
              value={selectedCreator}
              options={options.creators.map(toOption)}
              onChange={setSelectedCreator}
            />
            <ExportSelect
              label="Özet Durum"
              value={selectedStatus}
              options={statusOptions}
              onChange={setSelectedStatus}
            />
            <ExportSelect
              label="SAS Yaratan"
              value={selectedSasCreator}
              options={options.sasCreators}
              onChange={setSelectedSasCreator}
            />
            <ExportSelect
              label="Satıcı"
              value={selectedVendor}
              options={options.vendors}
              onChange={setSelectedVendor}
            />
            <ExportSelect
              label="SAT Onay Durumu"
              value={selectedApproval}
              options={options.approvals.map(toOption)}
              onChange={setSelectedApproval}
            />
          </div>
        </div>
        <DataTable
          data={visibleRows}
          columns={EXPORT_COLUMNS}
          rowKey={(row) => row.rowId}
          initialSortKey="createdAt"
          initialSortDir="desc"
          emptyMessage="Seçili filtrelerde SAT kalemi bulunamadı."
          onRowClick={setDetail}
          rowClassName={exportRowClassName}
        />
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `SAT ${detail.satNo} · ${detail.material || 'Malzeme'}` : 'SAT Kalem Detayı'}
        widthClass="max-w-4xl"
      >
        {detail && (
          <ExportDetail row={detail} documentTotal={detailDocumentTotal} />
        )}
      </Modal>

      <Modal
        open={reportModalOpen}
        onClose={() => !reportGenerating && setReportModalOpen(false)}
        title="SAT PDF Raporu Oluştur"
        widthClass="max-w-3xl"
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold text-slate-800">Rapor kapsamı</div>
            <p className="mt-1 text-xs text-slate-500">
              PDF içindeki metinler seçilebilir ve aranabilir olarak oluşturulur.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setReportScope('filtered')}
                disabled={!!reportGenerating}
                aria-pressed={reportScope === 'filtered'}
                className={`rounded-lg border p-3 text-left transition ${
                  reportScope === 'filtered'
                    ? 'border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/25'
                    : 'border-white/10 bg-white/[0.06] hover:border-cyan-400/40 hover:bg-white/[0.10]'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">
                  Mevcut Filtreler
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {visibleItemRows.length} tekil kalem · dashboard görünümü
                </span>
              </button>
              <button
                type="button"
                onClick={() => setReportScope('all')}
                disabled={!!reportGenerating}
                aria-pressed={reportScope === 'all'}
                className={`rounded-lg border p-3 text-left transition ${
                  reportScope === 'all'
                    ? 'border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/25'
                    : 'border-white/10 bg-white/[0.06] hover:border-cyan-400/40 hover:bg-white/[0.10]'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">
                  Tüm Veriler
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {allItemRows.length} tekil kalem · filtrelerden bağımsız
                </span>
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-800">
              Rapor türü
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {REPORT_OPTIONS.map((option) => {
                const generating = reportGenerating === option.type;
                const reportRows = reportScope === 'filtered' ? visibleRows : allRows;
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => createPDFReport(option.type)}
                    disabled={!!reportGenerating || reportRows.length === 0}
                    className="group flex min-h-32 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-500/10 disabled:cursor-wait disabled:opacity-55"
                  >
                    <span>
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 group-hover:text-cyan-300">
                        {generating ? (
                          <Loader2 size={16} className="animate-spin text-cyan-600" />
                        ) : (
                          <FileText size={16} className="text-cyan-600" />
                        )}
                        {generating ? 'Rapor hazırlanıyor...' : option.title}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-slate-500">
                        {option.description}
                      </span>
                    </span>
                    <span className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {option.format}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BudgetUsageOverview({
  cards,
  selectedBudgetKey,
  onSelectBudget,
}: {
  cards: BudgetUsageCardData[];
  selectedBudgetKey: string;
  onSelectBudget: (key: string) => void;
}) {
  const companyCards = BUDGET_USAGE_COMPANIES.map((company) => ({
    ...company,
    cards: cards
      .filter((card) => card.company === company.key)
      .sort(
        (a, b) =>
          BUDGET_USAGE_TYPE_ORDER.indexOf(a.budgetType ?? 'CAPEX') -
          BUDGET_USAGE_TYPE_ORDER.indexOf(b.budgetType ?? 'CAPEX'),
      ),
  }));
  const hasCompanyCards = companyCards.some((group) => group.cards.length > 0);

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Bütçe / Kaynak Bazlı Aşama Takibi</h3>
          <p className="mt-1 text-xs text-white/40">
            Her bütçe kaynağında SAT, SAS, FAT ve kalan bütçe dağılımı yatay bar olarak gösterilir.
          </p>
        </div>
        {cards.some((card) => card.fallback) && (
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] text-white/40">
            Bütçe kullanım dosyası yoksa mal grubu üzerinden gösterilir
          </span>
        )}
      </div>
      {hasCompanyCards ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {companyCards.map((group) => (
            <div
              key={group.key}
              className={`rounded-2xl border bg-black/15 p-3 transition ${
                selectedBudgetKey &&
                !group.cards.some((card) => card.key === selectedBudgetKey)
                  ? 'opacity-55'
                  : ''
              }`}
              style={{
                borderColor: `${group.color}55`,
                boxShadow: `inset 0 1px 0 ${group.color}22`,
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: group.color }}
                  >
                    {group.label}
                  </div>
                  <div className="mt-1 text-[11px] text-white/35">
                    Operational CAPEX · OPEX · CAPEX
                  </div>
                </div>
                <div
                  className="h-2 w-14 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
              </div>

              <div className="space-y-3">
                {group.cards.map((card) => (
                  <BudgetSourceCard
                    key={card.key}
                    card={card}
                    theme={group}
                    selectedBudgetKey={selectedBudgetKey}
                    onSelectBudget={onSelectBudget}
                  />
                ))}
                {group.cards.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/30">
                    Bu şirket için bütçe kaynağı bulunamadı.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-3">
          {cards.map((card) => (
            <BudgetSourceCard
              key={card.key}
              card={card}
              theme={FALLBACK_BUDGET_THEME}
              selectedBudgetKey={selectedBudgetKey}
              onSelectBudget={onSelectBudget}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetSourceCard({
  card,
  theme,
  selectedBudgetKey,
  onSelectBudget,
}: {
  card: BudgetUsageCardData;
  theme: { label: string; color: string };
  selectedBudgetKey: string;
  onSelectBudget: (key: string) => void;
}) {
  const active = selectedBudgetKey === card.key;
  const usedAmount = sum(Object.values(card.stageAmounts));
  const hasBudget = card.totalBudget > 0;
  const totalBase = Math.max(hasBudget ? card.totalBudget : usedAmount, 1);
  const unusedAmount = hasBudget ? Math.max(0, card.totalBudget - usedAmount) : 0;
  const barRows = BUDGET_USAGE_BAR_ROWS.filter(
    (row) => row.key !== 'UNUSED' || hasBudget,
  ).map((row) => {
    const value =
      row.key === 'UNUSED'
        ? unusedAmount
        : card.stageAmounts[row.key] ?? 0;
    const count =
      row.key === 'UNUSED' ? 0 : card.stageSatNos[row.key].size;
    return {
      ...row,
      value,
      count,
      percent: totalBase > 0 ? (value / totalBase) * 100 : 0,
    };
  });

  return (
    <button
      type="button"
      onClick={() => onSelectBudget(card.key)}
      className={`w-full rounded-xl border bg-black/20 p-4 text-left transition hover:bg-white/[0.045] ${
        selectedBudgetKey && !active ? 'opacity-55' : ''
      }`}
      style={{
        borderColor: active ? theme.color : 'rgb(255 255 255 / 0.1)',
        boxShadow: active ? `0 0 0 2px ${theme.color}33` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: `${theme.color}cc` }}
          >
            {card.subtitle}
          </div>
          <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-white">
            {card.title}
          </h4>
          <div className="mt-1 text-[11px] text-white/35">
            {card.code || 'Kod belirtilmemiş'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold text-white tabular-nums">
            {hasBudget ? formatCompactUsd(card.totalBudget) : formatNumber(card.satNos.size)}
          </div>
          <div className="text-[10px] text-white/35">
            {hasBudget ? 'Toplam bütçe' : 'SAT'}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {barRows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[minmax(78px,0.9fr)_42px_minmax(90px,1.3fr)_minmax(88px,auto)] items-center gap-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-xs text-white/55">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate">{row.label}</span>
            </span>
            <span className="rounded-md bg-white/[0.055] px-2 py-1 text-center text-[10px] font-semibold text-white/40 tabular-nums">
              %{Math.round(row.percent)}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-slate-500/25">
              <span
                className="block h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(row.percent, row.percent > 0 ? 1.5 : 0)}%`,
                  backgroundColor: row.color,
                }}
              />
            </span>
            <span className="text-right text-xs font-semibold text-white/70 tabular-nums">
              {row.value > 0
                ? formatUsd(row.value)
                : row.count > 0
                  ? `${formatNumber(row.count)} SAT`
                  : '0'}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

function ExportAlertOverview({
  alerts,
  selectedAlert,
  onSelect,
}: {
  alerts: { key: ExportAlertKey; count: number; amount: number }[];
  selectedAlert: ExportAlertKey | '';
  onSelect: (key: ExportAlertKey) => void;
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
            Uyarıya tıklayınca aşağıdaki SAT/SAS/FAT listesi ilgili kayıtlarla filtrelenir.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {EXPORT_ALERTS.map((config) => {
          const summary = alerts.find((item) => item.key === config.key);
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
                    {config.title}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-white/45">
                    {config.helper}
                  </div>
                  <div className="mt-3 text-[11px] font-medium text-white/35">
                    {formatUsd(summary?.amount ?? 0)}
                  </div>
                </div>
                <div
                  className="rounded-lg px-2 py-1 text-2xl font-semibold tabular-nums"
                  style={{ color: config.color, backgroundColor: `${config.color}16` }}
                >
                  {summary?.count ?? 0}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const EXPORT_COLUMNS: DataTableColumn<SATExportRow>[] = [
  {
    key: 'satNo',
    header: 'SAT Belge No',
    sortValue: (row) => row.satNo,
    searchValue: (row) => row.satNo,
    render: (row) => <span className="font-semibold text-white">{row.satNo}</span>,
  },
  {
    key: 'risk',
    header: 'Risk',
    sortValue: (row) => rowRiskPriority(row),
    searchValue: (row) => rowRiskInfo(row)?.label ?? '',
    className: 'whitespace-nowrap',
    render: (row) => <ExportRiskBadge row={row} />,
  },
  {
    key: 'satItemNo',
    header: 'SAT Kalem No',
    sortValue: (row) => Number(row.satItemNo) || row.satItemNo,
    searchValue: (row) => row.satItemNo,
    className: 'whitespace-nowrap',
    render: (row) => formatSATItemNo(row.satItemNo),
  },
  {
    key: 'createdAt',
    header: 'Yaratılma Tarihi',
    sortValue: (row) => row.createdAt ?? new Date(0),
    searchValue: (row) => formatDate(row.createdAt),
    className: 'whitespace-nowrap',
    render: (row) => formatDate(row.createdAt),
  },
  {
    key: 'creator',
    header: 'SAT Yaratan',
    sortValue: (row) => row.satCreator,
    searchValue: (row) => row.satCreator,
    className: 'whitespace-nowrap',
    render: (row) => row.satCreator,
  },
  {
    key: 'material',
    header: 'Malzeme',
    sortValue: (row) => row.materialDescription,
    searchValue: (row) => `${row.material} ${row.materialDescription}`,
    className: 'min-w-72',
    render: (row) => (
      <div>
        <div className="font-medium text-white/80">{row.materialDescription}</div>
        <div className="mt-1 text-xs text-white/35">{row.material || 'Kod yok'}</div>
      </div>
    ),
  },
  {
    key: 'satQuantity',
    header: 'SAT Miktarı',
    sortValue: (row) => row.satQuantity,
    searchValue: (row) => String(row.satQuantity),
    className: 'whitespace-nowrap',
    render: (row) => formatNumber(row.satQuantity),
  },
  {
    key: 'satUsd',
    header: 'Kalem SAT USD',
    sortValue: (row) => row.satItemUsd,
    searchValue: (row) => String(row.satItemUsd),
    className: 'whitespace-nowrap',
    render: (row) => <span className="font-semibold text-cyan-300">{formatUsd(row.satItemUsd)}</span>,
  },
  {
    key: 'sasUsd',
    header: 'SAS USD',
    sortValue: (row) => row.sasUsdAmount,
    searchValue: (row) => String(row.sasUsdAmount),
    className: 'whitespace-nowrap',
    render: (row) => formatUsd(row.sasUsdAmount),
  },
  {
    key: 'status',
    header: 'Özet Durum',
    sortValue: (row) => row.summaryStatus,
    searchValue: (row) => `${row.summaryStatus} ${row.approvalStatusDescription}`,
    className: 'whitespace-nowrap',
    render: (row) => <StatusBadge status={row.summaryStatus} />,
  },
  {
    key: 'sasCreator',
    header: 'SAS Yaratan',
    sortValue: (row) => row.sasCreator,
    searchValue: (row) => `${row.sasCreator} ${row.vendorName}`,
    className: 'whitespace-nowrap',
    render: (row) => row.sasCreator || 'Atanmamış',
  },
  {
    key: 'flags',
    header: 'Gerçekleşme',
    sortValue: (row) => Number(row.completed) + Number(row.lastDelivery) + Number(row.lastInvoice),
    searchValue: (row) => `${row.completed} ${row.lastDelivery} ${row.lastInvoice}`,
    className: 'whitespace-nowrap',
    render: (row) => <FlagSummary row={row} />,
  },
];

function buildBudgetUsageCards(
  usageRows: SATBudgetUsageRow[],
  exportRows: SATExportRow[],
  budgetRows: SATBudgetRow[],
): BudgetUsageCardData[] {
  const map = new Map<string, BudgetUsageCardData>();
  const usageAmountStageKeys = new Set<string>();

  usageRows.forEach((row) => {
    const processKey = budgetUsageProcessKey(row);
    if (!processKey || !shouldIncludeBudgetUsageRow(row)) return;
    const key = budgetCardKey(row.company, row.budgetType, row.sourceCode);
    const current =
      map.get(key) ??
      createBudgetUsageCard({
        key,
        title: cleanBudgetSourceLabel(row.sourceLabel),
        subtitle: `${companyLabel(row.company)} · ${budgetTypeLabel(row.budgetType)}`,
        code: row.sourceCode,
        company: row.company,
        budgetType: row.budgetType,
        fallback: false,
      });

    current.satNos.add(processKey);
    current.stageSatNos[row.stage].add(processKey);
    current.stageAmounts[row.stage] += Math.max(0, row.amountUsd);
    if (row.amountUsd > 0) usageAmountStageKeys.add(`${key}|${row.stage}`);
    map.set(key, current);
  });

  addExportRowsToBudgetCards(map, exportRows, usageAmountStageKeys);
  applyBudgetTotalsToCards(map, budgetRows);

  const cards = [...map.values()].sort(
    (a, b) => b.satNos.size - a.satNos.size || a.title.localeCompare(b.title, 'tr'),
  );
  return cards.length > 0 ? cards : buildMaterialFallbackBudgetCards(exportRows);
}

function addExportRowsToBudgetCards(
  map: Map<string, BudgetUsageCardData>,
  rows: SATExportRow[],
  usageAmountStageKeys: Set<string>,
) {
  const satItemSeen = new Set<string>();
  rows.forEach((row) => {
    if (!row.budgetSourceCode || !row.budgetCompany || !row.budgetType) return;
    if (!shouldIncludeExportBudgetRow(row)) return;
    const key = budgetCardKey(
      row.budgetCompany,
      row.budgetType,
      row.budgetSourceCode,
    );
    const current =
      map.get(key) ??
      createBudgetUsageCard({
        key,
        title: cleanBudgetSourceLabel(row.budgetSourceLabel || row.budgetSourceCode),
        subtitle: `${companyLabel(row.budgetCompany)} · ${budgetTypeLabel(row.budgetType)}`,
        code: row.budgetSourceCode,
        company: row.budgetCompany,
        budgetType: row.budgetType,
        fallback: false,
      });

    current.satNos.add(row.satNo);
    current.stageSatNos.SAT.add(row.satNo);
    const satItemKey = `${key}|SAT|${row.satNo}|${row.satItemNo || row.sourceRow}`;
    if (!usageAmountStageKeys.has(`${key}|SAT`) && !satItemSeen.has(satItemKey)) {
      satItemSeen.add(satItemKey);
      current.stageAmounts.SAT += Math.max(0, row.satItemUsd);
    }
    if (isRowSasConverted(row)) {
      current.stageSatNos.SAS.add(row.satNo);
      if (!usageAmountStageKeys.has(`${key}|SAS`)) {
        current.stageAmounts.SAS += Math.max(0, row.sasUsdAmount);
      }
    }
    if (row.lastInvoice) {
      current.stageSatNos.FAT.add(row.satNo);
      if (!usageAmountStageKeys.has(`${key}|FAT`)) {
        current.stageAmounts.FAT += Math.max(
          0,
          row.sasUsdAmount || row.satItemUsd,
        );
      }
    }
    map.set(key, current);
  });
}

function applyBudgetTotalsToCards(
  map: Map<string, BudgetUsageCardData>,
  budgetRows: SATBudgetRow[],
) {
  SAT_BUDGET_SOURCES.forEach((source) => {
    const totalBudget = Math.max(
      0,
      budgetTotals(
        budgetRows.filter(
          (row) =>
            row.company === source.company &&
            row.budgetType === source.budgetType &&
            row.sourceCode === source.code,
        ),
      ).net,
    );
    const key = budgetCardKey(source.company, source.budgetType, source.code);
    if (totalBudget <= 0 && !map.has(key)) return;
    const current =
      map.get(key) ??
      createBudgetUsageCard({
        key,
        title: cleanBudgetSourceLabel(source.label),
        subtitle: `${companyLabel(source.company)} · ${budgetTypeLabel(source.budgetType)}`,
        code: source.code,
        company: source.company,
        budgetType: source.budgetType,
        fallback: false,
      });
    current.totalBudget = totalBudget;
    map.set(key, current);
  });
}

function buildMaterialFallbackBudgetCards(rows: SATExportRow[]): BudgetUsageCardData[] {
  const map = new Map<string, BudgetUsageCardData>();
  rows.forEach((row) => {
    const group = row.materialGroup || 'Mal Grubu Belirtilmemiş';
    const key = `material|${group}`;
    const current =
      map.get(key) ??
      createBudgetUsageCard({
        key,
        title: group,
        subtitle: 'Mal Grubu',
        code: 'CI sütunu',
        fallback: true,
      });

    current.satNos.add(row.satNo);
    current.stageSatNos.SAT.add(row.satNo);
    current.stageAmounts.SAT += Math.max(0, row.satItemUsd);
    if (isRowSasConverted(row)) {
      current.stageSatNos.SAS.add(row.satNo);
      current.stageAmounts.SAS += Math.max(0, row.sasUsdAmount);
    }
    if (row.lastInvoice) {
      current.stageSatNos.FAT.add(row.satNo);
      current.stageAmounts.FAT += Math.max(0, row.sasUsdAmount || row.satItemUsd);
    }
    map.set(key, current);
  });

  return [...map.values()]
    .sort((a, b) => b.satNos.size - a.satNos.size || a.title.localeCompare(b.title, 'tr'))
    .slice(0, 6);
}

function budgetCardKey(
  company: string,
  budgetType: string,
  sourceCode: string,
) {
  return `${company}|${budgetType}|${sourceCode}`;
}

function budgetUsageProcessKey(row: SATBudgetUsageRow) {
  return (
    row.satNo ||
    (row.stage === 'FAT' ? row.previousDocumentNo : '') ||
    row.referenceNo
  );
}

function shouldIncludeBudgetUsageRow(row: SATBudgetUsageRow) {
  return (
    !isSTADOpexBudgetSource(row.sourceCode) ||
    isAllowedSTADOpexUser(row.user)
  );
}

function shouldIncludeExportBudgetRow(row: SATExportRow) {
  return (
    !isSTADOpexBudgetSource(row.budgetSourceCode) ||
    [row.sasCreator, row.satCreator].some(isAllowedSTADOpexUser)
  );
}

function isAllowedSTADOpexUser(value: string) {
  const clean = normalize(value).replace(/\s+/g, '');
  return clean === 'tpinar' || clean === 'tunapinar';
}

function createBudgetUsageCard({
  key,
  title,
  subtitle,
  code,
  company,
  budgetType,
  fallback,
}: {
  key: string;
  title: string;
  subtitle: string;
  code: string;
  company?: SATBudgetCompany;
  budgetType?: SATBudgetType;
  fallback: boolean;
}): BudgetUsageCardData {
  return {
    key,
    title,
    subtitle,
    code,
    company,
    budgetType,
    totalBudget: 0,
    satNos: new Set<string>(),
    stageSatNos: {
      SAT: new Set<string>(),
      SAS: new Set<string>(),
      FAT: new Set<string>(),
    },
    stageAmounts: { SAT: 0, SAS: 0, FAT: 0 },
    fallback,
  };
}

function cleanBudgetSourceLabel(value: string) {
  return value
    .replace(/^CAPEX\s*\/\s*/i, '')
    .replace(/^OPEX\s*\/\s*/i, '')
    .replace(/^Operational CAPEX\s*\/\s*/i, '')
    .trim() || 'Bütçe kaynağı';
}

function applyOperationalFilters(
  rows: SATExportRow[],
  selectedBudget: BudgetUsageCardData | null,
  selectedStage: ExportPipelineStage | '',
  selectedAlert: ExportAlertKey | '',
) {
  let result = rows;
  if (selectedBudget) {
    const satNos = selectedStage
      ? selectedBudget.stageSatNos[selectedStage]
      : selectedBudget.satNos;
    result = result.filter((row) => satNos.has(row.satNo));
  }
  if (selectedAlert) {
    result = filterRowsByAlert(result, selectedAlert);
  }
  return result;
}

function buildExportAlertSummary(rows: SATExportRow[]) {
  return EXPORT_ALERTS.map((alert) => {
    const alertRows = filterRowsByAlert(rows, alert.key);
    return {
      key: alert.key,
      count: new Set(alertRows.map((row) => row.satNo)).size,
      amount: sumSATItemUsd(alertRows),
    };
  });
}

function filterRowsByAlert(rows: SATExportRow[], alert: ExportAlertKey) {
  if (alert === 'deliveryNoInvoice') {
    const today = startOfDay(new Date());
    return rows.filter(
      (row) =>
        row.deliveryDate &&
        startOfDay(row.deliveryDate) < today &&
        !row.lastInvoice,
    );
  }

  const documents = buildDocuments(rows);
  const satNos = new Set(
    documents
      .filter((document) => documentMatchesAlert(document, alert))
      .map((document) => document.satNo),
  );
  return rows.filter((row) => satNos.has(row.satNo));
}

function documentMatchesAlert(document: SATDocument, alert: ExportAlertKey) {
  const age = documentAgeDays(document);
  if (alert === 'sat60') {
    return age >= 60 && age < 90 && !isDocumentSasConverted(document);
  }
  if (alert === 'sat90') {
    return age >= 90 && !isDocumentSasConverted(document);
  }
  if (alert === 'approvalWaiting') {
    return age >= 30 && isDocumentApprovalWaiting(document);
  }
  return false;
}

function isDocumentSasConverted(document: SATDocument) {
  return document.rows.some((row) => isRowSasConverted(row));
}

function isRowSasConverted(row: SATExportRow) {
  const status = `${row.summaryStatus} ${row.approvalStatusDescription}`.toLocaleLowerCase('tr-TR');
  return Boolean(
    row.sasNo ||
      row.sasUsdAmount > 0 ||
      status.includes('sipariş') ||
      status.includes('siparis') ||
      status.includes('sas'),
  );
}

function isDocumentApprovalWaiting(document: SATDocument) {
  const approval = document.approvalStatusDescription.toLocaleLowerCase('tr-TR');
  const status = document.summaryStatus.toLocaleLowerCase('tr-TR');
  if (
    approval.includes('tamam') ||
    status.includes('sipariş') ||
    status.includes('siparis') ||
    status.includes('fatura')
  ) {
    return false;
  }
  return (
    approval.includes('onay') ||
    approval.includes('bek') ||
    status.includes('revize') ||
    status.includes('teknik') ||
    status.includes('teklif') ||
    status.includes('sat işleme') ||
    status.includes('sat isleme')
  );
}

function documentAgeDays(document: SATDocument) {
  if (!document.createdAt || Number.isNaN(document.createdAt.getTime())) return 0;
  return Math.max(
    0,
    Math.floor(
      (startOfDay(new Date()).getTime() -
        startOfDay(document.createdAt).getTime()) /
        86400000,
    ),
  );
}

function exportRowClassName(row: SATExportRow) {
  const risk = rowRiskInfo(row);
  if (!risk) return '';
  if (risk.key === 'sat90') return 'bg-rose-500/[0.08]';
  if (risk.key === 'deliveryNoInvoice') return 'bg-pink-500/[0.06]';
  if (risk.key === 'sat60') return 'bg-amber-400/[0.06]';
  if (risk.key === 'approvalWaiting') return 'bg-orange-400/[0.045]';
  return '';
}

function rowRiskInfo(row: SATExportRow): {
  key: ExportAlertKey;
  label: string;
  color: string;
} | null {
  const today = startOfDay(new Date());
  if (
    row.createdAt &&
    Math.floor((today.getTime() - startOfDay(row.createdAt).getTime()) / 86400000) >= 90 &&
    !isRowSasConverted(row)
  ) {
    return { key: 'sat90', label: '90+ SAS Yok', color: '#ef4444' };
  }
  const age = row.createdAt
    ? Math.max(
        0,
        Math.floor(
          (today.getTime() - startOfDay(row.createdAt).getTime()) / 86400000,
        ),
      )
    : 0;
  if (age >= 60 && !isRowSasConverted(row)) {
    return { key: 'sat60', label: '60+ SAS Yok', color: '#f59e0b' };
  }
  if (
    row.deliveryDate &&
    startOfDay(row.deliveryDate) < today &&
    !row.lastInvoice
  ) {
    return {
      key: 'deliveryNoInvoice',
      label: 'Teslim/Fatura',
      color: '#fb7185',
    };
  }
  if (age >= 30 && rowApprovalWaiting(row)) {
    return { key: 'approvalWaiting', label: 'Acil Onay', color: '#f97316' };
  }
  return null;
}

function rowRiskPriority(row: SATExportRow) {
  const risk = rowRiskInfo(row);
  if (!risk) return 0;
  if (risk.key === 'sat90') return 4;
  if (risk.key === 'sat60') return 3;
  if (risk.key === 'deliveryNoInvoice') return 2;
  return 1;
}

function rowApprovalWaiting(row: SATExportRow) {
  const approval = row.approvalStatusDescription.toLocaleLowerCase('tr-TR');
  const status = row.summaryStatus.toLocaleLowerCase('tr-TR');
  if (
    approval.includes('tamam') ||
    status.includes('sipariş') ||
    status.includes('siparis') ||
    status.includes('fatura')
  ) {
    return false;
  }
  return (
    approval.includes('onay') ||
    approval.includes('bek') ||
    status.includes('revize') ||
    status.includes('teknik') ||
    status.includes('teklif') ||
    status.includes('sat işleme') ||
    status.includes('sat isleme')
  );
}

function buildDocuments(rows: SATExportRow[]): SATDocument[] {
  const map = new Map<string, SATDocument>();
  rows.forEach((row) => {
    const current = map.get(row.satNo) ?? {
      satNo: row.satNo,
      satCreator: row.satCreator,
      totalSatUsd: 0,
      createdAt: row.createdAt,
      summaryStatus: row.summaryStatus,
      approvalStatusDescription: row.approvalStatusDescription,
      rows: [],
      sasUsdTotal: 0,
      sasCreators: [],
    };
    current.rows.push(row);
    current.sasUsdTotal += row.sasUsdAmount;
    if (!current.summaryStatus && row.summaryStatus) current.summaryStatus = row.summaryStatus;
    if (row.sasCreator && !current.sasCreators.includes(row.sasCreator)) {
      current.sasCreators.push(row.sasCreator);
    }
    map.set(row.satNo, current);
  });
  return [...map.values()].map((document) => ({
    ...document,
    totalSatUsd: sumSATItemUsd(document.rows),
  }));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

interface StatusFlowItem {
  key: string;
  label: string;
  color: string;
  count: number;
  totalUsd: number;
}

function StatusFlowBars({
  statuses,
  selectedStatus,
  onSelect,
}: {
  statuses: StatusFlowItem[];
  selectedStatus: string;
  onSelect: (status: string) => void;
}) {
  const [metric, setMetric] = useState<'count' | 'usd'>('count');
  const totalCount = sum(statuses.map((status) => status.count));
  const totalUsd = sum(statuses.map((status) => status.totalUsd));
  const total = metric === 'count' ? totalCount : totalUsd;
  const visibleStatuses = statuses.filter((status) => status.count > 0);

  function metricValue(status: StatusFlowItem) {
    return metric === 'count' ? status.count : status.totalUsd;
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="panel-title">Satınalma Özet Durum Akışı</h2>
          <p className="panel-subtitle mt-1">
            Belge bazında hesaplanır; barlara tıklayarak tüm dashboard'ı filtreleyin.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-lg border border-white/10 bg-white/[0.04] p-1">
          {[
            { key: 'count' as const, label: 'Adet' },
            { key: 'usd' as const, label: 'SAT USD' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMetric(item.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                metric === item.key
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
        <div className="flex h-5 w-full overflow-hidden bg-white/[0.04]">
          {visibleStatuses.length > 0 ? (
            visibleStatuses.map((status) => {
              const value = metricValue(status);
              const percentValue = total ? (value / total) * 100 : 0;
              const active = selectedStatus === status.key;
              return (
                <button
                  key={status.key}
                  type="button"
                  title={`${status.label} · ${formatNumber(status.count)} SAT · ${formatUsd(status.totalUsd)}`}
                  onClick={() => onSelect(status.key)}
                  aria-pressed={active}
                  className={`h-full shrink-0 transition hover:brightness-125 ${
                    active ? 'brightness-125 ring-2 ring-inset ring-white/70' : ''
                  }`}
                  style={{
                    width: `${Math.max(percentValue, percentValue > 0 ? 1.5 : 0)}%`,
                    backgroundColor: status.color,
                  }}
                />
              );
            })
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/35">
              Veri yok
            </div>
          )}
        </div>

        <div className="grid gap-x-6 gap-y-1.5 p-3 xl:grid-cols-2">
          {statuses.map((status) => {
            const value = metricValue(status);
            const percentValue = total ? (value / total) * 100 : 0;
            const active = selectedStatus === status.key;
            return (
              <button
                key={status.key}
                type="button"
                onClick={() => onSelect(status.key)}
                aria-pressed={active}
                className={`grid grid-cols-[minmax(150px,1.1fr)_minmax(130px,1.6fr)_auto] items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                  active
                    ? 'bg-cyan-400/10 ring-1 ring-cyan-300/45'
                    : 'hover:bg-white/[0.045]'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="truncate text-xs font-medium text-white/70">
                    {status.label}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-500/25">
                    <span
                      className="block h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(percentValue, percentValue > 0 ? 1.5 : 0)}%`,
                        backgroundColor: status.color,
                      }}
                    />
                  </span>
                  <span className="w-10 text-right text-[10px] font-semibold text-white/40 tabular-nums">
                    %{Math.round(percentValue)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold text-white tabular-nums">
                    {formatNumber(status.count)}
                  </span>
                  <span className="block text-[10px] text-white/35">
                    {formatCompactUsd(status.totalUsd)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExportSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-white/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input appearance-none bg-[#171717]"
      >
        <option value="">Tümü</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG.find((item) => item.key === (status || EMPTY_STATUS));
  const color = config?.color ?? '#64748b';
  return (
    <span
      className="inline-flex rounded-md border px-2 py-1 text-xs font-medium"
      style={{ color, borderColor: `${color}45`, backgroundColor: `${color}14` }}
    >
      {config?.label ?? (status || 'Durum Yok')}
    </span>
  );
}

function ExportRiskBadge({ row }: { row: SATExportRow }) {
  const risk = rowRiskInfo(row);
  if (!risk) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className="inline-flex rounded-md border px-2 py-1 text-xs font-semibold"
      style={{
        color: risk.color,
        borderColor: `${risk.color}45`,
        backgroundColor: `${risk.color}16`,
      }}
    >
      {risk.label}
    </span>
  );
}

function FlagSummary({ row }: { row: SATExportRow }) {
  return (
    <div className="flex gap-1">
      <Flag active={row.completed} label="T" title="Tamam" />
      <Flag active={row.lastDelivery} label="D" title="Son Teslimat" />
      <Flag active={row.lastInvoice} label="F" title="Son Fatura" />
    </div>
  );
}

function Flag({
  active,
  label,
  title,
}: {
  active: boolean;
  label: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${
        active ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/[0.05] text-white/25'
      }`}
    >
      {label}
    </span>
  );
}

function ExportDetail({
  row,
  documentTotal,
}: {
  row: SATExportRow;
  documentTotal: number;
}) {
  const fields: [string, string][] = [
    ['SAT Yaratan', row.satCreator],
    ['Şirket Kodu', row.companyCode],
    ['SAT Belge Numarası', row.satNo],
    ['SAT Kalem Numarası', formatSATItemNo(row.satItemNo)],
    ['SAT Miktarı', formatNumber(row.satQuantity)],
    ['SAT Kalem USD Tutarı', formatUsd(row.satItemUsd)],
    ['SAT Belgesi Toplamı', formatUsd(documentTotal)],
    ['SAT Yaratılma Tarihi', formatDate(row.createdAt)],
    ['Tamam', yesNo(row.completed)],
    ['SAS Son Teslimat', yesNo(row.lastDelivery)],
    ['SAS Son Fatura', yesNo(row.lastInvoice)],
    ['SAS USD Tutar', formatUsd(row.sasUsdAmount)],
    ['Teslim Tarihi', formatDate(row.deliveryDate)],
    ['SAS Birim Fiyat', formatUsd(row.sasUnitPrice)],
    ['SAT Onay Durum', row.approvalCode],
    ['İrsaliye', row.waybill],
    ['Satınalma Özet Durum Bilgisi', row.summaryStatus],
    ['Malzeme Tanımı', row.materialDescription],
    ['Malzeme', row.material],
    ['SAS Yaratan', row.sasCreator],
    ['Satıcı Adı', row.vendorName],
    ['SAT Onay Durum Tanımı', row.approvalStatusDescription],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            {label}
          </div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-5 text-white/80">
            {value || '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
}

function withUnassigned(values: string[]) {
  return [
    ...(values.some((value) => !value)
      ? [{ value: UNASSIGNED, label: 'Atanmamış' }]
      : []),
    ...unique(values).map(toOption),
  ];
}

function toOption(value: string) {
  return { value, label: value };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatSATItemNo(value: string) {
  const numericValue = Number(value);
  return value && Number.isFinite(numericValue) && numericValue % 10 === 0
    ? `${value} (${numericValue / 10}. kalem)`
    : value || '—';
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

function yesNo(value: boolean) {
  return value ? 'Evet' : 'Hayır';
}
