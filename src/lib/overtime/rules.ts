import type { OvertimeType, ShiftCode } from './types';

export interface TimeIntervalOption {
  start: string;
  end: string;
  label: string;
}

const FULL_DAY_INTERVALS: TimeIntervalOption[] = [
  { start: '08:00', end: '16:00', label: '08:00–16:00' },
  { start: '08:00', end: '20:00', label: '08:00–20:00' },
  { start: '08:00', end: '24:00', label: '08:00–24:00' },
];

const CONTINUATION_INTERVALS: Partial<
  Record<ShiftCode, TimeIntervalOption[]>
> = {
  shift_08_16: [
    { start: '16:00', end: '20:00', label: '16:00–20:00' },
    { start: '16:00', end: '24:00', label: '16:00–24:00' },
  ],
  day_08_17: [
    { start: '17:00', end: '20:00', label: '17:00–20:00' },
    { start: '16:00', end: '24:00', label: '16:00–24:00' },
  ],
};

export function isCandidateEligible(
  overtimeType: OvertimeType,
  shiftCode: ShiftCode,
) {
  return overtimeType === 'full_day'
    ? shiftCode === 'weekly_rest'
    : shiftCode === 'shift_08_16' || shiftCode === 'day_08_17';
}

export function getAllowedIntervals(
  overtimeType: OvertimeType,
  shiftCode: ShiftCode,
) {
  if (!isCandidateEligible(overtimeType, shiftCode)) return [];
  if (overtimeType === 'full_day') return FULL_DAY_INTERVALS;
  return CONTINUATION_INTERVALS[shiftCode] ?? [];
}

export function candidateEligibilityReason(
  overtimeType: OvertimeType,
  shiftCode: ShiftCode,
) {
  if (overtimeType === 'full_day' && shiftCode !== 'weekly_rest') {
    return 'Tam gün mesaisi için personel hafta tatilinde olmalıdır.';
  }
  if (overtimeType === 'continuation' && shiftCode === 'weekly_rest') {
    return 'Hafta tatilindeki personel devam mesaisine bırakılamaz.';
  }
  if (
    overtimeType === 'continuation' &&
    getAllowedIntervals(overtimeType, shiftCode).length === 0
  ) {
    return 'Bu vardiya için devam mesaisi saatleri henüz tanımlanmadı.';
  }
  return 'Mesai türü ve vardiya durumu uygundur.';
}
