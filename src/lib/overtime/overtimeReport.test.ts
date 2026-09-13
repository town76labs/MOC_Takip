import { describe, expect, it } from 'vitest';
import { buildOvertimeReportData } from './overtimeReport';
import type {
  OvertimeBalanceAdjustment,
  OvertimeCalendarCall,
  OvertimePersonnel,
} from './types';

const personnel: OvertimePersonnel[] = [
  {
    id: 'person-1',
    employeeNo: '100001',
    firstName: 'Ali',
    lastName: 'Formen',
    unit: 'PP',
    workGroup: 'A',
    personnelRole: 'foreman',
    active: true,
    overtimeEligible: true,
  },
  {
    id: 'person-2',
    employeeNo: '100002',
    firstName: 'Veli',
    lastName: 'Teknisyen',
    unit: 'AROM',
    workGroup: 'L',
    personnelRole: 'technician',
    active: true,
    overtimeEligible: true,
  },
];

const calls: OvertimeCalendarCall[] = [
  {
    id: 'call-1',
    workDate: '2026-09-13',
    location: 'PP',
    note: '',
    createdAt: '2026-09-13T08:00:00+03:00',
    sourceType: 'manual',
    tasks: ['Kalibrasyon'],
    participants: [
      {
        id: 'participant-1',
        personnelId: 'person-1',
        employeeNo: '100001',
        fullName: 'Ali Formen',
        unit: 'PP',
        personnelRole: 'foreman',
        workGroup: 'A',
        overtimeType: 'full_day',
        startsAt: '2026-09-13T08:00:00+03:00',
        endsAt: '2026-09-13T16:00:00+03:00',
        wageCredit: 3,
        note: '',
      },
      {
        id: 'participant-2',
        personnelId: 'person-2',
        employeeNo: '100002',
        fullName: 'Veli Teknisyen',
        unit: 'AROM',
        personnelRole: 'technician',
        workGroup: 'L',
        overtimeType: 'continuation',
        startsAt: '2026-09-13T17:00:00+03:00',
        endsAt: '2026-09-13T20:00:00+03:00',
        wageCredit: 2,
        note: '',
      },
    ],
  },
];

const adjustments: OvertimeBalanceAdjustment[] = [
  {
    id: 'adjustment-1',
    personnelId: 'person-2',
    effectiveDate: '2026-01-01',
    occurrenceDelta: 1,
    wageCreditDelta: 4,
    description: 'Devreden bakiye',
  },
];

describe('mesai rapor hesapları', () => {
  it('detay ve devreden bakiyeyi aynı özette doğru toplar', () => {
    const report = buildOvertimeReportData(calls, adjustments, personnel, {
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      role: 'all',
      group: 'all',
      personnelId: 'all',
    });

    expect(report.metrics).toMatchObject({
      detailedRecords: 2,
      occurrenceCount: 3,
      participatingPersonnel: 2,
      wageCreditTotal: 9,
      detailedWageCredit: 5,
      adjustmentWageCredit: 4,
      fullDayCount: 1,
      continuationCount: 1,
      foremanOccurrences: 1,
      technicianOccurrences: 2,
    });
    expect(report.personnelSummary[0]).toMatchObject({
      personnelId: 'person-2',
      occurrenceCount: 2,
      wageCreditTotal: 6,
    });
  });

  it('personel tipi ve çalışma grubu filtrelerini birlikte uygular', () => {
    const report = buildOvertimeReportData(calls, adjustments, personnel, {
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      role: 'foreman',
      group: 'A',
      personnelId: 'all',
    });

    expect(report.rows).toHaveLength(1);
    expect(report.adjustments).toHaveLength(0);
    expect(report.metrics).toMatchObject({
      occurrenceCount: 1,
      participatingPersonnel: 1,
      wageCreditTotal: 3,
    });
  });
});
