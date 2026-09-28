import { describe, expect, it } from 'vitest';
import type { SCEV2DashboardRow } from '../types';
import {
  buildSCEV2ExcelData,
  getSCEV2ExcelColumnWidths,
  STAR_SCE_EXCEL_HEADERS,
} from './sceV2Excel';

function makeRow(
  overrides: Partial<SCEV2DashboardRow> = {},
): SCEV2DashboardRow {
  return {
    rowId: 'star-1',
    sourceRow: 2,
    company: 'STAR',
    factory: '',
    businessArea: '',
    unit: 'U-110',
    consoleName: 'KONSOL 1',
    categoryType: 'TT',
    equipmentType: 'TT - TEMPERATURE TRANSMITTER',
    equipmentNo: '3067955',
    tagNo: '110TT-0296A',
    equipmentDescription: '110TT-0296A BAKIM PLANI',
    notificationNo: '10357343',
    orderNo: '4444070',
    revision: 'W202640',
    userStatus: 'ONAY',
    maintenanceStartDate: null,
    maintenanceEndDate: null,
    plannedCompletionDate: new Date(2026, 8, 28),
    maintenanceDeadlineDate: new Date(2026, 8, 28),
    maintenanceItemNo: '42979',
    maintenancePlanNo: '43615',
    maintenancePeriod: '5 Yıl',
    shutdownRequirement: '',
    shutdownExplanation: '',
    maintenanceStatus: 'maintenance_not_completed',
    raw: {
      masterMaintenanceDescription: 'Gömülü bakım',
      masterWorkCenter: 'WC',
      masterPlannerGroup: 'PG',
      masterLastOrder: '100',
      masterCostCenter: 'CC',
    },
    calibrationStatus: 'not_applicable',
    deferralStatus: 'not_applicable',
    maintenanceDeadlineStatus: 'due_soon',
    controlNote: '',
    controlUpdatedBy: '',
    controlUpdatedAt: null,
    calibrationPdfCount: 0,
    calibrationDocumentCount: 0,
    calibrationReportFolder: '',
    calibrationReportFile: '',
    deferralOverdueDate: null,
    deferralIsOverdue: false,
    ...overrides,
  };
}

describe('SCE v2 Excel export', () => {
  it('STAR çıktısını istenen 21 sütunla ve doğru overdue alanlarıyla üretir', () => {
    const [row] = buildSCEV2ExcelData([makeRow()], 'STAR');

    expect(Object.keys(row)).toEqual(STAR_SCE_EXCEL_HEADERS);
    expect(row['Overdue Durumu']).toBe('Overdue Yaklaşıyor');
    expect(row['Overdue Tarihi']).toBe('28.09.2026');
    expect(row['Planlanan Tamamlanma Tarihi']).toBe('28.09.2026');
    expect(getSCEV2ExcelColumnWidths('STAR')).toHaveLength(21);
  });

  it('STAR çıktısından boş teknik ve kontrol sütunlarını kaldırır', () => {
    const [row] = buildSCEV2ExcelData([makeRow()], 'STAR');

    for (const removedHeader of [
      'Kalibrasyon PDF Sayısı',
      'Toplam Doküman',
      'Rapor Dosyası',
      'Rapor Klasörü',
      'Bakım Başlangıç Tarihi',
      'Bakım Bitiş Tarihi',
      'Planlanan Tarih',
      'Planlanan Tarih Durumu',
      'Kontrol Notu',
      'Kontrol Eden',
      'Kontrol Tarihi',
    ]) {
      expect(row).not.toHaveProperty(removedHeader);
    }
  });

  it('PETKİM ve Enerji Kritik için mevcut ayrıntılı alanları korur', () => {
    const petkimRow = buildSCEV2ExcelData(
      [makeRow({ company: 'PETKIM', factory: 'ETILEN' })],
      'PETKIM',
    )[0];
    const energyRow = buildSCEV2ExcelData(
      [makeRow({ company: 'ENERGY', businessArea: '201' })],
      'ENERGY',
    )[0];

    expect(petkimRow).toHaveProperty('Kalibrasyon PDF Sayısı');
    expect(petkimRow).toHaveProperty('Kontrol Tarihi');
    expect(petkimRow).toHaveProperty('Duruş Açıklaması');
    expect(energyRow).toHaveProperty('Kalibrasyon PDF Sayısı');
    expect(energyRow).toHaveProperty('Kontrol Tarihi');
    expect(energyRow).not.toHaveProperty('Duruş Açıklaması');
  });
});
