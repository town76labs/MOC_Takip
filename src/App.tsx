import { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  ShoppingCart,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Zap,
} from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { DashboardTabs, type TabKey } from './components/DashboardTabs';
import { useDataStore } from './store/dataStore';
import { TechnicalDashboard } from './components/technical/TechnicalDashboard';
import { ActionsDashboard } from './components/actions/ActionsDashboard';
import { SCEDashboard } from './components/sce/SCEDashboard';
import { SATDashboard } from './components/sat/SATDashboard';
import { MOCOverviewDashboard } from './components/overview/MOCOverviewDashboard';
import { SCEOverviewDashboard } from './components/sce/SCEOverviewDashboard';

type AppMode = 'select' | 'moc' | 'legal' | 'sce' | 'energy' | 'sat';

function App() {
  const technicalFile = useDataStore((s) => s.technicalFile);
  const actionsFile = useDataStore((s) => s.actionsFile);
  const mocTakipFile = useDataStore((s) => s.mocTakipFile);
  const technicalLoading = useDataStore((s) => s.technicalLoading);
  const actionsLoading = useDataStore((s) => s.actionsLoading);
  const mocTakipLoading = useDataStore((s) => s.mocTakipLoading);
  const technicalError = useDataStore((s) => s.technicalError);
  const actionsError = useDataStore((s) => s.actionsError);
  const mocTakipError = useDataStore((s) => s.mocTakipError);
  const uploadTechnical = useDataStore((s) => s.uploadTechnical);
  const uploadActions = useDataStore((s) => s.uploadActions);
  const uploadMOCTakip = useDataStore((s) => s.uploadMOCTakip);
  const clearTechnical = useDataStore((s) => s.clearTechnical);
  const clearActions = useDataStore((s) => s.clearActions);
  const clearMOCTakip = useDataStore((s) => s.clearMOCTakip);
  const sceFile = useDataStore((s) => s.sceFile);
  const sceLoading = useDataStore((s) => s.sceLoading);
  const sceError = useDataStore((s) => s.sceError);
  const uploadSCE = useDataStore((s) => s.uploadSCE);
  const clearSCE = useDataStore((s) => s.clearSCE);
  const satFile = useDataStore((s) => s.satFile);
  const satLoading = useDataStore((s) => s.satLoading);
  const satError = useDataStore((s) => s.satError);
  const uploadSAT = useDataStore((s) => s.uploadSAT);
  const clearSAT = useDataStore((s) => s.clearSAT);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [uploadsOpen, setUploadsOpen] = useState(false);
  const [sceUploadsOpen, setSceUploadsOpen] = useState(false);
  const [sceActiveView, setSceActiveView] = useState<'overview' | 'details'>(
    'overview',
  );
  const [satUploadsOpen, setSatUploadsOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('select');

  const allLoaded = !!technicalFile && !!actionsFile && !!mocTakipFile;
  const showUploadPanel = !allLoaded || uploadsOpen;

  if (appMode === 'select') {
    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <main className="mx-auto flex min-h-screen max-w-[1440px] items-center px-4 py-10 sm:px-6 lg:px-8">
          <section className="w-full">
            <div className="mb-10 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#db2f32] text-white shadow-sm ring-1 ring-white/10">
                <Sparkles size={24} />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
                  Dashboard Seçimi
                </div>
                <h1 className="mt-1 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Enstrüman Bakım Müdürlüğü
                </h1>
                <p className="mt-2 text-sm text-white/50">
                  Başlamak istediğiniz dashboard'u seçin.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                onClick={() => setAppMode('moc')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-red-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-red-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#db2f32] text-white shadow-sm">
                  <LayoutDashboard size={22} />
                </div>
                <div className="mt-8 text-3xl font-semibold text-white">
                  MOC Dashboard
                </div>
                <div className="mt-3 text-sm text-white/50">
                  Management of Change
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAppMode('legal')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-sky-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
                  <LayoutDashboard size={22} />
                </div>
                <div className="mt-8 text-3xl font-semibold text-white">
                  Yasal Bakımlar Dashboard
                </div>
                <div className="mt-3 text-sm text-white/50">
                  SCE ve Enerji Kritik Ekipmanlar
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAppMode('sat')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-cyan-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-teal-600 text-white shadow-sm">
                  <ShoppingCart size={22} />
                </div>
                <div className="mt-8 text-3xl font-semibold text-white">
                  SAT Takip Dashboard
                </div>
                <div className="mt-3 text-sm text-white/50">
                  Satın Alma Talepleri ve Bütçe Takibi
                </div>
              </button>
            </div>
          </section>
        </main>
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs font-medium text-white/45 shadow-elevated backdrop-blur">
          Copyright Sarkhan HAJIZADA
        </div>
      </div>
    );
  }

  if (appMode === 'sat') {
    const showSATUpload = !satFile || satUploadsOpen;

    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-teal-600 text-white shadow-sm ring-1 ring-white/10">
                <ShoppingCart size={18} />
              </div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/65">
                  Enstrüman Bakım Müdürlüğü
                </p>
                <h1 className="text-base font-semibold leading-tight text-white">
                  SAT Takip Dashboard
                </h1>
                <p className="text-xs text-white/50">
                  Satın Alma Talepleri ve Bütçe Takibi
                </p>
              </div>
              {satFile && (
                <button
                  type="button"
                  onClick={() => setSatUploadsOpen((open) => !open)}
                  aria-expanded={satUploadsOpen}
                  className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30 sm:inline-flex"
                >
                  <FileSpreadsheet size={16} />
                  SAT Excel Dosyası
                  <ChevronDown
                    size={16}
                    className={`transition ${satUploadsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {satFile && (
                <button
                  type="button"
                  onClick={() => setSatUploadsOpen((open) => !open)}
                  aria-expanded={satUploadsOpen}
                  aria-label="SAT Excel dosyası panelini aç veya kapat"
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-2 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30 sm:hidden"
                >
                  <FileSpreadsheet size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setAppMode('select')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              >
                <ArrowLeft size={16} />
                Dashboard Seçimi
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {showSATUpload && (
            <section className="mb-6 max-w-3xl">
              <FileUpload
                title="SAT Takip Excel'i"
                subtitle="Satın alma talepleri, onay ve teklif süreçlerini içeren dosya"
                hint="Beklenen sayfa: SAT LİSTESİ. Boş şablon satırları otomatik olarak elenir."
                fileMeta={satFile}
                loading={satLoading}
                error={satError}
                onFile={uploadSAT}
                onClear={clearSAT}
                accentColorClass="from-cyan-400 to-teal-600"
                surfaceClassName="upload-panel-dark"
              />
            </section>
          )}

          {!satFile ? (
            <div className="card mx-auto max-w-3xl p-10 text-center">
              <ShoppingCart size={36} className="mx-auto mb-4 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">
                Başlamak için SAT Takip Excel dosyasını yükleyin
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
                SAT listesi tarayıcınızda işlenir; onay ve satın alma durumları tek
                süreç akışına dönüştürülür.
              </p>
            </div>
          ) : (
            <SATDashboard />
          )}
        </main>

        <footer className="mx-auto max-w-[1440px] px-4 py-6 text-center text-xs text-white/35 sm:px-6 lg:px-8">
          Veriler tamamen tarayıcıda işlenir · sunucuya hiçbir veri gönderilmez.
        </footer>
      </div>
    );
  }

  if (appMode === 'legal') {
    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm ring-1 ring-white/10">
                <LayoutDashboard size={18} />
              </div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/65">
                  Enstrüman Bakım Müdürlüğü
                </p>
                <h1 className="text-base font-semibold leading-tight text-white">
                  Yasal Bakımlar Dashboard
                </h1>
                <p className="text-xs text-white/50">
                  Dashboard seçimi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAppMode('select')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/30"
            >
              <ArrowLeft size={16} />
              Dashboard Seçimi
            </button>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[1440px] items-center px-4 py-10 sm:px-6 lg:px-8">
          <section className="w-full">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white">
                Yasal Bakımlar Dashboard
              </h2>
              <p className="mt-1 text-sm text-white/50">
                Başlamak istediğiniz yasal bakım dashboard'unu seçin.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setAppMode('sce')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-sky-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
                  <LayoutDashboard size={22} />
                </div>
                <div className="mt-8 text-3xl font-semibold text-white">
                  SCE Dashboard
                </div>
                <div className="mt-3 text-sm text-white/50">
                  Safety Critical Element
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAppMode('energy')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-amber-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                  <Zap size={22} />
                </div>
                <div className="mt-8 text-3xl font-semibold text-white">
                  Enerji Kritik Ekipmanlar Dashboard
                </div>
                <div className="mt-3 text-sm text-white/50">
                  Enerji kritik ekipman takipleri
                </div>
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (appMode === 'sce') {
    const showSCEUpload = !sceFile || sceUploadsOpen;

    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm ring-1 ring-white/10">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/65">
                  Enstrüman Bakım Müdürlüğü
                </p>
                <h1 className="text-base font-semibold leading-tight text-white">
                  SCE Dashboard
                </h1>
                <p className="text-xs text-white/50">
                  Safety Critical Element
                </p>
              </div>
              {sceFile && (
                <button
                  type="button"
                  onClick={() => setSceUploadsOpen((open) => !open)}
                  aria-expanded={sceUploadsOpen}
                  className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/30 sm:inline-flex"
                >
                  <FileSpreadsheet size={16} />
                  SCE Excel Dosyası
                  <ChevronDown
                    size={16}
                    className={`transition ${
                      sceUploadsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {sceFile && (
                <button
                  type="button"
                  onClick={() => setSceUploadsOpen((open) => !open)}
                  aria-expanded={sceUploadsOpen}
                  aria-label="SCE Excel dosyası panelini aç veya kapat"
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-2 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/30 sm:hidden"
                >
                  <FileSpreadsheet size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setAppMode('legal')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              >
                <ArrowLeft size={16} />
                Yasal Bakımlar
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {showSCEUpload && (
            <section className="mb-6 max-w-3xl">
              <FileUpload
                title="SCE Ekipmanları Excel'i"
                subtitle="SCE ekipmanları, bakım planları ve periyodik bakım durumları"
                hint="A sütununda fabrika kodu bulunmalıdır: 1000, 1001, 1002, 1007, 1008, 1009, 1010 veya 1014."
                fileMeta={sceFile}
                loading={sceLoading}
                error={sceError}
                onFile={uploadSCE}
                onClear={clearSCE}
                accentColorClass="from-sky-400 to-sky-600"
                surfaceClassName="upload-panel-dark"
              />
            </section>
          )}

          {sceFile && (
            <div className="mb-6 inline-flex rounded-lg border border-white/10 bg-black/35 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setSceActiveView('overview')}
                aria-pressed={sceActiveView === 'overview'}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  sceActiveView === 'overview'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Gauge size={16} />
                Genel Bakış
              </button>
              <button
                type="button"
                onClick={() => setSceActiveView('details')}
                aria-pressed={sceActiveView === 'details'}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  sceActiveView === 'details'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                <TableProperties size={16} />
                Detaylı Takip
              </button>
            </div>
          )}

          {!sceFile ? (
            <div className="card mx-auto max-w-3xl p-10 text-center">
              <ShieldCheck
                size={34}
                className="mx-auto mb-4 text-sky-400"
              />
              <h2 className="text-lg font-semibold text-white">
                Başlamak için SCE Excel dosyasını yükleyin
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-white/50">
                Dosya tarayıcınızda işlenir. A sütunundaki kodlar fabrika
                kategorilerine otomatik ayrılır.
              </p>
            </div>
          ) : sceActiveView === 'overview' ? (
            <SCEOverviewDashboard />
          ) : (
            <SCEDashboard />
          )}
        </main>

        <footer className="mx-auto max-w-[1440px] px-4 py-6 text-center text-xs text-white/35 sm:px-6 lg:px-8">
          Veriler tamamen tarayıcıda işlenir · sunucuya hiçbir veri gönderilmez.
        </footer>
      </div>
    );
  }

  if (appMode === 'energy') {
    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm ring-1 ring-white/10">
                <Zap size={18} />
              </div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/65">
                  Enstrüman Bakım Müdürlüğü
                </p>
                <h1 className="text-base font-semibold leading-tight text-white">
                  Enerji Kritik Ekipmanlar Dashboard
                </h1>
                <p className="text-xs text-white/50">
                  Yasal Bakımlar
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAppMode('legal')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            >
              <ArrowLeft size={16} />
              Yasal Bakımlar
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="card p-10 text-center">
            <h2 className="text-lg font-semibold text-white">
              Enerji Kritik Ekipmanlar Dashboard
            </h2>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#db2f32] text-white shadow-sm ring-1 ring-white/10">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-200/65">
                Enstrüman Bakım Müdürlüğü
              </p>
              <h1 className="text-base font-semibold text-white leading-tight">
                MOC Dashboard
              </h1>
              <p className="text-xs text-white/50">
                Management of Change / Görüş & Aksiyon Takibi
              </p>
            </div>
            {allLoaded && (
              <button
                type="button"
                onClick={() => setUploadsOpen((open) => !open)}
                aria-expanded={uploadsOpen}
                className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400/30 sm:inline-flex"
              >
                <FileSpreadsheet size={16} />
                Excel Dosyaları
                <ChevronDown
                  size={16}
                  className={`transition ${uploadsOpen ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allLoaded && (
              <button
                type="button"
                onClick={() => setUploadsOpen((open) => !open)}
                aria-expanded={uploadsOpen}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-2 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400/30 sm:hidden"
                aria-label="Excel dosyaları panelini aç veya kapat"
              >
                <FileSpreadsheet size={18} />
              </button>
            )}
            {allLoaded && <DashboardTabs active={activeTab} onChange={setActiveTab} />}
            <button
              type="button"
              onClick={() => setAppMode('select')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400/30"
            >
              <ArrowLeft size={16} />
              Dashboard Seçimi
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {showUploadPanel && (
          <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <FileUpload
              title="Teknik Görüş Excel'i"
              subtitle="MOC katılımcılarının teknik görüş durumlarını içeren dosya"
              hint="Beklenen sütunlar: Şirket, MOC form no, MOC Konusu, Üniteler, Disiplin, Kullanıcı, Durum. Kullanıcılar hedef listeye göre otomatik süzülür."
              fileMeta={technicalFile}
              loading={technicalLoading}
              error={technicalError}
              onFile={uploadTechnical}
              onClear={clearTechnical}
              accentColorClass="from-white/20 to-white/5"
              surfaceClassName="upload-panel-red"
            />
            <FileUpload
              title="MOC Takip Excel'i"
              subtitle="MOC bilgi notu paylaşımı için takip edilen MOC numaraları"
              hint="Beklenen sütun: MOC No. Teknik görüşte olup bu listede olmayan MOC'lar bilgi notu paylaşılmamış sayılır."
              fileMeta={mocTakipFile}
              loading={mocTakipLoading}
              error={mocTakipError}
              onFile={uploadMOCTakip}
              onClear={clearMOCTakip}
              accentColorClass="from-violet-500 to-violet-700"
              surfaceClassName="upload-panel-dark"
            />
            <FileUpload
              title="Aksiyonlar Excel'i"
              subtitle="MOC sonrası atanan aksiyonların durum ve sorumlu bilgileri"
              hint="Beklenen sütunlar: Şirket, MOC form no, MOC Konusu, Ünite adı, Sorumlular, Aksiyon açıklaması, Durum, MOC durumu, Hedeflenen tamamlama tarihi"
              fileMeta={actionsFile}
              loading={actionsLoading}
              error={actionsError}
              onFile={uploadActions}
              onClear={clearActions}
              accentColorClass="from-red-500 to-red-700"
              surfaceClassName="upload-panel-dark"
            />
          </section>
        )}

        {!allLoaded ? (
          <div className="card mx-auto max-w-3xl p-10 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">
              Başlamak için üç Excel dosyasını da yükleyin
            </h2>
            <p className="text-sm text-white/55 max-w-xl mx-auto">
              Dosyalar yalnızca tarayıcınızda işlenir; sunucuya hiçbir veri gönderilmez.
              Yükledikten sonra Teknik Görüş ve Aksiyonlar panelleri açılır.
            </p>
          </div>
        ) : (
          <section>
            {activeTab === 'overview' && <MOCOverviewDashboard />}
            {activeTab === 'technical' && <TechnicalDashboard />}
            {activeTab === 'actions' && <ActionsDashboard />}
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-[1440px] px-4 py-6 text-center text-xs text-white/35 sm:px-6 lg:px-8">
        Veriler tamamen tarayıcıda işlenir · sunucuya hiçbir veri gönderilmez.
      </footer>
    </div>
  );
}

export default App;
