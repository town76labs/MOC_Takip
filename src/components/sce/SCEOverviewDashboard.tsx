import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FilterX,
  Layers3,
  PauseCircle,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type { SCERow } from '../../types';
import { useDataStore } from '../../store/dataStore';
import { formatDate, parseDate } from '../../lib/normalize';
import {
  classifySCEMaintenance,
  hasSCEValue,
} from '../../lib/sceMaintenance';
import { Modal } from '../common/Modal';
import { SCEReportControl } from './SCEReportControl';

const TOOLTIP_STYLE = {
  backgroundColor: '#111111',
  border: '1px solid rgb(255 255 255 / 0.12)',
  borderRadius: 8,
  color: '#f8fafc',
};

const MAINTENANCE_COLORS = {
  completed: '#10b981',
  deferral: '#38bdf8',
  pending: '#f59e0b',
  notRequired: '#8b5cf6',
};

export function SCEOverviewDashboard() {
  const rows = useDataStore((state) => state.sceRows);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedFactory, setSelectedFactory] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [detail, setDetail] = useState<SCERow | null>(null);

  const options = useMemo(
    () => ({
      companies: unique(rows.map((row) => row.sirket)),
      factories: unique(rows.map((row) => row.fabrika)),
      groups: unique(rows.map((row) => row.sceGrubu)),
    }),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!selectedCompany || row.sirket === selectedCompany) &&
          (!selectedFactory || row.fabrika === selectedFactory) &&
          (!selectedGroup || row.sceGrubu === selectedGroup),
      ),
    [rows, selectedCompany, selectedFactory, selectedGroup],
  );

  const summary = useMemo(
    () => buildMaintenanceSummary(filteredRows),
    [filteredRows],
  );
  const companyData = useMemo(
    () => buildCountData(filteredRows.map((row) => row.sirket)),
    [filteredRows],
  );
  const factoryData = useMemo(
    () => buildCountData(filteredRows.map((row) => row.fabrika)),
    [filteredRows],
  );
  const groupData = useMemo(
    () =>
      buildCountData(
        filteredRows.map((row) => row.sceGrubu || 'Belirtilmemiş'),
      ).slice(0, 9),
    [filteredRows],
  );
  const factoryPerformance = useMemo(
    () => buildFactoryPerformance(filteredRows),
    [filteredRows],
  );
  const calendarData = useMemo(
    () => buildMaintenanceCalendar(filteredRows),
    [filteredRows],
  );
  const criticalItems = useMemo(
    () => buildCriticalItems(filteredRows),
    [filteredRows],
  );

  const filtersActive = Boolean(
    selectedCompany || selectedFactory || selectedGroup,
  );

  function clearFilters() {
    setSelectedCompany('');
    setSelectedFactory('');
    setSelectedGroup('');
  }

  const reportFilterLabel = [
    selectedCompany ? `Şirket: ${selectedCompany}` : '',
    selectedFactory ? `Fabrika: ${selectedFactory}` : '',
    selectedGroup ? `SCE Grubu: ${selectedGroup}` : '',
  ]
    .filter(Boolean)
    .join(' · ') || 'Mevcut SCE Genel Bakış Görünümü';

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SCEReportControl
          allRows={rows}
          filteredRows={filteredRows}
          filterLabel={reportFilterLabel}
          view="overview"
        />
      </div>
      <section className="card p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="panel-title">SCE Genel Bakış Filtreleri</h2>
            <p className="panel-subtitle mt-1">
              KPI, grafik ve kritik ekipman listesi birlikte filtrelenir.
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SCESelect
            label="Şirket"
            value={selectedCompany}
            options={options.companies}
            onChange={setSelectedCompany}
          />
          <SCESelect
            label="Fabrika / Ünite"
            value={selectedFactory}
            options={options.factories}
            onChange={setSelectedFactory}
          />
          <SCESelect
            label="SCE Grubu"
            value={selectedGroup}
            options={options.groups}
            onChange={setSelectedGroup}
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Toplam SCE Ekipmanı"
          value={summary.total}
          helper="Filtrelenen ekipman"
          color="#38bdf8"
          icon={<ShieldCheck size={21} />}
        />
        <MetricCard
          title="Bakım Planı Hazır"
          value={summary.planned}
          helper={percent(summary.planned, summary.total)}
          color="#8b5cf6"
          icon={<ClipboardCheck size={21} />}
        />
        <MetricCard
          title="Bakım Planı Eksik"
          value={summary.unplanned}
          helper="Plan numarası bulunmuyor"
          color="#f97316"
          icon={<ShieldAlert size={21} />}
        />
        <MetricCard
          title="Bakımı Yapılan"
          value={summary.completed}
          helper={`${percent(summary.completed, summary.planned)} bakım uyumu`}
          color="#10b981"
          icon={<CheckCircle2 size={21} />}
        />
        <MetricCard
          title="Gecikmiş Bakım"
          value={summary.overdue}
          helper="Sonraki bakım tarihi geçmiş"
          color="#ef4444"
          icon={<CalendarClock size={21} />}
        />
        <MetricCard
          title="Deferral Başlatılmadı"
          value={summary.deferralNotStarted}
          helper="J boş · duruş gerekli · O: HAYIR"
          color="#f59e0b"
          icon={<PauseCircle size={21} />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MaintenanceDonut summary={summary} />
        <CompanyDonut data={companyData} total={filteredRows.length} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Fabrika Bazında SCE Dağılımı"
          subtitle="Ekipmanların fabrika ve ünitelere göre dağılımı"
          icon={<Factory size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={factoryData} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid stroke="rgb(255 255 255 / 0.07)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={92}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar dataKey="value" name="Ekipman" fill="#38bdf8" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="SCE Grubu Dağılımı"
          subtitle="En yoğun SCE grupları"
          icon={<Layers3 size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={groupData} margin={{ top: 8, right: 12, left: 0, bottom: 46 }}>
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
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar dataKey="value" name="Ekipman" fill="#8b5cf6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Fabrika Bakım Görünümü"
          subtitle="Tamamlanan, deferral durumu ve N sütunu değerlendirmesi"
          icon={<Wrench size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={factoryPerformance} layout="vertical" margin={{ left: 8, right: 18 }}>
              <CartesianGrid stroke="rgb(255 255 255 / 0.07)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={92}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar dataKey="completed" name="Bakımı Yapılan" stackId="maintenance" fill="#10b981" />
              <Bar dataKey="deferral" name="Deferral" stackId="maintenance" fill="#38bdf8" />
              <Bar
                dataKey="pending"
                name="Deferral Başlatılmadı"
                stackId="maintenance"
                fill="#f59e0b"
              />
              <Bar
                dataKey="notRequired"
                name="Deferral Gerektirmeyen"
                stackId="maintenance"
                fill="#8b5cf6"
                radius={[0, 5, 5, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Sonraki Bakım Takvimi"
          subtitle="Excel'de sonraki bakım tarihi bulunan ekipmanların aylık yoğunluğu"
          icon={<CalendarClock size={17} />}
        >
          {calendarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={calendarData} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="sceCalendar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgb(255 255 255 / 0.07)" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Bakım"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  fill="url(#sceCalendar)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Sonraki bakım tarihi bulunan ekipman yok." />
          )}
        </ChartCard>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-400/15 text-rose-300">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h2 className="panel-title">Kritik SCE Takip Listesi</h2>
              <p className="panel-subtitle mt-1">
                Gecikmiş bakım, deferral eksikliği veya bakım planı sorunu bulunan ekipmanlar
              </p>
            </div>
          </div>
          <span className="self-start rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold text-white/60 tabular-nums">
            {criticalItems.length} kayıt
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {criticalItems.length > 0 ? (
            criticalItems.slice(0, 12).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDetail(item.row)}
                className="rounded-lg border border-white/10 bg-white/[0.045] p-3 text-left transition hover:border-sky-400/45 hover:bg-white/[0.075]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {equipmentTitle(item.row)}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {item.row.sirket} · {item.row.fabrika}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.tone}`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/35">
                  <span className="truncate">{item.row.sceGrubu || 'SCE grubu yok'}</span>
                  <span className="shrink-0">{item.date ? formatDate(item.date) : 'Tarih yok'}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="col-span-full flex min-h-36 flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-center">
              <CheckCircle2 size={28} className="mb-2 text-emerald-400" />
              <div className="text-sm font-medium text-white/70">Kritik ekipman kaydı yok</div>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? equipmentTitle(detail) : 'SCE Ekipman Detayı'}
        widthClass="max-w-3xl"
      >
        {detail && <SCEOverviewDetail row={detail} />}
      </Modal>
    </div>
  );
}

type MaintenanceSummary = ReturnType<typeof buildMaintenanceSummary>;

function MaintenanceDonut({ summary }: { summary: MaintenanceSummary }) {
  const data = [
    {
      name: 'Bakımı Yapılan',
      value: summary.completed,
      color: MAINTENANCE_COLORS.completed,
    },
    {
      name: 'Deferral Başlatılan',
      value: summary.deferralStarted,
      color: MAINTENANCE_COLORS.deferral,
    },
    {
      name: 'Deferral Başlatılmayan',
      value: summary.deferralNotStarted,
      color: MAINTENANCE_COLORS.pending,
    },
    {
      name: 'Deferral Gerektirmeyen',
      value: summary.deferralNotRequired,
      color: MAINTENANCE_COLORS.notRequired,
    },
  ];
  const evaluatedTotal = summary.planned - summary.assessmentMissing;
  return (
    <DonutCard
      title="Periyodik Bakım Durumu"
      subtitle={`${evaluatedTotal} duruş değerlendirmesi bulunan planlı ekipman`}
      data={data}
      total={evaluatedTotal}
      centerLabel="Planlı"
      icon={<Wrench size={17} />}
    />
  );
}

function CompanyDonut({
  data,
  total,
}: {
  data: { name: string; value: number }[];
  total: number;
}) {
  const colors = ['#38bdf8', '#8b5cf6', '#14b8a6', '#f59e0b'];
  return (
    <DonutCard
      title="Şirket Dağılımı"
      subtitle="SCE ekipmanlarının şirketlere göre dağılımı"
      data={data.map((item, index) => ({
        ...item,
        color: colors[index % colors.length],
      }))}
      total={total}
      centerLabel="Ekipman"
      icon={<ShieldCheck size={17} />}
    />
  );
}

function DonutCard({
  title,
  subtitle,
  data,
  total,
  centerLabel,
  icon,
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
  icon: React.ReactNode;
}) {
  const chartData = data.filter((item) => item.value > 0);
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sky-300">{icon}</span>
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-subtitle mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="grid items-center gap-3 sm:grid-cols-[240px_1fr]">
        <div className="relative h-60 min-w-0">
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3}
                    stroke="#0d0d0d"
                    strokeWidth={3}
                  >
                    {chartData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-semibold text-white tabular-nums">{total}</div>
                  <div className="mt-1 text-[11px] font-medium text-white/40">{centerLabel}</div>
                </div>
              </div>
            </>
          ) : (
            <EmptyChart message="Bu görünüm için veri yok." />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.map((item) => (
            <div key={item.name} className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="line-clamp-2">{item.name}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-white tabular-nums">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
  value: number;
  helper: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card min-h-36">
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium leading-5 text-white/50">{title}</div>
          <div className="mt-3 text-3xl font-semibold text-white tabular-nums">
            {value.toLocaleString('tr-TR')}
          </div>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ color, backgroundColor: `${color}20` }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[11px] leading-4 text-white/35">{helper}</div>
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
        <span className="text-sky-300">{icon}</span>
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-subtitle mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="h-72 min-w-0">{children}</div>
    </section>
  );
}

function SCESelect({
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

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] px-6 text-center text-sm text-white/40">
      {message}
    </div>
  );
}

function SCEOverviewDetail({ row }: { row: SCERow }) {
  const fields = [
    ['Şirket', row.sirket],
    ['Fabrika / Ünite', row.fabrika],
    ['Fabrika Kodu', row.fabrikaKodu],
    ['Ekipman Numarası', row.ekipmanNo],
    ['Tag No', row.tagNo],
    ['Ekipman Adı', row.ekipmanAdi],
    ['Ekipman Türü', row.ekipmanTuru],
    ['SCE Grubu', row.sceGrubu],
    ['SCE Sebebi', row.sceSebebi],
    ['Bakım Planı Numarası', row.bakimPlaniNo],
    ['Bakım Kalemi Numarası', row.bakimKalemiNo],
    ['Bakım Periyodu', row.bakimPeriyodu],
    ['Duruş Gereklilik / Yapılabilirlik', row.durusGereklilikYorumu],
    ['Deferral Süreci', row.deferralSureci],
    ['Son Bakım Tarihi', row.sonBakimTarihi],
    ['Sonraki Bakım Tarihi', row.sonrakiBakimTarihi],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
          <div className="text-xs font-medium text-white/40">{label}</div>
          <div className="mt-1 whitespace-pre-wrap text-sm text-white/80">{value || '—'}</div>
        </div>
      ))}
    </div>
  );
}

function buildMaintenanceSummary(rows: SCERow[]) {
  const statuses = rows.map((row) => classifySCEMaintenance(row));
  const completed = statuses.filter((status) => status === 'completed').length;
  const deferralStarted = statuses.filter(
    (status) => status === 'deferral_started',
  ).length;
  const deferralNotStarted = statuses.filter(
    (status) => status === 'deferral_not_started',
  ).length;
  const deferralNotRequired = statuses.filter(
    (status) => status === 'deferral_not_required',
  ).length;
  const assessmentMissing = statuses.filter(
    (status) => status === 'assessment_missing',
  ).length;
  const unplanned = statuses.filter((status) => status === 'unplanned').length;
  const overdue = rows.filter(isMaintenanceOverdue).length;
  return {
    total: rows.length,
    planned: rows.length - unplanned,
    unplanned,
    completed,
    deferralStarted,
    deferralNotStarted,
    deferralNotRequired,
    assessmentMissing,
    overdue,
  };
}

function buildFactoryPerformance(rows: SCERow[]) {
  const map = new Map<
    string,
    {
      name: string;
      completed: number;
      deferral: number;
      pending: number;
      notRequired: number;
    }
  >();
  rows
    .filter((row) => hasSCEValue(row.bakimPlaniNo))
    .forEach((row) => {
      const current = map.get(row.fabrika) ?? {
        name: row.fabrika,
        completed: 0,
        deferral: 0,
        pending: 0,
        notRequired: 0,
      };
      const status = classifySCEMaintenance(row);
      if (status === 'completed') current.completed++;
      else if (status === 'deferral_started') current.deferral++;
      else if (status === 'deferral_not_started') current.pending++;
      else if (status === 'deferral_not_required') current.notRequired++;
      map.set(row.fabrika, current);
    });
  return [...map.values()].sort(
    (a, b) =>
      b.completed + b.deferral + b.pending + b.notRequired -
      (a.completed + a.deferral + a.pending + a.notRequired),
  );
}

function buildMaintenanceCalendar(rows: SCERow[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const date = parseMaintenanceDate(row.sonrakiBakimTarihi);
    if (!date) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()]
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

interface CriticalItem {
  key: string;
  row: SCERow;
  status: string;
  tone: string;
  date: Date | null;
  priority: number;
}

function buildCriticalItems(rows: SCERow[]): CriticalItem[] {
  return rows
    .map((row): CriticalItem | null => {
      const nextDate = parseMaintenanceDate(row.sonrakiBakimTarihi);
      if (isMaintenanceOverdue(row)) {
        return {
          key: `${row.rowId}-overdue`,
          row,
          status: 'Gecikmiş Bakım',
          tone: 'bg-rose-400/15 text-rose-300',
          date: nextDate,
          priority: 0,
        };
      }
      const maintenanceStatus = classifySCEMaintenance(row);
      if (maintenanceStatus === 'deferral_not_started') {
        return {
          key: `${row.rowId}-deferral`,
          row,
          status: 'Deferral Yok',
          tone: 'bg-amber-400/15 text-amber-300',
          date: nextDate,
          priority: 1,
        };
      }
      if (maintenanceStatus === 'unplanned') {
        return {
          key: `${row.rowId}-plan`,
          row,
          status: 'Plan Eksik',
          tone: 'bg-orange-400/15 text-orange-300',
          date: null,
          priority: 2,
        };
      }
      return null;
    })
    .filter((item): item is CriticalItem => item !== null)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const aDate = a.date?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDate = b.date?.getTime() ?? Number.POSITIVE_INFINITY;
      return aDate - bDate || equipmentTitle(a.row).localeCompare(equipmentTitle(b.row), 'tr');
    });
}

function isMaintenanceOverdue(row: SCERow) {
  const date = parseMaintenanceDate(row.sonrakiBakimTarihi);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function parseMaintenanceDate(value: string) {
  const date = parseDate(value);
  if (!date || date.getFullYear() < 2000 || date.getFullYear() > 2100) return null;
  return date;
}

function equipmentTitle(row: SCERow) {
  if (row.ekipmanNo && row.tagNo) return `${row.ekipmanNo} / ${row.tagNo}`;
  return row.ekipmanNo || row.tagNo || row.ekipmanAdi || 'SCE Ekipmanı';
}

function buildCountData(values: string[]) {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'tr'));
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
}

function percent(value: number, total: number) {
  return total ? `%${Math.round((value / total) * 100)}` : '%0';
}
