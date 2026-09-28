import type { SCEV2Company, SCEV2DashboardRow } from '../types';
import { energyCriticalFactoryLabel } from './energyCriticalFactories';
import { formatDate } from './normalize';

export type SCEV2ExcelRow = Record<string, string | number>;

export const STAR_SCE_EXCEL_HEADERS = [
  'Şirket',
  'Fabrika / Ünite',
  'Konsol',
  'Ekipman No',
  'Tag No / Teknik Birim',
  'Ekipman Tanımı',
  'Ekipman Tipi',
  'Kategori Tipi',
  'Sipariş No',
  'Bildirim No',
  'Bakım Plan No',
  'Bakım Kalemi',
  'Bakım Periyodu',
  'Revizyon',
  'SAP Kullanıcı Durumu',
  'Bakım Durumu',
  'Deferral Durumu',
  'Overdue Durumu',
  'Overdue Tarihi',
  'Kalibrasyon Raporu',
  'Planlanan Tamamlanma Tarihi',
] as const;

export function buildSCEV2ExcelData(
  rows: SCEV2DashboardRow[],
  company: SCEV2Company,
): SCEV2ExcelRow[] {
  return rows.map((row) =>
    company === 'STAR'
      ? buildStarExcelRow(row)
      : buildStandardExcelRow(row, company),
  );
}

export function getSCEV2ExcelColumnWidths(company: SCEV2Company) {
  if (company === 'STAR') {
    return [
      10, 18, 14, 16, 24, 38, 34, 16, 16, 16, 16, 16, 16, 20, 22,
      22, 22, 20, 18, 22, 26,
    ].map((wch) => ({ wch }));
  }

  return [
    10, 18, 14, 16, 24, 38, 34, 16,
    40, 18, 18, 22, 18,
    16, 16,
    16, 16, 16, 20, 22,
    16,
    ...(company === 'PETKIM' ? [34, 70] : []),
    28, 10, 16, 22, 18,
    16, 34, 40, 20, 20,
    24, 32, 18, 18,
  ].map((wch) => ({ wch }));
}

function buildStarExcelRow(row: SCEV2DashboardRow): SCEV2ExcelRow {
  return {
    Şirket: 'Star',
    'Fabrika / Ünite': row.unit,
    Konsol: row.consoleName,
    'Ekipman No': row.equipmentNo,
    'Tag No / Teknik Birim': row.tagNo,
    'Ekipman Tanımı': row.equipmentDescription,
    'Ekipman Tipi': row.equipmentType,
    'Kategori Tipi': row.categoryType,
    'Sipariş No': row.orderNo,
    'Bildirim No': row.notificationNo,
    'Bakım Plan No': row.maintenancePlanNo,
    'Bakım Kalemi': row.maintenanceItemNo,
    'Bakım Periyodu': row.maintenancePeriod,
    Revizyon: row.revision,
    'SAP Kullanıcı Durumu': row.userStatus,
    'Bakım Durumu': maintenanceLabel(row),
    'Deferral Durumu': deferralLabel(row),
    'Overdue Durumu': maintenanceDeadlineLabel(row),
    'Overdue Tarihi': formatDate(row.maintenanceDeadlineDate),
    'Kalibrasyon Raporu': calibrationLabel(row),
    'Planlanan Tamamlanma Tarihi': formatDate(row.plannedCompletionDate),
  };
}

function buildStandardExcelRow(
  row: SCEV2DashboardRow,
  company: Exclude<SCEV2Company, 'STAR'>,
): SCEV2ExcelRow {
  return {
    Şirket: company === 'ENERGY' ? 'Enerji Kritik' : 'Petkim',
    'Fabrika / Ünite':
      company === 'ENERGY'
        ? energyCriticalFactoryLabel(row.businessArea)
        : factoryLabel(row.factory),
    Konsol: '',
    'Ekipman No': row.equipmentNo,
    'Tag No / Teknik Birim': row.tagNo,
    'Ekipman Tanımı': row.equipmentDescription,
    'Ekipman Tipi': row.equipmentType,
    'Kategori Tipi': row.categoryType,
    'Gömülü Bakım Kalemi Tanımı': row.raw.masterMaintenanceDescription,
    'Sorumlu İşyeri': row.raw.masterWorkCenter,
    'Planlama Grubu': row.raw.masterPlannerGroup,
    'Gömülü Listedeki Son Sipariş': row.raw.masterLastOrder,
    'Masraf Yeri': row.raw.masterCostCenter,
    'Sipariş No': row.orderNo,
    'Bildirim No': row.notificationNo,
    'Bakım Plan No': row.maintenancePlanNo,
    'Bakım Kalemi': row.maintenanceItemNo,
    'Bakım Periyodu': row.maintenancePeriod,
    Revizyon: row.revision,
    ...(company === 'PETKIM'
      ? {
          'Duruş Gereklilik / Yapılabilirlik': row.shutdownRequirement,
          'Duruş Açıklaması': row.shutdownExplanation,
        }
      : {}),
    'SAP Kullanıcı Durumu': row.userStatus,
    'Bakım Durumu': maintenanceLabel(row),
    'Deferral Durumu': deferralLabel(row),
    Overdue: row.deferralIsOverdue ? 'Evet' : 'Hayır',
    'Overdue Tarihi': formatDate(row.deferralOverdueDate),
    'Kalibrasyon Raporu': calibrationLabel(row),
    'Kalibrasyon PDF Sayısı': row.calibrationPdfCount,
    'Toplam Doküman': row.calibrationDocumentCount,
    'Rapor Dosyası': row.calibrationReportFile,
    'Rapor Klasörü': row.calibrationReportFolder,
    'Bakım Başlangıç Tarihi': formatDate(row.maintenanceStartDate),
    'Bakım Bitiş Tarihi': formatDate(row.maintenanceEndDate),
    'Planlanan Tamamlanma Tarihi': formatDate(row.plannedCompletionDate),
    'Planlanan Tarih': formatDate(row.maintenanceDeadlineDate),
    'Planlanan Tarih Durumu': maintenanceDeadlineLabel(row),
    'Kontrol Notu': row.controlNote,
    'Kontrol Eden': row.controlUpdatedBy,
    'Kontrol Tarihi': formatDate(row.controlUpdatedAt),
  };
}

function maintenanceLabel(row: SCEV2DashboardRow) {
  if (row.maintenanceStatus === 'completed') return 'Tamamlandı';
  if (row.maintenanceStatus === 'shutdown_deferred') return 'Duruşa Ertelendi';
  if (row.maintenanceStatus === 'order_not_found') return 'Sipariş Kaydı Yok';
  return 'Bakımı Yapılmadı';
}

function maintenanceDeadlineLabel(row: SCEV2DashboardRow) {
  return {
    not_applicable: 'Uygulanmaz',
    completed: 'Tamamlandı',
    overdue: 'Overdue',
    due_soon: 'Overdue Yaklaşıyor',
    on_track: 'Takviminde',
  }[row.maintenanceDeadlineStatus];
}

function deferralLabel(row: SCEV2DashboardRow) {
  if (row.deferralStatus === 'started') return 'Deferral Başlatıldı';
  if (row.deferralStatus === 'required') return 'Deferral Başlatılmalı';
  return 'Deferral Gerekmiyor';
}

function calibrationLabel(row: SCEV2DashboardRow) {
  if (row.calibrationStatus === 'shared') return 'Paylaşıldı';
  if (row.calibrationStatus === 'not_shared') return 'Paylaşılmadı';
  if (row.calibrationStatus === 'not_applicable') return 'Uygulanmaz';
  return 'Bilgi Bekleniyor';
}

function factoryLabel(value: string) {
  const labels: Record<string, string> = {
    ISKELE: 'İskele',
    ETILEN: 'Etilen',
    AROMATIKLER: 'Aromatikler',
    DIGER: 'Diğer',
  };
  return labels[value] ?? value;
}
