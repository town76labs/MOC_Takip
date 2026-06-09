import { useMemo, useState } from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  UserX,
} from 'lucide-react';
import {
  applyFilters,
  buildActionMOCs,
  byCategory,
  summarize,
  TARGET_SORUMLULAR,
} from '../../lib/actionsLogic';
import { useDataStore } from '../../store/dataStore';
import { ActionsSummaryCards } from './ActionsSummaryCards';
import { ActionCategoryTable } from './ActionCategoryTable';
import { MOCDetailModal } from '../common/MOCDetailModal';
import type { ActionCategory, ActionMOC } from '../../types';
import { eq, normalize } from '../../lib/normalize';
import { Modal } from '../common/Modal';
import { downloadActionReportPdf } from '../../lib/actionReportPdf';

const ACTION_STATUS_COLORS: Record<string, string> = {
  Tamamlanmış: '#10b981',
  Tamamlanmayan: '#f59e0b',
  Gecikmiş: '#ef4444',
  'Atama Yapılmadı': '#38bdf8',
};

const RESPONSIBLE_BAR_COLORS = [
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#38bdf8',
  '#a3e635',
  '#fb7185',
  '#f97316',
  '#14b8a6',
];

type DistributionView = 'donut' | 'bars';

const SECTIONS: {
  key: ActionCategory;
  title: string;
  icon: React.ReactNode;
  toneClass: string;
}[] = [
  {
    key: 'tamamlanmis',
    title: 'Tamamlanmış Aksiyonlar',
    icon: <CheckCircle2 size={18} />,
    toneClass: 'text-emerald-700',
  },
  {
    key: 'tamamlanmayan',
    title: 'Tamamlanmayan Aksiyonlar',
    icon: <Clock size={18} />,
    toneClass: 'text-amber-700',
  },
  {
    key: 'gecikmis',
    title: 'Gecikmiş Aksiyonlar',
    icon: <AlertTriangle size={18} />,
    toneClass: 'text-rose-700',
  },
  {
    key: 'atama_yapilmadi',
    title: 'Aksiyon Ataması Henüz Yapılmadı',
    icon: <UserX size={18} />,
    toneClass: 'text-sky-700',
  },
];

export function ActionsDashboard() {
  const rows = useDataStore((s) => s.actionRows);
  const selectedCompanies = useDataStore((s) => s.selectedCompanies);
  const setSelectedCompanies = useDataStore((s) => s.setSelectedCompanies);

  const [detail, setDetail] = useState<ActionMOC | null>(null);
  const [activeCategory, setActiveCategory] = useState<ActionCategory | null>(null);
  const [distributionView, setDistributionView] =
    useState<DistributionView>('donut');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);

  const allMOCs = useMemo(() => buildActionMOCs(rows), [rows]);
  const responsibleFilteredMOCs = useMemo(
    () => applyFilters(allMOCs, [], TARGET_SORUMLULAR),
    [allMOCs],
  );
  const allCompanies = useMemo(() => {
    const set = new Set<string>();
    for (const moc of responsibleFilteredMOCs) {
      if (moc.sirket) set.add(moc.sirket.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [responsibleFilteredMOCs]);
  const filtered = useMemo(
    () => applyFilters(responsibleFilteredMOCs, selectedCompanies, []),
    [responsibleFilteredMOCs, selectedCompanies],
  );
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const categoryFiltered = useMemo(
    () => (activeCategory ? byCategory(filtered, activeCategory) : filtered),
    [activeCategory, filtered],
  );
  const visibleSections = useMemo(
    () =>
      activeCategory
        ? SECTIONS.filter((section) => section.key === activeCategory)
        : SECTIONS,
    [activeCategory],
  );

  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const moc of responsibleFilteredMOCs) {
      const company = moc.sirket || '(belirtilmemiş)';
      counts.set(company, (counts.get(company) ?? 0) + 1);
    }
    return counts;
  }, [responsibleFilteredMOCs]);

  const visibleSorumlular = (m: ActionMOC) => {
    return m.sorumlular.filter((s) =>
      TARGET_SORUMLULAR.some((selected) => eq(selected, s)),
    );
  };

  function toggleCompany(company: string) {
    setSelectedCompanies(
      selectedCompanies.includes(company)
        ? selectedCompanies.filter((item) => item !== company)
        : [...selectedCompanies, company],
    );
  }

  function toggleCategory(category: ActionCategory) {
    setActiveCategory((current) => (current === category ? null : category));
  }

  async function createReport(company?: string) {
    const reportMOCs = company
      ? responsibleFilteredMOCs.filter((moc) => eq(moc.sirket, company))
      : responsibleFilteredMOCs;

    setReportGenerating(true);
    try {
      await downloadActionReportPdf({
        mocs: reportMOCs,
        scopeLabel: company ?? 'Genel Rapor',
      });
      setReportModalOpen(false);
    } finally {
      setReportGenerating(false);
    }
  }

  // Şirket bazlı bölümlere ayırma (filtre uygulanmış sete göre)
  const companiesShown = useMemo(() => {
    const set = new Set(
      categoryFiltered.map((m) => m.sirket || '(belirtilmemiş)'),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [categoryFiltered]);

  const filteredSummary = useMemo(
    () => summarize(categoryFiltered),
    [categoryFiltered],
  );
  const distributionData = [
    { name: 'Tamamlanmış', value: filteredSummary.tamamlanmis },
    { name: 'Tamamlanmayan', value: filteredSummary.tamamlanmayan },
    { name: 'Gecikmiş', value: filteredSummary.gecikmis },
    { name: 'Atama Yapılmadı', value: filteredSummary.atama_yapilmadi },
  ].filter((item) => item.value > 0);
  const responsibleDistributionData = useMemo(() => {
    const counts = new Map<string, { name: string; value: number }>();

    for (const moc of categoryFiltered) {
      const uniqueResponsibleInMoc = new Map<string, string>();
      for (const responsible of moc.sorumlular) {
        if (!TARGET_SORUMLULAR.some((selected) => eq(selected, responsible))) {
          continue;
        }

        const name = responsible.trim();
        if (!name) continue;
        uniqueResponsibleInMoc.set(normalize(name), name);
      }

      for (const [key, name] of uniqueResponsibleInMoc) {
        const current = counts.get(key);
        counts.set(key, {
          name: current?.name ?? name,
          value: (current?.value ?? 0) + 1,
        });
      }
    }

    return Array.from(counts.values()).sort(
      (a, b) => b.value - a.value || a.name.localeCompare(b.name, 'tr'),
    );
  }, [categoryFiltered]);
  const responsibleTotal = responsibleDistributionData.reduce(
    (total, item) => total + item.value,
    0,
  );
  const maxResponsibleValue = Math.max(
    ...responsibleDistributionData.map((item) => item.value),
    1,
  );

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter size={16} />
            <span className="panel-title">Filtreler</span>
          </div>
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400/30"
          >
            <FileText size={16} />
            Rapor Oluştur
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium text-slate-600">Şirket</div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => setSelectedCompanies([])}
                className={`filter-tile ${
                  selectedCompanies.length === 0 ? 'filter-tile-active' : ''
                }`}
              >
                <span className="block text-xs font-medium text-slate-500">
                  Tüm Şirketler
                </span>
                <span className="mt-1 block text-xl font-semibold text-slate-900 tabular-nums">
                  {responsibleFilteredMOCs.length}
                </span>
              </button>
              {allCompanies.map((company) => {
                const active = selectedCompanies.includes(company);
                return (
                  <button
                    key={company}
                    type="button"
                    onClick={() => toggleCompany(company)}
                    className={`filter-tile ${active ? 'filter-tile-active' : ''}`}
                  >
                    <span className="block truncate text-xs font-medium text-slate-500">
                      {company}
                    </span>
                    <span className="mt-1 block text-xl font-semibold text-slate-900 tabular-nums">
                      {companyCounts.get(company) ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ActionsSummaryCards
        summary={summary}
        activeCategory={activeCategory}
        onCategoryToggle={toggleCategory}
      />

      {distributionData.length > 0 && (
        <div className="card p-5">
          <h3 className="panel-title mb-3">
            {distributionView === 'donut' ? 'Durum Dağılımı' : 'Sorumlu Dağılımı'}
          </h3>
          <div className="min-h-64">
            {distributionView === 'donut' ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {distributionData.map((item) => (
                        <Cell
                          key={item.name}
                          fill={ACTION_STATUS_COLORS[item.name]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-64 flex-col justify-center py-4">
                {responsibleDistributionData.length > 0 ? (
                  <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                    {responsibleDistributionData.map((item, index) => {
                      const percent = responsibleTotal
                        ? Math.round((item.value / responsibleTotal) * 100)
                        : 0;
                      const width = item.value
                        ? Math.max(
                            6,
                            Math.round(
                              (item.value / maxResponsibleValue) * 100,
                            ),
                          )
                        : 0;
                      const color =
                        RESPONSIBLE_BAR_COLORS[
                          index % RESPONSIBLE_BAR_COLORS.length
                        ];

                      return (
                        <div key={item.name} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              <span className="truncate text-sm font-medium text-white/85">
                                {item.name}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-baseline gap-2 text-right">
                              <span className="text-lg font-semibold text-white tabular-nums">
                                {item.value}
                              </span>
                              <span className="text-xs text-white/45 tabular-nums">
                                %{percent}
                              </span>
                            </div>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${width}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-64 items-center justify-center text-sm text-white/45">
                    Sorumlu bulunamadı
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-center">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.06] p-1">
              <button
                type="button"
                aria-pressed={distributionView === 'donut'}
                onClick={() => setDistributionView('donut')}
                className={`min-w-24 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  distributionView === 'donut'
                    ? 'bg-white text-slate-950'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                Halka
              </button>
              <button
                type="button"
                aria-pressed={distributionView === 'bars'}
                onClick={() => setDistributionView('bars')}
                className={`min-w-24 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  distributionView === 'bars'
                    ? 'bg-white text-slate-950'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                Sayılar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Şirket bazlı bölümler */}
      <div className="space-y-6">
        {companiesShown.map((company) => {
          const compMOCs = categoryFiltered.filter(
            (m) => (m.sirket || '(belirtilmemiş)') === company,
          );
          return (
            <div key={company} className="card p-5 space-y-5">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-brand-600" />
                <h3 className="text-base font-semibold text-slate-900">{company}</h3>
              </div>

              {visibleSections.map((sec) => {
                const list = byCategory(compMOCs, sec.key);
                return (
                  <div key={sec.key}>
                    <div className={`flex items-center gap-2 mb-2 ${sec.toneClass}`}>
                      {sec.icon}
                      <h4 className="text-sm font-semibold">
                        {sec.title}{' '}
                        <span className="text-slate-500 font-normal">
                          ({list.length})
                        </span>
                      </h4>
                    </div>
                    <ActionCategoryTable
                      mocs={list}
                      category={sec.key}
                      onRowClick={(m) => setDetail(m)}
                      sorumluFilter={TARGET_SORUMLULAR}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <MOCDetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        mocFormNo={detail?.mocFormNo ?? ''}
        fields={
          detail
            ? [
                { label: 'MOC Konusu', value: detail.mocKonusu },
                { label: 'Ünite Adı', value: detail.uniteAdi },
                { label: 'Aksiyon Açıklaması', value: detail.aksiyonAciklamasi },
                { label: 'Şirket', value: detail.sirket },
                {
                  label: 'Sorumlular',
                  value: visibleSorumlular(detail).join(', ') || '-',
                },
                { label: 'Durum', value: detail.durum },
                { label: 'MOC Durumu', value: detail.mocDurumu },
              ]
            : []
        }
      />

      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Rapor Oluştur"
        widthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            PDF raporu için genel görünümü veya şirketlerden birini seçin.
          </p>

          <button
            type="button"
            onClick={() => createReport()}
            disabled={reportGenerating}
            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
          >
            <span>
              <span className="block text-sm font-semibold text-white">
                Genel Rapor
              </span>
              <span className="mt-1 block text-xs text-white/45">
                Tüm şirketleri kapsar
              </span>
            </span>
            <span className="text-lg font-semibold text-white tabular-nums">
              {responsibleFilteredMOCs.length}
            </span>
          </button>

          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">
              Şirketler
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {allCompanies.map((company) => {
                const count = responsibleFilteredMOCs.filter((moc) =>
                  eq(moc.sirket, company),
                ).length;
                return (
                  <button
                    key={company}
                    type="button"
                    onClick={() => createReport(company)}
                    disabled={reportGenerating}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-white/85">
                      {company}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-white tabular-nums">
                      {count}
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
