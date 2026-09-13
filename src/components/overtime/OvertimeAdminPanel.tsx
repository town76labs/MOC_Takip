import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  listOvertimeBalancePeriods,
  startNewOvertimeBalancePeriod,
} from '../../lib/overtime/repository';
import type { OvertimeBalancePeriod } from '../../lib/overtime/types';

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function OvertimeAdminPanel({
  expanded,
  onToggle,
  onPeriodStarted,
}: {
  expanded: boolean;
  onToggle: () => void;
  onPeriodStarted: () => Promise<void>;
}) {
  const today = currentIstanbulDate();
  const [periods, setPeriods] = useState<OvertimeBalancePeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState(today);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activePeriod = useMemo(
    () => periods.find((period) => period.endsOn === null) ?? null,
    [periods],
  );
  const minimumStartDate = activePeriod
    ? nextDate(activePeriod.startsOn)
    : undefined;
  const canStartToday = !minimumStartDate || minimumStartDate <= today;

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    try {
      setPeriods(await listOvertimeBalancePeriods());
      setError('');
      setLoaded(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Denge dönemleri alınamadı.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded || loaded || loading) return undefined;
    const timer = window.setTimeout(() => void loadPeriods(), 0);
    return () => window.clearTimeout(timer);
  }, [expanded, loadPeriods, loaded, loading]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const periodName = name.trim();

    if (!periodName) {
      setError('Yeni denge dönemi için bir ad girin.');
      return;
    }
    if (minimumStartDate && startsOn < minimumStartDate) {
      setError('Yeni dönem mevcut dönemden sonraki bir tarihte başlamalıdır.');
      return;
    }
    if (startsOn > today) {
      setError('Yeni dönem gelecekteki bir tarihte başlatılamaz.');
      return;
    }
    if (!confirmed) {
      setError('Denge hesaplarının yeniden başlayacağını onaylayın.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await startNewOvertimeBalancePeriod(periodName, startsOn);
      await Promise.all([loadPeriods(), onPeriodStarted()]);
      setName('');
      setConfirmed(false);
      setSuccess(
        `${periodName} başlatıldı. Personel dengeleri ${formatDate(startsOn)} tarihinden itibaren hesaplanıyor.`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Yeni denge dönemi başlatılamadı.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300/15 bg-[#0d0d0d] shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200">
            <ShieldCheck size={20} />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">
              Denge Dönemi Yönetimi
            </span>
            <span className="mt-1 block text-xs text-white/40">
              Yalnızca mesai yöneticisi · geçmiş kayıtlar korunur
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3 text-xs text-amber-200/70">
          Yönetici İşlemi
          <ChevronDown
            size={19}
            className={`text-white/35 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-5 sm:p-6">
          {loading && !loaded ? (
            <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-white/40">
              <LoaderCircle size={18} className="animate-spin text-amber-300" />
              Denge dönemleri yükleniyor…
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-4">
                  <div className="flex items-start gap-3">
                    <CalendarRange size={19} className="mt-0.5 text-emerald-300" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/75">
                        Aktif Denge Dönemi
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {activePeriod?.name ?? 'Aktif dönem bulunamadı'}
                      </p>
                      {activePeriod && (
                        <p className="mt-1 text-xs text-white/45">
                          {formatDate(activePeriod.startsOn)} tarihinden itibaren
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs font-semibold text-white">Dönem Geçmişi</p>
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                    {periods.map((period) => (
                      <div
                        key={period.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/15 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-white/75">
                            {period.name}
                          </p>
                          <p className="mt-1 text-[10px] text-white/35">
                            {formatDate(period.startsOn)} –{' '}
                            {period.endsOn ? formatDate(period.endsOn) : 'Devam ediyor'}
                          </p>
                        </div>
                        {!period.endsOn && (
                          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                            Aktif
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="rounded-xl border border-amber-300/15 bg-amber-500/[0.045] p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <RotateCcw size={19} className="mt-0.5 text-amber-300" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Yeni Denge Dönemi Başlat
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-white/40">
                      Mesai sayısı ve yevmiye sıralaması seçilen tarihten itibaren
                      yeniden başlar.
                    </p>
                  </div>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    Dönem Adı
                  </span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="input bg-[#171717]"
                    placeholder="Örn. 2026 Sonbahar Dönemi"
                    maxLength={80}
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    Başlangıç Tarihi
                  </span>
                  <input
                    type="date"
                    value={startsOn}
                    min={minimumStartDate}
                    max={today}
                    onChange={(event) => setStartsOn(event.target.value)}
                    className="input bg-[#171717]"
                  />
                </label>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-300/15 bg-black/15 p-3">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-amber-400"
                  />
                  <span className="text-xs leading-5 text-white/55">
                    Mevcut dönemin kapanacağını ve denge hesaplarının yeni
                    başlangıç tarihine göre yapılacağını onaylıyorum.
                  </span>
                </label>

                <div className="mt-4 flex gap-2 rounded-lg border border-amber-300/15 bg-amber-500/[0.06] p-3 text-[11px] leading-5 text-amber-100/65">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  Geçmiş mesai kayıtları silinmez; personel geçmişinden yıl bazlı
                  görüntülenmeye devam eder.
                </div>

                {!canStartToday && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-xs text-white/45">
                    Aktif dönem bugün başladığı için aynı gün içinde ikinci bir
                    dönem başlatılamaz.
                  </div>
                )}
                {error && (
                  <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || loading || !canStartToday}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {submitting ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <RotateCcw size={17} />
                  )}
                  {submitting ? 'Yeni dönem başlatılıyor…' : 'Yeni Dönemi Başlat'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
