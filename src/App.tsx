import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  BatteryCharging,
  ChevronDown,
  FileChartColumn,
  FileSearch,
  FileSpreadsheet,
  Gauge,
  GitCompareArrows,
  KeyRound,
  ListChecks,
  LockKeyhole,
  LogIn,
  LogOut,
  ShoppingCart,
  ShieldAlert,
  ShieldCheck,
  TableProperties,
  UserRound,
  WalletCards,
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
import { SATExportDashboard } from './components/sat/SATExportDashboard';
import { SATBudgetOverviewDashboard } from './components/sat/SATBudgetOverviewDashboard';
import { RCADashboard } from './components/rca/RCADashboard';
import {
  SCEV2Dashboard,
  SCEV2ScopeSelector,
} from './components/sce-v2/SCEV2Dashboard';

const SCE_V2_FACTORY_OPTIONS = [
  'ISKELE',
  'ETILEN',
  'AROMATIKLER',
  'AYPE',
  'AYPE-T',
  'YYPE',
  'PP',
  'PA',
];

type AppMode =
  | 'select'
  | 'moc'
  | 'legal'
  | 'sce'
  | 'sce-v2'
  | 'energy'
  | 'sat'
  | 'rca';

const AUTH_SESSION_KEY = 'moc-dashboard-authenticated';
const AUTH_USERS = [
  { username: 'sarkhan.hajizada', password: 'Sarxan*155' },
  { username: 'kaan.ayaz', password: 'Kaan*570' },
  { username: 'gokhan.kaya', password: 'gokhan*749' },
  { username: 'ilhan.keskin', password: '122333444455555' },
] as const;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return window.localStorage.getItem(AUTH_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  function handleLogin(username: string, password: string) {
    const normalizedUsername = username.trim();
    const valid = AUTH_USERS.some(
      (user) =>
        user.username === normalizedUsername && user.password === password,
    );

    if (!valid) return false;

    try {
      window.localStorage.setItem(AUTH_SESSION_KEY, 'true');
    } catch {
      // localStorage kapalıysa sadece mevcut sekme oturumu açık kalır.
    }
    setIsAuthenticated(true);
    return true;
  }

  function handleLogout() {
    try {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // localStorage kapalıysa sessiz geç.
    }
    setIsAuthenticated(false);
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <DashboardApp onLogout={handleLogout} />;
}

function DashboardApp({ onLogout }: { onLogout: () => void }) {
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
  const sceStarFile = useDataStore((s) => s.sceStarFile);
  const sceStarLoading = useDataStore((s) => s.sceStarLoading);
  const sceStarError = useDataStore((s) => s.sceStarError);
  const uploadSCEStar = useDataStore((s) => s.uploadSCEStar);
  const clearSCEStar = useDataStore((s) => s.clearSCEStar);
  const sceStadFile = useDataStore((s) => s.sceStadFile);
  const sceStadLoading = useDataStore((s) => s.sceStadLoading);
  const sceStadError = useDataStore((s) => s.sceStadError);
  const uploadSCEStad = useDataStore((s) => s.uploadSCEStad);
  const clearSCEStad = useDataStore((s) => s.clearSCEStad);
  const sceV2File = useDataStore((s) => s.sceV2File);
  const sceV2Rows = useDataStore((s) => s.sceV2Rows);
  const sceV2Loading = useDataStore((s) => s.sceV2Loading);
  const sceV2Error = useDataStore((s) => s.sceV2Error);
  const uploadSCEV2 = useDataStore((s) => s.uploadSCEV2);
  const clearSCEV2 = useDataStore((s) => s.clearSCEV2);
  const sceV2StarRows = useDataStore((s) => s.sceV2StarRows);
  const sceV2StarFile = useDataStore((s) => s.sceV2StarFile);
  const sceV2StarLoading = useDataStore((s) => s.sceV2StarLoading);
  const sceV2StarError = useDataStore((s) => s.sceV2StarError);
  const uploadSCEV2Star = useDataStore((s) => s.uploadSCEV2Star);
  const clearSCEV2Star = useDataStore((s) => s.clearSCEV2Star);
  const sceV2ControlFile = useDataStore((s) => s.sceV2ControlFile);
  const sceV2ControlLoading = useDataStore((s) => s.sceV2ControlLoading);
  const sceV2ControlError = useDataStore((s) => s.sceV2ControlError);
  const uploadSCEV2Control = useDataStore((s) => s.uploadSCEV2Control);
  const clearSCEV2Control = useDataStore((s) => s.clearSCEV2Control);
  const rcaFile = useDataStore((s) => s.rcaFile);
  const rcaLoading = useDataStore((s) => s.rcaLoading);
  const rcaError = useDataStore((s) => s.rcaError);
  const uploadRCA = useDataStore((s) => s.uploadRCA);
  const clearRCA = useDataStore((s) => s.clearRCA);
  const satFile = useDataStore((s) => s.satFile);
  const satLoading = useDataStore((s) => s.satLoading);
  const satError = useDataStore((s) => s.satError);
  const satFormat = useDataStore((s) => s.satFormat);
  const uploadSAT = useDataStore((s) => s.uploadSAT);
  const clearSAT = useDataStore((s) => s.clearSAT);
  const satBudgetFile = useDataStore((s) => s.satBudgetFile);
  const satBudgetLoading = useDataStore((s) => s.satBudgetLoading);
  const satBudgetError = useDataStore((s) => s.satBudgetError);
  const uploadSATBudget = useDataStore((s) => s.uploadSATBudget);
  const clearSATBudget = useDataStore((s) => s.clearSATBudget);
  const satBudgetUsageFile = useDataStore((s) => s.satBudgetUsageFile);
  const satBudgetUsageLoading = useDataStore((s) => s.satBudgetUsageLoading);
  const satBudgetUsageError = useDataStore((s) => s.satBudgetUsageError);
  const uploadSATBudgetUsage = useDataStore((s) => s.uploadSATBudgetUsage);
  const clearSATBudgetUsage = useDataStore((s) => s.clearSATBudgetUsage);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [uploadsOpen, setUploadsOpen] = useState(false);
  const [sceUploadsOpen, setSceUploadsOpen] = useState(false);
  const [sceV2UploadsOpen, setSceV2UploadsOpen] = useState(false);
  const [sceV2SelectedCompany, setSceV2SelectedCompany] = useState<
    'PETKIM' | 'STAR'
  >('PETKIM');
  const [sceV2SelectedFactories, setSceV2SelectedFactories] = useState<
    string[]
  >([]);
  const [sceV2SelectedConsoles, setSceV2SelectedConsoles] = useState<string[]>(
    [],
  );
  const [sceActiveView, setSceActiveView] = useState<'overview' | 'details'>(
    'overview',
  );
  const [satUploadsOpen, setSatUploadsOpen] = useState(false);
  const [satActiveView, setSatActiveView] = useState<'overview' | 'tracking'>(
    'overview',
  );
  const [appMode, setAppMode] = useState<AppMode>('select');

  const allLoaded = !!technicalFile && !!actionsFile && !!mocTakipFile;
  const showUploadPanel = !allLoaded || uploadsOpen;

  function selectSCEV2Company(company: 'PETKIM' | 'STAR') {
    setSceV2SelectedCompany(company);
    setSceV2SelectedFactories([]);
    setSceV2SelectedConsoles([]);
  }

  function toggleSCEV2Factory(factory: string) {
    setSceV2SelectedFactories((current) =>
      current.length === 0
        ? [factory]
        : current.includes(factory)
          ? current.filter((item) => item !== factory)
          : [...current, factory],
    );
  }

  if (appMode === 'select') {
    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <button
          type="button"
          onClick={onLogout}
          className="fixed right-5 top-5 z-50 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs font-medium text-white/65 shadow-elevated backdrop-blur transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400/30"
        >
          <LogOut size={15} />
          Oturumu Kapat
        </button>
        <main className="mx-auto flex min-h-screen max-w-[1440px] items-center px-4 py-10 sm:px-6 lg:px-8">
          <section className="w-full">
            <div className="mb-10 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#db2f32] text-white shadow-sm ring-1 ring-white/10">
                <ICEngineeringIcon />
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setAppMode('moc')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-red-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-red-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-red-400 to-red-700 text-white shadow-sm ring-1 ring-white/10">
                  <GitCompareArrows size={25} strokeWidth={1.8} />
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
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-sm ring-1 ring-white/10">
                  <ShieldCheck size={25} strokeWidth={1.8} />
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
                  <FileChartColumn size={25} strokeWidth={1.8} />
                </div>
                <div className="mt-8 text-3xl font-semibold text-white">
                  SAT Takip Dashboard
                </div>
                <div className="mt-3 text-sm text-white/50">
                  Satın Alma Talepleri ve Bütçe Takibi
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAppMode('rca')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-amber-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-700 text-white shadow-sm">
                  <FileSearch size={25} strokeWidth={1.8} />
                </div>
                <div className="mt-8 text-3xl font-semibold text-white">
                  RCA Dashboard
                </div>
                <div className="mt-3 text-sm text-white/50">
                  Root Cause Analysis Aksiyon Takibi
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

  if (appMode === 'rca') {
    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-700 text-white shadow-sm ring-1 ring-white/10">
                <FileSearch size={20} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/65">
                  Enstrüman Bakım Müdürlüğü
                </p>
                <h1 className="text-base font-semibold leading-tight text-white">
                  RCA Dashboard
                </h1>
                <p className="text-xs text-white/50">
                  Root Cause Analysis Aksiyon Takibi
                </p>
              </div>
              {rcaFile && (
                <button
                  type="button"
                  onClick={clearRCA}
                  className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/30 sm:inline-flex"
                >
                  <FileSpreadsheet size={16} />
                  Excel'i Değiştir
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAppMode('select')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            >
              <ArrowLeft size={16} />
              Dashboard Seçimi
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {!rcaFile && (
            <section className="mb-6 max-w-3xl">
              <FileUpload
                title="RCA Aksiyon Excel'i"
                subtitle="RCA öneri aksiyonları, sorumluları ve hedef tamamlanma tarihleri"
                hint="Recommendation ID, Analysis ID, Job Title, Status ve Target Completion Date başlıkları beklenir. Aksiyon sahibi F sütunundan alınır."
                fileMeta={rcaFile}
                loading={rcaLoading}
                error={rcaError}
                onFile={uploadRCA}
                onClear={clearRCA}
                accentColorClass="from-amber-400 to-orange-700"
                surfaceClassName="upload-panel-dark"
              />
            </section>
          )}

          {!rcaFile ? (
            <div className="card mx-auto max-w-3xl p-10 text-center">
              <FileSearch
                size={36}
                className="mx-auto mb-4 text-amber-300"
                strokeWidth={1.8}
              />
              <h2 className="text-lg font-semibold text-white">
                Başlamak için RCA Excel dosyasını yükleyin
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
                Proje/proses otomasyon kapsamı dışarıda bırakılır; kalan RCA
                aksiyonları Petkim, Star ve STAD olarak ayrıştırılır.
              </p>
            </div>
          ) : (
            <RCADashboard />
          )}
        </main>

        <footer className="mx-auto max-w-[1440px] px-4 py-6 text-center text-xs text-white/35 sm:px-6 lg:px-8">
          Veriler tamamen tarayıcıda işlenir · sunucuya hiçbir veri gönderilmez.
        </footer>
      </div>
    );
  }

  if (appMode === 'sat') {
    const showSATUpload =
      !satFile || !satBudgetFile || !satBudgetUsageFile || satUploadsOpen;
    const hasAnySATFile = !!satFile || !!satBudgetFile || !!satBudgetUsageFile;

    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-teal-600 text-white shadow-sm ring-1 ring-white/10">
                <FileChartColumn size={20} strokeWidth={1.8} />
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
              {hasAnySATFile && (
                <button
                  type="button"
                  onClick={() => setSatUploadsOpen((open) => !open)}
                  aria-expanded={satUploadsOpen}
                  className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30 sm:inline-flex"
                >
                  <FileSpreadsheet size={16} />
                  SAT Excel Dosyaları
                  <ChevronDown
                    size={16}
                    className={`transition ${satUploadsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasAnySATFile && (
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
            <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <FileUpload
                title="SAT Bütçe Girişleri Excel'i"
                subtitle="Genel Bakış için şirket ve bütçe türü hareketleri"
                hint="H sütununda tanımlı mali merkez kodları, L sütununda işaretli USD işlem toplamları bulunmalıdır."
                fileMeta={satBudgetFile}
                loading={satBudgetLoading}
                error={satBudgetError}
                onFile={uploadSATBudget}
                onClear={clearSATBudget}
                accentColorClass="from-violet-500 to-cyan-500"
                surfaceClassName="upload-panel-dark"
              />
              <FileUpload
                title="SAT Bütçe Kullanım Detayı Excel'i"
                subtitle="SAT, SAS ve fatura aşamalarındaki bütçe kullanımları"
                hint="A-B sütunlarında belge bağlantıları, D sütununda belge türü, I sütununda USD tutarı ve K sütununda mali merkez bulunmalıdır. 55044108 için yalnız R=TPINAR kullanımları alınır."
                fileMeta={satBudgetUsageFile}
                loading={satBudgetUsageLoading}
                error={satBudgetUsageError}
                onFile={uploadSATBudgetUsage}
                onClear={clearSATBudgetUsage}
                accentColorClass="from-amber-500 to-orange-600"
                surfaceClassName="upload-panel-dark"
              />
              <FileUpload
                title="SAT Takip Excel'i"
                subtitle="Satın alma talepleri, onay ve teklif süreçlerini içeren dosya"
                hint="SAT LİSTESİ, yeni SAT Takip Listesi veya SAP EXPORT desteklenir. Sabit sütun konumlarından, hücre renginden bağımsız okunur."
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

          {hasAnySATFile && (
            <div className="mb-6 inline-flex rounded-lg border border-white/10 bg-black/35 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setSatActiveView('overview')}
                aria-pressed={satActiveView === 'overview'}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  satActiveView === 'overview'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Gauge size={16} />
                Genel Bakış
              </button>
              <button
                type="button"
                onClick={() => setSatActiveView('tracking')}
                aria-pressed={satActiveView === 'tracking'}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  satActiveView === 'tracking'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                <TableProperties size={16} />
                SAT Takip
              </button>
            </div>
          )}

          {satActiveView === 'overview' ? (
            satBudgetFile ? (
              <SATBudgetOverviewDashboard />
            ) : (
              <div className="card mx-auto max-w-3xl p-10 text-center">
                <WalletCards size={36} className="mx-auto mb-4 text-violet-300" />
                <h2 className="text-lg font-semibold text-white">
                  Genel Bakış için SAT Bütçe Girişleri Excel dosyasını yükleyin
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
                  Şirket, CAPEX, OPEX ve Operational CAPEX dağılımları bu dosyadan hesaplanır.
                </p>
              </div>
            )
          ) : !satFile ? (
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
          ) : satFormat === 'sap_export' ? (
            <SATExportDashboard />
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-sm ring-1 ring-white/10">
                <ShieldCheck size={20} strokeWidth={1.8} />
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                onClick={() => setAppMode('sce')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-sky-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-sm ring-1 ring-white/10">
                  <ShieldAlert size={25} strokeWidth={1.8} />
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
                onClick={() => setAppMode('sce-v2')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-cyan-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-teal-700 text-white shadow-sm ring-1 ring-white/10">
                  <ListChecks size={25} strokeWidth={1.8} />
                </div>
                <div className="mt-8 text-3xl font-semibold text-white">
                  SCE V2 Dashboard
                </div>
                <div className="mt-3 text-sm text-white/50">
                  SAP Sipariş ve Kalibrasyon Takibi
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAppMode('energy')}
                className="group min-h-56 rounded-lg border border-white/10 bg-[#0d0d0d] p-6 text-left shadow-card transition hover:border-amber-400/70 hover:bg-white/[0.04] hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-700 text-white shadow-sm ring-1 ring-white/10">
                  <BatteryCharging size={25} strokeWidth={1.8} />
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

  if (appMode === 'sce-v2') {
    const isSCEV2Star = sceV2SelectedCompany === 'STAR';
    const starUnitOptions = [
      ...new Set(sceV2StarRows.map((row) => row.unit).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
    const unitsByConsole = new Map<string, Set<string>>();
    for (const row of sceV2StarRows) {
      if (!row.consoleName || !row.unit) continue;
      const units = unitsByConsole.get(row.consoleName) ?? new Set<string>();
      units.add(row.unit);
      unitsByConsole.set(row.consoleName, units);
    }
    const starConsoleGroups = [...unitsByConsole.entries()]
      .sort(([left], [right]) => {
        if (left === 'JETTY') return 1;
        if (right === 'JETTY') return -1;
        return left.localeCompare(right, 'tr', { numeric: true });
      })
      .map(([name, units]) => ({
        name,
        options: [...units].sort((a, b) =>
          a.localeCompare(b, 'tr', { numeric: true }),
        ),
      }));
    const petkimFactories = new Set(
      sceV2Rows.map((row) => row.factory).filter(Boolean),
    );
    const petkimFactoryOptions = [
      ...SCE_V2_FACTORY_OPTIONS.filter((factory) => petkimFactories.has(factory)),
      ...[...petkimFactories]
        .filter((factory) => !SCE_V2_FACTORY_OPTIONS.includes(factory))
        .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true })),
    ];
    const showSCEV2Uploads = sceV2UploadsOpen;

    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-teal-700 text-white shadow-sm ring-1 ring-white/10">
                <ListChecks size={20} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/65">
                  Enstrüman Bakım Müdürlüğü
                </p>
                <h1 className="text-base font-semibold leading-tight text-white">
                  SCE V2 Dashboard
                </h1>
                <p className="text-xs text-white/50">
                  SAP Sipariş, Deferral ve Kalibrasyon Raporu Takibi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSceV2UploadsOpen((open) => !open)}
                aria-expanded={sceV2UploadsOpen}
                className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30 sm:inline-flex"
              >
                <FileSpreadsheet size={16} />
                SCE V2 Excel Dosyaları
                <ChevronDown
                  size={16}
                  className={`transition ${
                    sceV2UploadsOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSceV2UploadsOpen((open) => !open)}
                aria-expanded={sceV2UploadsOpen}
                aria-label="SCE V2 Excel dosyası panelini aç veya kapat"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-2 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30 sm:hidden"
              >
                <FileSpreadsheet size={18} />
              </button>
              <button
                type="button"
                onClick={() => setAppMode('legal')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              >
                <ArrowLeft size={16} />
                Yasal Bakımlar
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {showSCEV2Uploads &&
            (isSCEV2Star ? (
              <section className="mb-6 grid grid-cols-1 gap-4">
                <FileUpload
                  title="Star SCE Sipariş Son Durum Excel'i"
                  subtitle="Star üniteleri, ekipmanları ve periyodik bakım siparişleri"
                  hint="A sütunundaki işletme alanı U-xxx ünitesine dönüştürülür. Ekipman kategorisi, tipi ve konsolu kalıcı eşleştirme tablosundan alınır."
                  fileMeta={sceV2StarFile}
                  loading={sceV2StarLoading}
                  error={sceV2StarError}
                  onFile={(file) => {
                    setSceV2SelectedConsoles([]);
                    setSceV2SelectedFactories([]);
                    return uploadSCEV2Star(file);
                  }}
                  onClear={() => {
                    clearSCEV2Star();
                    setSceV2SelectedConsoles([]);
                    setSceV2SelectedFactories([]);
                  }}
                  accentColorClass="from-red-500 to-red-800"
                  surfaceClassName="upload-panel-dark"
                />
              </section>
            ) : (
              <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <FileUpload
                  title="1. SAP SCE Sipariş Durumları Excel'i"
                  subtitle="Ekipman, teknik birim, sipariş ve bakım durumları"
                  hint="Ekipman, Teknik birim, Kullanıcı drm., Yürütme bşl.tarihi, Yürütme bitiş tarihi, Bakım kalemi ve Bakım planı sütunları beklenir."
                  fileMeta={sceV2File}
                  loading={sceV2Loading}
                  error={sceV2Error}
                  onFile={(file) => {
                    setSceV2SelectedFactories([]);
                    return uploadSCEV2(file);
                  }}
                  onClear={() => {
                    clearSCEV2();
                    setSceV2SelectedFactories([]);
                  }}
                  accentColorClass="from-cyan-400 to-sky-700"
                  surfaceClassName="upload-panel-dark"
                />
                <FileUpload
                  title="2. Saha Kontrol ve Rapor Excel'i"
                  subtitle="Kalibrasyon raporu ve deferral başlatılma bilgileri"
                  hint="Ekipman, Kalibrasyon Raporu ve Deferral Durumu sütunları kullanılır. Ekipman numarası SAP dosyasıyla eşleştirilir."
                  fileMeta={sceV2ControlFile}
                  loading={sceV2ControlLoading}
                  error={sceV2ControlError}
                  onFile={uploadSCEV2Control}
                  onClear={clearSCEV2Control}
                  accentColorClass="from-violet-500 to-fuchsia-700"
                  surfaceClassName="upload-panel-dark"
                />
              </section>
            ))}

          <div className="mb-6">
            <SCEV2ScopeSelector
              selectedCompany={sceV2SelectedCompany}
              onCompanyChange={selectSCEV2Company}
              factoryOptions={
                isSCEV2Star ? starUnitOptions : petkimFactoryOptions
              }
              factoryGroups={isSCEV2Star ? starConsoleGroups : undefined}
              selectedGroups={isSCEV2Star ? sceV2SelectedConsoles : []}
              onGroupToggle={(group) => {
                setSceV2SelectedConsoles((current) =>
                  current.includes(group)
                    ? current.filter((item) => item !== group)
                    : [...current, group],
                );
                setSceV2SelectedFactories([]);
              }}
              onAllGroups={() => {
                setSceV2SelectedConsoles([]);
                setSceV2SelectedFactories([]);
              }}
              selectedFactories={sceV2SelectedFactories}
              onFactoryToggle={toggleSCEV2Factory}
              onAllFactories={() => setSceV2SelectedFactories([])}
            />
          </div>

          {isSCEV2Star ? (
            <>
              {!sceV2StarFile ? (
                <div className="card mx-auto max-w-3xl p-10 text-center">
                  <ListChecks
                    size={36}
                    className="mx-auto mb-4 text-red-300"
                    strokeWidth={1.8}
                  />
                  <h2 className="text-lg font-semibold text-white">
                    Başlamak için Star SCE Sipariş Son Durum Excel dosyasını
                    yükleyin
                  </h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
                    Konsol, ünite ve ekipman tipi filtreleri dosya yüklendikten
                    sonra otomatik hazırlanır.
                  </p>
                </div>
              ) : (
                <SCEV2Dashboard
                  key={`star-${sceV2SelectedConsoles.join('|') || 'all'}-${
                    sceV2SelectedFactories.join('|') || 'all'
                  }`}
                  company="STAR"
                  selectedFactories={sceV2SelectedFactories}
                  selectedConsoleScopes={sceV2SelectedConsoles}
                />
              )}
            </>
          ) : (
            <>
              {!sceV2File ? (
                <div className="card mx-auto max-w-3xl p-10 text-center">
                  <ListChecks
                    size={36}
                    className="mx-auto mb-4 text-cyan-300"
                    strokeWidth={1.8}
                  />
                  <h2 className="text-lg font-semibold text-white">
                    Başlamak için SAP SCE Sipariş Durumları Excel dosyasını yükleyin
                  </h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
                    Saha kontrol dosyası daha sonra da yüklenebilir. SAP bakım
                    durumları ilk dosyadan hemen hesaplanır.
                  </p>
                </div>
              ) : (
                <SCEV2Dashboard
                  key={sceV2SelectedFactories.join('|') || 'all'}
                  company="PETKIM"
                  selectedFactories={sceV2SelectedFactories}
                  selectedConsoleScopes={[]}
                />
              )}
            </>
          )}
        </main>

        <footer className="mx-auto max-w-[1440px] px-4 py-6 text-center text-xs text-white/35 sm:px-6 lg:px-8">
          Veriler tamamen tarayıcıda işlenir · sunucuya hiçbir veri gönderilmez.
        </footer>
      </div>
    );
  }

  if (appMode === 'sce') {
    const hasAnySCEFile = !!sceFile || !!sceStarFile || !!sceStadFile;
    const showSCEUpload =
      !sceFile || !sceStarFile || !sceStadFile || sceUploadsOpen;

    return (
      <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-sm ring-1 ring-white/10">
                <ShieldAlert size={20} strokeWidth={1.8} />
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
              {hasAnySCEFile && (
                <button
                  type="button"
                  onClick={() => setSceUploadsOpen((open) => !open)}
                  aria-expanded={sceUploadsOpen}
                  className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/30 sm:inline-flex"
                >
                  <FileSpreadsheet size={16} />
                  SCE Excel Dosyaları
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
              {hasAnySCEFile && (
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
            <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <FileUpload
                title="Petkim SCE Excel'i"
                subtitle="Petkim SCE ekipmanları, bakım planları ve periyodik bakım durumları"
                hint="A sütununda fabrika kodu bulunmalıdır: 1000, 1001, 1002, 1007, 1008, 1009, 1010 veya 1014."
                fileMeta={sceFile}
                loading={sceLoading}
                error={sceError}
                onFile={uploadSCE}
                onClear={clearSCE}
                accentColorClass="from-sky-400 to-sky-600"
                surfaceClassName="upload-panel-dark"
              />
              <FileUpload
                title="Star SCE Excel'i"
                subtitle="Star SCE ekipmanları için dosya girişi"
                hint="Şimdilik aynı SCE formatı beklenir. Yüklenen kayıtlar Star şirketi altında tutulur."
                fileMeta={sceStarFile}
                loading={sceStarLoading}
                error={sceStarError}
                onFile={uploadSCEStar}
                onClear={clearSCEStar}
                accentColorClass="from-red-500 to-red-700"
                surfaceClassName="upload-panel-dark"
              />
              <FileUpload
                title="STAD SCE Excel'i"
                subtitle="STAD SCE ekipmanları için dosya girişi"
                hint="Şimdilik aynı SCE formatı beklenir. Yüklenen kayıtlar STAD şirketi altında tutulur."
                fileMeta={sceStadFile}
                loading={sceStadLoading}
                error={sceStadError}
                onFile={uploadSCEStad}
                onClear={clearSCEStad}
                accentColorClass="from-emerald-500 to-green-700"
                surfaceClassName="upload-panel-dark"
              />
            </section>
          )}

          {hasAnySCEFile && (
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

          {!hasAnySCEFile ? (
            <div className="card mx-auto max-w-3xl p-10 text-center">
              <ShieldAlert
                size={34}
                className="mx-auto mb-4 text-sky-400"
                strokeWidth={1.8}
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-700 text-white shadow-sm ring-1 ring-white/10">
                <BatteryCharging size={20} strokeWidth={1.8} />
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-red-400 to-red-700 text-white shadow-sm ring-1 ring-white/10">
              <GitCompareArrows size={20} strokeWidth={1.8} />
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

function LoginScreen({
  onLogin,
}: {
  onLogin: (username: string, password: string) => boolean;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = onLogin(username, password);
    if (!valid) {
      setError('Kullanıcı adı veya şifre hatalı.');
      setPassword('');
      return;
    }
    setError('');
  }

  return (
    <div className="fintech-shell min-h-screen bg-[#303030] text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-[1440px] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-elevated lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-[520px] overflow-hidden bg-gradient-to-br from-[#161616] via-[#101010] to-black p-8 sm:p-10">
            <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-red-500/20 blur-3xl" />
            <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#db2f32] text-white shadow-sm ring-1 ring-white/10">
                  <ICEngineeringIcon />
                </div>
                <div className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
                  Yetkili Kullanıcı Girişi
                </div>
                <h1 className="mt-3 max-w-md text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Enstrüman Bakım Müdürlüğü
                </h1>
                <p className="mt-4 max-w-md text-sm leading-6 text-white/55">
                  MOC, SCE, SAT ve RCA dashboardlarına devam etmek için kullanıcı
                  adı ve şifre ile giriş yapın.
                </p>
              </div>

              <div className="mt-10 grid gap-3 text-sm text-white/50 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <ShieldCheck size={20} className="mb-3 text-emerald-300" />
                  MOC Takip
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <ShieldAlert size={20} className="mb-3 text-sky-300" />
                  SCE Takip
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <FileChartColumn size={20} className="mb-3 text-cyan-300" />
                  SAT Takip
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <FileSearch size={20} className="mb-3 text-amber-300" />
                  RCA Takip
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#111111] p-8 sm:p-10">
            <div className="mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-cyan-300">
                <LockKeyhole size={22} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-white">
                Giriş Yap
              </h2>
              <p className="mt-2 text-sm text-white/45">
                Oturum tarayıcıda tutulur; çıkış yapana kadar tekrar sorulmaz.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/50">
                  Kullanıcı Adı
                </span>
                <div className="relative">
                  <UserRound
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  />
                  <input
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setError('');
                    }}
                    autoComplete="username"
                    className="input bg-[#171717] pl-9"
                    placeholder="Kullanıcı adınızı girin"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/50">
                  Şifre
                </span>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError('');
                    }}
                    autoComplete="current-password"
                    className="input bg-[#171717] pl-9"
                    placeholder="Şifrenizi girin"
                  />
                </div>
              </label>

              {error && (
                <div className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-300/35"
              >
                <LogIn size={17} />
                Dashboard'a Gir
              </button>
            </form>

          </div>
        </section>
      </main>
    </div>
  );
}

function ICEngineeringIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="7.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10.2 16h3.1l1.65-3.3 2.25 6.6 1.65-3.3h2.95"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 3.5v5.25M16 23.25v5.25M3.5 16h5.25M23.25 16h5.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="16" cy="3.5" r="1.5" fill="currentColor" />
      <circle cx="16" cy="28.5" r="1.5" fill="currentColor" />
      <circle cx="3.5" cy="16" r="1.5" fill="currentColor" />
      <circle cx="28.5" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

export default App;
