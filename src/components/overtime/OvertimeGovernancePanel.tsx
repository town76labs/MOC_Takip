import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  History,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react';
import {
  listAllPersonnel,
  listCancelledOvertimeCalls,
  listOvertimeAdminProfiles,
  listOvertimeAuditEntries,
  updateOvertimePersonnel,
  updateOvertimeProfileAccess,
} from '../../lib/overtime/repository';
import type {
  CancelledOvertimeCall,
  OvertimeAdminProfile,
  OvertimeAuditEntry,
  OvertimePersonnel,
  PersonnelRole,
  WorkGroup,
} from '../../lib/overtime/types';

type GovernanceTab = 'audit' | 'users' | 'personnel' | 'cancelled';

const APP_ACCESS_LABELS: Record<OvertimeAdminProfile['appAccess'], string> = {
  full: 'Tüm Dashboardlar',
  sce_only: 'Yalnızca SCE',
  overtime_only: 'Yalnızca Mesai',
  none: 'Erişim Yok',
};

const OVERTIME_ROLE_LABELS: Record<
  OvertimeAdminProfile['overtimeRole'],
  string
> = {
  admin: 'Yönetici',
  operator: 'Operatör',
  viewer: 'Görüntüleyici',
  none: 'Mesai Yetkisi Yok',
};

const TABLE_LABELS: Record<string, string> = {
  profiles: 'Kullanıcı Yetkisi',
  personnel: 'Personel',
  overtime_calls: 'Mesai Kaydı',
  overtime_tasks: 'İş Açıklaması',
  overtime_participants: 'Mesai Katılımcısı',
  balance_periods: 'Denge Dönemi',
  overtime_balance_adjustments: 'Bakiye Düzeltmesi',
};

const OPERATION_LABELS: Record<OvertimeAuditEntry['operation'], string> = {
  INSERT: 'Oluşturuldu',
  UPDATE: 'Güncellendi',
  DELETE: 'Silindi',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function auditSubject(entry: OvertimeAuditEntry) {
  const payload = entry.newData ?? entry.oldData ?? {};
  const text = (key: string) =>
    typeof payload[key] === 'string' ? String(payload[key]) : '';

  if (entry.tableName === 'profiles') {
    return text('username') || text('display_name') || entry.recordId;
  }
  if (entry.tableName === 'personnel') {
    return (
      `${text('first_name')} ${text('last_name')}`.trim() || entry.recordId
    );
  }
  if (entry.tableName === 'balance_periods') {
    return text('name') || entry.recordId;
  }
  if (entry.tableName === 'overtime_calls') {
    return [text('work_date'), text('location')].filter(Boolean).join(' · ');
  }
  return entry.recordId;
}

function changedFields(entry: OvertimeAuditEntry) {
  if (entry.operation !== 'UPDATE' || !entry.oldData || !entry.newData) {
    return entry.newData ?? entry.oldData;
  }

  const ignored = new Set(['updated_at']);
  return Object.keys(entry.newData).reduce<Record<string, unknown>>(
    (changes, key) => {
      if (
        !ignored.has(key) &&
        JSON.stringify(entry.oldData?.[key]) !== JSON.stringify(entry.newData?.[key])
      ) {
        changes[key] = {
          önce: entry.oldData?.[key] ?? null,
          sonra: entry.newData?.[key] ?? null,
        };
      }
      return changes;
    },
    {},
  );
}

export function OvertimeGovernancePanel({
  expanded,
  onToggle,
  onPersonnelChanged,
}: {
  expanded: boolean;
  onToggle: () => void;
  onPersonnelChanged: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<GovernanceTab>('audit');
  const [profiles, setProfiles] = useState<OvertimeAdminProfile[]>([]);
  const [personnel, setPersonnel] = useState<OvertimePersonnel[]>([]);
  const [auditEntries, setAuditEntries] = useState<OvertimeAuditEntry[]>([]);
  const [cancelledCalls, setCancelledCalls] = useState<
    CancelledOvertimeCall[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRows, personnelRows, auditRows, cancelledRows] =
        await Promise.all([
          listOvertimeAdminProfiles(),
          listAllPersonnel(),
          listOvertimeAuditEntries(),
          listCancelledOvertimeCalls(),
        ]);
      setProfiles(profileRows);
      setPersonnel(personnelRows);
      setAuditEntries(auditRows);
      setCancelledCalls(cancelledRows);
      setLoaded(true);
    } catch (loadError) {
      setError(
        errorMessage(loadError, 'Yönetim ve denetim bilgileri alınamadı.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded || loaded || loading) return undefined;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [expanded, loadData, loaded, loading]);

  const profileNames = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.displayName])),
    [profiles],
  );

  const filteredPersonnel = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('tr-TR');
    if (!normalized) return personnel;
    return personnel.filter((person) =>
      [
        person.employeeNo,
        person.firstName,
        person.lastName,
        person.unit,
        person.workGroup,
        person.personnelRole === 'foreman' ? 'formen' : 'teknisyen',
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(normalized),
    );
  }, [personnel, search]);

  async function saveProfile(
    profile: OvertimeAdminProfile,
    draft: Pick<OvertimeAdminProfile, 'appAccess' | 'overtimeRole' | 'active'>,
  ) {
    setSavingId(profile.id);
    setError('');
    setSuccess('');
    try {
      await updateOvertimeProfileAccess({
        profileId: profile.id,
        ...draft,
      });
      await loadData();
      setSuccess(`${profile.displayName} kullanıcısının yetkileri güncellendi.`);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Kullanıcı yetkileri güncellenemedi.'));
    } finally {
      setSavingId('');
    }
  }

  async function savePersonnel(
    person: OvertimePersonnel,
    draft: Pick<
      OvertimePersonnel,
      'unit' | 'workGroup' | 'personnelRole' | 'active' | 'overtimeEligible'
    >,
  ) {
    setSavingId(person.id);
    setError('');
    setSuccess('');
    try {
      await updateOvertimePersonnel({
        personnelId: person.id,
        ...draft,
      });
      await Promise.all([loadData(), onPersonnelChanged()]);
      setSuccess(`${person.firstName} ${person.lastName} kaydı güncellendi.`);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Personel kaydı güncellenemedi.'));
    } finally {
      setSavingId('');
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#0d0d0d] shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
            <ShieldCheck size={20} />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">
              Yönetim ve Denetim
            </span>
            <span className="mt-1 block text-xs text-white/40">
              Kullanıcı yetkileri, personel yönetimi ve işlem geçmişi
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3 text-xs text-cyan-200/70">
          Yalnızca Yönetici
          <ChevronDown
            size={19}
            className={`text-white/35 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap gap-2">
              <TabButton
                active={activeTab === 'audit'}
                label="İşlem Geçmişi"
                count={auditEntries.length}
                icon={<History size={15} />}
                onClick={() => setActiveTab('audit')}
              />
              <TabButton
                active={activeTab === 'users'}
                label="Kullanıcılar"
                count={profiles.length}
                icon={<KeyRound size={15} />}
                onClick={() => setActiveTab('users')}
              />
              <TabButton
                active={activeTab === 'personnel'}
                label="Personel"
                count={personnel.length}
                icon={<UsersRound size={15} />}
                onClick={() => setActiveTab('personnel')}
              />
              <TabButton
                active={activeTab === 'cancelled'}
                label="İptal Edilenler"
                count={cancelledCalls.length}
                icon={<Ban size={15} />}
                onClick={() => setActiveTab('cancelled')}
              />
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Yenile
            </button>
          </div>

          {error && (
            <div className="mx-5 mt-5 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200 sm:mx-6">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-5 mt-5 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-200 sm:mx-6">
              <CheckCircle2 size={15} />
              {success}
            </div>
          )}

          {loading && !loaded ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-white/40">
              <LoaderCircle size={18} className="animate-spin text-cyan-300" />
              Yönetim kayıtları yükleniyor…
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              {activeTab === 'audit' && (
                <AuditTab entries={auditEntries} profileNames={profileNames} />
              )}
              {activeTab === 'users' && (
                <UsersTab
                  profiles={profiles}
                  savingId={savingId}
                  onSave={saveProfile}
                />
              )}
              {activeTab === 'personnel' && (
                <PersonnelTab
                  personnel={filteredPersonnel}
                  total={personnel.length}
                  search={search}
                  onSearchChange={setSearch}
                  savingId={savingId}
                  onSave={savePersonnel}
                />
              )}
              {activeTab === 'cancelled' && (
                <CancelledTab
                  calls={cancelledCalls}
                  profileNames={profileNames}
                />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TabButton({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
        active
          ? 'border-cyan-300/35 bg-cyan-500/15 text-cyan-100'
          : 'border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.07] hover:text-white'
      }`}
    >
      {icon}
      {label}
      <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] text-white/45">
        {count}
      </span>
    </button>
  );
}

function UsersTab({
  profiles,
  savingId,
  onSave,
}: {
  profiles: OvertimeAdminProfile[];
  savingId: string;
  onSave: (
    profile: OvertimeAdminProfile,
    draft: Pick<OvertimeAdminProfile, 'appAccess' | 'overtimeRole' | 'active'>,
  ) => Promise<void>;
}) {
  return (
    <div>
      <div className="mb-4 rounded-xl border border-cyan-300/15 bg-cyan-500/[0.055] p-4">
        <div className="flex items-start gap-3">
          <UserCog size={19} className="mt-0.5 text-cyan-300" />
          <div>
            <p className="text-sm font-semibold text-white">Kullanıcı Yetkileri</p>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Burada yalnızca mevcut Supabase kullanıcılarının erişimi yönetilir.
              Yeni hesap ve parola oluşturma işlemi Supabase Auth ekranından yapılır.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {profiles.map((profile) => (
          <ProfileRow
            key={`${profile.id}-${profile.updatedAt}`}
            profile={profile}
            saving={savingId === profile.id}
            onSave={onSave}
          />
        ))}
      </div>
    </div>
  );
}

function ProfileRow({
  profile,
  saving,
  onSave,
}: {
  profile: OvertimeAdminProfile;
  saving: boolean;
  onSave: (
    profile: OvertimeAdminProfile,
    draft: Pick<OvertimeAdminProfile, 'appAccess' | 'overtimeRole' | 'active'>,
  ) => Promise<void>;
}) {
  const [appAccess, setAppAccess] = useState(profile.appAccess);
  const [overtimeRole, setOvertimeRole] = useState(profile.overtimeRole);
  const [active, setActive] = useState(profile.active);

  const changed =
    appAccess !== profile.appAccess ||
    overtimeRole !== profile.overtimeRole ||
    active !== profile.active;

  return (
    <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4 xl:grid-cols-[minmax(220px,1fr)_minmax(190px,0.65fr)_minmax(190px,0.65fr)_auto] xl:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">
            {profile.displayName}
          </p>
          <span
            className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
              active
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'bg-red-400/10 text-red-200'
            }`}
          >
            {active ? 'Aktif' : 'Pasif'}
          </span>
        </div>
        <p className="mt-1 text-xs text-white/40">@{profile.username}</p>
        <label className="mt-3 flex w-fit items-center gap-2 text-xs text-white/55">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 accent-cyan-400"
          />
          Kullanıcı aktif
        </label>
      </div>
      <label>
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Dashboard Erişimi
        </span>
        <select
          value={appAccess}
          onChange={(event) =>
            setAppAccess(event.target.value as OvertimeAdminProfile['appAccess'])
          }
          className="input bg-[#171717]"
        >
          {Object.entries(APP_ACCESS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Mesai Rolü
        </span>
        <select
          value={overtimeRole}
          onChange={(event) =>
            setOvertimeRole(
              event.target.value as OvertimeAdminProfile['overtimeRole'],
            )
          }
          className="input bg-[#171717]"
        >
          {Object.entries(OVERTIME_ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!changed || saving}
        onClick={() => void onSave(profile, { appAccess, overtimeRole, active })}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-xs font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
        Kaydet
      </button>
    </div>
  );
}

function PersonnelTab({
  personnel,
  total,
  search,
  onSearchChange,
  savingId,
  onSave,
}: {
  personnel: OvertimePersonnel[];
  total: number;
  search: string;
  onSearchChange: (value: string) => void;
  savingId: string;
  onSave: (
    person: OvertimePersonnel,
    draft: Pick<
      OvertimePersonnel,
      'unit' | 'workGroup' | 'personnelRole' | 'active' | 'overtimeEligible'
    >,
  ) => Promise<void>;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="input bg-[#171717] pl-9"
            placeholder="Sicil, personel, fabrika veya grup ara"
          />
        </label>
        <span className="text-xs text-white/40">
          {personnel.length} / {total} kayıt
        </span>
      </div>
      <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
        {personnel.map((person) => (
          <PersonnelRow
            key={`${person.id}-${person.unit}-${person.workGroup}-${person.personnelRole}-${person.active}-${person.overtimeEligible}`}
            person={person}
            saving={savingId === person.id}
            onSave={onSave}
          />
        ))}
        {personnel.length === 0 && (
          <div className="rounded-xl border border-white/10 p-10 text-center text-sm text-white/40">
            Aramayla eşleşen personel bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

function PersonnelRow({
  person,
  saving,
  onSave,
}: {
  person: OvertimePersonnel;
  saving: boolean;
  onSave: (
    person: OvertimePersonnel,
    draft: Pick<
      OvertimePersonnel,
      'unit' | 'workGroup' | 'personnelRole' | 'active' | 'overtimeEligible'
    >,
  ) => Promise<void>;
}) {
  const [unit, setUnit] = useState(person.unit);
  const [workGroup, setWorkGroup] = useState<WorkGroup>(person.workGroup);
  const [personnelRole, setPersonnelRole] = useState<PersonnelRole>(
    person.personnelRole,
  );
  const [active, setActive] = useState(person.active);
  const [overtimeEligible, setOvertimeEligible] = useState(
    person.overtimeEligible,
  );

  const changed =
    unit.trim() !== person.unit ||
    workGroup !== person.workGroup ||
    personnelRole !== person.personnelRole ||
    active !== person.active ||
    (active ? overtimeEligible : false) !== person.overtimeEligible;

  return (
    <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4 2xl:grid-cols-[minmax(220px,1fr)_minmax(150px,0.55fr)_120px_150px_minmax(185px,0.65fr)_auto] 2xl:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-white">
            {person.firstName} {person.lastName}
          </p>
          {!active && (
            <span className="rounded bg-red-400/10 px-2 py-1 text-[10px] font-semibold text-red-200">
              Pasif
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-[11px] text-white/35">
          Sicil {person.employeeNo}
        </p>
      </div>
      <label>
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Fabrika / Birim
        </span>
        <input
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          className="input bg-[#171717]"
          maxLength={80}
        />
      </label>
      <label>
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Grup
        </span>
        <select
          value={workGroup}
          onChange={(event) => setWorkGroup(event.target.value as WorkGroup)}
          className="input bg-[#171717]"
        >
          {(['A', 'B', 'C', 'D', 'L'] as WorkGroup[]).map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Personel Tipi
        </span>
        <select
          value={personnelRole}
          onChange={(event) =>
            setPersonnelRole(event.target.value as PersonnelRole)
          }
          className="input bg-[#171717]"
        >
          <option value="foreman">Formen</option>
          <option value="technician">Teknisyen</option>
        </select>
      </label>
      <div className="space-y-2 pb-0.5">
        <label className="flex items-center gap-2 text-xs text-white/55">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => {
              setActive(event.target.checked);
              if (!event.target.checked) setOvertimeEligible(false);
            }}
            className="h-4 w-4 accent-cyan-400"
          />
          Aktif personel
        </label>
        <label className="flex items-center gap-2 text-xs text-white/55">
          <input
            type="checkbox"
            checked={active && overtimeEligible}
            disabled={!active}
            onChange={(event) => setOvertimeEligible(event.target.checked)}
            className="h-4 w-4 accent-cyan-400 disabled:opacity-30"
          />
          Mesai listesine dahil
        </label>
      </div>
      <button
        type="button"
        disabled={!changed || saving || !unit.trim()}
        onClick={() =>
          void onSave(person, {
            unit: unit.trim(),
            workGroup,
            personnelRole,
            active,
            overtimeEligible: active && overtimeEligible,
          })
        }
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-xs font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-35"
      >
        {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
        Kaydet
      </button>
    </div>
  );
}

function AuditTab({
  entries,
  profileNames,
}: {
  entries: OvertimeAuditEntry[];
  profileNames: Map<string, string>;
}) {
  return (
    <div>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <History size={19} className="mt-0.5 text-cyan-300" />
        <div>
          <p className="text-sm font-semibold text-white">Merkezi İşlem Kaydı</p>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Mesai, yetki, personel ve denge dönemi değişiklikleri; işlemi yapan
            kullanıcı ve zaman bilgisiyle saklanır.
          </p>
        </div>
      </div>
      <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <details
            key={entry.id}
            className="group rounded-xl border border-white/[0.08] bg-white/[0.02] open:border-cyan-300/20 open:bg-cyan-500/[0.035]"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    entry.operation === 'INSERT'
                      ? 'bg-emerald-400'
                      : entry.operation === 'DELETE'
                        ? 'bg-red-400'
                        : 'bg-amber-400'
                  }`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-white/80">
                    {TABLE_LABELS[entry.tableName] ?? entry.tableName} ·{' '}
                    {OPERATION_LABELS[entry.operation]}
                  </span>
                  <span className="mt-1 block truncate text-xs text-white/40">
                    {auditSubject(entry) || entry.recordId}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-[11px] text-white/35">
                <span>{entry.actorId ? profileNames.get(entry.actorId) ?? 'Sistem kullanıcısı' : 'Sistem'}</span>
                <span>{formatDateTime(entry.createdAt)}</span>
                <ChevronDown
                  size={15}
                  className="transition-transform group-open:rotate-180"
                />
              </span>
            </summary>
            <div className="border-t border-white/[0.07] p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Değişiklik Detayı
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-white/55">
                {JSON.stringify(changedFields(entry), null, 2)}
              </pre>
            </div>
          </details>
        ))}
        {entries.length === 0 && (
          <div className="rounded-xl border border-white/10 p-10 text-center text-sm text-white/40">
            Henüz denetim kaydı bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}

function CancelledTab({
  calls,
  profileNames,
}: {
  calls: CancelledOvertimeCall[];
  profileNames: Map<string, string>;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {calls.map((call) => (
        <article
          key={call.id}
          className="rounded-xl border border-red-400/15 bg-red-500/[0.045] p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {formatDate(call.workDate)}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {call.location || 'Çalışma yeri belirtilmemiş'}
              </p>
            </div>
            <span className="rounded-md bg-red-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-200">
              İptal
            </span>
          </div>
          <div className="mt-4 rounded-lg border border-red-400/15 bg-black/15 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-red-200/60">
              İptal Gerekçesi
            </p>
            <p className="mt-1 text-xs leading-5 text-red-100/80">
              {call.cancellationReason}
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Personel
              </p>
              <p className="mt-1 text-xs leading-5 text-white/60">
                {call.participantNames.join(', ') || '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Yapılacak İşler
              </p>
              <p className="mt-1 text-xs leading-5 text-white/60">
                {call.tasks.join(' · ') || '—'}
              </p>
            </div>
          </div>
          <p className="mt-4 border-t border-white/[0.07] pt-3 text-[11px] text-white/35">
            {call.cancelledBy
              ? profileNames.get(call.cancelledBy) ?? 'Sistem kullanıcısı'
              : 'Sistem'}{' '}
            · {formatDateTime(call.cancelledAt)}
          </p>
        </article>
      ))}
      {calls.length === 0 && (
        <div className="col-span-full rounded-xl border border-white/10 p-10 text-center">
          <BriefcaseBusiness size={28} className="mx-auto text-white/20" />
          <p className="mt-3 text-sm text-white/40">İptal edilmiş mesai kaydı yok.</p>
        </div>
      )}
    </div>
  );
}
