import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { SCEV2Row } from '../types';
import { buildSCEV2DashboardRows } from './sceV2Logic';
import {
  applySCEStarOrderCompletionRule,
  parseSCEV2SAPExcel,
} from './sceV2Parser';

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
  it('4416127 siparişindeki tarihsiz ve teyitsiz ikinci ENS adımını filtrelemeden önce hesaba katar', async () => {
    const headers = [
      'İşletme Alanı',
      'Bildirim',
      'Sipariş',
      'Ekipman',
      'Tanım',
      'Kullanıcı drm',
      'İşlem sistem durumu',
      'Yürütme Bşl Tarihi',
      'Yürütme Bitiş Tarihi',
      'Planlanan Bitiş Termini',
      'Planlanan Tarih',
      'Revizyon',
      'Teknik Birim',
      'Bakım Kalemi',
      'Bakım Planı',
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        headers,
        [
          '430',
          '10329344',
          '4416127',
          '3037251',
          '430FT-0554 BAKIM PLANI',
          'PLAN BEK1',
          'TYTE JBFI ONAY PİT',
          new Date(2026, 5, 24),
          new Date(2026, 5, 25),
          new Date(2026, 5, 25),
          new Date(2026, 5, 25),
          'W202626',
          '430FT-0554',
          '5000',
          '43001',
        ],
        [
          '430',
          '10329344',
          '4416127',
          '3037251',
          '430FT-0554 BAKIM PLANI',
          'PLAN BEK1',
          'ONAY',
          '',
          '',
          '',
          '',
          '',
          '430FT-0554',
          '5000',
          '43001',
        ],
      ]),
      'SAP',
    );
    const arrayBuffer = XLSX.write(workbook, {
      type: 'array',
      bookType: 'xlsx',
    }) as ArrayBuffer;
    const file = {
      size: arrayBuffer.byteLength,
      arrayBuffer: async () => arrayBuffer,
    } as File;

    const result = await parseSCEV2SAPExcel(file, 'STAR');
    const parsedRow = result.data.find(
      (row) => row.equipmentNo === '3037251',
    );

    expect(result.error).toBeUndefined();
    expect(parsedRow?.orderNo).toBe('4416127');
    expect(parsedRow?.maintenanceStatus).toBe('maintenance_not_completed');
    expect(
      buildSCEV2DashboardRows(parsedRow ? [parsedRow] : [], [])[0]
        ?.maintenanceDeadlineStatus,
    ).toBe('overdue');
  });

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
