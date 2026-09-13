import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { listPersonnelOvertimeHistory } from '../../lib/overtime/repository';
import type {
  OvertimeBalance,
  OvertimeHistoryEntry,
  OvertimePersonnel,
  PersonnelRole,
  WorkGroup,
} from '../../lib/overtime/types';

type SortMetric = 'wage' | 'occurrence';

function currentIstanbulYear() {
  return Number(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
    }).format(new Date()),
  );
}

function emptyBalance(personnelId: string): OvertimeBalance {
  return {
    personnelId,
    occurrenceCount: 0,
    wageCreditTotal: 0,
    lastOvertimeDate: null,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(`${value}T12:00:00+03:00`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

function durationHours(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

export function OvertimeBalanceBoard({
  personnel,
  balances,
  expanded,
  onToggle,
}: {
  personnel: OvertimePersonnel[];
  balances: OvertimeBalance[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const currentYear = currentIstanbulYear();
  const [sortMetric, setSortMetric] = useState<SortMetric>('wage');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | PersonnelRole>('all');
  const [groupFilter, setGroupFilter] = useState<'all' | WorkGroup>('all');
  const [selectedPerson, setSelectedPerson] = useState<OvertimePersonnel | null>(
    null,
  );
  const [historyYear, setHistoryYear] = useState(currentYear);
  const [history, setHistory] = useState<OvertimeHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const balanceMap = useMemo(
    () => new Map(balances.map((balance) => [balance.personnelId, balance])),
    [balances],
  );

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
    return personnel
      .filter((person) => {
        if (roleFilter !== 'all' && person.personnelRole !== roleFilter) return false;
        if (groupFilter !== 'all' && person.workGroup !== groupFilter) return false;
        if (!normalizedSearch) return true;
        return `${person.firstName} ${person.lastName} ${person.employeeNo}`
          .toLocaleLowerCase('tr-TR')
          .includes(normalizedSearch);
      })
      .map((person) => ({
        person,
        balance: balanceMap.get(person.id) ?? emptyBalance(person.id),
      }))
      .sort((left, right) => {
        const metricDifference =
          sortMetric === 'wage'
            ? right.balance.wageCreditTotal - left.balance.wageCreditTotal
            : right.balance.occurrenceCount - left.balance.occurrenceCount;
        return (
          metricDifference ||
          `${left.person.firstName} ${left.person.lastName}`.localeCompare(
            `${right.person.firstName} ${right.person.lastName}`,
            'tr',
          )
        );
      });
  }, [balanceMap, groupFilter, personnel, roleFilter, search, sortMetric]);

  const maximumValue = useMemo(
    () =>
      Math.max(
        1,
        ...rows.map(({ balance }) =>
          sortMetric === 'wage'
            ? balance.wageCreditTotal
            : balance.occurrenceCount,
        ),
      ),
    [rows, sortMetric],
  );

  const totals = useMemo(
    () => ({
      occurrences: balances.reduce(
        (sum, balance) => sum + balance.occurrenceCount,
        0,
      ),
      wages: balances.reduce(
        (sum, balance) => sum + balance.wageCreditTotal,
        0,
      ),
      participated: balances.filter((balance) => balance.occurrenceCount > 0).length,
    }),
    [balances],
  );

  useEffect(() => {
    if (!selectedPerson) return;
    let active = true;

    void listPersonnelOvertimeHistory(selectedPerson.id, historyYear)
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHistory([]);
        setHistoryError(
          error instanceof Error ? error.message : 'Mesai geçmişi alınamadı.',
        );
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [historyYear, selectedPerson]);

  function openHistory(person: OvertimePersonnel) {
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    setHistoryYear(currentYear);
    setSelectedPerson(person);
  }

  function changeHistoryYear(year: number) {
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    setHistoryYear(year);
  }

  function closeHistory() {
    setSelectedPerson(null);
    setHistory([]);
    setHistoryError('');
  }

  const historyWageTotal = history.reduce(
    (sum, entry) => sum + entry.wageCredit,
    0,
  );
  const historyOccurrenceTotal = history.reduce(
    (sum, entry) => sum + entry.occurrenceCredit,
    0,
  );

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-card">
        <div className={`p-5 sm:p-6 ${expanded ? 'border-b border-white/10' : ''}`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center gap-3 text-left"
              aria-expanded={expanded}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
                <BarChart3 size={19} />
              </span>
              <span>
                <span className="block text-lg font-semibold text-white">
                  Personel Mesai Dengesi
                </span>
                <span className="mt-1 block text-xs leading-5 text-white/40">
                  Aktif denge dönemindeki toplamlar · Ayrıntı için personele tıklayın
                </span>
              </span>
            </button>
            <div className="flex items-center gap-3">
              <div className="grid flex-1 grid-cols-3 gap-2 sm:min-w-[430px]">
                <SummaryItem label="Mesai Kaydı" value={totals.occurrences} />
                <SummaryItem
                  label="Toplam Yevmiye"
                  value={totals.wages.toLocaleString('tr-TR')}
                />
                <SummaryItem label="Katılan Personel" value={totals.participated} />
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="rounded-lg p-2 text-white/35 transition hover:bg-white/[0.05] hover:text-white"
                aria-label={expanded ? 'Personel dengesini kapat' : 'Personel dengesini aç'}
              >
                <ChevronDown
                  size={19}
                  className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {expanded && <>
        <div className="grid gap-3 border-b border-white/10 p-5 sm:p-6 xl:grid-cols-[minmax(240px,1fr)_auto_auto_auto] xl:items-end">
          <label className="relative block">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input bg-[#171717] pl-9"
              placeholder="Personel veya sicil ara"
            />
          </label>
          <SelectFilter
            label="Personel Tipi"
            value={roleFilter}
            onChange={(value) => setRoleFilter(value as 'all' | PersonnelRole)}
            options={[
              ['all', 'Tümü'],
              ['foreman', 'Formen'],
              ['technician', 'Teknisyen'],
            ]}
          />
          <SelectFilter
            label="Çalışma Grubu"
            value={groupFilter}
            onChange={(value) => setGroupFilter(value as 'all' | WorkGroup)}
            options={[
              ['all', 'Tümü'],
              ['A', 'A Grubu'],
              ['B', 'B Grubu'],
              ['C', 'C Grubu'],
              ['D', 'D Grubu'],
              ['L', 'L Grubu'],
            ]}
          />
          <SelectFilter
            label="Bar Ölçüsü"
            value={sortMetric}
            onChange={(value) => setSortMetric(value as SortMetric)}
            options={[
              ['wage', 'Yevmiye'],
              ['occurrence', 'Mesai Sayısı'],
            ]}
          />
        </div>

        <div className="max-h-[650px] overflow-y-auto p-4 sm:p-5">
          {rows.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-white/40">
              Seçili filtrelerle eşleşen personel bulunamadı.
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {rows.map(({ person, balance }) => {
                const metricValue =
                  sortMetric === 'wage'
                    ? balance.wageCreditTotal
                    : balance.occurrenceCount;
                const width = `${Math.max(
                  metricValue === 0 ? 0 : 3,
                  (metricValue / maximumValue) * 100,
                )}%`;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => openHistory(person)}
                    className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-left transition hover:border-violet-300/30 hover:bg-violet-500/[0.07]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {person.firstName} {person.lastName}
                        </p>
                        <p className="mt-1 text-[11px] text-white/35">
                          {person.personnelRole === 'foreman' ? 'Formen' : 'Teknisyen'} ·{' '}
                          {person.overtimeEligible
                            ? `${person.workGroup} Grubu`
                            : 'Vardiya Atanmamış'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-right">
                        <div>
                          <p className="text-sm font-semibold text-violet-200">
                            {balance.wageCreditTotal.toLocaleString('tr-TR')} yevmiye
                          </p>
                          <p className="mt-1 text-[11px] text-white/35">
                            {balance.occurrenceCount} kez mesai
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-white/20 transition group-hover:translate-x-0.5 group-hover:text-violet-200"
                        />
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
                        style={{ width }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        </>}
      </section>

      {selectedPerson && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeHistory();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Personel mesai geçmişi"
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
                  <UserRound size={21} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                    Personel Mesai Geçmişi
                  </p>
                  <h3 className="mt-1 truncate text-xl font-semibold text-white">
                    {selectedPerson.firstName} {selectedPerson.lastName}
                  </h3>
                  <p className="mt-1 text-xs text-white/35">
                    {selectedPerson.personnelRole === 'foreman' ? 'Formen' : 'Teknisyen'} ·{' '}
                    {selectedPerson.overtimeEligible
                      ? `${selectedPerson.workGroup} Grubu`
                      : 'Vardiya Atanmamış'}{' '}
                    · Sicil {selectedPerson.employeeNo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                className="rounded-xl border border-white/10 p-2 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Mesai geçmişini kapat"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 border-b border-white/10 bg-white/[0.018] p-5 sm:grid-cols-[220px_1fr] sm:items-end sm:p-6">
              <label>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Rapor Yılı
                </span>
                <select
                  value={historyYear}
                  onChange={(event) => changeHistoryYear(Number(event.target.value))}
                  className="input bg-[#171717] [color-scheme:dark]"
                >
                  {Array.from({ length: 6 }, (_, index) => currentYear - index).map(
                    (year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:max-w-md sm:justify-self-end">
                <SummaryItem
                  label="Mesai Sayısı"
                  value={historyOccurrenceTotal}
                />
                <SummaryItem
                  label="Yevmiye Toplamı"
                  value={historyWageTotal.toLocaleString('tr-TR')}
                />
              </div>
            </div>

            <div className="min-h-56 flex-1 overflow-y-auto p-4 sm:p-6">
              {historyLoading ? (
                <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-white/40">
                  <LoaderCircle size={18} className="animate-spin text-violet-300" />
                  Mesai geçmişi yükleniyor…
                </div>
              ) : historyError ? (
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
                  {historyError}
                </div>
              ) : history.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 text-center">
                  <CalendarDays size={28} className="text-white/20" />
                  <p className="mt-3 text-sm font-medium text-white/55">
                    {historyYear} yılında mesai kaydı yok
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {formatDate(entry.workDate)}
                          </p>
                          {entry.entryType === 'overtime' &&
                          entry.startsAt &&
                          entry.endsAt ? (
                            <p className="mt-1 flex items-center gap-2 text-xs text-white/40">
                              <Clock3 size={13} />
                              {formatTime(entry.startsAt)}–{formatTime(entry.endsAt)} ·{' '}
                              {durationHours(entry.startsAt, entry.endsAt)} saat
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-amber-200/60">
                              Ayrıntısı bulunmayan devreden bakiye
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-md bg-violet-500/15 px-2 py-1 text-xs font-medium text-violet-200">
                            {entry.entryType === 'adjustment'
                              ? 'Devir Bakiyesi'
                              : entry.overtimeType === 'full_day'
                                ? 'Tam Gün'
                                : 'Devam'}
                          </span>
                          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                            {entry.wageCredit.toLocaleString('tr-TR')} yevmiye
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 border-t border-white/[0.07] pt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          Yapılan İşler
                        </p>
                        <ul className="mt-2 space-y-1.5 text-sm leading-5 text-white/65">
                          {entry.tasks.map((task, index) => (
                            <li key={`${entry.id}-${index}`} className="flex gap-2">
                              <span className="text-violet-300">•</span>
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                        {(entry.location || entry.callNote || entry.participantNote) && (
                          <p className="mt-3 text-xs leading-5 text-white/35">
                            {[entry.location, entry.callNote, entry.participantNote]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-[9px] font-semibold uppercase tracking-wider text-white/30">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input min-w-36 bg-[#171717] [color-scheme:dark]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
