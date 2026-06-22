import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BadgeDollarSign,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  FilterX,
  Layers3,
  Loader2,
  ShoppingCart,
  Truck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import type { SATExportRow } from '../../types';
import { useDataStore } from '../../store/dataStore';
import { formatDate } from '../../lib/normalize';
import {
  DataTable,
  type DataTableColumn,
} from '../common/DataTable';
import { Modal } from '../common/Modal';
import {
  downloadSATExportReportPdf,
  type SATExportReportType,
} from '../../lib/satExportReportPdf';

const EMPTY_STATUS = '__empty_status__';
const UNASSIGNED = '__unassigned__';
const OTHER_MATERIAL_GROUPS = '__other_material_groups__';
const TOOLTIP_STYLE = {
  backgroundColor: '#111111',
  border: '1px solid rgb(255 255 255 / 0.12)',
  borderRadius: 8,
  color: '#f8fafc',
};

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

type MaterialMetric = 'count' | 'satUsd' | 'sasUsd';

interface MaterialGroupDatum {
  name: string;
  value: number;
  cumulative: number;
  filterValue: string;
}

const REPORT_OPTIONS: {
  type: SATExportReportType;
  title: string;
  description: string;
  format: string;
}[] = [
  {
    type: 'executive',
    title: 'Yönetici Özeti',
    description: 'KPI, süreç hunisi, Pareto ve öncelikli açık SAT belgeleri.',
    format: 'Kısa · Dikey',
  },
  {
    type: 'performance',
    title: 'Süreç Performans Raporu',
    description: 'Durum, iş yükü, yaşlandırma, aylık trend ve dönüşüm oranları.',
    format: 'Analiz · Dikey',
  },
  {
    type: 'delivery_risk',
    title: 'Teslimat ve Risk Raporu',
    description: 'Geciken, yaklaşan ve teslim tarihi olmayan kalemlerin detayı.',
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
  const [selectedCreator, setSelectedCreator] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSasCreator, setSelectedSasCreator] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedApproval, setSelectedApproval] = useState('');
  const [selectedMaterialGroup, setSelectedMaterialGroup] = useState('');
  const [materialMetric, setMaterialMetric] = useState<MaterialMetric>('count');
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
  const materialChartRows = useMemo(
    () =>
      partyFilteredRows.filter((row) => {
        if (!selectedStatus) return true;
        if (selectedStatus === EMPTY_STATUS) return !row.summaryStatus;
        return row.summaryStatus === selectedStatus;
      }),
    [partyFilteredRows, selectedStatus],
  );
  const materialGroupSummary = useMemo(
    () => buildMaterialGroupData(materialChartRows, materialMetric, 8),
    [materialChartRows, materialMetric],
  );
  const statusBaseRows = useMemo(
    () =>
      filterByMaterialGroup(
        partyFilteredRows,
        selectedMaterialGroup,
        materialGroupSummary.topGroupNames,
      ),
    [partyFilteredRows, selectedMaterialGroup, materialGroupSummary.topGroupNames],
  );
  const visibleRows = useMemo(
    () =>
      filterByMaterialGroup(
        materialChartRows,
        selectedMaterialGroup,
        materialGroupSummary.topGroupNames,
      ),
    [materialChartRows, selectedMaterialGroup, materialGroupSummary.topGroupNames],
  );
  const documents = useMemo(() => buildDocuments(visibleRows), [visibleRows]);
  const baseDocuments = useMemo(() => buildDocuments(statusBaseRows), [statusBaseRows]);

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

  const totals = useMemo(
    () => ({
      satUsd: sum(documents.map((doc) => doc.totalSatUsd)),
      sasUsd: sum(visibleRows.map((row) => row.sasUsdAmount)),
      completed: visibleRows.filter((row) => row.completed).length,
      lastDelivery: visibleRows.filter((row) => row.lastDelivery).length,
      lastInvoice: visibleRows.filter((row) => row.lastInvoice).length,
      approvedDocs: documents.filter((doc) =>
        doc.approvalStatusDescription.toLocaleLowerCase('tr-TR').includes('tamam'),
      ).length,
    }),
    [documents, visibleRows],
  );

  const creatorData = useMemo(
    () => buildDocumentPartyData(documents, (doc) => [doc.satCreator]),
    [documents],
  );
  const sasCreatorData = useMemo(
    () =>
      buildDocumentPartyData(documents, (doc) =>
        doc.sasCreators.length ? doc.sasCreators : ['Atanmamış'],
      ).slice(0, 9),
    [documents],
  );
  const topSatData = useMemo(
    () =>
      [...documents]
        .sort((a, b) => b.totalSatUsd - a.totalSatUsd)
        .slice(0, 8)
        .map((doc) => ({ name: doc.satNo, value: doc.totalSatUsd })),
    [documents],
  );
  const monthlyData = useMemo(
    () => buildMonthlyDocuments(documents, (doc) => doc.createdAt),
    [documents],
  );
  const deliveryData = useMemo(
    () => buildMonthlyRows(visibleRows, (row) => row.deliveryDate),
    [visibleRows],
  );
  const agingData = useMemo(() => buildAgingData(documents), [documents]);
  const deliveryRiskData = useMemo(
    () => buildDeliveryRiskData(visibleRows),
    [visibleRows],
  );
  const funnelData = useMemo(() => buildFunnelData(documents), [documents]);
  const selectedMaterialLabel = selectedMaterialGroup
    ? materialGroupSummary.data.find(
        (item) => item.filterValue === selectedMaterialGroup,
      )?.name ?? selectedMaterialGroup
    : '';

  const filtersActive = Boolean(
    selectedCreator ||
      selectedStatus ||
      selectedSasCreator ||
      selectedVendor ||
      selectedApproval ||
      selectedMaterialGroup,
  );

  function clearFilters() {
    setSelectedCreator('');
    setSelectedStatus('');
    setSelectedSasCreator('');
    setSelectedVendor('');
    setSelectedApproval('');
    setSelectedMaterialGroup('');
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
      selectedMaterialLabel ? `Mal Grubu: ${selectedMaterialLabel}` : '',
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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setReportModalOpen(true)}
          disabled={allRows.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-cyan-400 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileText size={17} />
          PDF Raporu Oluştur
        </button>
      </div>
      <section className="card p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
              <h2 className="panel-title">SAP Export Dashboard Filtreleri</h2>
            </div>
            <p className="panel-subtitle mt-1">
              Veriler tanımlı 19 SAP Export sütunundan, hücre renginden bağımsız okunur.
            </p>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!filtersActive}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            <FilterX size={15} />
            Filtreleri Temizle
          </button>
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
        {selectedMaterialGroup && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-white/40">Grafikten seçilen mal grubu:</span>
            <button
              type="button"
              onClick={() => setSelectedMaterialGroup('')}
              className="rounded-full border border-orange-300/35 bg-orange-400/10 px-3 py-1 font-medium text-orange-200 transition hover:bg-orange-400/20"
              title="Mal grubu filtresini kaldır"
            >
              {selectedMaterialLabel} ×
            </button>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Tekil SAT Belgesi"
          value={formatNumber(documents.length)}
          helper={`${totals.approvedDocs} belge onayı tamamlandı`}
          color="#38bdf8"
          icon={<ClipboardList size={21} />}
        />
        <MetricCard
          title="SAT Kalemi"
          value={formatNumber(visibleRows.length)}
          helper="Malzeme kalem satırı"
          color="#8b5cf6"
          icon={<Boxes size={21} />}
        />
        <MetricCard
          title="Toplam SAT USD"
          value={formatCompactUsd(totals.satUsd)}
          helper={formatUsd(totals.satUsd)}
          color="#06b6d4"
          icon={<BadgeDollarSign size={21} />}
        />
        <MetricCard
          title="SAS USD Tutarı"
          value={formatCompactUsd(totals.sasUsd)}
          helper={formatUsd(totals.sasUsd)}
          color="#10b981"
          icon={<ShoppingCart size={21} />}
        />
        <MetricCard
          title="Tamamlanan Kalem"
          value={formatNumber(totals.completed)}
          helper={percent(totals.completed, visibleRows.length)}
          color="#22c55e"
          icon={<CheckCircle2 size={21} />}
        />
        <MetricCard
          title="Teslimat / Fatura"
          value={`${totals.lastDelivery} / ${totals.lastInvoice}`}
          helper="Son teslimat · son fatura"
          color="#f59e0b"
          icon={<Truck size={21} />}
        />
      </section>

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="panel-title">Satınalma Özet Durum Akışı</h2>
          <p className="panel-subtitle mt-1">
            Belge bazında hesaplanır; karta tıklayarak tüm dashboard'ı filtreleyin.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          {statusSummary.map((status) => {
            const active = selectedStatus === status.key;
            return (
              <button
                key={status.key}
                type="button"
                onClick={() => setSelectedStatus(active ? '' : status.key)}
                aria-pressed={active}
                className={`relative min-h-32 overflow-hidden rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08] ${
                  active
                    ? 'border-cyan-300/70 bg-cyan-400/10 ring-2 ring-cyan-400/25'
                    : 'border-white/10 bg-white/[0.045]'
                }`}
              >
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: status.color }}
                />
                <div className="mt-1 text-[11px] font-medium leading-4 text-white/55">
                  {status.label}
                </div>
                <div className="mt-3 text-2xl font-semibold text-white tabular-nums">
                  {status.count}
                </div>
                <div className="mt-2 truncate text-[10px] text-white/35">
                  {formatUsd(status.totalUsd)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="SAT Yaratan Dağılımı"
          subtitle="Tekil SAT belge sayısı"
          icon={<Users size={17} />}
        >
          <HorizontalBar data={creatorData} color="#38bdf8" name="SAT Belgesi" />
        </ChartCard>
        <ChartCard
          title="En Yüksek SAT Belgeleri"
          subtitle="Toplam SAT USD tutarına göre ilk sekiz belge"
          icon={<BadgeDollarSign size={17} />}
        >
          <HorizontalBar data={topSatData} color="#14b8a6" name="USD" currency />
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Aylık SAT Oluşturma Trendi"
          subtitle="Tekil SAT belgelerinin yaratılma tarihine göre dağılımı"
          icon={<CalendarClock size={17} />}
        >
          <AreaTrend data={monthlyData} name="SAT Belgesi" color="#8b5cf6" gradientId="satExportCreated" />
        </ChartCard>
        <ChartCard
          title="Teslimat Takvimi"
          subtitle="Teslim tarihi bulunan malzeme kalemleri"
          icon={<Truck size={17} />}
        >
          {deliveryData.length > 0 ? (
            <AreaTrend data={deliveryData} name="Teslimat" color="#f59e0b" gradientId="satExportDelivery" />
          ) : (
            <EmptyChart message="Teslim tarihi bulunan kalem yok." />
          )}
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="SAS Yaratan İş Yükü"
          subtitle="SAS yaratan kişi bazında tekil SAT belge sayısı"
          icon={<UserRoundCheck size={17} />}
        >
          <HorizontalBar data={sasCreatorData} color="#6366f1" name="SAT Belgesi" />
        </ChartCard>
        <ChartCard
          title="Mal Grubu Pareto Analizi"
          subtitle={`CI sütunu · Çubuğa tıklayarak filtreleyin${
            materialMetric === 'satUsd'
              ? ' · SAT tutarı kalemlere eşit dağıtılır'
              : ''
          }`}
          icon={<Layers3 size={17} />}
          action={
            <MaterialMetricToggle
              value={materialMetric}
              onChange={setMaterialMetric}
            />
          }
        >
          <MaterialPareto
            data={materialGroupSummary.data}
            metric={materialMetric}
            selected={selectedMaterialGroup}
            onSelect={(value) =>
              setSelectedMaterialGroup((current) =>
                current === value ? '' : value,
              )
            }
          />
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Açık SAT Yaşlandırma"
          subtitle="Tamamlanmamış SAT belgelerinin oluşturulma tarihine göre bekleme süresi"
          icon={<CalendarClock size={17} />}
        >
          <HorizontalBar data={agingData} color="#a78bfa" name="SAT Belgesi" />
        </ChartCard>
        <ChartCard
          title="Teslimat Riski"
          subtitle={`${deliveryRiskData.overdueCount} gecikmiş kalem · ${formatUsd(deliveryRiskData.overdueUsd)}`}
          icon={<Truck size={17} />}
        >
          <DeliveryRiskGrid data={deliveryRiskData.data} />
        </ChartCard>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-cyan-300"><ShoppingCart size={17} /></span>
          <div>
            <h2 className="panel-title">SAT → SAS → Teslimat → Fatura Hunisi</h2>
            <p className="panel-subtitle mt-1">
              Tekil SAT belgelerinin satınalma sürecindeki ilerleme ve dönüşüm oranları
            </p>
          </div>
        </div>
        <ProcurementFunnel data={funnelData} />
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">SAT Malzeme Kalemleri</h2>
            <p className="mt-1 text-xs text-white/45">
              {documents.length} SAT belgesi · {visibleRows.length} kalem
              {selectedMaterialLabel ? ` · ${selectedMaterialLabel}` : ''}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/55">
            <FileCheck2 size={15} />
            Satıra tıklayarak tüm takip alanlarını görüntüleyin
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
        />
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `SAT ${detail.satNo} · ${detail.material || 'Malzeme'}` : 'SAT Kalem Detayı'}
        widthClass="max-w-4xl"
      >
        {detail && <ExportDetail row={detail} />}
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
                  {visibleRows.length} kalem · dashboard görünümü
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
                  {allRows.length} kalem · filtrelerden bağımsız
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

const EXPORT_COLUMNS: DataTableColumn<SATExportRow>[] = [
  {
    key: 'satNo',
    header: 'SAT Belge No',
    sortValue: (row) => row.satNo,
    searchValue: (row) => row.satNo,
    render: (row) => <span className="font-semibold text-white">{row.satNo}</span>,
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
    key: 'satUsd',
    header: 'SAT USD',
    sortValue: (row) => row.totalSatUsd,
    searchValue: (row) => String(row.totalSatUsd),
    className: 'whitespace-nowrap',
    render: (row) => <span className="font-semibold text-cyan-300">{formatUsd(row.totalSatUsd)}</span>,
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

function buildDocuments(rows: SATExportRow[]): SATDocument[] {
  const map = new Map<string, SATDocument>();
  rows.forEach((row) => {
    const current = map.get(row.satNo) ?? {
      satNo: row.satNo,
      satCreator: row.satCreator,
      totalSatUsd: row.totalSatUsd,
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
  return [...map.values()];
}

function buildDocumentPartyData(
  documents: SATDocument[],
  getParties: (document: SATDocument) => string[],
) {
  const counts = new Map<string, number>();
  documents.forEach((doc) => {
    [...new Set(getParties(doc).filter(Boolean))].forEach((party) =>
      counts.set(party, (counts.get(party) ?? 0) + 1),
    );
  });
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'tr'));
}

function buildMaterialGroupData(
  rows: SATExportRow[],
  metric: MaterialMetric,
  limit: number,
) {
  const documentStats = new Map<string, { rows: number; totalSatUsd: number }>();
  rows.forEach((row) => {
    const current = documentStats.get(row.satNo) ?? { rows: 0, totalSatUsd: 0 };
    current.rows += 1;
    current.totalSatUsd = Math.max(current.totalSatUsd, row.totalSatUsd);
    documentStats.set(row.satNo, current);
  });

  const groups = new Map<
    string,
    { count: number; satUsd: number; sasUsd: number }
  >();
  rows.forEach((row) => {
    const category = row.materialGroup || 'Mal Grubu Yok';
    const current = groups.get(category) ?? { count: 0, satUsd: 0, sasUsd: 0 };
    const document = documentStats.get(row.satNo);
    current.count += 1;
    current.satUsd += document ? document.totalSatUsd / document.rows : 0;
    current.sasUsd += row.sasUsdAmount;
    groups.set(category, current);
  });

  const metricValue = (values: { count: number; satUsd: number; sasUsd: number }) =>
    values[metric];
  const sorted = [...groups.entries()].sort(
    ([nameA, valuesA], [nameB, valuesB]) =>
      metricValue(valuesB) - metricValue(valuesA) ||
      nameA.localeCompare(nameB, 'tr'),
  );
  const topEntries = sorted.slice(0, limit);
  const topGroupNames = topEntries.map(([name]) => name);
  const remaining = sorted.slice(limit);
  const displayEntries: Array<[string, number, string]> = topEntries.map(
    ([name, values]) => [name, metricValue(values), name],
  );
  if (remaining.length > 0) {
    displayEntries.push([
      `Diğer (${remaining.length} grup)`,
      sum(remaining.map(([, values]) => metricValue(values))),
      OTHER_MATERIAL_GROUPS,
    ]);
  }
  const total = sum(displayEntries.map(([, value]) => value));
  let running = 0;
  const data: MaterialGroupDatum[] = displayEntries.map(
    ([name, value, filterValue]) => {
      running += value;
      return {
        name,
        value,
        cumulative: total ? (running / total) * 100 : 0,
        filterValue,
      };
    },
  );
  return { data, topGroupNames };
}

function filterByMaterialGroup(
  rows: SATExportRow[],
  selected: string,
  topGroupNames: string[],
) {
  if (!selected) return rows;
  return rows.filter((row) => {
    const group = row.materialGroup || 'Mal Grubu Yok';
    return selected === OTHER_MATERIAL_GROUPS
      ? !topGroupNames.includes(group)
      : group === selected;
  });
}

function buildAgingData(documents: SATDocument[]) {
  const today = startOfDay(new Date());
  const buckets = [
    { name: '0–15 Gün', value: 0 },
    { name: '16–30 Gün', value: 0 },
    { name: '31–60 Gün', value: 0 },
    { name: '60+ Gün', value: 0 },
    { name: 'Tarih Yok', value: 0 },
  ];
  documents
    .filter((document) => !document.rows.every((row) => row.completed))
    .forEach((document) => {
      if (!document.createdAt || Number.isNaN(document.createdAt.getTime())) {
        buckets[4].value += 1;
        return;
      }
      const days = Math.max(
        0,
        Math.floor((today.getTime() - startOfDay(document.createdAt).getTime()) / 86400000),
      );
      if (days <= 15) buckets[0].value += 1;
      else if (days <= 30) buckets[1].value += 1;
      else if (days <= 60) buckets[2].value += 1;
      else buckets[3].value += 1;
    });
  return buckets;
}

function buildDeliveryRiskData(rows: SATExportRow[]) {
  const today = startOfDay(new Date());
  const inSevenDays = addDays(today, 7);
  const inThirtyDays = addDays(today, 30);
  const buckets = [
    { name: 'Gecikmiş', value: 0 },
    { name: 'Önümüzdeki 7 Gün', value: 0 },
    { name: '8–30 Gün', value: 0 },
    { name: 'Teslim Tarihi Yok', value: 0 },
  ];
  let overdueUsd = 0;
  rows
    .filter((row) => !row.lastDelivery)
    .forEach((row) => {
      if (!row.deliveryDate || Number.isNaN(row.deliveryDate.getTime())) {
        buckets[3].value += 1;
        return;
      }
      const deliveryDate = startOfDay(row.deliveryDate);
      if (deliveryDate < today) {
        buckets[0].value += 1;
        overdueUsd += row.sasUsdAmount;
      } else if (deliveryDate <= inSevenDays) {
        buckets[1].value += 1;
      } else if (deliveryDate <= inThirtyDays) {
        buckets[2].value += 1;
      }
    });
  return {
    data: buckets,
    overdueCount: buckets[0].value,
    overdueUsd,
  };
}

function buildFunnelData(documents: SATDocument[]) {
  const created = documents;
  const processing = created.filter(
    (document) =>
      document.summaryStatus || document.rows.some((row) => row.sasUsdAmount > 0),
  );
  const ordered = processing.filter((document) =>
    document.rows.some(
      (row) => row.sasUsdAmount > 0 || row.lastDelivery || row.lastInvoice,
    ),
  );
  const delivered = ordered.filter((document) =>
    document.rows.some((row) => row.lastDelivery),
  );
  const invoiced = delivered.filter((document) =>
    document.rows.some((row) => row.lastInvoice),
  );
  return [
    { label: 'SAT Oluşturuldu', documents: created, color: '#38bdf8' },
    { label: 'İşleme Alındı', documents: processing, color: '#8b5cf6' },
    { label: 'SAS / Sipariş', documents: ordered, color: '#f59e0b' },
    { label: 'Teslim Edildi', documents: delivered, color: '#10b981' },
    { label: 'Faturalandı', documents: invoiced, color: '#22c55e' },
  ].map((stage) => ({
    label: stage.label,
    count: stage.documents.length,
    totalUsd: sum(stage.documents.map((document) => document.totalSatUsd)),
    color: stage.color,
  }));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function buildMonthlyDocuments(
  documents: SATDocument[],
  getDate: (document: SATDocument) => Date | null,
) {
  return buildMonthlyValues(documents.map(getDate));
}

function buildMonthlyRows(
  rows: SATExportRow[],
  getDate: (row: SATExportRow) => Date | null,
) {
  return buildMonthlyValues(rows.map(getDate));
}

function buildMonthlyValues(values: (Date | null)[]) {
  const counts = new Map<string, number>();
  values.forEach((date) => {
    if (!date || Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        key,
        value,
        label: new Date(year, month - 1, 1).toLocaleDateString('tr-TR', {
          month: 'short',
          year: '2-digit',
        }),
      };
    });
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
          <div className="mt-3 truncate text-3xl font-semibold text-white tabular-nums">{value}</div>
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

function ChartCard({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card min-w-0 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-cyan-300">{icon}</span>
          <div>
            <h2 className="panel-title">{title}</h2>
            <p className="panel-subtitle mt-1">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="h-72 min-w-0">{children}</div>
    </section>
  );
}

function MaterialMetricToggle({
  value,
  onChange,
}: {
  value: MaterialMetric;
  onChange: (value: MaterialMetric) => void;
}) {
  const options: { value: MaterialMetric; label: string }[] = [
    { value: 'count', label: 'Adet' },
    { value: 'satUsd', label: 'SAT USD' },
    { value: 'sasUsd', label: 'SAS USD' },
  ];
  return (
    <div className="inline-flex self-start rounded-lg border border-white/10 bg-black/20 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition ${
            value === option.value
              ? 'bg-orange-400/20 text-orange-200'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MaterialPareto({
  data,
  metric,
  selected,
  onSelect,
}: {
  data: MaterialGroupDatum[];
  metric: MaterialMetric;
  selected: string;
  onSelect: (value: string) => void;
}) {
  const metricName =
    metric === 'count' ? 'SAT Kalemi' : metric === 'satUsd' ? 'SAT USD' : 'SAS USD';
  const isCurrency = metric !== 'count';
  return data.length > 0 ? (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <ComposedChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 22, bottom: 0, left: 16 }}
      >
        <CartesianGrid stroke="rgb(255 255 255 / 0.07)" horizontal={false} />
        <XAxis
          xAxisId="value"
          type="number"
          allowDecimals={isCurrency}
          stroke="#64748b"
          fontSize={10}
          tickFormatter={isCurrency ? compactAxis : undefined}
        />
        <XAxis
          xAxisId="percent"
          type="number"
          orientation="top"
          domain={[0, 100]}
          ticks={[0, 20, 40, 60, 80, 100]}
          stroke="#fb923c"
          fontSize={10}
          tickFormatter={(value) => `%${value}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={135}
          stroke="#94a3b8"
          fontSize={10}
          tickLine={false}
          tickFormatter={shortLabel}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
          formatter={(value, name) =>
            name === 'Kümülatif %'
              ? [`%${Number(value).toFixed(1)}`, name]
              : [
                  isCurrency ? formatUsd(Number(value)) : formatNumber(Number(value)),
                  metricName,
                ]
          }
        />
        <Bar
          xAxisId="value"
          dataKey="value"
          name={metricName}
          radius={[0, 5, 5, 0]}
        >
          {data.map((item) => (
            <Cell
              key={item.filterValue}
              fill={
                selected && selected !== item.filterValue ? '#7c2d12' : '#f97316'
              }
              fillOpacity={selected && selected !== item.filterValue ? 0.42 : 0.9}
              onClick={() => onSelect(item.filterValue)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Bar>
        <Line
          xAxisId="percent"
          type="monotone"
          dataKey="cumulative"
          name="Kümülatif %"
          stroke="#facc15"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#facc15', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
        <ReferenceLine
          xAxisId="percent"
          x={80}
          stroke="#facc15"
          strokeDasharray="4 4"
          strokeOpacity={0.55}
        />
      </ComposedChart>
    </ResponsiveContainer>
  ) : (
    <EmptyChart message="Seçili filtrelerde mal grubu verisi yok." />
  );
}

function ProcurementFunnel({
  data,
}: {
  data: { label: string; count: number; totalUsd: number; color: string }[];
}) {
  const max = Math.max(data[0]?.count ?? 0, 1);
  return (
    <div className="flex flex-col items-center gap-2">
      {data.map((stage, index) => {
        const conversion = index === 0 ? 100 : (stage.count / max) * 100;
        return (
          <div
            key={stage.label}
            className="relative min-w-64 overflow-hidden rounded-lg border border-white/10 px-4 py-3 transition hover:border-white/20"
            style={{
              width: `${Math.max(38, (stage.count / max) * 100)}%`,
              backgroundColor: `${stage.color}16`,
            }}
          >
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: stage.color }}
            />
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-white/55">{stage.label}</div>
                <div className="mt-1 text-xl font-semibold text-white tabular-nums">
                  {formatNumber(stage.count)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold" style={{ color: stage.color }}>
                  %{conversion.toFixed(0)}
                </div>
                <div className="mt-1 text-[10px] text-white/35">
                  {formatCompactUsd(stage.totalUsd)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeliveryRiskGrid({ data }: { data: { name: string; value: number }[] }) {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#64748b'];
  const total = sum(data.map((item) => item.value));
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      {data.map((item, index) => (
        <div
          key={item.name}
          className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] p-4"
        >
          <span
            className="absolute inset-x-0 top-0 h-1"
            style={{ backgroundColor: colors[index] }}
          />
          <div className="text-xs font-medium text-white/45">{item.name}</div>
          <div className="mt-3 text-3xl font-semibold text-white tabular-nums">
            {formatNumber(item.value)}
          </div>
          <div className="mt-2 text-[11px]" style={{ color: colors[index] }}>
            {percent(item.value, total)} açık kalem
          </div>
        </div>
      ))}
    </div>
  );
}

function HorizontalBar({
  data,
  color,
  name,
  currency = false,
}: {
  data: { name: string; value: number }[];
  color: string;
  name: string;
  currency?: boolean;
}) {
  return data.length > 0 ? (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 22 }}>
        <CartesianGrid stroke="rgb(255 255 255 / 0.07)" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          stroke="#64748b"
          fontSize={11}
          tickFormatter={currency ? compactAxis : undefined}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={128}
          stroke="#94a3b8"
          fontSize={10}
          tickLine={false}
          tickFormatter={shortLabel}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
          formatter={(value) =>
            currency ? [formatUsd(Number(value)), name] : [Number(value), name]
          }
        />
        <Bar dataKey="value" name={name} fill={color} radius={[0, 5, 5, 0]} />
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <EmptyChart message="Seçili filtrelerde grafik verisi yok." />
  );
}

function AreaTrend({
  data,
  name,
  color,
  gradientId,
}: {
  data: { label: string; value: number }[];
  name: string;
  color: string;
  gradientId: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgb(255 255 255 / 0.07)" vertical={false} />
        <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
        <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey="value"
          name={name}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
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

function ExportDetail({ row }: { row: SATExportRow }) {
  const fields: [string, string][] = [
    ['SAT Yaratan', row.satCreator],
    ['Şirket Kodu', row.companyCode],
    ['SAT Belge Numarası', row.satNo],
    ['Toplam SAT USD Tutarı', formatUsd(row.totalSatUsd)],
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

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] px-6 text-center text-sm text-white/40">
      {message}
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

function percent(value: number, total: number) {
  return total ? `%${Math.round((value / total) * 100)}` : '%0';
}

function yesNo(value: boolean) {
  return value ? 'Evet' : 'Hayır';
}

function shortLabel(value: string) {
  return value.length > 20 ? `${value.slice(0, 19)}…` : value;
}

function compactAxis(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
