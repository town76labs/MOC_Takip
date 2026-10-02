import { describe, expect, it } from 'vitest';
import type { SCEV2Row } from '../types';
import { buildSCEV2DashboardRows } from './sceV2Logic';
import { applySCEStarOrderCompletionRule } from './sceV2Parser';

function makeRow(
  rowId: string,
  orderNo: string,
  maintenanceStatus: SCEV2Row['maintenanceStatus'],
): SCEV2Row {
  return {
    rowId,
    sourceRow: Number(rowId.replace(/\D/g, '')) || 1,
    company: 'STAR',
    factory: 'U-110',
    businessArea: '110',
    unit: 'U-110',
    consoleName: 'KONSOL 1',
    categoryType: 'TT',
    equipmentType: 'TT - TRANSMITTER',
    equipmentNo: '3067955',
    tagNo: '110TT-0296A',
    equipmentDescription: 'Bakım planı',
    notificationNo: '10357343',
    orderNo,
    revision: 'W202640',
    userStatus: maintenanceStatus === 'completed' ? 'TYTE' : 'ONAY',
    maintenanceStartDate: null,
    maintenanceEndDate: null,
    plannedCompletionDate: new Date(2026, 9, 1),
    maintenanceDeadlineDate: new Date(2026, 9, 1),
    maintenanceItemNo: '42979',
    maintenancePlanNo: '43615',
    maintenancePeriod: '5 Yıl',
    shutdownRequirement: '',
    shutdownExplanation: '',
    maintenanceStatus,
    raw: {},
  };
}

describe('STAR sipariş tamamlama kuralı', () => {
  it('aynı siparişteki ENS adımlarından biri tamamlanmadıysa siparişin tamamını tamamlanmadı sayar', () => {
    const rows = applySCEStarOrderCompletionRule([
      {
        ...makeRow('row-1', '4416127', 'completed'),
        maintenanceDeadlineDate: new Date(2026, 0, 1),
      },
      {
        ...makeRow('row-2', '4416127', 'maintenance_not_completed'),
        maintenanceDeadlineDate: new Date(2026, 0, 1),
      },
    ]);

    expect(rows.map((row) => row.maintenanceStatus)).toEqual([
      'maintenance_not_completed',
      'maintenance_not_completed',
    ]);
    expect(
      buildSCEV2DashboardRows(rows, []).every(
        (row) => row.maintenanceDeadlineStatus === 'overdue',
      ),
    ).toBe(true);
  });

  it('aynı siparişteki bütün ENS adımları tamamlandıysa tamamlandı durumunu korur', () => {
    const rows = applySCEStarOrderCompletionRule([
      makeRow('row-1', '4416127', 'completed'),
      makeRow('row-2', '4416127', 'completed'),
    ]);

    expect(rows.every((row) => row.maintenanceStatus === 'completed')).toBe(true);
  });

  it('tek satırlı siparişlerin mevcut durumunu değiştirmez', () => {
    const [row] = applySCEStarOrderCompletionRule([
      makeRow('row-1', '4416127', 'shutdown_deferred'),
    ]);

    expect(row.maintenanceStatus).toBe('shutdown_deferred');
  });
});
