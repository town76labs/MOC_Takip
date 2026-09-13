import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  MapPin,
} from 'lucide-react';
import { listOvertimeCallsForRange } from '../../lib/overtime/repository';
import type { OvertimeCalendarCall } from '../../lib/overtime/types';
import { OvertimeCallActions } from './OvertimeCallActions';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

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

function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function longDateLabel(date: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

function formatEndClock(workDate: string, value: string) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).formatToParts(new Date(value));
  const dateMap = Object.fromEntries(
    dateParts.map((part) => [part.type, part.value]),
  );
  const endDate = `${dateMap.year}-${dateMap.month}-${dateMap.day}`;
  const clock = formatClock(value);
  return endDate !== workDate && clock === '00:00' ? '24:00' : clock;
}

function monthDates(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlankCount = (firstDay + 6) % 7;
  return [
    ...Array.from({ length: leadingBlankCount }, () => null),
    ...Array.from(
      { length: dayCount },
      (_, index) => `${monthKey}-${String(index + 1).padStart(2, '0')}`,
    ),
  ];
}

export function OvertimeCalendar({
  expanded,
  onToggle,
  monthKey,
  selectedDate,
  onMonthChange,
  onDateSelect,
  refreshKey,
  canEdit,
  onChanged,
}: {
  expanded: boolean;
  onToggle: () => void;
  monthKey: string;
  selectedDate: string;
  onMonthChange: (monthKey: string) => void;
  onDateSelect: (date: string) => void;
  refreshKey: number;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const today = currentIstanbulDate();
  const [calls, setCalls] = useState<OvertimeCalendarCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const [year, month] = monthKey.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    void listOvertimeCallsForRange(
      `${monthKey}-01`,
      `${monthKey}-${String(lastDay).padStart(2, '0')}`,
    )
      .then((rows) => {
        if (!active) return;
        setCalls(rows);
        setError('');
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setCalls([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Mesai takvimi yüklenemedi.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [monthKey, refreshKey]);

  const callsByDate = useMemo(() => {
    const grouped = new Map<string, OvertimeCalendarCall[]>();
    calls.forEach((call) => {
      grouped.set(call.workDate, [...(grouped.get(call.workDate) ?? []), call]);
    });
    return grouped;
  }, [calls]);

  const selectedCalls = callsByDate.get(selectedDate) ?? [];
  const monthParticipantCount = calls.reduce(
    (sum, call) => sum + call.participants.length,
    0,
  );
  const monthWageTotal = calls.reduce(
    (sum, call) =>
      sum +
      call.participants.reduce(
        (participantSum, participant) =>
          participantSum + participant.wageCredit,
        0,
      ),
    0,
  );

  function navigateMonth(offset: number) {
    const targetMonth = shiftMonth(monthKey, offset);
    setLoading(true);
    setError('');
    onMonthChange(targetMonth);
    onDateSelect(`${targetMonth}-01`);
  }

  function goToToday() {
    setLoading(true);
    setError('');
    onMonthChange(monthKeyFromDate(today));
    onDateSelect(today);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
            <CalendarDays size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold text-white">Mesai Takvimi</span>
            <span className="mt-1 block text-xs text-white/40">
              Gün bazında mesai ekipleri ve yapılan işler
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3 self-stretch sm:self-auto">
          <span className="grid flex-1 grid-cols-3 gap-2 sm:flex-none">
            <HeaderMetric label="Kayıt" value={calls.length} />
            <HeaderMetric label="Katılım" value={monthParticipantCount} />
            <HeaderMetric
              label="Yevmiye"
              value={monthWageTotal.toLocaleString('tr-TR')}
            />
          </span>
          <ChevronDown
            size={19}
            className={`shrink-0 text-white/35 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                className="rounded-lg border border-white/10 p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Önceki ay"
              >
                <ChevronLeft size={17} />
              </button>
              <h4 className="min-w-40 text-center text-sm font-semibold capitalize text-white">
                {monthLabel(monthKey)}
              </h4>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                className="rounded-lg border border-white/10 p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Sonraki ay"
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20"
            >
              Bugüne Git
            </button>
          </div>

          {error ? (
            <div className="m-5 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : (
            <div className="grid xl:grid-cols-[minmax(0,1.25fr)_minmax(370px,0.75fr)]">
              <div className="border-b border-white/10 p-3 sm:p-5 xl:border-b-0 xl:border-r">
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {WEEKDAYS.map((weekday) => (
                    <div
                      key={weekday}
                      className="pb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-white/25 sm:text-[10px]"
                    >
                      {weekday}
                    </div>
                  ))}
                  {monthDates(monthKey).map((date, index) => {
                    if (!date) {
                      return <div key={`blank-${index}`} className="min-h-20 sm:min-h-28" />;
                    }
                    const dayCalls = callsByDate.get(date) ?? [];
                    const participantCount = dayCalls.reduce(
                      (sum, call) => sum + call.participants.length,
                      0,
                    );
                    const isSelected = selectedDate === date;
                    const isToday = today === date;
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => onDateSelect(date)}
                        className={`min-h-20 rounded-xl border p-2 text-left transition sm:min-h-28 sm:p-3 ${
                          isSelected
                            ? 'border-violet-300/50 bg-violet-500/15 ring-1 ring-violet-300/20'
                            : dayCalls.length > 0
                              ? 'border-violet-300/15 bg-violet-500/[0.055] hover:border-violet-300/35'
                              : 'border-white/[0.07] bg-white/[0.018] hover:bg-white/[0.04]'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                            isToday
                              ? 'bg-violet-400 text-slate-950'
                              : 'text-white/55'
                          }`}
                        >
                          {Number(date.slice(-2))}
                        </span>
                        {dayCalls.length > 0 && (
                          <span className="mt-2 block">
                            <span className="block truncate text-[10px] font-semibold text-violet-200 sm:text-xs">
                              {participantCount} kişi
                            </span>
                            <span className="mt-1 hidden text-[10px] text-white/30 sm:block">
                              {dayCalls.length} mesai kaydı
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {loading && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/35">
                    <LoaderCircle size={14} className="animate-spin text-violet-300" />
                    Takvim güncelleniyor…
                  </div>
                )}
              </div>

              <div className="max-h-[690px] overflow-y-auto p-4 sm:p-5">
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">
                    Seçili Gün
                  </p>
                  <h4 className="mt-1 text-lg font-semibold capitalize text-white">
                    {longDateLabel(selectedDate)}
                  </h4>
                  <p className="mt-1 text-xs text-white/35">
                    {selectedCalls.length === 0
                      ? 'Mesai kaydı bulunmuyor'
                      : `${selectedCalls.length} kayıt · ${selectedCalls.reduce(
                          (sum, call) => sum + call.participants.length,
                          0,
                        )} personel katılımı`}
                  </p>
                </div>

                {selectedCalls.length === 0 ? (
                  <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-5 text-center">
                    <CalendarDays size={28} className="text-white/18" />
                    <p className="mt-3 text-sm text-white/40">
                      Bu tarihte kayıtlı mesai ekibi yok.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCalls.map((call, callIndex) => (
                      <article
                        key={call.id}
                        className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Mesai Ekibi {callIndex + 1}
                            </p>
                            {call.location && (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/40">
                                <MapPin size={12} /> {call.location}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {call.sourceType === 'legacy_import' && (
                              <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-200">
                                Excel Geçmişi
                              </span>
                            )}
                            <span className="rounded-md bg-violet-500/15 px-2 py-1 text-xs font-medium text-violet-200">
                              {call.participants.length} kişi
                            </span>
                            {canEdit && (
                              <OvertimeCallActions
                                call={call}
                                onChanged={onChanged}
                              />
                            )}
                          </div>
                        </div>

                        {call.tasks.length > 0 && (
                          <div className="mt-4 rounded-lg bg-black/20 p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/25">
                              Yapılacak İşler
                            </p>
                            <ul className="mt-2 space-y-1 text-xs leading-5 text-white/60">
                              {call.tasks.map((task, index) => (
                                <li key={`${call.id}-task-${index}`} className="flex gap-2">
                                  <span className="text-violet-300">•</span>
                                  <span>{task}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-3 space-y-2">
                          {call.participants.map((participant) => (
                            <div
                              key={participant.id}
                              className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-white">
                                    {participant.fullName}
                                  </p>
                                  <p className="mt-1 text-[10px] text-white/35">
                                    {participant.personnelRole === 'foreman'
                                      ? 'Formen'
                                      : 'Teknisyen'}{' '}
                                    · {participant.workGroup} Grubu
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs font-semibold text-emerald-200">
                                  {participant.wageCredit.toLocaleString('tr-TR')} yevmiye
                                </span>
                              </div>
                              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/45">
                                <Clock3 size={12} />
                                {formatClock(participant.startsAt)}–
                                {formatEndClock(call.workDate, participant.endsAt)} ·{' '}
                                {participant.overtimeType === 'full_day'
                                  ? 'Tam Gün'
                                  : 'Devam'}
                              </p>
                            </div>
                          ))}
                        </div>
                        {call.note && (
                          <p className="mt-3 text-xs leading-5 text-white/35">{call.note}</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function HeaderMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <span className="min-w-20 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
      <span className="block text-[8px] font-semibold uppercase tracking-wider text-white/25">
        {label}
      </span>
      <span className="mt-0.5 block text-sm font-semibold text-white">{value}</span>
    </span>
  );
}
