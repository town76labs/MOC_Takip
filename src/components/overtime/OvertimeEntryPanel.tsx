import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Search,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import {
  createOvertimeCall,
  listShiftAssignments,
} from '../../lib/overtime/repository';
import { getAllowedIntervals } from '../../lib/overtime/rules';
import {
  WAGE_CREDIT_OPTIONS,
  type OvertimeBalance,
  type OvertimePersonnel,
  type OvertimeType,
  type PersonnelRole,
  type ShiftAssignment,
  type ShiftCode,
  type WageCredit,
  type WorkGroup,
} from '../../lib/overtime/types';

const SHIFT_LABELS: Record<ShiftCode, string> = {
  shift_00_08: '00:00–08:00',
  shift_08_16: '08:00–16:00',
  shift_16_24: '16:00–24:00',
  day_08_17: '08:00–17:00',
  weekly_rest: 'Hafta Tatili',
};

interface ParticipantDraft {
  intervalKey: string;
  wageCredit: WageCredit;
  note: string;
}

interface Candidate {
  person: OvertimePersonnel;
  shiftCode: ShiftCode;
  balance: OvertimeBalance;
}

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

function intervalKey(start: string, end: string) {
  return `${start}|${end}`;
}

function nextDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

function toIstanbulTimestamp(date: string, time: string) {
  if (time === '24:00') return `${nextDate(date)}T00:00:00+03:00`;
  return `${date}T${time}:00+03:00`;
}

function emptyBalance(personnelId: string): OvertimeBalance {
  return {
    personnelId,
    occurrenceCount: 0,
    wageCreditTotal: 0,
    lastOvertimeDate: null,
  };
}

export function OvertimeEntryPanel({
  personnel,
  balances,
  expanded,
  onToggle,
  onSaved,
}: {
  personnel: OvertimePersonnel[];
  balances: OvertimeBalance[];
  expanded: boolean;
  onToggle: () => void;
  onSaved: (workDate: string) => Promise<void>;
}) {
  const [workDate, setWorkDate] = useState(currentIstanbulDate);
  const [overtimeType, setOvertimeType] = useState<OvertimeType>('full_day');
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentError, setAssignmentError] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | PersonnelRole>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, ParticipantDraft>>({});
  const [taskText, setTaskText] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;

    void listShiftAssignments(workDate)
      .then((rows) => {
        if (active) setAssignments(rows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAssignments([]);
        setAssignmentError(
          error instanceof Error
            ? error.message
            : 'Vardiya bilgileri alınamadı.',
        );
      })
      .finally(() => {
        if (active) setLoadingAssignments(false);
      });

    return () => {
      active = false;
    };
  }, [workDate]);

  const balanceMap = useMemo(
    () => new Map(balances.map((balance) => [balance.personnelId, balance])),
    [balances],
  );
  const shiftMap = useMemo(
    () =>
      new Map<WorkGroup, ShiftCode>(
        assignments.map((assignment) => [
          assignment.workGroup,
          assignment.shiftCode,
        ]),
      ),
    [assignments],
  );

  const candidates = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
    return personnel
      .flatMap<Candidate>((person) => {
        if (!person.overtimeEligible) return [];
        const shiftCode = shiftMap.get(person.workGroup);
        if (!shiftCode || getAllowedIntervals(overtimeType, shiftCode).length === 0) {
          return [];
        }
        if (roleFilter !== 'all' && person.personnelRole !== roleFilter) return [];
        if (
          normalizedSearch &&
          !`${person.firstName} ${person.lastName} ${person.employeeNo} ${person.workGroup}`
            .toLocaleLowerCase('tr-TR')
            .includes(normalizedSearch)
        ) {
          return [];
        }
        return [
          {
            person,
            shiftCode,
            balance: balanceMap.get(person.id) ?? emptyBalance(person.id),
          },
        ];
      })
      .sort(
        (left, right) =>
          left.balance.wageCreditTotal - right.balance.wageCreditTotal ||
          left.balance.occurrenceCount - right.balance.occurrenceCount ||
          `${left.person.firstName} ${left.person.lastName}`.localeCompare(
            `${right.person.firstName} ${right.person.lastName}`,
            'tr',
          ),
      );
  }, [balanceMap, overtimeType, personnel, roleFilter, search, shiftMap]);

  const selectedCandidates = useMemo(
    () =>
      personnel.flatMap<Candidate>((person) => {
        if (!selected[person.id]) return [];
        const shiftCode = shiftMap.get(person.workGroup);
        if (!shiftCode) return [];
        return [
          {
            person,
            shiftCode,
            balance: balanceMap.get(person.id) ?? emptyBalance(person.id),
          },
        ];
      }),
    [balanceMap, personnel, selected, shiftMap],
  );

  function resetSelectionFor(type: OvertimeType) {
    setOvertimeType(type);
    setSelected({});
    setSubmitError('');
    setSuccessMessage('');
  }

  function handleDateChange(date: string) {
    setLoadingAssignments(true);
    setAssignmentError('');
    setWorkDate(date);
    setSelected({});
    setSubmitError('');
    setSuccessMessage('');
  }

  function toggleCandidate(candidate: Candidate) {
    setSelected((current) => {
      if (current[candidate.person.id]) {
        const next = { ...current };
        delete next[candidate.person.id];
        return next;
      }
      const firstInterval = getAllowedIntervals(
        overtimeType,
        candidate.shiftCode,
      )[0];
      if (!firstInterval) return current;
      return {
        ...current,
        [candidate.person.id]: {
          intervalKey: intervalKey(firstInterval.start, firstInterval.end),
          wageCredit: 2,
          note: '',
        },
      };
    });
  }

  function updateParticipant(
    personnelId: string,
    update: Partial<ParticipantDraft>,
  ) {
    setSelected((current) => ({
      ...current,
      [personnelId]: { ...current[personnelId], ...update },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    const tasks = taskText
      .split('\n')
      .map((task) => task.trim())
      .filter(Boolean);
    if (tasks.length === 0) {
      setSubmitError('En az bir iş açıklaması girin.');
      return;
    }
    if (selectedCandidates.length === 0) {
      setSubmitError('En az bir uygun personel seçin.');
      return;
    }

    try {
      setSubmitting(true);
      await createOvertimeCall({
        workDate,
        location,
        note,
        tasks,
        participants: selectedCandidates.map((candidate) => {
          const draft = selected[candidate.person.id];
          const [start, end] = draft.intervalKey.split('|');
          return {
            personnelId: candidate.person.id,
            overtimeType,
            startsAt: toIstanbulTimestamp(workDate, start),
            endsAt: toIstanbulTimestamp(workDate, end),
            wageCredit: draft.wageCredit,
            note: draft.note,
          };
        }),
      });
      await onSaved(workDate);
      setSuccessMessage(
        `${selectedCandidates.length} personel için mesai kaydı oluşturuldu.`,
      );
      setSelected({});
      setTaskText('');
      setLocation('');
      setNote('');
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Mesai kaydı oluşturulamadı.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-300/15 bg-[#0d0d0d] shadow-card">
      <div className={`flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between sm:px-6 ${expanded ? 'border-b border-white/10' : ''}`}>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
            <BriefcaseBusiness size={19} />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">Yeni Mesai Kaydı</span>
            <span className="mt-1 block text-xs leading-5 text-white/40">
              Adaylar vardiya uygunluğuna göre süzülür; en az yevmiyesi olanlar
              önce gösterilir.
            </span>
          </span>
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <UserRoundCheck size={18} className="text-violet-300" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/35">Seçilen</p>
              <p className="text-sm font-semibold text-white">
                {selectedCandidates.length} personel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-2 text-white/35 transition hover:bg-white/[0.05] hover:text-white"
            aria-label={expanded ? 'Yeni mesai formunu kapat' : 'Yeni mesai formunu aç'}
          >
            <ChevronDown
              size={19}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          </div>
      </div>

      {expanded && <form onSubmit={handleSubmit}>
        <div className="grid gap-4 border-b border-white/10 p-5 sm:p-6 lg:grid-cols-[220px_1fr]">
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Mesai Tarihi
            </span>
            <input
              type="date"
              value={workDate}
              onChange={(event) => handleDateChange(event.target.value)}
              className="input bg-[#171717] [color-scheme:dark]"
              required
            />
          </label>
          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Mesai Türü
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              <TypeButton
                active={overtimeType === 'full_day'}
                title="Tam Gün Mesaisi"
                description="Yalnızca o gün hafta tatilinde olanlar"
                onClick={() => resetSelectionFor('full_day')}
              />
              <TypeButton
                active={overtimeType === 'continuation'}
                title="Devam Mesaisi"
                description="08–16 vardiyası veya 08–17 L personeli"
                onClick={() => resetSelectionFor('continuation')}
              />
            </div>
          </div>
        </div>

        <div className="grid min-h-[520px] xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
          <div className="border-b border-white/10 xl:border-b-0 xl:border-r">
            <div className="border-b border-white/10 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Uygun Mesai Adayları</h4>
                  <p className="mt-1 text-xs text-white/35">
                    {loadingAssignments
                      ? 'Vardiya kontrol ediliyor…'
                      : `${candidates.length} uygun personel`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['all', 'foreman', 'technician'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      className={`rounded-lg border px-3 py-2 text-xs transition ${
                        roleFilter === role
                          ? 'border-violet-300/40 bg-violet-500/20 text-violet-100'
                          : 'border-white/10 bg-white/[0.035] text-white/45 hover:text-white'
                      }`}
                    >
                      {role === 'all' ? 'Tümü' : role === 'foreman' ? 'Formen' : 'Teknisyen'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="relative mt-4 block">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Personel, sicil veya vardiya ara"
                  className="input bg-[#171717] pl-9"
                />
              </label>
            </div>

            <div className="max-h-[490px] overflow-y-auto p-3 sm:p-4">
              {loadingAssignments ? (
                <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-white/40">
                  <LoaderCircle size={18} className="animate-spin text-violet-300" />
                  Uygunluk hesaplanıyor…
                </div>
              ) : assignmentError ? (
                <Message tone="error">{assignmentError}</Message>
              ) : assignments.length === 0 ? (
                <Message tone="warning">
                  Bu tarih için vardiya çizelgesi bulunmuyor.
                </Message>
              ) : candidates.length === 0 ? (
                <Message tone="warning">
                  Bu mesai türü ve filtrelerle uygun personel bulunamadı.
                </Message>
              ) : (
                <div className="space-y-2">
                  {candidates.map((candidate, index) => {
                    const isSelected = Boolean(selected[candidate.person.id]);
                    return (
                      <button
                        key={candidate.person.id}
                        type="button"
                        onClick={() => toggleCandidate(candidate)}
                        className={`grid w-full grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-violet-300/40 bg-violet-500/15'
                            : 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold ${
                            isSelected
                              ? 'border-violet-300/50 bg-violet-400 text-slate-950'
                              : 'border-white/10 bg-white/[0.04] text-white/35'
                          }`}
                        >
                          {isSelected ? <Check size={16} /> : index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">
                            {candidate.person.firstName} {candidate.person.lastName}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/38">
                            <span>
                              {candidate.person.personnelRole === 'foreman'
                                ? 'Formen'
                                : 'Teknisyen'}
                            </span>
                            <span>·</span>
                            <span>{candidate.person.workGroup} Grubu</span>
                            <span>·</span>
                            <span>{SHIFT_LABELS[candidate.shiftCode]}</span>
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-semibold text-violet-200">
                            {candidate.balance.wageCreditTotal.toLocaleString('tr-TR')} yevmiye
                          </span>
                          <span className="mt-1 block text-[11px] text-white/35">
                            {candidate.balance.occurrenceCount} kez mesai
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-[520px] flex-col">
            <div className="border-b border-white/10 px-5 py-5 sm:px-6">
              <h4 className="text-sm font-semibold text-white">Seçilen Personel Ayarları</h4>
              <p className="mt-1 text-xs text-white/35">
                Saat aralığı ve yevmiye her personel için ayrı seçilir.
              </p>
            </div>
            <div className="max-h-[360px] flex-1 overflow-y-auto p-4 sm:p-5">
              {selectedCandidates.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                  <UsersRound size={28} className="text-white/20" />
                  <p className="mt-3 text-sm font-medium text-white/60">
                    Henüz personel seçilmedi
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/30">
                    Soldaki uygun adaylardan bir veya daha fazla personel seçin.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCandidates.map((candidate) => {
                    const draft = selected[candidate.person.id];
                    const intervals = getAllowedIntervals(
                      overtimeType,
                      candidate.shiftCode,
                    );
                    return (
                      <div
                        key={candidate.person.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {candidate.person.firstName} {candidate.person.lastName}
                            </p>
                            <p className="mt-1 text-[11px] text-white/35">
                              {candidate.person.workGroup} Grubu · {SHIFT_LABELS[candidate.shiftCode]}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCandidate(candidate)}
                            className="rounded-lg border border-white/10 p-1.5 text-white/35 transition hover:bg-red-500/10 hover:text-red-200"
                            aria-label="Personeli seçimden çıkar"
                          >
                            <X size={15} />
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label>
                            <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/35">
                              Saat Aralığı
                            </span>
                            <select
                              value={draft.intervalKey}
                              onChange={(event) =>
                                updateParticipant(candidate.person.id, {
                                  intervalKey: event.target.value,
                                })
                              }
                              className="input bg-[#171717] [color-scheme:dark]"
                            >
                              {intervals.map((interval) => (
                                <option
                                  key={intervalKey(interval.start, interval.end)}
                                  value={intervalKey(interval.start, interval.end)}
                                >
                                  {interval.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/35">
                              Yevmiye
                            </span>
                            <select
                              value={draft.wageCredit}
                              onChange={(event) =>
                                updateParticipant(candidate.person.id, {
                                  wageCredit: Number(event.target.value) as WageCredit,
                                })
                              }
                              className="input bg-[#171717] [color-scheme:dark]"
                            >
                              {WAGE_CREDIT_OPTIONS.map((value) => (
                                <option key={value} value={value}>
                                  {value.toLocaleString('tr-TR')}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[0.018] p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block lg:col-span-2">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Yapılacak İşler
              </span>
              <textarea
                value={taskText}
                onChange={(event) => setTaskText(event.target.value)}
                className="input min-h-24 resize-y bg-[#171717]"
                placeholder={'Her işi ayrı satıra yazın\nÖrnek: 215-FRALT-205-A kalibrasyon işi'}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Çalışma Yeri
              </span>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="input bg-[#171717]"
                placeholder="Fabrika, saha veya atölye"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Genel Not
              </span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="input bg-[#171717]"
                placeholder="İsteğe bağlı açıklama"
              />
            </label>
          </div>

          {submitError && <div className="mt-4"><Message tone="error">{submitError}</Message></div>}
          {successMessage && <div className="mt-4"><Message tone="success">{successMessage}</Message></div>}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs leading-5 text-white/35">
              <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-300/70" />
              Kayıt sırasında vardiya, saat aralığı ve çakışma kuralları
              veritabanında tekrar doğrulanır.
            </p>
            <button
              type="submit"
              disabled={submitting || selectedCandidates.length === 0}
              className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Check size={17} />
              )}
              {submitting ? 'Kaydediliyor…' : 'Mesaiyi Kaydet'}
            </button>
          </div>
        </div>
      </form>}
    </section>
  );
}

function TypeButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        active
          ? 'border-violet-300/40 bg-violet-500/15 ring-1 ring-violet-400/15'
          : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]'
      }`}
    >
      <span className={`block text-sm font-semibold ${active ? 'text-violet-100' : 'text-white/70'}`}>
        {title}
      </span>
      <span className="mt-1 block text-xs text-white/35">{description}</span>
    </button>
  );
}

function Message({
  tone,
  children,
}: {
  tone: 'error' | 'warning' | 'success';
  children: React.ReactNode;
}) {
  const toneClass = {
    error: 'border-red-400/20 bg-red-500/10 text-red-200',
    warning: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}
