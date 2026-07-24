import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  SCEV2CalibrationStatus,
  SCEV2DashboardRow,
  SCEV2DeferralStatus,
  SCEV2MaintenanceStatus,
} from '../../types';
import { useDataStore } from '../../store/dataStore';
import { buildSCEV2DashboardRows } from '../../lib/sceV2Logic';
import { formatDate, normalize } from '../../lib/normalize';
import { Modal } from '../common/Modal';

type DashboardFilter =
  | 'all'
  | SCEV2MaintenanceStatus
  | 'deferral_started'
  | 'deferral_required'
  | 'calibration_shared'
  | 'calibration_not_shared'
  | 'calibration_unknown';

interface ChartDatum {
  name: string;
  value: number;
  color: string;
  filter: DashboardFilter;
}

const PAGE_SIZE = 25;
const tooltipStyle = {
  background: '#111827',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  color: '#f8fafc',
  boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
};

export function SCEV2Dashboard() {
  const sourceRows = useDataStore((state) => state.sceV2Rows);
  const controlRows = useDataStore((state) => state.sceV2ControlRows);
  const [filter, setFilter] = useState<DashboardFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<SCEV2DashboardRow | null>(
    null,
  );

  const rows = useMemo(
    () => buildSCEV2DashboardRows(sourceRows, controlRows),
    [controlRows, sourceRows],
  );
  const metrics = useMemo(() => buildMetrics(rows), [rows]);
  const maintenanceChartData: ChartDatum[] = [
    {
      name: 'Tamamlandı',
      value: metrics.completed,
      color: '#10b981',
      filter: 'completed',
    },
    {
      name: 'Duruşa Ertelendi',
      value: metrics.shutdownDeferred,
      color: '#f59e0b',
      filter: 'shutdown_deferred',
    },
    {
      name: 'Bakımı Yapılmadı',
      value: metrics.notCompleted,
      color: '#f43f5e',
      filter: 'maintenance_not_completed',
    },
  ];
  const deferralChartData: ChartDatum[] = [
    {
      name: 'Başlatıldı',
      value: metrics.deferralStarted,
      color: '#38bdf8',
      filter: 'deferral_started',
    },
    {
      name: 'Başlatılmalı',
      value: metrics.deferralRequired,
      color: '#ef4444',
      filter: 'deferral_required',
    },
  ];
  const calibrationChartData: ChartDatum[] = [
    {
      name: 'Paylaşıldı',
      value: metrics.calibrationShared,
      color: '#22c55e',
      filter: 'calibration_shared',
    },
    {
      name: 'Paylaşılmadı',
      value: metrics.calibrationNotShared,
      color: '#fb7185',
      filter: 'calibration_not_shared',
    },
    {
      name: 'Bilgi Bekleniyor',
      value: metrics.calibrationUnknown,
      color: '#64748b',
      filter: 'calibration_unknown',
    },
  ];
  const filteredRows = useMemo(() => {
    const query = normalize(search);
    return rows
      .filter((row) => matchesFilter(row, filter))
      .filter((row) => {
        if (!query) return true;
        return normalize(
          [
            row.equipmentNo,
            row.tagNo,
            row.equipmentDescription,
            row.orderNo,
            row.notificationNo,
            row.userStatus,
            row.maintenancePlanNo,
            row.maintenanceItemNo,
          ].join(' '),
        ).includes(query);
      })
      .sort(compareRows);
  }, [filter, rows, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="border-b border-white/10 p-5 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20">
                <ShieldAlert size={21} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  SCE V2 Periyodik Bakım Takibi
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  SAP sipariş durumları ile saha kontrol kayıtları ekipman
                  numarası üzerinden birleştirilir.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => downloadControlTemplate(rows)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20 focus:outline-none focus:ring-2 focus:ring-sky-400/30 sm:mt-0"
          >
            <Download size={16} />
            Kontrol Excel Şablonunu İndir
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-3 xl:grid-cols-6">
          <MetricButton
            label="Toplam Ekipman"
            value={rows.length}
            note="Tekilleştirilmiş kayıt"
            color="slate"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <MetricButton
            label="Bakımı Tamamlanan"
            value={metrics.completed}
            note="KPLI veya SHTM"
            color="emerald"
            active={filter === 'completed'}
            onClick={() => setFilter('completed')}
          />
          <MetricButton
            label="Duruşa Ertelenen"
            value={metrics.shutdownDeferred}
            note="BEK içeren durum"
            color="amber"
            active={filter === 'shutdown_deferred'}
            onClick={() => setFilter('shutdown_deferred')}
          />
          <MetricButton
            label="Bakımı Yapılmadı"
            value={metrics.notCompleted}
            note="Diğer SAP durumları"
            color="rose"
            active={filter === 'maintenance_not_completed'}
            onClick={() => setFilter('maintenance_not_completed')}
          />
          <MetricButton
            label="Deferral Başlatıldı"
            value={metrics.deferralStarted}
            note="Kontrol Excel'i eşleşti"
            color="sky"
            active={filter === 'deferral_started'}
            onClick={() => setFilter('deferral_started')}
          />
          <MetricButton
            label="Deferral Başlatılmalı"
            value={metrics.deferralRequired}
            note="BEK var, kayıt yok"
            color="red"
            active={filter === 'deferral_required'}
            onClick={() => setFilter('deferral_required')}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ModernChartCard
          title="Bakım Durumu"
          subtitle="SAP kullanıcı durumlarının genel dağılımı"
          accentClass="from-emerald-400/25 via-amber-400/10 to-rose-400/20"
        >
          <div className="relative h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={maintenanceChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={96}
                  paddingAngle={3}
                  stroke="transparent"
                >
                  {maintenanceChartData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.color}
                      className="cursor-pointer outline-none"
                      onClick={() => setFilter(item.filter)}
                    />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
            <ChartCenterLabel
              value={`%${percent(metrics.completed, rows.length)}`}
              label="Tamamlanma"
            />
          </div>
          <ChartLegend
            data={maintenanceChartData}
            total={rows.length}
            activeFilter={filter}
            onSelect={setFilter}
          />
        </ModernChartCard>

        <ModernChartCard
          title="Deferral Aksiyonları"
          subtitle="Duruşa ertelenen ekipmanların takip durumu"
          accentClass="from-sky-400/25 via-red-400/10 to-transparent"
        >
          <div className="mb-2 flex items-end justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div>
              <div className="text-xs text-white/40">Deferral kapsama oranı</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {metrics.deferralStarted + metrics.deferralRequired}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/40">Başlatılma oranı</div>
              <div className="mt-1 text-2xl font-semibold text-sky-300">
                %
                {percent(
                  metrics.deferralStarted,
                  metrics.deferralStarted + metrics.deferralRequired,
                )}
              </div>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={deferralChartData}
                layout="vertical"
                margin={{ top: 12, right: 20, bottom: 12, left: 10 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  width={94}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="value" barSize={25} radius={[0, 8, 8, 0]}>
                  {deferralChartData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.color}
                      className="cursor-pointer"
                      onClick={() => setFilter(item.filter)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            data={deferralChartData}
            total={metrics.deferralStarted + metrics.deferralRequired}
            activeFilter={filter}
            onSelect={setFilter}
          />
        </ModernChartCard>

        <ModernChartCard
          title="Kalibrasyon Raporları"
          subtitle="Saha kontrol Excel'indeki paylaşım durumu"
          accentClass="from-emerald-400/20 via-slate-400/10 to-rose-400/15"
        >
          <div className="relative h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={calibrationChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={96}
                  paddingAngle={3}
                  stroke="transparent"
                >
                  {calibrationChartData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.color}
                      className="cursor-pointer outline-none"
                      onClick={() => setFilter(item.filter)}
                    />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
            <ChartCenterLabel
              value={`%${percent(
                metrics.calibrationShared + metrics.calibrationNotShared,
                rows.length,
              )}`}
              label="Kontrol Edilen"
            />
          </div>
          <ChartLegend
            data={calibrationChartData}
            total={rows.length}
            activeFilter={filter}
            onSelect={setFilter}
          />
        </ModernChartCard>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">
                Ekipman Takip Listesi
              </h3>
              <p className="mt-1 text-xs text-white/50">
                {filterLabel(filter)} · {filteredRows.length} kayıt
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <label className="relative block min-w-72">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ekipman, tag, sipariş veya plan ara..."
                  className="input pl-9"
                />
              </label>
              {(filter !== 'all' || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSearch('');
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  Filtreyi Temizle
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.05] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-5 py-3 font-medium">Ekipman / Tag</th>
                <th className="px-4 py-3 font-medium">Sipariş</th>
                <th className="px-4 py-3 font-medium">Kullanıcı Durumu</th>
                <th className="px-4 py-3 font-medium">Bakım Durumu</th>
                <th className="px-4 py-3 font-medium">Deferral</th>
                <th className="px-4 py-3 font-medium">Kalibrasyon Raporu</th>
                <th className="px-5 py-3 text-right font-medium">Bitiş</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07]">
              {pageRows.map((row) => (
                <tr
                  key={row.rowId}
                  onClick={() => setSelectedRow(row)}
                  className="cursor-pointer bg-[#0d0d0d] transition hover:bg-white/[0.05]"
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{row.equipmentNo || '—'}</div>
                    <div className="mt-0.5 text-xs text-sky-300/75">
                      {row.tagNo || 'Tag yok'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/70">{row.orderNo || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs font-medium text-white/65">
                      {row.userStatus || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <MaintenanceBadge status={row.maintenanceStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <DeferralBadge status={row.deferralStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <CalibrationBadge status={row.calibrationStatus} />
                  </td>
                  <td className="px-5 py-3 text-right text-white/55">
                    {formatDate(row.maintenanceEndDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pageRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-white/45">
            Bu filtreye uyan ekipman bulunamadı.
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <span className="text-xs text-white/45">
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filteredRows.length)} /{' '}
              {filteredRows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                className="rounded-md border border-white/10 p-2 text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Önceki sayfa"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-16 text-center text-xs text-white/55">
                {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                className="rounded-md border border-white/10 p-2 text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Sonraki sayfa"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      <EquipmentDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}

function MetricButton({
  label,
  value,
  note,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  note: string;
  color: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'red';
  active: boolean;
  onClick: () => void;
}) {
  const colors = {
    slate: 'text-slate-200',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    sky: 'text-sky-300',
    red: 'text-red-300',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-[#0d0d0d] p-5 text-left transition hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-400/35 ${
        active ? 'bg-white/[0.07]' : ''
      }`}
    >
      <div className="text-xs font-medium text-white/50">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${colors[color]}`}>
        {value}
      </div>
      <div className="mt-2 text-xs text-white/35">{note}</div>
    </button>
  );
}

function ModernChartCard({
  title,
  subtitle,
  accentClass,
  children,
}: {
  title: string;
  subtitle: string;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentClass}`}
      />
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-sky-400/[0.04] blur-3xl" />
      <div className="relative">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs text-white/45">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function ChartCenterLabel({ value, label }: { value: string; label: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
      <span className="text-3xl font-semibold tracking-tight text-white">
        {value}
      </span>
      <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
        {label}
      </span>
    </div>
  );
}

function ChartLegend({
  data,
  total,
  activeFilter,
  onSelect,
}: {
  data: ChartDatum[];
  total: number;
  activeFilter: DashboardFilter;
  onSelect: (filter: DashboardFilter) => void;
}) {
  return (
    <div className="space-y-1.5">
      {data.map((item) => (
        <button
          key={item.name}
          type="button"
          onClick={() => onSelect(item.filter)}
          className={`grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
            activeFilter === item.filter
              ? 'border-sky-400/35 bg-sky-500/10'
              : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
          }`}
        >
          <span
            className="h-2.5 w-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-white/60">{item.name}</span>
          <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-white/40">
            %{percent(item.value, total)}
          </span>
          <span className="min-w-8 text-right text-sm font-semibold text-white">
            {item.value}
          </span>
        </button>
      ))}
    </div>
  );
}

function ChartTooltip() {
  return <Tooltip contentStyle={tooltipStyle} />;
}

function MaintenanceBadge({ status }: { status: SCEV2MaintenanceStatus }) {
  const config = {
    completed: {
      label: 'Bakımı Tamamlandı',
      className: 'bg-emerald-500/15 text-emerald-300',
    },
    shutdown_deferred: {
      label: 'Duruşa Ertelendi',
      className: 'bg-amber-500/15 text-amber-300',
    },
    maintenance_not_completed: {
      label: 'Bakımı Yapılmadı',
      className: 'bg-rose-500/15 text-rose-300',
    },
  }[status];
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function DeferralBadge({ status }: { status: SCEV2DeferralStatus }) {
  const config = {
    not_applicable: {
      label: 'Gerekmez',
      className: 'bg-white/[0.05] text-white/35',
    },
    started: {
      label: 'Başlatıldı',
      className: 'bg-sky-500/15 text-sky-300',
    },
    required: {
      label: 'Başlatılmalı',
      className: 'bg-red-500/15 text-red-300',
    },
  }[status];
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function CalibrationBadge({ status }: { status: SCEV2CalibrationStatus }) {
  const config = {
    shared: {
      label: 'Paylaşıldı',
      className: 'bg-emerald-500/15 text-emerald-300',
    },
    not_shared: {
      label: 'Paylaşılmadı',
      className: 'bg-rose-500/15 text-rose-300',
    },
    unknown: {
      label: 'Bilgi Bekleniyor',
      className: 'bg-white/[0.05] text-white/35',
    },
  }[status];
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function EquipmentDetailModal({
  row,
  onClose,
}: {
  row: SCEV2DashboardRow | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title={row ? `${row.tagNo || row.equipmentNo} · Ekipman Detayı` : ''}
      widthClass="max-w-4xl"
    >
      {row && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DetailStatus
              icon={<Wrench size={18} />}
              label="Bakım Durumu"
              value={maintenanceLabel(row.maintenanceStatus)}
              className="text-sky-300"
            />
            <DetailStatus
              icon={<Clock3 size={18} />}
              label="Deferral Durumu"
              value={deferralLabel(row.deferralStatus)}
              className="text-amber-300"
            />
            <DetailStatus
              icon={<FileCheck2 size={18} />}
              label="Kalibrasyon Raporu"
              value={calibrationLabel(row.calibrationStatus)}
              className="text-emerald-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <DetailItem label="Ekipman Numarası" value={row.equipmentNo} />
            <DetailItem label="Tag Numarası / Teknik Birim" value={row.tagNo} />
            <DetailItem label="Bakım Planı" value={row.maintenancePlanNo} />
            <DetailItem label="Bakım Kalemi" value={row.maintenanceItemNo} />
            <DetailItem label="Sipariş Numarası" value={row.orderNo} />
            <DetailItem label="Bildirim Numarası" value={row.notificationNo} />
            <DetailItem label="Bakım Periyodu" value={row.maintenancePeriod} />
            <DetailItem label="SAP Kullanıcı Durumu" value={row.userStatus} />
            <DetailItem
              label="Bakım Başlangıç Tarihi"
              value={formatDate(row.maintenanceStartDate)}
            />
            <DetailItem
              label="Son Bakım Yapıldığı Tarih"
              value={formatDate(row.maintenanceEndDate)}
            />
          </div>

          {row.equipmentDescription && (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-white/35">
                Ekipman Tanımı
              </div>
              <div className="mt-2 text-sm text-white/75">
                {row.equipmentDescription}
              </div>
            </div>
          )}

          {(row.controlNote || row.controlUpdatedBy || row.controlUpdatedAt) && (
            <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-200">
                <CalendarDays size={17} />
                Saha Kontrol Kaydı
              </div>
              <div className="mt-3 text-sm text-white/70">
                {row.controlNote || 'Açıklama girilmemiş.'}
              </div>
              <div className="mt-3 text-xs text-white/40">
                {[row.controlUpdatedBy, formatDate(row.controlUpdatedAt)]
                  .filter((value) => value && value !== '—')
                  .join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function DetailStatus({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className={`flex items-center gap-2 ${className}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/[0.08] pb-3">
      <div className="text-xs text-white/35">{label}</div>
      <div className="mt-1 text-sm font-medium text-white/80">{value || '—'}</div>
    </div>
  );
}

function buildMetrics(rows: SCEV2DashboardRow[]) {
  return {
    completed: rows.filter((row) => row.maintenanceStatus === 'completed').length,
    shutdownDeferred: rows.filter(
      (row) => row.maintenanceStatus === 'shutdown_deferred',
    ).length,
    notCompleted: rows.filter(
      (row) => row.maintenanceStatus === 'maintenance_not_completed',
    ).length,
    deferralStarted: rows.filter((row) => row.deferralStatus === 'started').length,
    deferralRequired: rows.filter(
      (row) => row.deferralStatus === 'required',
    ).length,
    calibrationShared: rows.filter(
      (row) => row.calibrationStatus === 'shared',
    ).length,
    calibrationNotShared: rows.filter(
      (row) => row.calibrationStatus === 'not_shared',
    ).length,
    calibrationUnknown: rows.filter(
      (row) => row.calibrationStatus === 'unknown',
    ).length,
  };
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function matchesFilter(row: SCEV2DashboardRow, filter: DashboardFilter) {
  if (filter === 'all') return true;
  if (
    filter === 'completed' ||
    filter === 'shutdown_deferred' ||
    filter === 'maintenance_not_completed'
  ) {
    return row.maintenanceStatus === filter;
  }
  if (filter === 'deferral_started') return row.deferralStatus === 'started';
  if (filter === 'deferral_required') return row.deferralStatus === 'required';
  if (filter === 'calibration_shared') return row.calibrationStatus === 'shared';
  if (filter === 'calibration_not_shared') {
    return row.calibrationStatus === 'not_shared';
  }
  return row.calibrationStatus === 'unknown';
}

function compareRows(a: SCEV2DashboardRow, b: SCEV2DashboardRow) {
  const priority = (row: SCEV2DashboardRow) => {
    if (row.deferralStatus === 'required') return 0;
    if (row.maintenanceStatus === 'maintenance_not_completed') return 1;
    if (row.calibrationStatus === 'not_shared') return 2;
    if (row.maintenanceStatus === 'shutdown_deferred') return 3;
    return 4;
  };
  return (
    priority(a) - priority(b) ||
    a.tagNo.localeCompare(b.tagNo, 'tr', { numeric: true })
  );
}

function filterLabel(filter: DashboardFilter) {
  const labels: Record<DashboardFilter, string> = {
    all: 'Tüm ekipmanlar',
    completed: 'Bakımı tamamlananlar',
    shutdown_deferred: 'Duruşa ertelenenler',
    maintenance_not_completed: 'Bakımı yapılmayanlar',
    deferral_started: 'Deferral başlatılanlar',
    deferral_required: 'Deferral başlatılması gerekenler',
    calibration_shared: 'Kalibrasyon raporu paylaşılanlar',
    calibration_not_shared: 'Kalibrasyon raporu paylaşılmayanlar',
    calibration_unknown: 'Kalibrasyon raporu bilgisi beklenenler',
  };
  return labels[filter];
}

function maintenanceLabel(status: SCEV2MaintenanceStatus) {
  return {
    completed: 'Bakımı Tamamlandı',
    shutdown_deferred: 'Duruşa Ertelendi',
    maintenance_not_completed: 'Bakımı Yapılmadı',
  }[status];
}

function deferralLabel(status: SCEV2DeferralStatus) {
  return {
    not_applicable: 'Gerekmez',
    started: 'Deferral Başlatıldı',
    required: 'Deferral Başlatılmalı',
  }[status];
}

function calibrationLabel(status: SCEV2CalibrationStatus) {
  return {
    shared: 'Paylaşıldı',
    not_shared: 'Paylaşılmadı',
    unknown: 'Bilgi Bekleniyor',
  }[status];
}

function downloadControlTemplate(rows: SCEV2DashboardRow[]) {
  const uniqueRows = [...rows]
    .sort((a, b) => a.tagNo.localeCompare(b.tagNo, 'tr', { numeric: true }))
    .map((row) => ({
      Ekipman: row.equipmentNo,
      'Teknik Birim': row.tagNo,
      'SAP Kullanıcı Durumu': row.userStatus,
      'Kalibrasyon Raporu': '',
      'Deferral Durumu':
        row.maintenanceStatus === 'shutdown_deferred' ? '' : 'Gerekmez',
      Açıklama: '',
      Güncelleyen: '',
      'Güncelleme Tarihi': '',
    }));
  const instructions = [
    {
      Alan: 'Kalibrasyon Raporu',
      'Kullanılacak Değerler': 'Paylaşıldı / Paylaşılmadı',
    },
    {
      Alan: 'Deferral Durumu',
      'Kullanılacak Değerler': 'Başlatıldı / Başlatılmadı / Gerekmez',
    },
    {
      Alan: 'Ekipman',
      'Kullanılacak Değerler':
        'SAP dosyasındaki Ekipman numarası ile aynı kalmalıdır.',
    },
  ];
  const workbook = XLSX.utils.book_new();
  const controlSheet = XLSX.utils.json_to_sheet(uniqueRows);
  const instructionSheet = XLSX.utils.json_to_sheet(instructions);
  controlSheet['!cols'] = [
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 22 },
    { wch: 42 },
    { wch: 20 },
    { wch: 20 },
  ];
  controlSheet['!autofilter'] = {
    ref: controlSheet['!ref'] ?? 'A1:H1',
  };
  instructionSheet['!cols'] = [{ wch: 28 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(workbook, controlSheet, 'Kontrol');
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Kullanım');
  XLSX.writeFile(workbook, 'SCE_V2_Saha_Kontrol_Sablonu.xlsx');
}
