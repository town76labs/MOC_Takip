import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
  FilterX,
  ReceiptText,
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

const EMPTY_STATUS = '__empty_status__';
const UNASSIGNED = '__unassigned__';
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
  vendors: string[];
}

export function SATExportDashboard() {
  const allRows = useDataStore((state) => state.satExportRows);
  const [selectedCreator, setSelectedCreator] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSasCreator, setSelectedSasCreator] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedApproval, setSelectedApproval] = useState('');
  const [detail, setDetail] = useState<SATExportRow | null>(null);

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

  const baseRows = useMemo(
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
  const visibleRows = useMemo(
    () =>
      baseRows.filter((row) => {
        if (!selectedStatus) return true;
        if (selectedStatus === EMPTY_STATUS) return !row.summaryStatus;
        return row.summaryStatus === selectedStatus;
      }),
    [baseRows, selectedStatus],
  );
  const documents = useMemo(() => buildDocuments(visibleRows), [visibleRows]);
  const baseDocuments = useMemo(() => buildDocuments(baseRows), [baseRows]);

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
  const vendorData = useMemo(
    () =>
      buildDocumentPartyData(documents, (doc) =>
        doc.vendors.length ? doc.vendors : ['Satıcı Atanmamış'],
      ).slice(0, 8),
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

  const filtersActive = Boolean(
    selectedCreator ||
      selectedStatus ||
      selectedSasCreator ||
      selectedVendor ||
      selectedApproval,
  );

  function clearFilters() {
    setSelectedCreator('');
    setSelectedStatus('');
    setSelectedSasCreator('');
    setSelectedVendor('');
    setSelectedApproval('');
  }

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
              <h2 className="panel-title">Sarı Kolonlar Dashboard Filtreleri</h2>
            </div>
            <p className="panel-subtitle mt-1">
              SAP exportundaki sarı işaretli 18 kolon kullanılır.
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
          title="Satıcı Dağılımı"
          subtitle="Satıcı bazında tekil SAT belge sayısı"
          icon={<ReceiptText size={17} />}
        >
          <HorizontalBar data={vendorData} color="#f97316" name="SAT Belgesi" />
        </ChartCard>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">SAT Malzeme Kalemleri</h2>
            <p className="mt-1 text-xs text-white/45">
              {documents.length} SAT belgesi · {visibleRows.length} kalem · yalnız sarı kolonlar
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/55">
            <FileCheck2 size={15} />
            Satıra tıklayarak tüm sarı alanları görüntüleyin
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
      vendors: [],
    };
    current.rows.push(row);
    current.sasUsdTotal += row.sasUsdAmount;
    if (!current.summaryStatus && row.summaryStatus) current.summaryStatus = row.summaryStatus;
    if (row.sasCreator && !current.sasCreators.includes(row.sasCreator)) {
      current.sasCreators.push(row.sasCreator);
    }
    if (row.vendorName && !current.vendors.includes(row.vendorName)) {
      current.vendors.push(row.vendorName);
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
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card min-w-0 p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-cyan-300">{icon}</span>
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-subtitle mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="h-72 min-w-0">{children}</div>
    </section>
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
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
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
