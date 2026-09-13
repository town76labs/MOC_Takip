import { describe, expect, it } from 'vitest';
import {
  candidateEligibilityReason,
  getAllowedIntervals,
  isCandidateEligible,
} from './rules';
import type { ShiftCode } from './types';

const allShifts: ShiftCode[] = [
  'shift_00_08',
  'shift_08_16',
  'shift_16_24',
  'day_08_17',
  'weekly_rest',
];

describe('mesai aday ve saat kuralları', () => {
  it('tam gün mesaisine yalnızca hafta tatilindeki personeli alır', () => {
    allShifts.forEach((shift) => {
      expect(isCandidateEligible('full_day', shift)).toBe(
        shift === 'weekly_rest',
      );
    });
    expect(getAllowedIntervals('full_day', 'weekly_rest')).toEqual([
      { start: '08:00', end: '16:00', label: '08:00–16:00' },
      { start: '08:00', end: '20:00', label: '08:00–20:00' },
      { start: '08:00', end: '24:00', label: '08:00–24:00' },
    ]);
  });

  it('08–16 vardiyası devam mesaisini 16–20 ve 16–24 ile sınırlar', () => {
    expect(getAllowedIntervals('continuation', 'shift_08_16')).toEqual([
      { start: '16:00', end: '20:00', label: '16:00–20:00' },
      { start: '16:00', end: '24:00', label: '16:00–24:00' },
    ]);
  });

  it('L grubu devam mesaisini 17–20 ve 16–24 ile sınırlar', () => {
    expect(getAllowedIntervals('continuation', 'day_08_17')).toEqual([
      { start: '17:00', end: '20:00', label: '17:00–20:00' },
      { start: '16:00', end: '24:00', label: '16:00–24:00' },
    ]);
  });

  it('gece, akşam ve hafta tatili vardiyalarını devam mesaisinden çıkarır', () => {
    (['shift_00_08', 'shift_16_24', 'weekly_rest'] as ShiftCode[]).forEach(
      (shift) => {
        expect(isCandidateEligible('continuation', shift)).toBe(false);
        expect(getAllowedIntervals('continuation', shift)).toEqual([]);
      },
    );
    expect(
      candidateEligibilityReason('continuation', 'weekly_rest'),
    ).toContain('bırakılamaz');
  });
});
