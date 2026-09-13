import * as XLSX from 'xlsx';
import type {
  OvertimeBalanceAdjustment,
  OvertimeCalendarCall,
  OvertimePersonnel,
  PersonnelRole,
  WorkGroup,
} from './types';

export type OvertimeReportRoleFilter = 'all' | PersonnelRole;
export type OvertimeReportGroupFilter = 'all' | WorkGroup;

export interface OvertimeReportFilters {
  startsOn: string;
  endsOn: string;
  role: OvertimeReportRoleFilter;
  group: OvertimeReportGroupFilter;
  personnelId: 'all' | string;
}

export interface OvertimeReportRow {
  id: string;
  callId: string;
  personnelId: string;
  workDate: string;
  employeeNo: string;
  fullName: string;
  personnelRole: PersonnelRole;
  workGroup: WorkGroup;
  unit: string;
  overtimeType: 'full_day' | 'continuation';
  startsAt: string;
  endsAt: string;
  wageCredit: number;
  location: string;
  tasks: string[];
  callNote: string;
  participantNote: string;
  sourceType: 'manual' | 'legacy_import';
}

export interface OvertimeReportAdjustmentRow {
  id: string;
  personnelId: string;
  effectiveDate: string;
  employeeNo: string;
  fullName: string;
  personnelRole: PersonnelRole;
  workGroup: WorkGroup;
  unit: string;
  occurrenceDelta: number;
  wageCreditDelta: number;
  description: string;
}

export interface OvertimeReportPersonSummary {
  personnelId: string;
  employeeNo: string;
  fullName: string;
  personnelRole: PersonnelRole;
  workGroup: WorkGroup;
  unit: string;
  detailedOccurrenceCount: number;
  adjustmentOccurrenceCount: number;
  occurrenceCount: number;
  detailedWageCredit: number;
  adjustmentWageCredit: number;
  wageCreditTotal: number;
}

export interface OvertimeReportData {
  generatedAt: Date;
  filters: OvertimeReportFilters;
  scopeLabel: string;
  rows: OvertimeReportRow[];
  adjustments: OvertimeReportAdjustmentRow[];
  personnelSummary: OvertimeReportPersonSummary[];
  metrics: {
    detailedRecords: number;
    occurrenceCount: number;
    participatingPersonnel: number;
    wageCreditTotal: number;
    detailedWageCredit: number;
    adjustmentWageCredit: number;
    fullDayCount: number;
    continuationCount: number;
    foremanOccurrences: number;
    technicianOccurrences: number;
  };
}

function personMatches(
  person: OvertimePersonnel,
  filters: OvertimeReportFilters,
) {
  return (
    (filters.role === 'all' || person.personnelRole === filters.role) &&
    (filters.group === 'all' || person.workGroup === filters.group) &&
    (filters.personnelId === 'all' || person.id === filters.personnelId)
  );
}

function roleLabel(role: PersonnelRole) {
  return role === 'foreman' ? 'Formen' : 'Teknisyen';
}

function groupLabel(group: WorkGroup) {
  return group === 'L' ? 'L Grubu' : `${group} Vardiyası`;
}

export function buildOvertimeReportData(
  calls: OvertimeCalendarCall[],
  balanceAdjustments: OvertimeBalanceAdjustment[],
  personnel: OvertimePersonnel[],
  filters: OvertimeReportFilters,
): OvertimeReportData {
  const peopleById = new Map(personnel.map((person) => [person.id, person]));
  const eligibleIds = new Set(
    personnel.filter((person) => personMatches(person, filters)).map((person) => person.id),
  );

  const rows = calls
    .flatMap((call) =>
      call.participants
        .filter((participant) => eligibleIds.has(participant.personnelId))
        .map((participant) => ({
          id: participant.id,
          callId: call.id,
          personnelId: participant.personnelId,
          workDate: call.workDate,
          employeeNo: participant.employeeNo,
          fullName: participant.fullName,
          personnelRole: participant.personnelRole,
          workGroup: participant.workGroup,
          unit: participant.unit,
          overtimeType: participant.overtimeType,
          startsAt: participant.startsAt,
          endsAt: participant.endsAt,
          wageCredit: participant.wageCredit,
          location: call.location,
          tasks: call.tasks,
          callNote: call.note,
          participantNote: participant.note,
          sourceType: call.sourceType,
        })),
    )
    .sort(
      (left, right) =>
        right.workDate.localeCompare(left.workDate) ||
        left.fullName.localeCompare(right.fullName, 'tr-TR'),
    );

  const adjustments = balanceAdjustments
    .flatMap((adjustment) => {
      const person = peopleById.get(adjustment.personnelId);
      if (!person || !eligibleIds.has(person.id)) return [];
      return [
        {
          id: adjustment.id,
          personnelId: person.id,
          effectiveDate: adjustment.effectiveDate,
          employeeNo: person.employeeNo,
          fullName: `${person.firstName} ${person.lastName}`,
          personnelRole: person.personnelRole,
          workGroup: person.workGroup,
          unit: person.unit,
          occurrenceDelta: adjustment.occurrenceDelta,
          wageCreditDelta: adjustment.wageCreditDelta,
          description: adjustment.description,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.effectiveDate.localeCompare(left.effectiveDate) ||
        left.fullName.localeCompare(right.fullName, 'tr-TR'),
    );

  const summary = new Map<string, OvertimeReportPersonSummary>();
  function ensureSummary(person: OvertimePersonnel) {
    const existing = summary.get(person.id);
    if (existing) return existing;
    const created: OvertimeReportPersonSummary = {
      personnelId: person.id,
      employeeNo: person.employeeNo,
      fullName: `${person.firstName} ${person.lastName}`,
      personnelRole: person.personnelRole,
      workGroup: person.workGroup,
      unit: person.unit,
      detailedOccurrenceCount: 0,
      adjustmentOccurrenceCount: 0,
      occurrenceCount: 0,
      detailedWageCredit: 0,
      adjustmentWageCredit: 0,
      wageCreditTotal: 0,
    };
    summary.set(person.id, created);
    return created;
  }

  rows.forEach((row) => {
    const person = peopleById.get(row.personnelId);
    if (!person) {
      const fallback = personnel.find((item) => item.employeeNo === row.employeeNo);
      if (!fallback) return;
      const current = ensureSummary(fallback);
      current.detailedOccurrenceCount += 1;
      current.occurrenceCount += 1;
      current.detailedWageCredit += row.wageCredit;
      current.wageCreditTotal += row.wageCredit;
      return;
    }
    const current = ensureSummary(person);
    current.detailedOccurrenceCount += 1;
    current.occurrenceCount += 1;
    current.detailedWageCredit += row.wageCredit;
    current.wageCreditTotal += row.wageCredit;
  });

  adjustments.forEach((adjustment) => {
    const person = peopleById.get(adjustment.personnelId);
    if (!person) return;
    const current = ensureSummary(person);
    current.adjustmentOccurrenceCount += adjustment.occurrenceDelta;
    current.occurrenceCount += adjustment.occurrenceDelta;
    current.adjustmentWageCredit += adjustment.wageCreditDelta;
    current.wageCreditTotal += adjustment.wageCreditDelta;
  });

  const personnelSummary = [...summary.values()].sort(
    (left, right) =>
      right.wageCreditTotal - left.wageCreditTotal ||
      right.occurrenceCount - left.occurrenceCount ||
      left.fullName.localeCompare(right.fullName, 'tr-TR'),
  );
  const detailedWageCredit = rows.reduce((sum, row) => sum + row.wageCredit, 0);
  const adjustmentWageCredit = adjustments.reduce(
    (sum, row) => sum + row.wageCreditDelta,
    0,
  );
  const adjustmentOccurrences = adjustments.reduce(
    (sum, row) => sum + row.occurrenceDelta,
    0,
  );
  const scopeParts = [
    `${formatDate(filters.startsOn)} – ${formatDate(filters.endsOn)}`,
    filters.role === 'all' ? 'Tüm personel tipleri' : roleLabel(filters.role),
    filters.group === 'all' ? 'Tüm çalışma grupları' : groupLabel(filters.group),
  ];
  if (filters.personnelId !== 'all') {
    const selectedPerson = peopleById.get(filters.personnelId);
    if (selectedPerson) {
      scopeParts.push(`${selectedPerson.firstName} ${selectedPerson.lastName}`);
    }
  }

  return {
    generatedAt: new Date(),
    filters,
    scopeLabel: scopeParts.join(' · '),
    rows,
    adjustments,
    personnelSummary,
    metrics: {
      detailedRecords: rows.length,
      occurrenceCount: rows.length + adjustmentOccurrences,
      participatingPersonnel: personnelSummary.length,
      wageCreditTotal: detailedWageCredit + adjustmentWageCredit,
      detailedWageCredit,
      adjustmentWageCredit,
      fullDayCount: rows.filter((row) => row.overtimeType === 'full_day').length,
      continuationCount: rows.filter((row) => row.overtimeType === 'continuation').length,
      foremanOccurrences: personnelSummary
        .filter((row) => row.personnelRole === 'foreman')
        .reduce((sum, row) => sum + row.occurrenceCount, 0),
      technicianOccurrences: personnelSummary
        .filter((row) => row.personnelRole === 'technician')
        .reduce((sum, row) => sum + row.occurrenceCount, 0),
    },
  };
}

export function downloadOvertimeExcelReport(report: OvertimeReportData) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'Mesai Takip Raporu',
    Subject: report.scopeLabel,
    Author: 'Enstrüman Bakım Müdürlüğü',
    CreatedDate: report.generatedAt,
  };

  const summaryRows: Array<Array<string | number | Date>> = [
    ['Enstrüman Bakım Müdürlüğü Mesai Takip Raporu'],
    ['Rapor Kapsamı', report.scopeLabel],
    ['Üretim Tarihi', report.generatedAt],
    [],
    ['Toplam Mesai Sayısı', 'Toplam Yevmiye', 'Katılan Personel', 'Detaylı Kayıt'],
    [
      report.metrics.occurrenceCount,
      report.metrics.wageCreditTotal,
      report.metrics.participatingPersonnel,
      report.metrics.detailedRecords,
    ],
    [],
    ['Personel Özeti'],
    [
      'Sicil',
      'Ad Soyad',
      'Tip',
      'Grup',
      'Fabrika / Birim',
      'Mesai Sayısı',
      'Toplam Yevmiye',
      'Detaylı Yevmiye',
      'Devreden / Düzeltme',
    ],
    ...report.personnelSummary.map((person) => [
      person.employeeNo,
      person.fullName,
      roleLabel(person.personnelRole),
      person.workGroup,
      person.unit,
      person.occurrenceCount,
      person.wageCreditTotal,
      person.detailedWageCredit,
      person.adjustmentWageCredit,
    ]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows, { cellDates: true });
  summarySheet['!merges'] = [XLSX.utils.decode_range('A1:I1'), XLSX.utils.decode_range('A8:I8')];
  summarySheet['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 13 }, { wch: 9 }, { wch: 20 },
    { wch: 15 }, { wch: 17 }, { wch: 18 }, { wch: 22 },
  ];
  setDateCellFormat(summarySheet, 'B3');

  const detailRows = report.rows.map((row) => ({
      Tarih: excelDate(row.workDate),
      Sicil: row.employeeNo,
      'Ad Soyad': row.fullName,
      Tip: roleLabel(row.personnelRole),
      Grup: row.workGroup,
      'Fabrika / Birim': row.unit,
      'Mesai Türü': row.overtimeType === 'full_day' ? 'Tam Gün' : 'Devam',
      'Saat Aralığı': `${formatClock(row.startsAt)}–${formatEndClock(row.workDate, row.endsAt)}`,
      Yevmiye: row.wageCredit,
      'Çalışma Yeri': row.location,
      'Yapılan İşler': row.tasks.join(' | '),
      'Genel Not': row.callNote,
      'Personel Notu': row.participantNote,
      Kaynak: row.sourceType === 'legacy_import' ? 'Excel Geçmişi' : 'Uygulama Kaydı',
    }));
  const detailHeaders = [
    'Tarih', 'Sicil', 'Ad Soyad', 'Tip', 'Grup', 'Fabrika / Birim',
    'Mesai Türü', 'Saat Aralığı', 'Yevmiye', 'Çalışma Yeri', 'Yapılan İşler',
    'Genel Not', 'Personel Notu', 'Kaynak',
  ];
  const detailSheet = XLSX.utils.json_to_sheet(detailRows, {
    cellDates: true,
    header: detailHeaders,
  });
  detailSheet['!autofilter'] = { ref: detailSheet['!ref'] ?? 'A1:N1' };
  detailSheet['!cols'] = [
    { wch: 13 }, { wch: 12 }, { wch: 27 }, { wch: 12 }, { wch: 8 },
    { wch: 18 }, { wch: 13 }, { wch: 15 }, { wch: 10 }, { wch: 24 },
    { wch: 48 }, { wch: 36 }, { wch: 36 }, { wch: 16 },
  ];
  setColumnDateFormat(detailSheet, 0, report.rows.length + 1);

  const adjustmentRows = report.adjustments.map((row) => ({
      Tarih: excelDate(row.effectiveDate),
      Sicil: row.employeeNo,
      'Ad Soyad': row.fullName,
      Tip: roleLabel(row.personnelRole),
      Grup: row.workGroup,
      'Fabrika / Birim': row.unit,
      'Mesai Sayısı Düzeltmesi': row.occurrenceDelta,
      'Yevmiye Düzeltmesi': row.wageCreditDelta,
      Açıklama: row.description,
    }));
  const adjustmentHeaders = [
    'Tarih', 'Sicil', 'Ad Soyad', 'Tip', 'Grup', 'Fabrika / Birim',
    'Mesai Sayısı Düzeltmesi', 'Yevmiye Düzeltmesi', 'Açıklama',
  ];
  const adjustmentSheet = XLSX.utils.json_to_sheet(adjustmentRows, {
    cellDates: true,
    header: adjustmentHeaders,
  });
  adjustmentSheet['!autofilter'] = { ref: adjustmentSheet['!ref'] ?? 'A1:I1' };
  adjustmentSheet['!cols'] = [
    { wch: 13 }, { wch: 12 }, { wch: 27 }, { wch: 12 }, { wch: 8 },
    { wch: 18 }, { wch: 24 }, { wch: 21 }, { wch: 55 },
  ];
  setColumnDateFormat(adjustmentSheet, 0, report.adjustments.length + 1);

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Yönetici Özeti');
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Mesai Detayı');
  XLSX.utils.book_append_sheet(workbook, adjustmentSheet, 'Devreden Bakiyeler');
  XLSX.writeFile(
    workbook,
    `${slugify(`Mesai-Takip-${report.filters.startsOn}-${report.filters.endsOn}`)}.xlsx`,
    { cellDates: true },
  );
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function formatClock(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

export function formatEndClock(workDate: string, value: string) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  const endDate = `${map.year}-${map.month}-${map.day}`;
  const clock = formatClock(value);
  return endDate !== workDate && clock === '00:00' ? '24:00' : clock;
}

function excelDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function setDateCellFormat(sheet: XLSX.WorkSheet, address: string) {
  if (sheet[address]) sheet[address].z = 'dd.mm.yyyy hh:mm';
}

function setColumnDateFormat(sheet: XLSX.WorkSheet, column: number, rowCount: number) {
  for (let row = 1; row < rowCount; row += 1) {
    const address = XLSX.utils.encode_cell({ r: row, c: column });
    if (sheet[address]) sheet[address].z = 'dd.mm.yyyy';
  }
}

export function slugify(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
