import { useMemo, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  CalendarClock,
  ClipboardList,
  Factory,
  Layers3,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import type {
  SCECategory,
  SCECompany,
  SCEFactory,
  SCERow,
} from '../../types';
import {
  SCE_COMPANIES,
  SCE_FACTORIES,
  SCE_FACTORY_CODES,
} from '../../lib/sceParser';
import {
  classifySCEShutdownRequirement,
  classifySCEMaintenance,
  hasSCEValue,
} from '../../lib/sceMaintenance';
import {
  DataTable,
  type DataTableColumn,
} from '../common/DataTable';
import { Modal } from '../common/Modal';
import { SCEReportControl } from './SCEReportControl';

const CATEGORY_CONFIG: {
  key: SCECategory;
  title: string;
  subtitle: string;
  color: string;
  icon: typeof ShieldCheck;
}[] = [
  {
    key: 'all',
    title: 'Tüm SCE Ekipmanları',
    subtitle: 'Excelde bulunan tüm SCE ekipmanları',
    color: '#38bdf8',
    icon: ShieldCheck,
  },
  {
    key: 'plans',
    title: 'Bakım Planları Hazır',
    subtitle: 'H sütununda bakım planı numarası bulunan ekipmanlar',
    color: '#8b5cf6',
    icon: ClipboardList,
  },
  {
    key: 'periodic',
    title: 'Periyodik Bakım Durumları',
    subtitle: 'Bakım periyodu ve son bakım bilgileri bulunan ekipmanlar',
    color: '#f59e0b',
    icon: CalendarClock,
  },
];

const PERIODIC_MAINTENANCE_COLORS = {
  'Periyodik Bakımı Yapılan': '#10b981',
  'Deferral Süreci Başlatılan': '#38bdf8',
  'Deferral Süreci Başlatılmayan': '#f59e0b',
  'Deferral Gerektirmeyen': '#8b5cf6',
} as const;

type ShutdownRequirement = 'required' | 'not_required' | 'force';

const SHUTDOWN_REQUIREMENT_CONFIG: {
  key: ShutdownRequirement;
  name: string;
  normalizedValue: string;
  color: string;
}[] = [
  {
    key: 'required',
    name: 'Duruş Gereklidir',
    normalizedValue: 'durus gereklidir',
    color: '#f97316',
  },
  {
    key: 'not_required',
    name: 'Duruş Gerekli Değildir',
    normalizedValue: 'durus gerekli degildir',
    color: '#10b981',
  },
  {
    key: 'force',
    name: 'Force ile Yapılabilir',
    normalizedValue: 'force ile yapilabilir',
    color: '#8b5cf6',
  },
];

export function SCEDashboard() {
  const rows = useDataStore((state) => state.sceRows);
  const [selectedCompany, setSelectedCompany] = useState<SCECompany | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<SCECategory>('all');
  const [selectedFactory, setSelectedFactory] =
    useState<SCEFactory | null>(null);
  const [selectedShutdownRequirement, setSelectedShutdownRequirement] =
    useState<ShutdownRequirement | null>(null);
  const [detail, setDetail] = useState<SCERow | null>(null);

  const companyRows = useMemo(
    () =>
      selectedCompany
        ? rows.filter((row) => row.sirket === selectedCompany)
        : rows,
    [rows, selectedCompany],
  );

  const categoryCounts = useMemo(
    () =>
      CATEGORY_CONFIG.reduce<Record<SCECategory, number>>(
        (counts, category) => {
          counts[category.key] = filterByCategory(
            companyRows,
            category.key,
          ).length;
          return counts;
        },
        { all: 0, plans: 0, periodic: 0 },
      ),
    [companyRows],
  );

  const categoryRows = useMemo(
    () => filterByCategory(companyRows, selectedCategory),
    [companyRows, selectedCategory],
  );

  const factoryCounts = useMemo(() => {
    const counts = new Map<SCEFactory, number>();
    SCE_FACTORIES.forEach((factory) => counts.set(factory, 0));
    categoryRows.forEach((row) =>
      counts.set(row.fabrika, (counts.get(row.fabrika) ?? 0) + 1),
    );
    return counts;
  }, [categoryRows]);

  const baseVisibleRows = useMemo(
    () =>
      selectedFactory
        ? categoryRows.filter((row) => row.fabrika === selectedFactory)
        : categoryRows,
    [categoryRows, selectedFactory],
  );

  const visibleRows = useMemo(
    () =>
      selectedShutdownRequirement
        ? baseVisibleRows.filter((row) =>
            matchesShutdownRequirement(row, selectedShutdownRequirement),
          )
        : baseVisibleRows,
    [baseVisibleRows, selectedShutdownRequirement],
  );

  const companyCounts = useMemo(() => {
    const counts = new Map<SCECompany, number>();
    SCE_COMPANIES.forEach((company) => counts.set(company, 0));
    rows.forEach((row) =>
      counts.set(row.sirket, (counts.get(row.sirket) ?? 0) + 1),
    );
    return counts;
  }, [rows]);

  function selectCompany(company: SCECompany | null) {
    setSelectedCompany(company);
    setSelectedFactory(null);
  }

  function selectCategory(category: SCECategory) {
    setSelectedCategory(category);
    setSelectedFactory(null);
    setSelectedShutdownRequirement(null);
  }

  const columns = useMemo(
    () => columnsForCategory(selectedCategory),
    [selectedCategory],
  );

  const periodicMaintenanceSummary = useMemo(
    () => buildPeriodicMaintenanceSummary(visibleRows),
    [visibleRows],
  );
  const shutdownRequirementSummary = useMemo(
    () => buildShutdownRequirementSummary(baseVisibleRows),
    [baseVisibleRows],
  );
  const reportFilterLabel = [
    selectedCompany ? `Şirket: ${selectedCompany}` : '',
    selectedCategory !== 'all'
      ? `Kategori: ${CATEGORY_CONFIG.find((item) => item.key === selectedCategory)?.title}`
      : '',
    selectedFactory ? `Fabrika: ${selectedFactory}` : '',
    selectedShutdownRequirement
      ? `Duruş: ${SHUTDOWN_REQUIREMENT_CONFIG.find((item) => item.key === selectedShutdownRequirement)?.name}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ') || 'Mevcut SCE Takip Görünümü';

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SCEReportControl
          allRows={rows}
          filteredRows={visibleRows}
          filterLabel={reportFilterLabel}
          view="tracking"
        />
      </div>
      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers3 size={17} className="text-sky-400" />
          <h2 className="panel-title">Şirketler</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <FilterTile
            label="Tüm Şirketler"
            value={rows.length}
            active={selectedCompany === null}
            onClick={() => selectCompany(null)}
          />
          {SCE_COMPANIES.map((company) => (
            <FilterTile
              key={company}
              label={company}
              value={companyCounts.get(company) ?? 0}
              active={selectedCompany === company}
              onClick={() =>
                selectCompany(selectedCompany === company ? null : company)
              }
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {CATEGORY_CONFIG.map((category) => {
          const Icon = category.icon;
          const active = selectedCategory === category.key;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => selectCategory(category.key)}
              aria-pressed={active}
              className={`metric-card min-h-40 text-left ${
                active ? 'ring-2 ring-sky-400/50' : ''
              }`}
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: category.color }}
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white/55">
                    {category.title}
                  </span>
                  <strong className="mt-4 block text-4xl font-semibold text-white tabular-nums">
                    {categoryCounts[category.key]}
                  </strong>
                </div>
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${category.color}22`,
                    color: category.color,
                  }}
                >
                  <Icon size={22} />
                </span>
              </div>
              <span className="mt-3 block text-xs leading-5 text-white/40">
                {category.subtitle}
              </span>
            </button>
          );
        })}
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Factory size={17} className="text-sky-400" />
          <div>
            <h2 className="panel-title">Fabrikalar</h2>
            <p className="panel-subtitle">
              A sütunundaki fabrika kodlarına göre ayrıştırılır.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <FilterTile
            label="Tüm Fabrikalar"
            value={categoryRows.length}
            active={selectedFactory === null}
            onClick={() => setSelectedFactory(null)}
          />
          {SCE_FACTORIES.map((factory) => (
            <FilterTile
              key={factory}
              label={factory}
              helper={factoryCode(factory)}
              value={factoryCounts.get(factory) ?? 0}
              active={selectedFactory === factory}
              onClick={() =>
                setSelectedFactory(
                  selectedFactory === factory ? null : factory,
                )
              }
            />
          ))}
        </div>
      </section>

      {selectedCategory === 'periodic' && (
        <div className="space-y-4">
          <PeriodicMaintenanceDonut summary={periodicMaintenanceSummary} />
          <ShutdownRequirementDonut
            summary={shutdownRequirementSummary}
            selected={selectedShutdownRequirement}
            onSelect={(requirement) =>
              setSelectedShutdownRequirement((current) =>
                current === requirement ? null : requirement,
              )
            }
          />
        </div>
      )}

      <section className="card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              {CATEGORY_CONFIG.find(
                (category) => category.key === selectedCategory,
              )?.title}
            </h2>
            <p className="mt-1 text-xs text-white/45">
              {selectedCompany ?? 'Tüm Şirketler'} ·{' '}
              {selectedFactory ?? 'Tüm Fabrikalar'} · {visibleRows.length} kayıt
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/60">
            <Wrench size={15} />
            Satıra tıklayarak tüm Excel alanlarını görüntüleyin
          </div>
        </div>

        <DataTable
          data={visibleRows}
          columns={columns}
          rowKey={(row) => row.rowId}
          initialSortKey="factory"
          emptyMessage="Seçili filtrelerde SCE ekipmanı bulunamadı."
          onRowClick={setDetail}
        />
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? sceDetailTitle(detail) : 'SCE Ekipman Detayı'}
        widthClass="max-w-3xl"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {detail &&
            sceDetailFields(detail).map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-white/10 bg-white/[0.05] p-3"
              >
                <div className="text-xs font-medium text-white/45">
                  {label}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">
                  {value || '—'}
                </div>
              </div>
            ))}
        </div>
      </Modal>
    </div>
  );
}

type PeriodicMaintenanceSummary = ReturnType<
  typeof buildPeriodicMaintenanceSummary
>;

function PeriodicMaintenanceDonut({
  summary,
}: {
  summary: PeriodicMaintenanceSummary;
}) {
  const completedPercent = summary.total
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="panel-title">Periyodik Bakım Dağılımı</h2>
          <p className="panel-subtitle mt-1">
            H bakım planını, J/K tarihleri tamamlanmayı; O ve Q sütunları deferral durumunu belirler.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-right">
          <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">
            Tamamlanma
          </div>
          <div className="text-2xl font-semibold text-white tabular-nums">
            %{completedPercent}
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,380px)_1fr]">
        <div className="relative h-72 min-h-72 min-w-0">
          {summary.total > 0 ? (
            <>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
              >
                <PieChart>
                  <Pie
                    data={summary.chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={3}
                    stroke="#0d0d0d"
                    strokeWidth={3}
                  >
                    {summary.chartData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      border: '1px solid rgb(255 255 255 / 0.12)',
                      borderRadius: 8,
                      color: '#f8fafc',
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-semibold text-white tabular-nums">
                    {summary.total}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/40">
                    Ekipman
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm text-white/45">
              Seçili filtrelerde bakım planı hazır ekipman bulunamadı.
            </div>
          )}
        </div>

        <div className="grid content-center gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summary.items.map((item) => {
            const percent = summary.total
              ? Math.round((item.value / summary.total) * 100)
              : 0;

            return (
              <div
                key={item.name}
                className="rounded-lg border border-white/10 bg-white/[0.05] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium text-white/60">
                        {item.name}
                      </span>
                    </div>
                    <div className="mt-4 text-3xl font-semibold text-white tabular-nums">
                      {item.value}
                    </div>
                  </div>
                  <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold text-white/60 tabular-nums">
                    %{percent}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type ShutdownRequirementSummary = ReturnType<
  typeof buildShutdownRequirementSummary
>;

function ShutdownRequirementDonut({
  summary,
  selected,
  onSelect,
}: {
  summary: ShutdownRequirementSummary;
  selected: ShutdownRequirement | null;
  onSelect: (requirement: ShutdownRequirement) => void;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="panel-title">Duruş Gerekliliği ve Yapılabilirlik</h2>
          <p className="panel-subtitle mt-1">
            N sütunundaki üç değerlendirme; dilime veya karta tıklayarak tabloyu filtreleyin.
          </p>
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(selected)}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            Filtreyi Temizle
          </button>
        )}
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,380px)_1fr]">
        <div className="relative h-72 min-h-72 min-w-0">
          {summary.total > 0 ? (
            <>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
              >
                <PieChart>
                  <Pie
                    data={summary.chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={3}
                    stroke="#0d0d0d"
                    strokeWidth={3}
                  >
                    {summary.chartData.map((item) => (
                      <Cell
                        key={item.key}
                        fill={item.color}
                        fillOpacity={selected && selected !== item.key ? 0.28 : 1}
                        onClick={() => onSelect(item.key)}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      border: '1px solid rgb(255 255 255 / 0.12)',
                      borderRadius: 8,
                      color: '#f8fafc',
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-semibold text-white tabular-nums">
                    {summary.total}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/40">
                    Değerlendirilen
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm text-white/45">
              Seçili filtrelerde N sütunu değerlendirmesi bulunamadı.
            </div>
          )}
        </div>

        <div className="grid content-center gap-3 sm:grid-cols-3">
          {summary.items.map((item) => {
            const active = selected === item.key;
            const itemPercent = summary.total
              ? Math.round((item.value / summary.total) * 100)
              : 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                aria-pressed={active}
                className={`rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08] ${
                  active
                    ? 'border-sky-400/65 bg-sky-400/10 ring-2 ring-sky-400/25'
                    : 'border-white/10 bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-white/60">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold text-white/60 tabular-nums">
                    %{itemPercent}
                  </span>
                </div>
                <div className="mt-5 text-3xl font-semibold text-white tabular-nums">
                  {item.value}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function sceDetailTitle(row: SCERow) {
  if (row.ekipmanNo && row.tagNo) return `${row.ekipmanNo} / ${row.tagNo}`;
  return row.ekipmanNo || row.tagNo || row.ekipmanAdi || 'SCE Ekipman Detayı';
}

function sceDetailFields(row: SCERow) {
  return [
    { label: 'Şirket', value: row.sirket },
    { label: 'Fabrika/Ünite', value: row.fabrika },
    { label: 'Ekipman Numarası', value: row.ekipmanNo },
    { label: 'Tag No', value: row.tagNo },
    { label: 'SCE Grubu', value: row.sceGrubu },
    { label: 'SCE Gözden Geçirme', value: row.sceGozdenGecirme },
    { label: row.sutunELabel, value: row.sutunE },
    { label: row.sutunFLabel, value: row.sutunF },
    { label: row.sutunGLabel, value: row.sutunG },
    { label: 'Bakım Planı Numarası', value: row.bakimPlaniNo },
    { label: 'Bakım Kalemi Numarası', value: row.bakimKalemiNo },
    {
      label: 'Duruş Gereklilik / Yapılabilirlik',
      value: row.durusGereklilikYorumu,
    },
    { label: 'Duruş Açıklaması', value: row.durusAciklamasi },
    { label: 'Deferral Süreci', value: row.deferralSureci },
    { label: 'Son Kontrol Tarihi', value: row.sonKontrolTarihi },
    { label: 'Son Bakım Tarihi', value: row.sonBakimTarihi },
    {
      label: 'Son Bakım Bildirim/Sipariş',
      value: row.sonBakimBildirimSiparis,
    },
  ];
}

function FilterTile({
  label,
  helper,
  value,
  active,
  onClick,
}: {
  label: string;
  helper?: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`filter-tile min-h-20 ${active ? 'filter-tile-active' : ''}`}
    >
      <span className="block truncate text-xs font-medium text-slate-500">
        {label}
      </span>
      <span className="mt-1 flex items-end justify-between gap-2">
        <strong className="text-xl font-semibold text-slate-900 tabular-nums">
          {value}
        </strong>
        {helper && (
          <span className="text-[11px] font-medium text-white/35">
            {helper}
          </span>
        )}
      </span>
    </button>
  );
}

function filterByCategory(rows: SCERow[], category: SCECategory) {
  if (category === 'plans') {
    return rows.filter((row) => hasSCEValue(row.bakimPlaniNo));
  }
  if (category === 'periodic') {
    return rows.filter((row) => hasSCEValue(row.bakimPlaniNo));
  }
  return rows;
}

function buildPeriodicMaintenanceSummary(rows: SCERow[]) {
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
  const items = [
    {
      name: 'Periyodik Bakımı Yapılan',
      value: completed,
      color: PERIODIC_MAINTENANCE_COLORS['Periyodik Bakımı Yapılan'],
    },
    {
      name: 'Deferral Süreci Başlatılan',
      value: deferralStarted,
      color: PERIODIC_MAINTENANCE_COLORS['Deferral Süreci Başlatılan'],
    },
    {
      name: 'Deferral Süreci Başlatılmayan',
      value: deferralNotStarted,
      color: PERIODIC_MAINTENANCE_COLORS['Deferral Süreci Başlatılmayan'],
    },
    {
      name: 'Deferral Gerektirmeyen',
      value: deferralNotRequired,
      color: PERIODIC_MAINTENANCE_COLORS['Deferral Gerektirmeyen'],
    },
  ];
  const total = rows.length - assessmentMissing;

  return {
    total,
    completed,
    notCompleted: total - completed,
    deferralStarted,
    deferralNotStarted,
    deferralNotRequired,
    items,
    chartData: items.filter((item) => item.value > 0),
  };
}

function buildShutdownRequirementSummary(rows: SCERow[]) {
  const items = SHUTDOWN_REQUIREMENT_CONFIG.map((config) => ({
    key: config.key,
    name: config.name,
    color: config.color,
    value: rows.filter((row) =>
      matchesShutdownRequirement(row, config.key),
    ).length,
  }));
  return {
    total: items.reduce((total, item) => total + item.value, 0),
    items,
    chartData: items.filter((item) => item.value > 0),
  };
}

function matchesShutdownRequirement(
  row: SCERow,
  requirement: ShutdownRequirement,
) {
  const config = SHUTDOWN_REQUIREMENT_CONFIG.find(
    (item) => item.key === requirement,
  );
  return (
    !!config &&
    classifySCEShutdownRequirement(row.durusGereklilikYorumu) === config.key
  );
}

function columnsForCategory(
  category: SCECategory,
): DataTableColumn<SCERow>[] {
  const allColumns: DataTableColumn<SCERow>[] = [
    {
      key: 'company',
      header: 'Şirket',
      sortValue: (row) => row.sirket,
      searchValue: (row) => row.sirket,
      render: (row) => row.sirket,
    },
    {
      key: 'factory',
      header: 'Fabrika/Ünite',
      sortValue: (row) => row.fabrika,
      searchValue: (row) => `${row.fabrika} ${row.fabrikaKodu}`,
      render: (row) => (
        <div>
          <span className="font-semibold text-white">{row.fabrika}</span>
          <span className="ml-2 text-xs text-white/35">{row.fabrikaKodu}</span>
        </div>
      ),
    },
    {
      key: 'equipmentNo',
      header: 'Ekipman Numarası',
      sortValue: (row) => row.ekipmanNo,
      searchValue: (row) => row.ekipmanNo,
      render: (row) => row.ekipmanNo || '—',
    },
    {
      key: 'tagNo',
      header: 'Tag No',
      sortValue: (row) => row.tagNo,
      searchValue: (row) => row.tagNo,
      render: (row) => row.tagNo || '—',
    },
    {
      key: 'equipmentType',
      header: 'Ekipman Türü',
      sortValue: (row) => row.ekipmanTuru,
      searchValue: (row) => row.ekipmanTuru,
      render: (row) => row.ekipmanTuru || '—',
    },
    {
      key: 'sceGroup',
      header: 'SCE Grubu',
      sortValue: (row) => row.sceGrubu,
      searchValue: (row) => row.sceGrubu,
      render: (row) => row.sceGrubu || '—',
    },
    {
      key: 'sceReason',
      header: 'SCE Sebebi',
      sortValue: (row) => row.sceSebebi,
      searchValue: (row) => row.sceSebebi,
      render: (row) => row.sceSebebi || '—',
    },
  ];

  const periodicColumns: DataTableColumn<SCERow>[] = [
    {
      key: 'company',
      header: 'Şirket',
      sortValue: (row) => row.sirket,
      searchValue: (row) => row.sirket,
      render: (row) => row.sirket,
    },
    {
      key: 'factory',
      header: 'Fabrika/Ünite',
      sortValue: (row) => row.fabrika,
      searchValue: (row) => `${row.fabrika} ${row.fabrikaKodu}`,
      render: (row) => (
        <div>
          <span className="font-semibold text-white">{row.fabrika}</span>
          <span className="ml-2 text-xs text-white/35">{row.fabrikaKodu}</span>
        </div>
      ),
    },
    {
      key: 'equipmentNo',
      header: 'Ekipman Numarası',
      sortValue: (row) => row.ekipmanNo,
      searchValue: (row) => row.ekipmanNo,
      render: (row) => row.ekipmanNo || '—',
    },
    {
      key: 'tagNo',
      header: 'Tag No',
      sortValue: (row) => row.tagNo,
      searchValue: (row) => row.tagNo,
      render: (row) => row.tagNo || '—',
    },
    {
      key: 'maintenancePeriod',
      header: 'Bakım Periyodu',
      sortValue: (row) => row.bakimPeriyodu,
      searchValue: (row) => row.bakimPeriyodu,
      render: (row) => row.bakimPeriyodu || '—',
    },
    {
      key: 'lastControl',
      header: 'Son Kontrol Tarihi',
      sortValue: (row) => row.sonKontrolTarihi,
      searchValue: (row) => row.sonKontrolTarihi,
      render: (row) => row.sonKontrolTarihi || '—',
    },
    {
      key: 'lastMaintenance',
      header: 'Son Bakım Tarihi',
      sortValue: (row) => row.sonBakimTarihi,
      searchValue: (row) => row.sonBakimTarihi,
      render: (row) => row.sonBakimTarihi || '—',
    },
    {
      key: 'lastMaintenanceOrder',
      header: 'Son Bakım Siparişi',
      sortValue: (row) => row.sonBakimBildirimSiparis,
      searchValue: (row) => row.sonBakimBildirimSiparis,
      render: (row) => row.sonBakimBildirimSiparis || '—',
    },
    {
      key: 'shutdownRequirement',
      header: 'Duruş Gerekliliği',
      sortValue: (row) => row.durusGereklilikYorumu,
      searchValue: (row) => row.durusGereklilikYorumu,
      className: 'min-w-44',
      render: (row) => row.durusGereklilikYorumu || '—',
    },
    {
      key: 'shutdownExplanation',
      header: 'Duruş Açıklaması',
      sortValue: (row) => row.durusAciklamasi,
      searchValue: (row) => row.durusAciklamasi,
      className: 'min-w-56',
      render: (row) => (
        <span className="line-clamp-2 leading-5">
          {row.durusAciklamasi || '—'}
        </span>
      ),
    },
    {
      key: 'deferralStatus',
      header: 'Deferral Süreci',
      sortValue: (row) => row.deferralSureci,
      searchValue: (row) => row.deferralSureci,
      render: (row) => row.deferralSureci || '—',
    },
  ];

  if (category === 'all') return allColumns;
  if (category === 'plans') return allColumns;
  if (category === 'periodic') return periodicColumns;
  return allColumns;
}

function factoryCode(factory: SCEFactory) {
  return (
    Object.entries(SCE_FACTORY_CODES).find(([, value]) => value === factory)?.[0] ??
    ''
  );
}
