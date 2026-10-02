import { describe, expect, it } from 'vitest';
import type { SCEV2DashboardRow } from '../types';
import { buildSCEV2ReportDefinition } from './sceV2ReportPdf';

function makeRow(
  rowId: string,
  deadlineStatus: SCEV2DashboardRow['maintenanceDeadlineStatus'],
): SCEV2DashboardRow {
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
    equipmentNo: `306795${rowId}`,
    tagNo: `110TT-0296${rowId}`,
    equipmentDescription: 'Bakım planı',
    notificationNo: '10357343',
    orderNo: `441612${rowId}`,
    revision: 'W202640',
    userStatus: 'ONAY',
    maintenanceStartDate: null,
    maintenanceEndDate: null,
    plannedCompletionDate: new Date(2026, 9, 1),
    maintenanceDeadlineDate: new Date(2026, 9, 1),
    maintenanceItemNo: '42979',
    maintenancePlanNo: '43615',
    maintenancePeriod: '5 Yıl',
    shutdownRequirement: '',
    shutdownExplanation: '',
    maintenanceStatus: 'maintenance_not_completed',
    raw: {},
    calibrationStatus: 'unknown',
    deferralStatus: 'not_applicable',
    maintenanceDeadlineStatus: deadlineStatus,
    controlNote: '',
    controlUpdatedBy: '',
    controlUpdatedAt: null,
    calibrationPdfCount: 0,
    calibrationDocumentCount: 0,
    calibrationReportFolder: '',
    calibrationReportFile: '',
    deferralOverdueDate: null,
    deferralIsOverdue: false,
  };
}

function collectText(value: unknown, texts: string[] = []): string[] {
  if (typeof value === 'string') texts.push(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, texts));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectText(item, texts));
  }
  return texts;
}

describe('SCE v2 PDF raporu', () => {
  it('sadeleştirilmiş STAR rapor başlıklarını ve tam overdue listelerini üretir', () => {
    const definition = buildSCEV2ReportDefinition({
      rows: [
        makeRow('1', 'overdue'),
        makeRow('2', 'due_soon'),
        makeRow('3', 'on_track'),
      ],
      company: 'STAR',
      type: 'detailed',
      scopeLabel: 'Star · Tüm Konsollar',
    });
    const texts = collectText(definition.content);

    expect(texts).toContain('Deferral ve Doğrulama Takibi');
    expect(texts).toContain('Tamamlanan Bakımların Doğrulama Raporu');
    expect(texts.some((text) => text.includes('Overdue Ekipmanlar (1)'))).toBe(
      true,
    );
    expect(
      texts.some((text) => text.includes('Overdue Yaklaşan Ekipmanlar (1)')),
    ).toBe(true);
    expect(texts.filter((text) => text.includes('Overdue Ekipmanlar')).length).toBe(
      1,
    );
    expect(
      texts.filter((text) => text.includes('Overdue Yaklaşan Ekipmanlar')).length,
    ).toBe(1);
  });

  it('kaldırılan özetleri, kalibrasyon alanlarını ve diğer aksiyon listesini içermez', () => {
    const definition = buildSCEV2ReportDefinition({
      rows: [
        makeRow('1', 'overdue'),
        makeRow('2', 'due_soon'),
        makeRow('3', 'on_track'),
      ],
      company: 'STAR',
      type: 'detailed',
      scopeLabel: 'Star · Tüm Konsollar',
    });
    const text = collectText(definition.content).join('\n');

    for (const removedText of [
      'Kalibrasyon',
      'Bilgi Bekleniyor',
      'Overdue Aksiyon',
      'Diğer Aksiyon Gerektiren Ekipmanlar',
      'Programa Girmeyenler',
      'Sipariş Kaydı Yok',
      'ilk 3',
    ]) {
      expect(text).not.toContain(removedText);
    }
  });
});
