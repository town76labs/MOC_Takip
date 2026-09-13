import { useMemo, useState, type FormEvent } from 'react';
import {
  Ban,
  CircleAlert,
  LoaderCircle,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import {
  cancelOvertimeCall,
  updateOvertimeCallDetails,
} from '../../lib/overtime/repository';
import {
  WAGE_CREDIT_OPTIONS,
  type OvertimeCalendarCall,
} from '../../lib/overtime/types';

type DialogMode = 'edit' | 'cancel' | null;

export function OvertimeCallActions({
  call,
  onChanged,
}: {
  call: OvertimeCalendarCall;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<DialogMode>(null);
  const [location, setLocation] = useState(call.location);
  const [note, setNote] = useState(call.note);
  const [taskText, setTaskText] = useState(call.tasks.join('\n'));
  const [participantDrafts, setParticipantDrafts] = useState(() =>
    Object.fromEntries(
      call.participants.map((participant) => [
        participant.id,
        { wageCredit: participant.wageCredit, note: participant.note },
      ]),
    ),
  );
  const [cancellationReason, setCancellationReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const wageOptions = useMemo(
    () =>
      [...new Set([
        ...WAGE_CREDIT_OPTIONS,
        ...call.participants.map((participant) => participant.wageCredit),
      ])].sort((left, right) => left - right),
    [call.participants],
  );

  function openDialog(nextMode: Exclude<DialogMode, null>) {
    setLocation(call.location);
    setNote(call.note);
    setTaskText(call.tasks.join('\n'));
    setParticipantDrafts(
      Object.fromEntries(
        call.participants.map((participant) => [
          participant.id,
          { wageCredit: participant.wageCredit, note: participant.note },
        ]),
      ),
    );
    setCancellationReason('');
    setError('');
    setMode(nextMode);
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tasks = taskText
      .split('\n')
      .map((task) => task.trim())
      .filter(Boolean);
    if (tasks.length === 0) {
      setError('En az bir iş açıklaması girin.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await updateOvertimeCallDetails({
        callId: call.id,
        location,
        note,
        tasks,
        participants: call.participants.map((participant) => ({
          id: participant.id,
          wageCredit:
            participantDrafts[participant.id]?.wageCredit ??
            participant.wageCredit,
          note: participantDrafts[participant.id]?.note ?? participant.note,
        })),
      });
      await onChanged();
      setMode(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Mesai kaydı güncellenemedi.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancellationReason.trim()) {
      setError('İptal gerekçesi zorunludur.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await cancelOvertimeCall(call.id, cancellationReason.trim());
      await onChanged();
      setMode(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Mesai kaydı iptal edilemedi.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => openDialog('edit')}
          className="rounded-lg border border-white/10 p-2 text-white/40 transition hover:border-violet-300/30 hover:bg-violet-500/10 hover:text-violet-200"
          aria-label="Mesai kaydını düzenle"
          title="Düzenle"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => openDialog('cancel')}
          className="rounded-lg border border-white/10 p-2 text-white/40 transition hover:border-red-300/30 hover:bg-red-500/10 hover:text-red-200"
          aria-label="Mesai kaydını iptal et"
          title="İptal et"
        >
          <Ban size={14} />
        </button>
      </div>

      {mode && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setMode(null);
            }
          }}
        >
          {mode === 'edit' ? (
            <form
              onSubmit={handleEdit}
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl sm:rounded-2xl"
            >
              <DialogHeader
                title="Mesai Kaydını Düzenle"
                description={`${call.workDate} · ${call.participants.length} personel`}
                onClose={() => setMode(null)}
                disabled={submitting}
              />
              <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      Çalışma Yeri
                    </span>
                    <input
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      className="input bg-[#171717]"
                      placeholder="Fabrika, saha veya atölye"
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
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
                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    Yapılan İşler · Her Satır Ayrı Kayıt
                  </span>
                  <textarea
                    value={taskText}
                    onChange={(event) => setTaskText(event.target.value)}
                    className="input min-h-28 resize-y bg-[#171717]"
                    required
                  />
                </label>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    Personel Yevmiye ve Notları
                  </p>
                  <div className="space-y-2">
                    {call.participants.map((participant) => {
                      const draft = participantDrafts[participant.id];
                      return (
                        <div
                          key={participant.id}
                          className="grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 sm:grid-cols-[1fr_130px]"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {participant.fullName}
                            </p>
                            <input
                              value={draft?.note ?? ''}
                              onChange={(event) =>
                                setParticipantDrafts((current) => ({
                                  ...current,
                                  [participant.id]: {
                                    ...current[participant.id],
                                    note: event.target.value,
                                  },
                                }))
                              }
                              className="input mt-2 bg-[#171717] text-xs"
                              placeholder="Personel notu"
                            />
                          </div>
                          <label>
                            <span className="mb-2 block text-[9px] font-semibold uppercase tracking-wider text-white/30">
                              Yevmiye
                            </span>
                            <select
                              value={draft?.wageCredit ?? participant.wageCredit}
                              onChange={(event) =>
                                setParticipantDrafts((current) => ({
                                  ...current,
                                  [participant.id]: {
                                    ...current[participant.id],
                                    wageCredit: Number(event.target.value),
                                  },
                                }))
                              }
                              className="input bg-[#171717] [color-scheme:dark]"
                            >
                              {wageOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value.toLocaleString('tr-TR')}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {error && <ErrorMessage message={error} />}
              </div>
              <div className="flex justify-end gap-2 border-t border-white/10 p-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  disabled={submitting}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50"
                >
                  {submitting ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Kaydet
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handleCancel}
              className="w-full max-w-lg rounded-t-2xl border border-red-300/15 bg-[#0d0d0d] shadow-2xl sm:rounded-2xl"
            >
              <DialogHeader
                title="Mesai Kaydını İptal Et"
                description={`${call.workDate} · ${call.participants.length} personel`}
                onClose={() => setMode(null)}
                disabled={submitting}
              />
              <div className="p-5 sm:p-6">
                <div className="flex gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100/80">
                  <CircleAlert size={19} className="mt-0.5 shrink-0" />
                  Kayıt silinmez; denetim izi korunarak takvimden ve aktif
                  mesai toplamlarından çıkarılır.
                </div>
                <label className="mt-5 block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    İptal Gerekçesi
                  </span>
                  <textarea
                    value={cancellationReason}
                    onChange={(event) =>
                      setCancellationReason(event.target.value)
                    }
                    className="input min-h-24 resize-y bg-[#171717]"
                    placeholder="Neden iptal edildiğini yazın"
                    required
                  />
                </label>
                {error && <ErrorMessage message={error} />}
              </div>
              <div className="flex justify-end gap-2 border-t border-white/10 p-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  disabled={submitting}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                >
                  {submitting ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Ban size={16} />
                  )}
                  Kaydı İptal Et
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

function DialogHeader({
  title,
  description,
  onClose,
  disabled,
}: {
  title: string;
  description: string;
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:px-6">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs text-white/35">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        className="rounded-lg border border-white/10 p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        aria-label="Pencereyi kapat"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
      {message}
    </div>
  );
}
