import { useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
} from 'lucide-react';
import {
  listOvertimeBalanceAdjustmentsForRange,
  listOvertimeCallsForRange,
} from '../../lib/overtime/repository';
import {
  buildOvertimeReportData,
  downloadOvertimeExcelReport,
  type OvertimeReportFilters,
  type OvertimeReportGroupFilter,
  type OvertimeReportRoleFilter,
} from '../../lib/overtime/overtimeReport';
import {
  downloadOvertimeReportPdf,
  type OvertimePdfReportType,
} from '../../lib/overtime/overtimeReportPdf';
import type { OvertimePersonnel, WorkGroup } from '../../lib/overtime/types';

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

export function OvertimeReportPanel({
  personnel,
  expanded,
  onToggle,
}: {
  personnel: OvertimePersonnel[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const today = currentIstanbulDate();
  const [startsOn, setStartsOn] = useState(`${today.slice(0, 4)}-01-01`);
  const [endsOn, setEndsOn] = useState(today);
  const [role, setRole] = useState<OvertimeReportRoleFilter>('all');
  const [group, setGroup] = useState<OvertimeReportGroupFilter>('all');
  const [personnelId, setPersonnelId] = useState<'all' | string>('all');
  const [pdfType, setPdfType] = useState<OvertimePdfReportType>('executive');
  const [generating, setGenerating] = useState<'excel' | 'pdf' | null>(null);
  const [error, setError] = useState('');
  const [lastExportCount, setLastExportCount] = useState<number | null>(null);

  const personOptions = useMemo(
    () =>
      personnel
        .filter(
          (person) =>
            (role === 'all' || person.personnelRole === role) &&
            (group === 'all' || person.workGroup === group),
        )
        .sort((left, right) =>
          `${left.firstName} ${left.lastName}`.localeCompare(
            `${right.firstName} ${right.lastName}`,
            'tr-TR',
          ),
        ),
    [group, personnel, role],
  );

  function updateRole(value: OvertimeReportRoleFilter) {
    setRole(value);
    setPersonnelId('all');
    setLastExportCount(null);
  }

  function updateGroup(value: OvertimeReportGroupFilter) {
    setGroup(value);
    setPersonnelId('all');
    setLastExportCount(null);
  }

  function reportFilters(): OvertimeReportFilters {
    return { startsOn, endsOn, role, group, personnelId };
  }

  async function prepareReport() {
    if (startsOn > endsOn) {
      throw new Error('Rapor başlangıç tarihi bitiş tarihinden sonra olamaz.');
    }
    const [overtimeCalls, balanceAdjustments] = await Promise.all([
      listOvertimeCallsForRange(startsOn, endsOn),
      listOvertimeBalanceAdjustmentsForRange(startsOn, endsOn),
    ]);
    const report = buildOvertimeReportData(
      overtimeCalls,
      balanceAdjustments,
      personnel,
      reportFilters(),
    );
    if (
      report.metrics.occurrenceCount === 0 &&
      report.metrics.wageCreditTotal === 0
    ) {
      throw new Error('Seçili filtrelerde raporlanacak mesai kaydı bulunamadı.');
    }
    setLastExportCount(report.metrics.occurrenceCount);
    return report;
  }

  async function createExcel() {
    setGenerating('excel');
    setError('');
    try {
      downloadOvertimeExcelReport(await prepareReport());
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'Excel raporu oluşturulamadı.',
      );
    } finally {
      setGenerating(null);
    }
  }

  async function createPdf() {
    setGenerating('pdf');
    setError('');
    try {
      await downloadOvertimeReportPdf(await prepareReport(), pdfType);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'PDF raporu oluşturulamadı.',
      );
    } finally {
      setGenerating(null);
    }
  }

  return (
    <section
      id="overtime-reports"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-violet-300/15 bg-[#0d0d0d] shadow-card"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
            <BarChart3 size={20} />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">
              Mesai Raporları
            </span>
            <span className="mt-1 block text-xs text-white/40">
              Tarih, personel tipi ve çalışma grubuna göre Excel veya PDF
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3 text-xs text-violet-200/70">
          {lastExportCount === null ? 'Rapor Oluştur' : `${lastExportCount} mesai`}
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
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Başlangıç Tarihi">
                  <input
                    type="date"
                    value={startsOn}
                    max={endsOn}
                    onChange={(event) => {
                      setStartsOn(event.target.value);
                      setLastExportCount(null);
                    }}
                    className="input bg-[#171717]"
                  />
                </Field>
                <Field label="Bitiş Tarihi">
                  <input
                    type="date"
                    value={endsOn}
                    min={startsOn}
                    max={today}
                    onChange={(event) => {
                      setEndsOn(event.target.value);
                      setLastExportCount(null);
                    }}
                    className="input bg-[#171717]"
                  />
                </Field>
                <Field label="Personel Tipi">
                  <select
                    value={role}
                    onChange={(event) =>
                      updateRole(event.target.value as OvertimeReportRoleFilter)
                    }
                    className="input bg-[#171717]"
                  >
                    <option value="all">Tümü</option>
                    <option value="foreman">Formen</option>
                    <option value="technician">Teknisyen</option>
                  </select>
                </Field>
                <Field label="Çalışma Grubu">
                  <select
                    value={group}
                    onChange={(event) =>
                      updateGroup(event.target.value as OvertimeReportGroupFilter)
                    }
                    className="input bg-[#171717]"
                  >
                    <option value="all">Tümü</option>
                    {(['A', 'B', 'C', 'D', 'L'] as WorkGroup[]).map((item) => (
                      <option key={item} value={item}>
                        {item} Grubu
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Personel" className="mt-4">
                <select
                  value={personnelId}
                  onChange={(event) => {
                    setPersonnelId(event.target.value);
                    setLastExportCount(null);
                  }}
                  className="input bg-[#171717]"
                >
                  <option value="all">Tüm personel</option>
                  {personOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.employeeNo} · {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Excel İçeriği
                </p>
                <div className="mt-3 grid gap-2 text-xs text-white/50 sm:grid-cols-3">
                  <span>Yönetici özeti</span>
                  <span>Mesai detayları</span>
                  <span>Devreden bakiyeler</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-violet-300/15 bg-violet-500/[0.045] p-4 sm:p-5">
              <p className="text-xs font-semibold text-white">PDF Rapor Türü</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <ReportTypeButton
                  active={pdfType === 'executive'}
                  title="Yönetici Özeti"
                  description="KPI’lar, dağılımlar ve personel mesai özeti"
                  onClick={() => setPdfType('executive')}
                />
                <ReportTypeButton
                  active={pdfType === 'detailed'}
                  title="Detaylı Rapor"
                  description="Yönetici özetine ek olarak tarih, saat, yer ve iş detayları"
                  onClick={() => setPdfType('detailed')}
                />
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={createPdf}
                  disabled={generating !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-400 hover:to-indigo-500 disabled:cursor-wait disabled:opacity-50"
                >
                  {generating === 'pdf' ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <FileText size={17} />
                  )}
                  {generating === 'pdf' ? 'PDF hazırlanıyor…' : 'PDF Raporunu İndir'}
                </button>
                <button
                  type="button"
                  onClick={createExcel}
                  disabled={generating !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-50"
                >
                  {generating === 'excel' ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={17} />
                  )}
                  {generating === 'excel'
                    ? 'Excel hazırlanıyor…'
                    : 'Excel Raporunu İndir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
        {label}
      </span>
      {children}
    </label>
  );
}

function ReportTypeButton({
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
      className={`rounded-lg border p-3 text-left transition ${
        active
          ? 'border-violet-300/45 bg-violet-500/15 ring-1 ring-violet-300/15'
          : 'border-white/10 bg-black/15 hover:bg-white/[0.04]'
      }`}
    >
      <span className="block text-xs font-semibold text-white">{title}</span>
      <span className="mt-1 block text-[11px] leading-5 text-white/40">
        {description}
      </span>
    </button>
  );
}
