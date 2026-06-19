import { useMemo } from 'react';
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
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Gauge,
  Layers3,
  ListChecks,
  Users,
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import {
  buildTechnicalMOCs,
  filterByCompanies,
  openTechnicalOpinionItems,
  openTechnicalTerminDates,
  summarize as summarizeTechnical,
} from '../../lib/technicalLogic';
import {
  applyFilters,
  buildActionMOCs,
  summarize as summarizeActions,
  TARGET_SORUMLULAR,
} from '../../lib/actionsLogic';
import { formatDate, normalizeMocNo } from '../../lib/normalize';
import type { ActionMOC, TechnicalMOC } from '../../types';

const TOOLTIP_STYLE = {
  backgroundColor: '#111111',
  border: '1px solid rgb(255 255 255 / 0.12)',
  borderRadius: 8,
  color: '#f8fafc',
};

const TECHNICAL_COLORS = {
  Tamamlandı: '#10b981',
  Bekliyor: '#f59e0b',
  Gecikmiş: '#ef4444',
  'Geri Gönderildi': '#38bdf8',
};

const ACTION_COLORS = {
  Tamamlanmış: '#10b981',
  Açık: '#f59e0b',
  Gecikmiş: '#ef4444',
  Atanmamış: '#38bdf8',
  Diğer: '#64748b',
};

export function MOCOverviewDashboard() {
  const technicalRows = useDataStore((state) => state.technicalRows);
  const actionRows = useDataStore((state) => state.actionRows);
  const mocTakipMocNos = useDataStore((state) => state.mocTakipMocNos);
  const selectedCompanies = useDataStore((state) => state.selectedCompanies);
  const setSelectedCompanies = useDataStore(
    (state) => state.setSelectedCompanies,
  );

  const allTechnicalMOCs = useMemo(
    () => buildTechnicalMOCs(technicalRows, mocTakipMocNos),
    [technicalRows, mocTakipMocNos],
  );
  const teamActions = useMemo(
    () =>
      applyFilters(buildActionMOCs(actionRows), [], TARGET_SORUMLULAR),
    [actionRows],
  );
  const technicalMOCs = useMemo(
    () => filterByCompanies(allTechnicalMOCs, selectedCompanies),
    [allTechnicalMOCs, selectedCompanies],
  );
  const actions = useMemo(
    () => applyFilters(teamActions, selectedCompanies, []),
    [teamActions, selectedCompanies],
  );
  const unifiedMOCs = useMemo(
    () => buildUnifiedMOCs(technicalMOCs, actions),
    [technicalMOCs, actions],
  );
  const allUnifiedMOCs = useMemo(
    () => buildUnifiedMOCs(allTechnicalMOCs, teamActions),
    [allTechnicalMOCs, teamActions],
  );

  const companies = useMemo(
    () =>
      unique(
        allUnifiedMOCs.map((moc) => moc.company).filter(Boolean),
      ),
    [allUnifiedMOCs],
  );
  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allUnifiedMOCs.forEach((moc) => {
      const company = moc.company || '(Belirtilmemiş)';
      counts.set(company, (counts.get(company) ?? 0) + 1);
    });
    return counts;
  }, [allUnifiedMOCs]);

  const technicalSummary = useMemo(
    () => summarizeTechnical(technicalMOCs),
    [technicalMOCs],
  );
  const actionSummary = useMemo(() => summarizeActions(actions), [actions]);
  const openTechnical =
    technicalSummary.bekliyor +
    technicalSummary.gecikmis +
    technicalSummary.geriGonderildi;
  const openActions =
    actionSummary.tamamlanmayan +
    actionSummary.gecikmis +
    actionSummary.atama_yapilmadi;
  const categorizedActions =
    actionSummary.tamamlanmis +
    actionSummary.tamamlanmayan +
    actionSummary.gecikmis +
    actionSummary.atama_yapilmadi;

  const technicalStatusData = [
    {
      name: 'Tamamlandı',
      value: technicalSummary.tamamlandi,
      color: TECHNICAL_COLORS.Tamamlandı,
    },
    {
      name: 'Bekliyor',
      value: technicalSummary.bekliyor,
      color: TECHNICAL_COLORS.Bekliyor,
    },
    {
      name: 'Gecikmiş',
      value: technicalSummary.gecikmis,
      color: TECHNICAL_COLORS.Gecikmiş,
    },
    {
      name: 'Geri Gönderildi',
      value: technicalSummary.geriGonderildi,
      color: TECHNICAL_COLORS['Geri Gönderildi'],
    },
  ];
  const actionStatusData = [
    {
      name: 'Tamamlanmış',
      value: actionSummary.tamamlanmis,
      color: ACTION_COLORS.Tamamlanmış,
    },
    {
      name: 'Açık',
      value: actionSummary.tamamlanmayan,
      color: ACTION_COLORS.Açık,
    },
    {
      name: 'Gecikmiş',
      value: actionSummary.gecikmis,
      color: ACTION_COLORS.Gecikmiş,
    },
    {
      name: 'Atanmamış',
      value: actionSummary.atama_yapilmadi,
      color: ACTION_COLORS.Atanmamış,
    },
    {
      name: 'Diğer',
      value: Math.max(0, actions.length - categorizedActions),
      color: ACTION_COLORS.Diğer,
    },
  ];

  const companyData = useMemo(
    () => buildCountData(unifiedMOCs.map((moc) => moc.company || 'Belirtilmemiş')),
    [unifiedMOCs],
  );
  const workloadData = useMemo(
    () => buildWorkloadData(technicalMOCs, actions),
    [technicalMOCs, actions],
  );
  const calendarData = useMemo(
    () => buildCalendarData(technicalMOCs, actions),
    [technicalMOCs, actions],
  );
  const criticalItems = useMemo(
    () => buildCriticalItems(technicalMOCs, actions),
    [technicalMOCs, actions],
  );

  function toggleCompany(company: string) {
    setSelectedCompanies(
      selectedCompanies.includes(company)
        ? selectedCompanies.filter((item) => item !== company)
        : [...selectedCompanies, company],
    );
  }

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Building2 size={17} className="text-red-300" />
          <div>
            <h2 className="panel-title">Şirket Filtresi</h2>
            <p className="panel-subtitle mt-1">
              Genel Bakış, Teknik Görüş ve Aksiyonlar sekmelerinde ortak çalışır.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <FilterTile
            label="Tüm Şirketler"
            value={allUnifiedMOCs.length}
            active={selectedCompanies.length === 0}
            onClick={() => setSelectedCompanies([])}
          />
          {companies.map((company) => (
            <FilterTile
              key={company}
              label={company}
              value={companyCounts.get(company) ?? 0}
              active={selectedCompanies.includes(company)}
              onClick={() => toggleCompany(company)}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Toplam MOC"
          value={unifiedMOCs.length}
          helper="Tekil MOC kaydı"
          color="#38bdf8"
          icon={<Layers3 size={21} />}
        />
        <MetricCard
          title="Teknik Görüş Tamamlandı"
          value={technicalSummary.tamamlandi}
          helper={percent(technicalSummary.tamamlandi, technicalSummary.total)}
          color="#10b981"
          icon={<BadgeCheck size={21} />}
        />
        <MetricCard
          title="Açık Teknik Görüş"
          value={openTechnical}
          helper="Bekleyen + geciken + iade"
          color="#f59e0b"
          icon={<Clock3 size={21} />}
        />
        <MetricCard
          title="Bilgi Notu Eksik"
          value={technicalSummary.bilgiNotuPaylasilmamis}
          helper="MOC takip listesinde yok"
          color="#8b5cf6"
          icon={<FileWarning size={21} />}
        />
        <MetricCard
          title="Açık Aksiyon"
          value={openActions}
          helper={`${actionSummary.tamamlanmis} tamamlandı`}
          color="#f97316"
          icon={<ListChecks size={21} />}
        />
        <MetricCard
          title="Toplam Gecikmiş"
          value={technicalSummary.gecikmis + actionSummary.gecikmis}
          helper={`${technicalSummary.gecikmis} teknik · ${actionSummary.gecikmis} aksiyon`}
          color="#ef4444"
          icon={<AlertTriangle size={21} />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StatusDonut
          title="Teknik Görüş Durumu"
          subtitle={`${technicalSummary.total} MOC · ${percent(
            technicalSummary.tamamlandi,
            technicalSummary.total,
          )} tamamlanma`}
          data={technicalStatusData}
          centerValue={technicalSummary.total}
          centerLabel="MOC"
          icon={<ClipboardCheck size={17} />}
        />
        <StatusDonut
          title="Aksiyon Durumu"
          subtitle={`${actions.length} aksiyon kaydı`}
          data={actionStatusData}
          centerValue={actions.length}
          centerLabel="Aksiyon"
          icon={<ListChecks size={17} />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Şirket Bazında MOC Dağılımı"
          subtitle="Teknik görüş ve aksiyon listelerindeki tekil MOC'lar"
          icon={<Building2 size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={companyData} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid stroke="rgb(255 255 255 / 0.07)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={95}
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar dataKey="value" name="MOC" fill="#38bdf8" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Ekip İş Yükü"
          subtitle="Açık teknik görüş ve aksiyon atamalarının toplamı"
          icon={<Users size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={workloadData} layout="vertical" margin={{ left: 12, right: 18 }}>
              <CartesianGrid stroke="rgb(255 255 255 / 0.07)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={118}
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar dataKey="teknik" name="Teknik Görüş" stackId="work" fill="#8b5cf6" />
              <Bar dataKey="aksiyon" name="Aksiyon" stackId="work" fill="#f59e0b" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
        <ChartCard
          title="Termin ve Hedef Tarihi Yoğunluğu"
          subtitle="Teknik görüş terminleri ve aksiyon hedeflerinin aylık dağılımı"
          icon={<Gauge size={17} />}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={calendarData} margin={{ top: 8, right: 15, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="technicalTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="actionTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(255 255 255 / 0.07)" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="teknik"
                name="Teknik Görüş"
                stroke="#a78bfa"
                strokeWidth={2}
                fill="url(#technicalTrend)"
              />
              <Area
                type="monotone"
                dataKey="aksiyon"
                name="Aksiyon"
                stroke="#fbbf24"
                strokeWidth={2}
                fill="url(#actionTrend)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-400/15 text-rose-300">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2 className="panel-title">Kritik Takip Listesi</h2>
                <p className="panel-subtitle mt-1">
                  Gecikmiş, geri gönderilmiş veya atanmamış ilk kayıtlar
                </p>
              </div>
            </div>
            <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold text-white/60 tabular-nums">
              {criticalItems.length}
            </span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {criticalItems.length > 0 ? (
              criticalItems.slice(0, 10).map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-white/10 bg-white/[0.045] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            item.type === 'Teknik'
                              ? 'bg-violet-400/15 text-violet-300'
                              : 'bg-amber-400/15 text-amber-300'
                          }`}
                        >
                          {item.type}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {item.mocNo || 'MOC No yok'}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-1 text-xs text-white/50">
                        {item.subject || 'Konu belirtilmemiş'}
                      </div>
                      <div className="mt-2 text-[11px] text-white/35">
                        {item.owner || 'Sorumlu belirtilmemiş'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] font-medium text-rose-300">
                        {item.status}
                      </div>
                      <div className="mt-1 text-[10px] text-white/35">
                        {formatDate(item.date)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-center">
                <CheckCircle2 size={28} className="mb-2 text-emerald-400" />
                <div className="text-sm font-medium text-white/70">Kritik kayıt yok</div>
                <div className="mt-1 text-xs text-white/35">Seçili şirketlerde risk görünmüyor.</div>
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

interface UnifiedMOC {
  key: string;
  mocNo: string;
  company: string;
  unit: string;
  subject: string;
}

function buildUnifiedMOCs(
  technicalMOCs: TechnicalMOC[],
  actions: ActionMOC[],
): UnifiedMOC[] {
  const map = new Map<string, UnifiedMOC>();

  const add = (
    mocNo: string,
    company: string,
    unit: string,
    subject: string,
  ) => {
    const normalized = normalizeMocNo(mocNo);
    const key = normalized || `${company}|${unit}|${subject}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { key, mocNo, company, unit, subject });
      return;
    }
    if (!existing.mocNo && mocNo) existing.mocNo = mocNo;
    if (!existing.company && company) existing.company = company;
    if (!existing.unit && unit) existing.unit = unit;
    if (!existing.subject && subject) existing.subject = subject;
  };

  technicalMOCs.forEach((moc) =>
    add(moc.mocFormNo, moc.sirket, moc.uniteAdi, moc.mocKonusu),
  );
  actions.forEach((action) =>
    add(
      action.mocFormNo,
      action.sirket,
      action.uniteAdi,
      action.mocKonusu,
    ),
  );

  return [...map.values()];
}

function buildWorkloadData(technicalMOCs: TechnicalMOC[], actions: ActionMOC[]) {
  const people = new Map<string, { name: string; teknik: number; aksiyon: number }>();
  const add = (name: string, field: 'teknik' | 'aksiyon') => {
    const clean = name.trim();
    if (!clean) return;
    const key = clean.toLocaleLowerCase('tr-TR');
    const current = people.get(key) ?? { name: clean, teknik: 0, aksiyon: 0 };
    current[field] += 1;
    people.set(key, current);
  };

  technicalMOCs
    .filter((moc) => moc.status !== 'tamamlandi')
    .forEach((moc) =>
      openTechnicalOpinionItems(moc).forEach((item) =>
        add(item.kullanici, 'teknik'),
      ),
    );
  actions
    .filter((action) => action.category !== 'tamamlanmis')
    .forEach((action) => {
      if (action.sorumlular.length === 0) add('Atama yapılmadı', 'aksiyon');
      action.sorumlular.forEach((owner) => add(owner, 'aksiyon'));
    });

  return [...people.values()]
    .sort(
      (a, b) =>
        b.teknik + b.aksiyon - (a.teknik + a.aksiyon) ||
        a.name.localeCompare(b.name, 'tr'),
    )
    .slice(0, 9);
}

function buildCalendarData(technicalMOCs: TechnicalMOC[], actions: ActionMOC[]) {
  const months = new Map<string, { key: string; teknik: number; aksiyon: number }>();
  const add = (date: Date | null, field: 'teknik' | 'aksiyon') => {
    if (!date || Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = months.get(key) ?? { key, teknik: 0, aksiyon: 0 };
    current[field] += 1;
    months.set(key, current);
  };

  technicalMOCs.forEach((moc) =>
    moc.kullanicilar.forEach((item) => add(item.terminTarihi, 'teknik')),
  );
  actions.forEach((action) => add(action.hedefTarih, 'aksiyon'));

  return [...months.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => {
      const [year, month] = item.key.split('-').map(Number);
      return {
        ...item,
        label: new Date(year, month - 1, 1).toLocaleDateString('tr-TR', {
          month: 'short',
          year: '2-digit',
        }),
      };
    });
}

interface CriticalItem {
  key: string;
  type: 'Teknik' | 'Aksiyon';
  mocNo: string;
  subject: string;
  owner: string;
  status: string;
  date: Date | null;
  priority: number;
}

function buildCriticalItems(
  technicalMOCs: TechnicalMOC[],
  actions: ActionMOC[],
): CriticalItem[] {
  const items: CriticalItem[] = [];

  technicalMOCs.forEach((moc) => {
    let status = '';
    let priority = 3;
    if (moc.status === 'gecikmis') {
      status = 'Gecikmiş';
      priority = 0;
    } else if (moc.status === 'geri_gonderildi') {
      status = 'Geri gönderildi';
      priority = 1;
    } else if (moc.bilgiNotuPaylasilmamis) {
      status = 'Bilgi notu eksik';
      priority = 2;
    }
    if (!status) return;

    items.push({
      key: `technical-${normalizeMocNo(moc.mocFormNo)}`,
      type: 'Teknik',
      mocNo: moc.mocFormNo,
      subject: moc.mocKonusu,
      owner: openTechnicalOpinionItems(moc)
        .map((item) => item.kullanici)
        .join(', '),
      status,
      date: openTechnicalTerminDates(moc)[0] ?? null,
      priority,
    });
  });

  actions.forEach((action) => {
    if (
      action.category !== 'gecikmis' &&
      action.category !== 'atama_yapilmadi'
    ) {
      return;
    }
    items.push({
      key: `action-${action.rowId}`,
      type: 'Aksiyon',
      mocNo: action.mocFormNo,
      subject: action.aksiyonAciklamasi || action.mocKonusu,
      owner: action.sorumlular.join(', '),
      status:
        action.category === 'gecikmis' ? 'Gecikmiş' : 'Atama yapılmadı',
      date: action.hedefTarih,
      priority: action.category === 'gecikmis' ? 0 : 2,
    });
  });

  return items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aDate = a.date?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDate = b.date?.getTime() ?? Number.POSITIVE_INFINITY;
    return aDate - bDate || a.mocNo.localeCompare(b.mocNo, 'tr');
  });
}

function StatusDonut({
  title,
  subtitle,
  data,
  centerValue,
  centerLabel,
  icon,
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number; color: string }[];
  centerValue: number;
  centerLabel: string;
  icon: React.ReactNode;
}) {
  const chartData = data.filter((item) => item.value > 0);
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-red-300">{icon}</span>
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
                  <div className="text-3xl font-semibold text-white tabular-nums">
                    {centerValue}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-white/40">
                    {centerLabel}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/40">
              Veri bulunamadı
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.map((item) => (
            <div key={item.name} className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-white tabular-nums">
                {item.value}
              </div>
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
        <span className="text-red-300">{icon}</span>
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-subtitle mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="h-72 min-w-0">{children}</div>
    </section>
  );
}

function FilterTile({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
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
      <span className="block truncate text-xs font-medium text-slate-500">{label}</span>
      <strong className="mt-1 block text-xl font-semibold text-slate-900 tabular-nums">
        {value}
      </strong>
    </button>
  );
}

function buildCountData(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'tr'));
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'tr'));
}

function percent(value: number, total: number) {
  return total ? `%${Math.round((value / total) * 100)}` : '%0';
}
