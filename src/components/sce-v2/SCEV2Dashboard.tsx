import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  ListFilterPlus,
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
import { SCEV2ReportControl } from './SCEV2ReportControl';

type DashboardFilter =
  | 'all'
  | SCEV2MaintenanceStatus
  | 'not_in_program'
  | 'deferral_started'
  | 'deferral_required'
  | 'deferral_overdue'
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
const FACTORY_LABELS: Record<string, string> = {
  ISKELE: 'İskele',
  ETILEN: 'Etilen',
  AROMATIKLER: 'Aromatikler',
  AYPE: 'AYPE',
  'AYPE-T': 'AYPE-T',
  YYPE: 'YYPE',
  PP: 'PP',
  PA: 'PA',
  DIGER: 'Diğer',
};
const tooltipStyle = {
  background: '#111827',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  color: '#f8fafc',
  boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
};
const tooltipItemStyle = {
  color: '#f8fafc',
  fontWeight: 600,
};
const tooltipLabelStyle = {
  color: '#f8fafc',
  fontWeight: 600,
  marginBottom: '6px',
};

export function SCEV2Dashboard({
  company,
  selectedFactories,
  selectedConsoleScopes,
  onClearScopeFilters,
}: {
  company: 'PETKIM' | 'STAR';
  selectedFactories: string[];
  selectedConsoleScopes: string[];
  onClearScopeFilters: () => void;
}) {
  const petkimRows = useDataStore((state) => state.sceV2Rows);
  const starRows = useDataStore((state) => state.sceV2StarRows);
  const petkimControlRows = useDataStore(
    (state) => state.sceV2PetkimControlRows,
  );
  const starControlRows = useDataStore(
    (state) => state.sceV2StarControlRows,
  );
  const deferralRows = useDataStore((state) => state.sceV2DeferralRows);
  const deferralFile = useDataStore((state) => state.sceV2DeferralFile);
  const [selectedEquipmentType, setSelectedEquipmentType] = useState('');
  const [filter, setFilter] = useState<DashboardFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<SCEV2DashboardRow | null>(
    null,
  );

  const allRows = useMemo(
    () =>
      buildSCEV2DashboardRows(
        company === 'STAR' ? starRows : petkimRows,
        company === 'STAR' ? starControlRows : petkimControlRows,
        deferralRows,
        Boolean(deferralFile),
      ),
    [
      company,
      deferralFile,
      deferralRows,
      petkimControlRows,
      petkimRows,
      starControlRows,
      starRows,
    ],
  );
  const scopeRows = useMemo(
    () =>
      allRows.filter(
        (row) =>
          (selectedConsoleScopes.length === 0 ||
            selectedConsoleScopes.includes(row.consoleName)) &&
          (selectedFactories.length === 0 ||
            selectedFactories.includes(row.factory)),
      ),
    [allRows, selectedConsoleScopes, selectedFactories],
  );
  const rows = useMemo(
    () =>
      scopeRows.filter(
        (row) =>
          (!selectedEquipmentType ||
            row.equipmentType === selectedEquipmentType),
      ),
    [scopeRows, selectedEquipmentType],
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
    {
      name: 'Sipariş Kaydı Yok',
      value: metrics.orderNotFound,
      color: '#64748b',
      filter: 'order_not_found',
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
    ...(metrics.deferralOverdue > 0
      ? [
          {
            name: 'Overdue',
            value: metrics.deferralOverdue,
            color: '#f97316',
            filter: 'deferral_overdue' as const,
          },
        ]
      : []),
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
  const equipmentTypeChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of scopeRows.filter((item) => matchesFilter(item, filter))) {
      const name = row.equipmentType || 'Ekipman tipi bulunamadı';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'tr'));
  }, [filter, scopeRows]);
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
            row.revision,
            row.userStatus,
            row.maintenancePlanNo,
            row.maintenanceItemNo,
            row.shutdownRequirement,
            row.shutdownExplanation,
            row.unit,
            row.consoleName,
            row.categoryType,
            row.equipmentType,
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
  const reportScopeLabel = buildReportScopeLabel(
    company,
    selectedConsoleScopes,
    selectedFactories,
  );
  const activeExcelFilterLabel = [
    reportScopeLabel,
    filterLabel(filter),
    selectedEquipmentType ? `Ekipman tipi: ${selectedEquipmentType}` : '',
    search ? `Arama: ${search}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  function selectDashboardFilter(nextFilter: DashboardFilter) {
    const resolvedFilter =
      nextFilter !== 'all' && filter === nextFilter ? 'all' : nextFilter;
    setFilter(resolvedFilter);
    setSelectedEquipmentType('');
    setSearch('');
    setPage(1);
  }

  function clearAllFilters() {
    setFilter('all');
    setSelectedEquipmentType('');
    setSearch('');
    setPage(1);
    onClearScopeFilters();
  }

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
                  {company === 'STAR' ? 'Star' : 'Petkim'} SCE Periyodik
                  Bakım Takibi
                </h2>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
            <SCEV2ReportControl
              rows={scopeRows}
              excelRows={filteredRows}
              company={company}
              scopeLabel={reportScopeLabel}
              activeFilterLabel={activeExcelFilterLabel}
            />
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
            >
              <ListFilterPlus size={16} />
              Filtreleri Temizle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-3 xl:grid-cols-6">
          <MetricButton
            label="Toplam Ekipman"
            value={rows.length}
            note={
              company === 'STAR'
                ? `${metrics.orderNotFound} sipariş kaydı yok`
                : 'Tekilleştirilmiş kayıt'
            }
            color="slate"
            active={filter === 'all'}
            onClick={() => selectDashboardFilter('all')}
          />
          <MetricButton
            label="Bakımı Tamamlanan"
            value={metrics.completed}
            note="KPLI veya SHTM"
            color="emerald"
            active={filter === 'completed'}
            onClick={() => selectDashboardFilter('completed')}
          />
          <MetricButton
            label="Duruşa Ertelenen"
            value={metrics.shutdownDeferred}
            note="BEK içeren durum"
            color="amber"
            active={filter === 'shutdown_deferred'}
            onClick={() => selectDashboardFilter('shutdown_deferred')}
          />
          <MetricButton
            label="Bakımı Yapılmadı"
            value={metrics.notCompleted}
            note="Diğer SAP durumları"
            color="rose"
            active={filter === 'maintenance_not_completed'}
            onClick={() => selectDashboardFilter('maintenance_not_completed')}
          />
          <MetricButton
            label="Deferral Başlatıldı"
            value={metrics.deferralStarted}
            note="Deferral PM eşleşti"
            color="sky"
            active={filter === 'deferral_started'}
            onClick={() => selectDashboardFilter('deferral_started')}
          />
          <MetricButton
            label="Deferral Başlatılmalı"
            value={metrics.deferralRequired}
            note="Başlatma aksiyonu bekliyor"
            color="red"
            active={filter === 'deferral_required'}
            onClick={() => selectDashboardFilter('deferral_required')}
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
                      onClick={() => selectDashboardFilter(item.filter)}
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
            onSelect={selectDashboardFilter}
          />
          {company === 'PETKIM' && (
            <button
              type="button"
              aria-pressed={filter === 'not_in_program'}
              onClick={() => selectDashboardFilter('not_in_program')}
              className={`mt-3 w-full rounded-xl border px-3 py-2.5 text-left transition ${
                filter === 'not_in_program'
                  ? 'border-violet-400/45 bg-violet-500/15 ring-1 ring-violet-400/20'
                  : 'border-white/[0.08] bg-white/[0.025] hover:border-violet-400/25 hover:bg-violet-500/[0.06]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
                <span className="text-xs font-medium text-white/70">
                  Programa Girmeyenler
                </span>
                <span className="ml-auto text-sm font-semibold text-violet-200">
                  {metrics.notInProgram}
                </span>
              </div>
              <div className="mt-1 pl-[18px] text-[11px] text-white/35">
                Sipariş kaydı yok · Revizyon alanı boş
              </div>
            </button>
          )}
        </ModernChartCard>

        <ModernChartCard
          title="Deferral Aksiyonları"
          subtitle="Ortak Deferral PM Excel'indeki başlatma ve overdue durumu"
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
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                />
                <Bar
                  dataKey="value"
                  name="Adet"
                  barSize={25}
                  radius={[0, 8, 8, 0]}
                >
                  {deferralChartData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={item.color}
                      className="cursor-pointer"
                      onClick={() => selectDashboardFilter(item.filter)}
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
            onSelect={selectDashboardFilter}
          />
        </ModernChartCard>

        <ModernChartCard
          title="Kalibrasyon Raporları"
          subtitle={`Tamamlanan bakımların ${
            company === 'STAR' ? 'Star' : 'Petkim'
          } kontrol Excel'indeki durumu`}
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
                      onClick={() => selectDashboardFilter(item.filter)}
                    />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
            <ChartCenterLabel
              value={`%${percent(
                metrics.calibrationShared + metrics.calibrationNotShared,
                metrics.calibrationApplicable,
              )}`}
              label="Kontrol Edilen"
            />
          </div>
          <ChartLegend
            data={calibrationChartData}
            total={metrics.calibrationApplicable}
            activeFilter={filter}
            onSelect={selectDashboardFilter}
          />
        </ModernChartCard>
      </section>

      {filter !== 'all' && (
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  Ekipman Tipi Dağılımı
                </h3>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${
                    company === 'STAR'
                      ? 'bg-red-500/10 text-red-300 ring-red-400/20'
                      : 'bg-sky-500/10 text-sky-300 ring-sky-400/20'
                  }`}
                >
                  {filterLabel(filter)}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/45">
                Bar seçerek ekipman listesini ilgili ekipman tipine daraltın.
              </p>
            </div>
            {selectedEquipmentType && (
              <button
                type="button"
                onClick={() => {
                  setSelectedEquipmentType('');
                  setPage(1);
                }}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/55 transition hover:bg-white/10 hover:text-white"
              >
                Ekipman Tipi Filtresini Temizle
              </button>
            )}
          </div>

          {equipmentTypeChartData.length > 0 ? (
            <div className="max-h-[620px] overflow-y-auto p-4 sm:p-5">
              <div
                style={{ height: Math.max(280, equipmentTypeChartData.length * 42) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={equipmentTypeChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 36, bottom: 4, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={270}
                      tick={{ fill: '#cbd5e1', fontSize: 11 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Bar
                      dataKey="value"
                      name="Adet"
                      barSize={23}
                      radius={[0, 7, 7, 0]}
                    >
                      {equipmentTypeChartData.map((item) => (
                        <Cell
                          key={item.name}
                          fill={
                            selectedEquipmentType === item.name
                              ? company === 'STAR'
                                ? '#f43f5e'
                                : '#38bdf8'
                              : company === 'STAR'
                                ? '#ef4444'
                                : '#0ea5e9'
                          }
                          fillOpacity={
                            selectedEquipmentType &&
                            selectedEquipmentType !== item.name
                              ? 0.28
                              : 0.88
                          }
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedEquipmentType((current) =>
                              current === item.name ? '' : item.name,
                            );
                            setPage(1);
                          }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-white/45">
              Bu durum için ekipman tipi kaydı bulunamadı.
            </div>
          )}
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">
                Ekipman Takip Listesi
              </h3>
              <p className="mt-1 text-xs text-white/50">
                {filterLabel(filter)}
                {selectedEquipmentType ? ` · ${selectedEquipmentType}` : ''} ·{' '}
                {filteredRows.length} kayıt
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
                  placeholder="Ekipman, tag, sipariş, plan veya revizyon ara..."
                  className="input pl-9"
                />
              </label>
              {(filter !== 'all' || selectedEquipmentType || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSelectedEquipmentType('');
                    setSearch('');
                    setPage(1);
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
                {company === 'STAR' && (
                  <th className="px-4 py-3 font-medium">Ünite / Konsol</th>
                )}
                <th className="px-4 py-3 font-medium">Ekipman Tipi</th>
                <th className="px-4 py-3 font-medium">Sipariş</th>
                <th className="px-4 py-3 font-medium">Kullanıcı Durumu</th>
                <th className="px-4 py-3 font-medium">Bakım Durumu</th>
                {company === 'PETKIM' && (
                  <th className="px-4 py-3 font-medium">Duruş Bilgisi</th>
                )}
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
                  {company === 'STAR' && (
                    <td className="px-4 py-3">
                      <div className="font-medium text-white/75">{row.unit}</div>
                      <div className="mt-0.5 text-xs text-red-300/70">
                        {row.consoleName || 'Konsol bilgisi yok'}
                      </div>
                    </td>
                  )}
                  <td className="max-w-64 px-4 py-3 text-xs text-white/60">
                    {row.equipmentType || '—'}
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
                  {company === 'PETKIM' && (
                    <td className="max-w-72 px-4 py-3">
                      <ShutdownRequirementBadge value={row.shutdownRequirement} />
                      {row.shutdownExplanation && (
                        <div
                          className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/40"
                          title={row.shutdownExplanation}
                        >
                          {row.shutdownExplanation}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <DeferralBadge status={row.deferralStatus} />
                    {row.deferralIsOverdue && (
                      <div className="mt-1 text-[11px] font-medium text-orange-300">
                        Overdue · {formatDate(row.deferralOverdueDate)}
                      </div>
                    )}
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

export function SCEV2ScopeSelector({
  selectedCompany,
  onCompanyChange,
  factoryOptions,
  factoryGroups,
  selectedGroups,
  onGroupToggle,
  onAllGroups,
  selectedFactories,
  onFactoryToggle,
  onAllFactories,
}: {
  selectedCompany: 'PETKIM' | 'STAR';
  onCompanyChange: (company: 'PETKIM' | 'STAR') => void;
  factoryOptions: string[];
  factoryGroups?: Array<{ name: string; options: string[] }>;
  selectedGroups: string[];
  onGroupToggle: (group: string) => void;
  onAllGroups: () => void;
  selectedFactories: string[];
  onFactoryToggle: (factory: string) => void;
  onAllFactories: () => void;
}) {
  const hasScopeOptions =
    selectedCompany === 'STAR'
      ? Boolean(factoryGroups?.length)
      : factoryOptions.length > 0;
  const selectedGroupOptions =
    factoryGroups?.filter((group) => selectedGroups.includes(group.name)) ?? [];

  return (
    <section className="card overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-white/10">
        <button
          type="button"
          aria-pressed={selectedCompany === 'PETKIM'}
          onClick={() => onCompanyChange('PETKIM')}
          className={`relative min-h-24 p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-400/40 ${
            selectedCompany === 'PETKIM'
              ? 'bg-sky-500/10'
              : 'bg-[#0d0d0d] hover:bg-white/[0.04]'
          }`}
        >
          <span
            className={`absolute inset-y-0 left-0 w-1 ${
              selectedCompany === 'PETKIM' ? 'bg-sky-400' : 'bg-transparent'
            }`}
          />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Şirket
          </span>
          <span className="mt-1 block text-2xl font-semibold text-white">
            Petkim
          </span>
        </button>
        <button
          type="button"
          aria-pressed={selectedCompany === 'STAR'}
          onClick={() => onCompanyChange('STAR')}
          className={`relative min-h-24 p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-400/40 ${
            selectedCompany === 'STAR'
              ? 'bg-red-500/10'
              : 'bg-[#0d0d0d] hover:bg-white/[0.04]'
          }`}
        >
          <span
            className={`absolute inset-y-0 left-0 w-1 ${
              selectedCompany === 'STAR' ? 'bg-red-500' : 'bg-transparent'
            }`}
          />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
            Şirket
          </span>
          <span className="mt-1 block text-2xl font-semibold text-white">
            Star
          </span>
        </button>
      </div>

      {hasScopeOptions && (
        <div className="border-t border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                {selectedCompany === 'PETKIM'
                  ? 'Petkim Fabrikaları'
                  : 'Star Konsolları'}
              </h3>
              <p className="mt-0.5 text-xs text-white/40">
                {selectedCompany === 'PETKIM'
                  ? 'Bir veya birden fazla fabrika seçebilirsiniz.'
                  : 'Konsola tıklayın; bağlı U-xxx üniteleri altında açılsın.'}
              </p>
            </div>
            <span
              className={`hidden rounded-md px-2 py-1 text-xs sm:inline ${
                selectedCompany === 'PETKIM'
                  ? 'bg-sky-500/10 text-sky-300'
                  : 'bg-red-500/10 text-red-300'
              }`}
            >
              {selectedFactories.length === 0
                ? selectedCompany === 'PETKIM'
                  ? 'Tüm fabrikalar'
                  : selectedGroups.length === 0
                    ? 'Tüm konsollar'
                    : `${selectedGroups.length} konsol seçili`
                : `${selectedFactories.length} ${
                    selectedCompany === 'PETKIM' ? 'fabrika' : 'ünite'
                  } seçili`}
            </span>
          </div>
          {selectedCompany === 'STAR' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={selectedGroups.length === 0}
                  onClick={onAllGroups}
                  className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                    selectedGroups.length === 0
                      ? 'border-red-400/60 bg-red-500 text-white shadow-lg shadow-red-950/30'
                      : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-red-400/30 hover:text-white'
                  }`}
                >
                  Tüm Konsollar
                </button>
                {factoryGroups?.map((group) => {
                  const active = selectedGroups.includes(group.name);
                  return (
                    <button
                      key={group.name}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onGroupToggle(group.name)}
                      className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                        active
                          ? 'border-red-400/60 bg-red-500/20 text-red-100 ring-1 ring-red-400/20'
                          : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-red-400/30 hover:text-white'
                      }`}
                    >
                      {group.name}
                    </button>
                  );
                })}
              </div>

              {selectedGroupOptions.length > 0 && (
                <div className="space-y-3 rounded-xl border border-red-400/15 bg-red-500/[0.04] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300/80">
                      Seçili Konsolların Üniteleri
                    </div>
                    <button
                      type="button"
                      aria-pressed={selectedFactories.length === 0}
                      onClick={onAllFactories}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        selectedFactories.length === 0
                          ? 'border-red-400/60 bg-red-500 text-white'
                          : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-red-400/30 hover:text-white'
                      }`}
                    >
                      Tüm Üniteler
                    </button>
                  </div>
                  {selectedGroupOptions.map((group) => (
                    <div
                      key={group.name}
                      className="grid gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-[110px_1fr] sm:items-start"
                    >
                      <div className="pt-2 text-xs font-semibold text-red-200/70">
                        {group.name}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((unit) => {
                          const active = selectedFactories.includes(unit);
                          return (
                            <button
                              key={unit}
                              type="button"
                              aria-pressed={active}
                              onClick={() => onFactoryToggle(unit)}
                              className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                                active
                                  ? 'border-red-400/60 bg-red-500/20 text-red-100 ring-1 ring-red-400/20'
                                  : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-red-400/30 hover:text-white'
                              }`}
                            >
                              {unit}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={selectedFactories.length === 0}
                onClick={onAllFactories}
                className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                  selectedFactories.length === 0
                    ? 'border-sky-400/60 bg-sky-500 text-white shadow-lg shadow-sky-950/30'
                    : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-sky-400/30 hover:text-white'
                }`}
              >
                Tümü
              </button>
              {factoryOptions.map((factory) => {
                const active = selectedFactories.includes(factory);
                return (
                  <button
                    key={factory}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onFactoryToggle(factory)}
                    className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-sky-400/60 bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/20'
                        : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-sky-400/30 hover:text-white'
                    }`}
                  >
                    {FACTORY_LABELS[factory] ?? factory}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
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
  return (
    <Tooltip
      contentStyle={tooltipStyle}
      itemStyle={tooltipItemStyle}
      labelStyle={tooltipLabelStyle}
    />
  );
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
    order_not_found: {
      label: 'Sipariş Kaydı Yok',
      className: 'bg-slate-500/15 text-slate-300',
    },
  }[status];
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function ShutdownRequirementBadge({ value }: { value: string }) {
  const clean = normalize(value).replace(/[.!?]+$/g, '').trim();
  const className =
    clean === 'durus gerekli' || clean === 'durus gerekir'
      ? 'bg-red-500/15 text-red-300'
      : clean === 'durus gerekli degil' || clean === 'durus gerekli degildir'
        ? 'bg-emerald-500/15 text-emerald-300'
        : clean === 'durusta yapilabilir' || clean === 'durusta yapilacak'
          ? 'bg-amber-500/15 text-amber-300'
          : clean === 'yapilabilir'
            ? 'bg-sky-500/15 text-sky-300'
            : 'bg-white/[0.05] text-white/35';

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${className}`}>
      {value || 'Bilgi Yok'}
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
    not_applicable: {
      label: 'Uygulanmaz',
      className: 'bg-white/[0.03] text-white/25',
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
            {row.company === 'STAR' && (
              <>
                <DetailItem label="Ünite" value={row.unit} />
                <DetailItem label="Konsol" value={row.consoleName} />
              </>
            )}
            <DetailItem label="Ekipman Tipi" value={row.equipmentType} />
            <DetailItem label="Bakım Planı" value={row.maintenancePlanNo} />
            <DetailItem label="Bakım Kalemi" value={row.maintenanceItemNo} />
            <DetailItem label="Sipariş Numarası" value={row.orderNo} />
            <DetailItem label="Bildirim Numarası" value={row.notificationNo} />
            {row.company === 'PETKIM' && (
              <DetailItem
                label="Revizyon / Program Haftası"
                value={formatRevision(row.revision)}
              />
            )}
            <DetailItem label="Bakım Periyodu" value={row.maintenancePeriod} />
            <DetailItem label="SAP Kullanıcı Durumu" value={row.userStatus} />
            {row.company === 'PETKIM' && (
              <>
                <DetailItem
                  label="Duruş Gereklilik / Yapılabilirlik"
                  value={row.shutdownRequirement}
                />
                <DetailItem
                  label="Duruş Açıklaması"
                  value={row.shutdownExplanation}
                />
              </>
            )}
            {row.maintenanceStatus === 'shutdown_deferred' && (
              <DetailItem
                label="Deferral Overdue Date"
                value={formatDate(row.deferralOverdueDate)}
              />
            )}
            <DetailItem
              label="Bakım Başlangıç Tarihi"
              value={formatDate(row.maintenanceStartDate)}
            />
            <DetailItem
              label="Son Bakım Yapıldığı Tarih"
              value={formatDate(row.maintenanceEndDate)}
            />
            {row.company === 'STAR' && (
              <>
                <DetailItem
                  label="Planlanan Bitiş Termini"
                  value={formatDate(row.plannedCompletionDate)}
                />
                <DetailItem
                  label="Kalibrasyon PDF Sayısı"
                  value={String(row.calibrationPdfCount)}
                />
                <DetailItem
                  label="Toplam Doküman Sayısı"
                  value={String(row.calibrationDocumentCount)}
                />
                <DetailItem
                  label="Rapor Klasörü"
                  value={row.calibrationReportFolder}
                />
                <DetailItem
                  label="Örnek PDF"
                  value={row.calibrationReportFile}
                />
              </>
            )}
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
                {row.company === 'STAR' ? 'Star' : 'Petkim'} Kontrol Kaydı
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
      <div className="mt-1 break-all text-sm font-medium text-white/80">
        {value || '—'}
      </div>
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
    orderNotFound: rows.filter(
      (row) => row.maintenanceStatus === 'order_not_found',
    ).length,
    notInProgram: rows.filter(isNotInProgram).length,
    deferralStarted: rows.filter((row) => row.deferralStatus === 'started').length,
    deferralRequired: rows.filter(
      (row) => row.deferralStatus === 'required',
    ).length,
    deferralOverdue: rows.filter((row) => row.deferralIsOverdue).length,
    calibrationShared: rows.filter(
      (row) => row.calibrationStatus === 'shared',
    ).length,
    calibrationNotShared: rows.filter(
      (row) => row.calibrationStatus === 'not_shared',
    ).length,
    calibrationUnknown: rows.filter(
      (row) => row.calibrationStatus === 'unknown',
    ).length,
    calibrationApplicable: rows.filter(
      (row) => row.calibrationStatus !== 'not_applicable',
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
    filter === 'maintenance_not_completed' ||
    filter === 'order_not_found'
  ) {
    return row.maintenanceStatus === filter;
  }
  if (filter === 'not_in_program') return isNotInProgram(row);
  if (filter === 'deferral_started') return row.deferralStatus === 'started';
  if (filter === 'deferral_required') return row.deferralStatus === 'required';
  if (filter === 'deferral_overdue') return row.deferralIsOverdue;
  if (filter === 'calibration_shared') return row.calibrationStatus === 'shared';
  if (filter === 'calibration_not_shared') {
    return row.calibrationStatus === 'not_shared';
  }
  return row.calibrationStatus === 'unknown';
}

function compareRows(a: SCEV2DashboardRow, b: SCEV2DashboardRow) {
  const priority = (row: SCEV2DashboardRow) => {
    if (row.deferralIsOverdue) return 0;
    if (row.deferralStatus === 'required') return 1;
    if (row.maintenanceStatus === 'maintenance_not_completed') return 2;
    if (row.maintenanceStatus === 'order_not_found') return 3;
    if (row.calibrationStatus === 'not_shared') return 4;
    if (row.maintenanceStatus === 'shutdown_deferred') return 5;
    return 6;
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
    order_not_found: 'Sipariş kaydı bulunmayanlar',
    not_in_program: 'Programa girmeyenler',
    deferral_started: 'Deferral başlatılanlar',
    deferral_required: 'Deferral başlatılması gerekenler',
    deferral_overdue: 'Deferral overdue olanlar',
    calibration_shared: 'Kalibrasyon raporu paylaşılanlar',
    calibration_not_shared: 'Kalibrasyon raporu paylaşılmayanlar',
    calibration_unknown: 'Kalibrasyon raporu bilgisi beklenenler',
  };
  return labels[filter];
}

function isNotInProgram(row: SCEV2DashboardRow) {
  return row.maintenanceStatus === 'order_not_found' && !row.revision.trim();
}

function formatRevision(value: string) {
  const clean = value.trim();
  if (!clean) return 'Programa alınmadı';
  const match = clean.match(/^W(\d{4})(\d{2})$/i);
  if (!match) return clean;
  return `${clean} · ${match[1]} / ${Number(match[2])}. hafta`;
}

function maintenanceLabel(status: SCEV2MaintenanceStatus) {
  return {
    completed: 'Bakımı Tamamlandı',
    shutdown_deferred: 'Duruşa Ertelendi',
    maintenance_not_completed: 'Bakımı Yapılmadı',
    order_not_found: 'Sipariş Kaydı Yok',
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
    not_applicable: 'Uygulanmaz',
  }[status];
}

function buildReportScopeLabel(
  company: 'PETKIM' | 'STAR',
  selectedConsoleScopes: string[],
  selectedFactories: string[],
) {
  if (company === 'STAR') {
    const consoles =
      selectedConsoleScopes.length > 0
        ? selectedConsoleScopes.join(', ')
        : 'Tüm Konsollar';
    const units =
      selectedFactories.length > 0
        ? ` · ${selectedFactories.join(', ')}`
        : '';
    return `Star · ${consoles}${units}`;
  }

  const factories =
    selectedFactories.length > 0
      ? selectedFactories
          .map((factory) => FACTORY_LABELS[factory] ?? factory)
          .join(', ')
      : 'Tüm Fabrikalar';
  return `Petkim · ${factories}`;
}
