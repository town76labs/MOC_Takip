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
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  FilterX,
  Loader2,
  PackageSearch,
  ShoppingCart,
  Users,
} from 'lucide-react';
import type { SATRow, SATStage } from '../../types';
import { useDataStore } from '../../store/dataStore';
import { formatDate, normalize } from '../../lib/normalize';
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

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#111111',
  border: '1px solid rgb(255 255 255 / 0.12)',
  borderRadius: 8,
  color: '#f8fafc',
};

export function SATDashboard() {
  const rows = useDataStore((state) => state.satRows);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [selectedStage, setSelectedStage] = useState<SATStage | null>(null);
  const [detail, setDetail] = useState<SATRow | null>(null);
  const [reportGenerating, setReportGenerating] = useState(false);

  const options = useMemo(
    () => ({
      units: unique(rows.map((row) => row.unite)),
      owners: unique(rows.map((row) => row.talepSahibi)),
      buyers: unique(
        rows.map((row) => row.satinAlmaSorumlusu || 'Atanmamış'),
      ),
      currencies: unique(rows.map((row) => row.paraBirimi)),
    }),
    [rows],
  );

  const baseFilteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!selectedUnit || row.unite === selectedUnit) &&
          (!selectedOwner || row.talepSahibi === selectedOwner) &&
          (!selectedBuyer ||
            (selectedBuyer === 'Atanmamış'
              ? !row.satinAlmaSorumlusu
              : row.satinAlmaSorumlusu === selectedBuyer)) &&
          (!selectedCurrency || row.paraBirimi === selectedCurrency),
      ),
    [
      rows,
      selectedUnit,
      selectedOwner,
      selectedBuyer,
      selectedCurrency,
    ],
  );

  const filteredRows = useMemo(
    () =>
      selectedStage
        ? baseFilteredRows.filter((row) => row.stage === selectedStage)
        : baseFilteredRows,
    [baseFilteredRows, selectedStage],
  );

  const stageSummary = useMemo(
    () =>
      STAGES.map((stage) => {
        const stageRows = baseFilteredRows.filter((row) => row.stage === stage.key);
        return {
          ...stage,
          count: stageRows.length,
          eur: sumCurrency(stageRows, 'EUR'),
          usd: sumCurrency(stageRows, 'USD'),
        };
      }),
    [baseFilteredRows],
  );

  const stats = useMemo(() => {
    const approvalCompleted = filteredRows.filter((row) =>
      normalize(row.onayDurumu).includes('tamamlandi'),
    ).length;
    const activeProcurement = filteredRows.filter((row) =>
      [
        'satina_aktarilacak',
        'teklif_bekleniyor',
        'teklif_degerlendiriliyor',
        'teklif_degerlendirildi',
        'sas_verildi',
      ].includes(row.stage),
    ).length;

    return {
      total: filteredRows.length,
      approvalCompleted,
      activeProcurement,
      completed: filteredRows.filter((row) => row.stage === 'tamamlandi').length,
      eur: sumCurrency(filteredRows, 'EUR'),
      usd: sumCurrency(filteredRows, 'USD'),
    };
  }, [filteredRows]);

  const unitData = useMemo(
    () => buildCountData(filteredRows, (row) => row.unite, 9),
    [filteredRows],
  );
  const buyerData = useMemo(
    () =>
      buildCountData(
        filteredRows,
        (row) => row.satinAlmaSorumlusu || 'Atanmamış',
        7,
      ),
    [filteredRows],
  );
  const monthlyData = useMemo(
    () => buildMonthlyData(filteredRows),
    [filteredRows],
  );
  const quality = useMemo(() => buildQualitySummary(rows), [rows]);

  const filtersActive = Boolean(
    selectedUnit ||
      selectedOwner ||
      selectedBuyer ||
      selectedCurrency ||
      selectedStage,
  );

  function clearFilters() {
    setSelectedUnit('');
    setSelectedOwner('');
    setSelectedBuyer('');
    setSelectedCurrency('');
    setSelectedStage(null);
  }

  async function createPDFReport() {
    const scope = [
      selectedUnit ? `Ünite: ${selectedUnit}` : '',
      selectedOwner ? `Talep Sahibi: ${selectedOwner}` : '',
      selectedBuyer ? `SAT Sorumlusu: ${selectedBuyer}` : '',
      selectedCurrency ? `Para Birimi: ${selectedCurrency}` : '',
      selectedStage ? `Süreç: ${stageLabel(selectedStage)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    setReportGenerating(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSATReportPdf({
        rows: filteredRows,
        scopeLabel: scope || 'Tüm SAT Talepleri',
      });
    } catch {
      window.alert('SAT PDF raporu oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setReportGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="panel-title">Dashboard Filtreleri</h2>
            <p className="panel-subtitle mt-1">
              Tüm kartlar, grafikler ve talep listesi birlikte filtrelenir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={createPDFReport}
              disabled={reportGenerating || filteredRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-cyan-400 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reportGenerating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileText size={15} />
              )}
              {reportGenerating ? 'Rapor Hazırlanıyor...' : 'PDF Raporu Oluştur'}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SATSelect
            label="Ünite"
            value={selectedUnit}
            options={options.units}
            onChange={setSelectedUnit}
          />
          <SATSelect
            label="Talep Sahibi"
            value={selectedOwner}
            options={options.owners}
            onChange={setSelectedOwner}
          />
          <SATSelect
            label="Satın Alma Sorumlusu"
            value={selectedBuyer}
            options={options.buyers}
            onChange={setSelectedBuyer}
          />
          <SATSelect
            label="Para Birimi"
            value={selectedCurrency}
            options={options.currencies}
            onChange={setSelectedCurrency}
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Toplam Talep"
          value={formatNumber(stats.total)}
          helper="Filtrelenen kayıt"
          color="#38bdf8"
          icon={<ClipboardList size={21} />}
        />
        <MetricCard
          title="Onayı Tamamlanan"
          value={formatNumber(stats.approvalCompleted)}
          helper={percent(stats.approvalCompleted, stats.total)}
          color="#8b5cf6"
          icon={<BadgeCheck size={21} />}
        />
        <MetricCard
          title="Satın Almada"
          value={formatNumber(stats.activeProcurement)}
          helper="Aktif süreç"
          color="#f59e0b"
          icon={<ShoppingCart size={21} />}
        />
        <MetricCard
          title="Tamamlanan"
          value={formatNumber(stats.completed)}
          helper={percent(stats.completed, stats.total)}
          color="#22c55e"
          icon={<CheckCircle2 size={21} />}
        />
        <MetricCard
          title="EUR Talep Tutarı"
          value={formatCompactAmount(stats.eur)}
          helper={formatAmount(stats.eur, 'EUR')}
          color="#06b6d4"
          icon={<Banknote size={21} />}
        />
        <MetricCard
          title="USD Talep Tutarı"
          value={formatCompactAmount(stats.usd)}
          helper={formatAmount(stats.usd, 'USD')}
          color="#10b981"
          icon={<CircleDollarSign size={21} />}
        />
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="panel-title">SAT Süreç Akışı</h2>
            <p className="panel-subtitle mt-1">
              Bir aşamaya tıklayarak dashboard'ı o adıma daraltın.
            </p>
          </div>
          {selectedStage && (
            <button
              type="button"
              onClick={() => setSelectedStage(null)}
              className="text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
            >
              Süreç filtresini kaldır
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {stageSummary
            .filter((stage) => stage.key !== 'diger' || stage.count > 0)
            .map((stage, index) => {
              const active = selectedStage === stage.key;
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() =>
                    setSelectedStage(active ? null : stage.key)
                  }
                  aria-pressed={active}
                  className={`relative min-h-32 overflow-hidden rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08] ${
                    active
                      ? 'border-cyan-300/70 bg-cyan-400/10 ring-2 ring-cyan-400/25'
                      : 'border-white/10 bg-white/[0.045]'
                  }`}
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <span className="text-xs font-medium leading-5 text-white/55">
                      {index + 1}. {stage.shortLabel}
                    </span>
                    <strong className="text-2xl font-semibold text-white tabular-nums">
                      {stage.count}
                    </strong>
                  </div>
                  <div className="mt-4 space-y-1 text-[11px] text-white/40">
                    {stage.eur > 0 && <div>{formatAmount(stage.eur, 'EUR')}</div>}
                    {stage.usd > 0 && <div>{formatAmount(stage.usd, 'USD')}</div>}
                    {stage.eur === 0 && stage.usd === 0 && <div>Tutar yok</div>}
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Ünite Bazında Talepler"
          subtitle="En fazla SAT açılan üniteler"
          icon={<Boxes size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={unitData} layout="vertical" margin={{ left: 8, right: 18 }}>
              <CartesianGrid stroke="rgb(255 255 255 / 0.07)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={82}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar dataKey="value" name="Talep" fill="#38bdf8" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Satın Alma Sorumlusu İş Yükü"
          subtitle="Atanan ve henüz atanmayan talepler"
          icon={<Users size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={buyerData} margin={{ top: 8, right: 12, left: 0, bottom: 42 }}>
              <CartesianGrid stroke="rgb(255 255 255 / 0.07)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                fontSize={10}
                angle={-24}
                textAnchor="end"
                interval={0}
                tickLine={false}
              />
              <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar dataKey="value" name="Talep" fill="#8b5cf6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <ChartCard
          title="Aylık SAT Talebi"
          subtitle="Hatalı yıl kayıtları grafiğe dahil edilmez"
          icon={<PackageSearch size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={monthlyData} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="satTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(255 255 255 / 0.07)" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="value"
                name="Talep"
                stroke="#22d3ee"
                strokeWidth={2.5}
                fill="url(#satTrend)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="card p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h2 className="panel-title">Veri Kalitesi</h2>
              <p className="panel-subtitle mt-1">
                Dashboard sonucu etkileyebilecek eksik veya şüpheli alanlar
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quality.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/10 bg-white/[0.045] p-3"
              >
                <div className="text-2xl font-semibold text-white tabular-nums">
                  {item.value}
                </div>
                <div className="mt-1 text-xs font-medium text-white/55">
                  {item.label}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-white/35">
                  {item.helper}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">SAT Talep Listesi</h2>
            <p className="mt-1 text-xs text-white/45">
              {filteredRows.length} kayıt · Satıra tıklayarak tüm Excel alanlarını görüntüleyin
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/55">
            <ShoppingCart size={15} />
            EUR ve USD tutarları ayrı değerlendirilir
          </div>
        </div>
        <DataTable
          data={filteredRows}
          columns={SAT_COLUMNS}
          rowKey={(row) => row.rowId}
          initialSortKey="date"
          initialSortDir="desc"
          emptyMessage="Seçili filtrelerde SAT talebi bulunamadı."
          onRowClick={setDetail}
          rowClassName={(row) => (hasCriticalIssue(row) ? 'bg-amber-400/[0.035]' : '')}
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
    key: 'stage',
    header: 'Süreç',
    sortValue: (row) => stageIndex(row.stage),
    searchValue: (row) => `${row.onayDurumu} ${row.satDurumu} ${stageLabel(row.stage)}`,
    className: 'whitespace-nowrap',
    render: (row) => <StageBadge stage={row.stage} />,
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
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card min-h-36">
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

function SATSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input appearance-none bg-[#171717]"
      >
        <option value="">Tümü</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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

function StageBadge({ stage }: { stage: SATStage }) {
  const config = STAGES.find((item) => item.key === stage) ?? STAGES.at(-1)!;
  return (
    <span
      className="inline-flex rounded-md border px-2 py-1 text-xs font-medium"
      style={{
        color: config.color,
        borderColor: `${config.color}45`,
        backgroundColor: `${config.color}14`,
      }}
    >
      {config.shortLabel}
    </span>
  );
}

function SATDetail({ row }: { row: SATRow }) {
  const fields = [
    ['Süreç Aşaması', stageLabel(row.stage)],
    ['SAT Tarihi', formatDate(row.satTarihi)],
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
      {hasCriticalIssue(row) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300" />
          <span>{criticalIssueText(row)}</span>
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'tr'),
  );
}

function sumCurrency(rows: SATRow[], currency: string) {
  return rows.reduce(
    (sum, row) =>
      row.paraBirimi === currency ? sum + row.toplamTutar : sum,
    0,
  );
}

function buildCountData(
  rows: SATRow[],
  getKey: (row: SATRow) => string,
  limit: number,
) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = getKey(row) || 'Belirtilmemiş';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function buildMonthlyData(rows: SATRow[]) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const date = row.satTarihi;
    if (!date || hasInvalidYear(row)) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        key,
        label: new Date(year, month - 1, 1).toLocaleDateString('tr-TR', {
          month: 'short',
          year: '2-digit',
        }),
        value,
      };
    });
}

function buildQualitySummary(rows: SATRow[]) {
  return [
    {
      label: 'Hatalı Tarih',
      value: rows.filter(hasInvalidYear).length,
      helper: 'Yılı 2000–2100 dışında',
    },
    {
      label: 'SAT No Eksik',
      value: rows.filter((row) => !row.satNo).length,
      helper: 'Takip numarası girilmemiş',
    },
    {
      label: 'PYP / Merkez Eksik',
      value: rows.filter((row) => !row.pypKodu).length,
      helper: 'Bütçe bağlantısı kurulamıyor',
    },
    {
      label: 'Sorumlu Atanmamış',
      value: rows.filter((row) => !row.satinAlmaSorumlusu).length,
      helper: 'Satın alma sorumlusu boş',
    },
  ];
}

function stageIndex(stage: SATStage) {
  return STAGES.findIndex((item) => item.key === stage);
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

function criticalIssueText(row: SATRow) {
  const issues = [];
  if (!row.satNo) issues.push('SAT numarası eksik');
  if (hasInvalidYear(row)) issues.push(`SAT tarihi şüpheli: ${formatDate(row.satTarihi)}`);
  return issues.join(' · ');
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

function formatCompactAmount(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function percent(value: number, total: number) {
  return total ? `%${Math.round((value / total) * 100)}` : '%0';
}
