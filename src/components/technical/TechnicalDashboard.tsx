import { useMemo, useState } from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useDataStore } from '../../store/dataStore';
import {
  buildTechnicalMOCs,
  filterByCompanies,
  filterByStatuses,
  isTechnicalCompletionSignal,
  isTechnicalLateSignal,
  isTechnicalReturnedSignal,
  summarize,
  uniqueCompanies,
  usersWithoutTechnicalOpinion,
} from '../../lib/technicalLogic';
import { TechnicalSummaryCards } from './TechnicalSummaryCards';
import { MOCTable } from './MOCTable';
import { MOCDetailModal } from '../common/MOCDetailModal';
import type { TechnicalMOC, TechnicalStatus } from '../../types';
import { Building2, FileText, Filter } from 'lucide-react';
import { eq, formatDate, normalize } from '../../lib/normalize';
import { Modal } from '../common/Modal';
import { downloadTechnicalReportPdf } from '../../lib/technicalReportPdf';

const STATUS_COLORS: Record<string, string> = {
  Tamamlandı: '#10b981',
  'MOC Bilgi Notu Paylaşılmamış': '#8b5cf6',
  Gecikmiş: '#ef4444',
  Bekliyor: '#f59e0b',
  'Geri Gönderildi': '#38bdf8',
};

const USER_BAR_COLORS = [
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

export function TechnicalDashboard() {
  const rows = useDataStore((s) => s.technicalRows);
  const mocTakipMocNos = useDataStore((s) => s.mocTakipMocNos);
  const selectedCompanies = useDataStore((s) => s.selectedCompanies);
  const selectedTechnicalStatuses = useDataStore((s) => s.selectedTechnicalStatuses);
  const setSelectedCompanies = useDataStore((s) => s.setSelectedCompanies);
  const setSelectedTechnicalStatuses = useDataStore(
    (s) => s.setSelectedTechnicalStatuses,
  );

  const [detail, setDetail] = useState<TechnicalMOC | null>(null);
  const [distributionView, setDistributionView] =
    useState<DistributionView>('donut');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);

  const allCompanies = useMemo(() => uniqueCompanies(rows), [rows]);
  const allMOCs = useMemo(
    () => buildTechnicalMOCs(rows, mocTakipMocNos),
    [mocTakipMocNos, rows],
  );
  const companyFilteredMOCs = useMemo(
    () => filterByCompanies(allMOCs, selectedCompanies),
    [allMOCs, selectedCompanies],
  );
  const filteredMOCs = useMemo(
    () => filterByStatuses(companyFilteredMOCs, selectedTechnicalStatuses),
    [companyFilteredMOCs, selectedTechnicalStatuses],
  );

  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const moc of allMOCs) {
      const company = moc.sirket || '(belirtilmemiş)';
      counts.set(company, (counts.get(company) ?? 0) + 1);
    }
    return counts;
  }, [allMOCs]);

  const activeTechnicalStatus =
    selectedTechnicalStatuses.length === 1 ? selectedTechnicalStatuses[0] : null;

  const showPendingUsers =
    selectedTechnicalStatuses.length === 1 &&
    (selectedTechnicalStatuses[0] === 'bekliyor' ||
      selectedTechnicalStatuses[0] === 'gecikmis');
  const showAllUsers =
    selectedTechnicalStatuses.length === 1 &&
    selectedTechnicalStatuses[0] === 'bilgi_notu_paylasilmamis';

  function toggleCompany(company: string) {
    setSelectedCompanies(
      selectedCompanies.includes(company)
        ? selectedCompanies.filter((item) => item !== company)
        : [...selectedCompanies, company],
    );
  }

  function toggleTechnicalStatus(status: TechnicalStatus | null) {
    if (!status) {
      setSelectedTechnicalStatuses([]);
      return;
    }
    setSelectedTechnicalStatuses(
      activeTechnicalStatus === status ? [] : [status],
    );
  }

  async function createReport(company?: string) {
    const reportMOCs = company
      ? allMOCs.filter((moc) => eq(moc.sirket, company))
      : allMOCs;

    setReportGenerating(true);
    try {
      await downloadTechnicalReportPdf({
        mocs: reportMOCs,
        scopeLabel: company ?? 'Genel Rapor',
      });
      setReportModalOpen(false);
    } finally {
      setReportGenerating(false);
    }
  }

  // Şirket bazlı kategoriler (filtre uygulanmış set üzerinden)
  const companiesShown = useMemo(() => {
    const set = new Set(filteredMOCs.map((m) => m.sirket || '(belirtilmemiş)'));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [filteredMOCs]);

  const summary = useMemo(() => summarize(companyFilteredMOCs), [companyFilteredMOCs]);
  const filteredSummary = useMemo(() => summarize(filteredMOCs), [filteredMOCs]);

  const statusData = [
    { name: 'Tamamlandı', value: filteredSummary.tamamlandi },
    {
      name: 'MOC Bilgi Notu Paylaşılmamış',
      value: filteredSummary.bilgiNotuPaylasilmamis,
    },
    { name: 'Gecikmiş', value: filteredSummary.gecikmis },
    { name: 'Bekliyor', value: filteredSummary.bekliyor },
    { name: 'Geri Gönderildi', value: filteredSummary.geriGonderildi },
  ];
  const pieData = statusData.filter((d) => d.value > 0);
  const userDistributionData = useMemo(() => {
    const counts = new Map<string, { name: string; value: number }>();

    for (const moc of filteredMOCs) {
      const users =
        activeTechnicalStatus === 'bekliyor'
          ? usersWithoutTechnicalOpinion(moc)
          : moc.kullanicilar
              .filter((item) => {
                if (activeTechnicalStatus === 'tamamlandi') {
                  return isTechnicalCompletionSignal(item.durum);
                }
                if (activeTechnicalStatus === 'gecikmis') {
                  return isTechnicalLateSignal(item.durum);
                }
                if (activeTechnicalStatus === 'geri_gonderildi') {
                  return isTechnicalReturnedSignal(item.durum);
                }
                return true;
              })
              .map((item) => item.kullanici);

      const uniqueUsersInMoc = new Map<string, string>();
      for (const user of users) {
        const name = user.trim();
        if (!name) continue;
        uniqueUsersInMoc.set(normalize(name), name);
      }

      for (const [key, name] of uniqueUsersInMoc) {
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
  }, [activeTechnicalStatus, filteredMOCs]);
  const userTotal = userDistributionData.reduce(
    (total, item) => total + item.value,
    0,
  );
  const maxUserValue = Math.max(
    ...userDistributionData.map((item) => item.value),
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
        <div className="space-y-3">
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
                  {allMOCs.length}
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

      <TechnicalSummaryCards
        summary={summary}
        activeStatus={activeTechnicalStatus}
        onStatusToggle={toggleTechnicalStatus}
      />

      {pieData.length > 0 && (
        <div className="card p-5">
          <h3 className="panel-title mb-3">
            {distributionView === 'donut' ? 'Durum Dağılımı' : 'Kullanıcı Dağılımı'}
          </h3>
          <div className="min-h-64">
            {distributionView === 'donut' ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={STATUS_COLORS[d.name]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-64 flex-col justify-center py-4">
                {userDistributionData.length > 0 ? (
                  <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                    {userDistributionData.map((item, index) => {
                      const percent = userTotal
                        ? Math.round((item.value / userTotal) * 100)
                        : 0;
                      const width = item.value
                        ? Math.max(
                            6,
                            Math.round((item.value / maxUserValue) * 100),
                          )
                        : 0;
                      const color = USER_BAR_COLORS[index % USER_BAR_COLORS.length];

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
                    Kullanıcı bulunamadı
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
          const list = filteredMOCs.filter(
            (m) => (m.sirket || '(belirtilmemiş)') === company,
          );
          const tamam = list.filter((m) => m.status === 'tamamlandi').length;
          const bilgiNotu = list.filter((m) => m.bilgiNotuPaylasilmamis).length;
          const gecikmis = list.filter((m) => m.status === 'gecikmis').length;
          const geri = list.filter((m) => m.status === 'geri_gonderildi').length;
          const bekle = list.filter((m) => m.status === 'bekliyor').length;

          return (
            <div key={company} className="card p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-brand-600" />
                  <h3 className="text-base font-semibold text-slate-900">
                    {company}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                    Toplam <b className="text-slate-950">{list.length}</b>
                  </span>
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                    Tamamlandı <b>{tamam}</b>
                  </span>
                  <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700">
                    Bilgi Notu <b>{bilgiNotu}</b>
                  </span>
                  <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
                    Gecikmiş <b>{gecikmis}</b>
                  </span>
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                    Bekliyor <b>{bekle}</b>
                  </span>
                  <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-sky-700">
                    Geri <b>{geri}</b>
                  </span>
                </div>
              </div>
              <MOCTable
                mocs={list}
                onRowClick={(m) => setDetail(m)}
                showPendingUsers={showPendingUsers}
                showAllUsers={showAllUsers}
              />
            </div>
          );
        })}
      </div>

      {/* "Değişiklik Geri Gönderildi" için özel vurgu bölümü */}
      {filteredMOCs.some((m) => m.status === 'geri_gonderildi') && (
        <div className="card border-rose-200 bg-rose-50/40 p-5">
          <h3 className="text-base font-semibold text-rose-900 mb-3">
            Değişiklik Geri Gönderilen MOC'ler
          </h3>
          <MOCTable
            mocs={filteredMOCs.filter((m) => m.status === 'geri_gonderildi')}
            onRowClick={(m) => setDetail(m)}
            showPendingUsers={showPendingUsers}
            showAllUsers={showAllUsers}
          />
        </div>
      )}

      <MOCDetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        mocFormNo={detail?.mocFormNo ?? ''}
        fields={
          detail
            ? [
                { label: 'MOC Konusu', value: detail.mocKonusu },
                { label: 'Ünite Adı', value: detail.uniteAdi },
                { label: 'Şirket', value: detail.sirket },
                {
                  label: 'Kullanıcılar',
                  value: detail.kullanicilar
                    .map(
                      (k) =>
                        `${k.kullanici || '—'} — ${k.durum || '—'} — Termin: ${formatDate(k.terminTarihi)} — ${k.disiplin || '—'}`,
                    )
                    .join('\n'),
                },
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
              {allMOCs.length}
            </span>
          </button>

          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">
              Şirketler
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {allCompanies.map((company) => {
                const count = allMOCs.filter((moc) => eq(moc.sirket, company)).length;
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
