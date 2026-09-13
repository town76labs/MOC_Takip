import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Database,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react';
import {
  listActivePersonnel,
  listOvertimeBalances,
  listShiftAssignments,
} from '../../lib/overtime/repository';
import type { OvertimeRole } from '../../lib/auth';
import {
  type OvertimeBalance,
  type OvertimePersonnel,
  type PersonnelRole,
  type ShiftAssignment,
  type ShiftCode,
  type WorkGroup,
} from '../../lib/overtime/types';
import { isSupabaseConfigured } from '../../lib/supabase';
import { OvertimeBalanceBoard } from './OvertimeBalanceBoard';
import { OvertimeCalendar } from './OvertimeCalendar';
import { OvertimeEntryPanel } from './OvertimeEntryPanel';
import { OvertimeAdminPanel } from './OvertimeAdminPanel';
import { OvertimeGovernancePanel } from './OvertimeGovernancePanel';
import { OvertimeReportPanel } from './OvertimeReportPanel';

type OvertimeSection =
  | 'calendar'
  | 'balance'
  | 'entry'
  | 'admin'
  | 'governance'
  | 'reports'
  | 'shifts'
  | 'personnel';

const GROUPS: Array<'all' | WorkGroup> = ['all', 'A', 'B', 'C', 'D', 'L'];
const PERSONNEL_ROLES: Array<'all' | PersonnelRole> = [
  'all',
  'foreman',
  'technician',
];

const SHIFT_LABELS: Record<ShiftCode, string> = {
  shift_00_08: '00:00–08:00',
  shift_08_16: '08:00–16:00',
  shift_16_24: '16:00–24:00',
  day_08_17: '08:00–17:00',
  weekly_rest: 'Hafta Tatili',
};

function currentIstanbulDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

async function loadOvertimeDashboardData(workDate: string) {
  const [personnelRows, shiftRows, balanceRows] = await Promise.all([
    listActivePersonnel(),
    listShiftAssignments(workDate),
    listOvertimeBalances(),
  ]);
  return { personnelRows, shiftRows, balanceRows };
}

export default function OvertimeDashboard({
  overtimeRole,
}: {
  overtimeRole: OvertimeRole;
}) {
  const today = currentIstanbulDate();
  const [personnel, setPersonnel] = useState<OvertimePersonnel[]>([]);
  const [balances, setBalances] = useState<OvertimeBalance[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<'all' | WorkGroup>('all');
  const [selectedRole, setSelectedRole] = useState<'all' | PersonnelRole>('all');
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<OvertimeSection | null>(
    'calendar',
  );
  const [calendarMonth, setCalendarMonth] = useState(() =>
    monthKeyFromDate(today),
  );
  const [calendarDate, setCalendarDate] = useState(today);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const canEdit = overtimeRole === 'admin' || overtimeRole === 'operator';

  useEffect(() => {
    let active = true;

    async function loadPersonnel() {
      if (!isSupabaseConfigured) {
        setError('Supabase bağlantısı yapılandırılmadı.');
        setLoading(false);
        return;
      }

      try {
        const { personnelRows, shiftRows, balanceRows } =
          await loadOvertimeDashboardData(currentIstanbulDate());
        if (active) {
          setPersonnel(personnelRows);
          setShiftAssignments(shiftRows);
          setBalances(balanceRows);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Personel listesi alınamadı.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPersonnel();
    return () => {
      active = false;
    };
  }, []);

  async function refreshBalances() {
    const rows = await listOvertimeBalances();
    setBalances(rows);
  }

  async function retryDashboardLoad() {
    setLoading(true);
    setError('');
    try {
      const { personnelRows, shiftRows, balanceRows } =
        await loadOvertimeDashboardData(today);
      setPersonnel(personnelRows);
      setShiftAssignments(shiftRows);
      setBalances(balanceRows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Mesai Takibi verileri alınamadı.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshPersonnelData() {
    const [personnelRows, balanceRows] = await Promise.all([
      listActivePersonnel(),
      listOvertimeBalances(),
    ]);
    setPersonnel(personnelRows);
    setBalances(balanceRows);
  }

  function toggleSection(section: OvertimeSection) {
    setActiveSection((current) => (current === section ? null : section));
  }

  function openReports() {
    setActiveSection('reports');
    window.requestAnimationFrame(() => {
      document
        .getElementById('overtime-reports')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function handleOvertimeSaved(workDate: string) {
    await refreshBalances();
    setCalendarDate(workDate);
    setCalendarMonth(monthKeyFromDate(workDate));
    setCalendarRefreshKey((current) => current + 1);
    setActiveSection('calendar');
  }

  async function handleOvertimeChanged() {
    await refreshBalances();
    setCalendarRefreshKey((current) => current + 1);
  }

  const groupCounts = useMemo(() => {
    const counts: Record<WorkGroup, number> = { A: 0, B: 0, C: 0, D: 0, L: 0 };
    personnel.forEach((person) => {
      if (!person.overtimeEligible) return;
      counts[person.workGroup] += 1;
    });
    return counts;
  }, [personnel]);

  const roleCounts = useMemo(() => {
    const counts: Record<PersonnelRole, number> = { foreman: 0, technician: 0 };
    personnel.forEach((person) => {
      counts[person.personnelRole] += 1;
    });
    return counts;
  }, [personnel]);

  const filteredPersonnel = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
    return personnel.filter((person) => {
      if (selectedGroup !== 'all' && person.workGroup !== selectedGroup) {
        return false;
      }
      if (selectedRole !== 'all' && person.personnelRole !== selectedRole) {
        return false;
      }
      if (!normalizedSearch) return true;
      return [
        person.employeeNo,
        person.firstName,
        person.lastName,
        person.unit,
        person.workGroup,
        person.personnelRole === 'foreman' ? 'formen' : 'teknisyen',
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(normalizedSearch);
    });
  }, [personnel, search, selectedGroup, selectedRole]);

  const shiftPersonnelCount = personnel.length - groupCounts.L;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-violet-300/15 bg-[#0d0d0d] shadow-card">
        <div className="relative overflow-hidden border-b border-white/10 px-6 py-8 sm:px-8">
          <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-700 text-white shadow-lg shadow-violet-950/30">
                <Clock3 size={24} strokeWidth={1.8} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                Merkezi Mesai Yönetimi
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Formen ve Teknisyen Mesai Takibi
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                Personel dengesi, vardiya uygunluğu, mesai sayısı ve yevmiye
                toplamları tek merkezden takip edilecek.
              </p>
            </div>
            <div className="flex w-fit flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openReports}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/25 transition hover:from-violet-400 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-violet-300/35"
              >
                <FileText size={17} />
                Rapor Oluştur
              </button>
              <div
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${
                  error
                    ? 'border-red-400/20 bg-red-400/10 text-red-200'
                    : loading
                      ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                      : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    error
                      ? 'bg-red-300'
                      : loading
                        ? 'animate-pulse bg-amber-300'
                        : 'bg-emerald-300'
                  }`}
                />
                {error
                  ? 'Supabase bağlantı hatası'
                  : loading
                    ? 'Bağlantı kontrol ediliyor'
                    : 'Supabase bağlantısı aktif'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8 xl:grid-cols-5">
          <MetricCard
            icon={<UsersRound size={19} />}
            title="Aktif Personel"
            value={loading ? '—' : String(personnel.length)}
            description="Gömülü personel ana listesi"
          />
          <MetricCard
            icon={<UsersRound size={19} />}
            title="Formen"
            value={loading ? '—' : String(roleCounts.foreman)}
            description="Ekip yönetimi"
          />
          <MetricCard
            icon={<CheckCircle2 size={19} />}
            title="Teknisyen"
            value={loading ? '—' : String(roleCounts.technician)}
            description="Bakım personeli"
          />
          <MetricCard
            icon={<CalendarDays size={19} />}
            title="Vardiyalı"
            value={loading ? '—' : String(shiftPersonnelCount)}
            description="A/B/C/D grupları"
          />
          <MetricCard
            icon={<Clock3 size={19} />}
            title="Gündüz Personeli"
            value={loading ? '—' : String(groupCounts.L)}
            description="L · 08:00–17:00 düzeni"
          />
        </div>
      </section>

      {error && (
        <section className="flex flex-col gap-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CircleAlert size={20} className="mt-0.5 shrink-0 text-red-300" />
            <div>
              <p className="text-sm font-semibold text-red-100">
                Mesai verilerine ulaşılamadı
              </p>
              <p className="mt-1 text-xs leading-5 text-red-100/60">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void retryDashboardLoad()}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-2.5 text-xs font-semibold text-red-100 transition hover:bg-red-300/15 disabled:opacity-40"
          >
            {loading ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            Yeniden Dene
          </button>
        </section>
      )}

      {!loading && !error && personnel.length > 0 && (
        <>
          <OvertimeReportPanel
            personnel={personnel}
            expanded={activeSection === 'reports'}
            onToggle={() => toggleSection('reports')}
          />
          <OvertimeCalendar
            expanded={activeSection === 'calendar'}
            onToggle={() => toggleSection('calendar')}
            monthKey={calendarMonth}
            selectedDate={calendarDate}
            onMonthChange={setCalendarMonth}
            onDateSelect={setCalendarDate}
            refreshKey={calendarRefreshKey}
            canEdit={canEdit}
            onChanged={handleOvertimeChanged}
          />
          <OvertimeBalanceBoard
            personnel={personnel}
            balances={balances}
            expanded={activeSection === 'balance'}
            onToggle={() => toggleSection('balance')}
          />
          {overtimeRole === 'admin' && (
            <>
              <OvertimeGovernancePanel
                expanded={activeSection === 'governance'}
                onToggle={() => toggleSection('governance')}
                onPersonnelChanged={refreshPersonnelData}
              />
              <OvertimeAdminPanel
                expanded={activeSection === 'admin'}
                onToggle={() => toggleSection('admin')}
                onPeriodStarted={refreshBalances}
              />
            </>
          )}
          {canEdit && (
            <OvertimeEntryPanel
              personnel={personnel}
              balances={balances}
              expanded={activeSection === 'entry'}
              onToggle={() => toggleSection('entry')}
              onSaved={handleOvertimeSaved}
            />
          )}
        </>
      )}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-card">
        <button
          type="button"
          onClick={() => toggleSection('shifts')}
          className={`flex w-full flex-col gap-3 px-5 py-5 text-left transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between ${
            activeSection === 'shifts' ? 'border-b border-white/10' : ''
          }`}
          aria-expanded={activeSection === 'shifts'}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
              <CalendarDays size={18} />
            </span>
            <span>
              <span className="block text-lg font-semibold text-white">
                Bugünün Çalışma Düzeni
              </span>
              <span className="mt-1 block text-xs text-white/40">
                {today} · Europe/Istanbul
              </span>
            </span>
          </span>
          <span className="flex items-center gap-3 text-xs text-white/35">
            2026 vardiya çizelgesi
            <ChevronDown
              size={19}
              className={`transition-transform ${
                activeSection === 'shifts' ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>
        {activeSection === 'shifts' && (loading ? (
          <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-white/45">
            <LoaderCircle size={19} className="animate-spin text-violet-300" />
            Vardiya bilgisi yükleniyor…
          </div>
        ) : shiftAssignments.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-amber-200/75">
            2026 vardiya seed dosyası henüz uygulanmadı.
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
            {shiftAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className={`rounded-xl border p-4 ${
                  assignment.shiftCode === 'weekly_rest'
                    ? 'border-red-400/20 bg-red-500/10'
                    : 'border-white/10 bg-white/[0.035]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">
                    {assignment.workGroup} Grubu
                  </span>
                  <span className="text-xs text-white/35">
                    {groupCounts[assignment.workGroup]} kişi
                  </span>
                </div>
                <p
                  className={`mt-3 text-sm font-medium ${
                    assignment.shiftCode === 'weekly_rest'
                      ? 'text-red-200'
                      : 'text-violet-200'
                  }`}
                >
                  {SHIFT_LABELS[assignment.shiftCode]}
                </p>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-card">
        <button
          type="button"
          onClick={() => toggleSection('personnel')}
          className={`flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-white/[0.025] ${
            activeSection === 'personnel' ? 'border-b border-white/10' : ''
          }`}
          aria-expanded={activeSection === 'personnel'}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
              <Database size={18} />
            </span>
            <span>
              <span className="block text-lg font-semibold text-white">Personel Ana Listesi</span>
              <span className="mt-1 block text-xs text-white/40">
                Supabase üzerindeki aktif formen ve teknisyenler
              </span>
            </span>
          </span>
          <span className="flex items-center gap-3 text-sm text-white/45">
            {personnel.length} personel
            <ChevronDown
              size={19}
              className={`transition-transform ${
                activeSection === 'personnel' ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>

        {activeSection === 'personnel' && <>
        <div className="border-b border-white/10 px-5 py-4">
          <label className="relative block w-full lg:max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input bg-[#171717] pl-9"
              placeholder="Sicil, personel veya birim ara"
            />
          </label>
        </div>

        <div className="grid gap-4 border-b border-white/10 px-5 py-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <FilterGroup label="Çalışma düzeni">
            {GROUPS.map((group) => {
              const count = group === 'all' ? personnel.length : groupCounts[group];
              return (
                <FilterButton
                  key={group}
                  active={selectedGroup === group}
                  label={group === 'all' ? 'Tümü' : `${group} Grubu`}
                  count={count}
                  onClick={() => setSelectedGroup(group)}
                />
              );
            })}
          </FilterGroup>
          <FilterGroup label="Personel tipi">
            {PERSONNEL_ROLES.map((role) => {
              const count = role === 'all' ? personnel.length : roleCounts[role];
              return (
                <FilterButton
                  key={role}
                  active={selectedRole === role}
                  label={
                    role === 'all'
                      ? 'Tümü'
                      : role === 'foreman'
                        ? 'Formen'
                        : 'Teknisyen'
                  }
                  count={count}
                  onClick={() => setSelectedRole(role)}
                />
              );
            })}
          </FilterGroup>
        </div>

        {loading ? (
          <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-white/45">
            <LoaderCircle size={20} className="animate-spin text-violet-300" />
            Personel listesi yükleniyor…
          </div>
        ) : error ? (
          <div className="m-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            {error}
          </div>
        ) : personnel.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <UsersRound size={32} className="mx-auto text-white/20" />
            <h4 className="mt-4 text-sm font-semibold text-white">
              Personel seed dosyası henüz uygulanmadı
            </h4>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-white/40">
              Personel listesi Supabase’e eklendiğinde bu ekran otomatik olarak
              canlı veriyi gösterecek.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-white/[0.035] text-[11px] uppercase tracking-wider text-white/35">
                <tr>
                  <th className="px-5 py-3 font-medium">Sicil</th>
                  <th className="px-5 py-3 font-medium">Personel</th>
                  <th className="px-5 py-3 font-medium">Tip</th>
                  <th className="px-5 py-3 font-medium">Birim</th>
                  <th className="px-5 py-3 font-medium">Çalışma Düzeni</th>
                  <th className="px-5 py-3 text-right font-medium">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.07]">
                {filteredPersonnel.map((person) => (
                  <tr key={person.id} className="text-white/70 hover:bg-white/[0.025]">
                    <td className="px-5 py-3 font-mono text-xs text-white/45">
                      {person.employeeNo}
                    </td>
                    <td className="px-5 py-3 font-medium text-white">
                      {person.firstName} {person.lastName}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs ${
                          person.personnelRole === 'foreman'
                            ? 'bg-amber-400/10 text-amber-200'
                            : 'bg-sky-400/10 text-sky-200'
                        }`}
                      >
                        {person.personnelRole === 'foreman' ? 'Formen' : 'Teknisyen'}
                      </span>
                    </td>
                    <td className="px-5 py-3">{person.unit}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-xs">
                        {!person.overtimeEligible
                          ? 'Vardiya Atanmamış'
                          : person.workGroup === 'L'
                          ? 'L · 08:00–17:00'
                          : `${person.workGroup} Vardiyası`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`text-xs ${
                          person.overtimeEligible
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {person.overtimeEligible ? 'Aktif' : 'Vardiya Bekliyor'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPersonnel.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-white/40">
                Seçili filtrelerle eşleşen personel bulunamadı.
              </div>
            )}
          </div>
        )}
        </>}
      </section>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
        active
          ? 'border-violet-300/40 bg-violet-500/20 text-violet-100'
          : 'border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white'
      }`}
    >
      {label}
      <span className="ml-2 text-white/35">{count}</span>
    </button>
  );
}

function MetricCard({
  icon,
  title,
  value,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          {icon}
        </div>
        <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
      </div>
      <h3 className="mt-5 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-white/40">{description}</p>
    </div>
  );
}
