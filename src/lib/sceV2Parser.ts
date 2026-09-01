import * as XLSX from 'xlsx';
import type {
  ParseError,
  SCEV2CalibrationStatus,
  SCEV2ControlRow,
  SCEV2MaintenanceStatus,
  SCEV2Row,
} from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';
import {
  getAllSCEStarEquipmentInfo,
  getSCEStarConsoleByUnit,
  getSCEStarEquipmentInfo,
} from './sceStarLookup';
import {
  getAllSCEPetkimEquipmentInfo,
  getSCEPetkimEquipmentType,
} from './scePetkimLookup';

type SAPField =
  | 'businessArea'
  | 'notificationNo'
  | 'orderNo'
  | 'equipmentNo'
  | 'equipmentDescription'
  | 'userStatus'
  | 'maintenanceStartDate'
  | 'maintenanceEndDate'
  | 'plannedCompletionDate'
  | 'revision'
  | 'tagNo'
  | 'maintenanceItemNo'
  | 'maintenancePlanNo';

type ControlField =
  | 'company'
  | 'equipmentNo'
  | 'tagNo'
  | 'orderNo'
  | 'calibrationStatus'
  | 'pdfCount'
  | 'documentCount'
  | 'reportFolder'
  | 'reportFile'
  | 'deferralStatus'
  | 'note'
  | 'updatedBy'
  | 'updatedAt';

const SAP_ALIASES: Record<SAPField, string[]> = {
  businessArea: ['isletme alani', 'işletme alanı'],
  notificationNo: ['bildirim'],
  orderNo: ['siparis', 'sipariş'],
  equipmentNo: ['ekipman'],
  equipmentDescription: ['tanim', 'tanım', 'kisa metin', 'kısa metin'],
  userStatus: ['kullanici drm', 'kullanıcı drm', 'kullanici durumu'],
  maintenanceStartDate: [
    'yurutme bsl tarihi',
    'yürütme bşl tarihi',
    'yurutme baslangic tarihi',
    'fiili yurutme baslangic tarihi',
  ],
  maintenanceEndDate: [
    'yurutme bitis tarihi',
    'yürütme bitiş tarihi',
    'fiili yurutme bitis tarihi',
  ],
  plannedCompletionDate: [
    'planlanan bitis termini',
    'planlanan bitiş termini',
  ],
  revision: ['revizyon'],
  tagNo: ['teknik birim'],
  maintenanceItemNo: ['bakim kalemi', 'bakım kalemi'],
  maintenancePlanNo: ['bakim plani', 'bakım planı'],
};

const CONTROL_ALIASES: Record<ControlField, string[]> = {
  company: ['sirket', 'şirket'],
  equipmentNo: ['ekipman no', 'ekipman numarasi', 'ekipman numarası'],
  tagNo: ['tag no', 'tag numarasi', 'tag numarası', 'teknik birim'],
  orderNo: [
    'siparis no',
    'sipariş no',
    'siparis numarasi',
    'sipariş numarası',
    'siparis',
    'sipariş',
  ],
  calibrationStatus: [
    'kalibrasyon raporu',
    'kalibrasyon raporu durumu',
    'kalibrasyon raporu paylasildi paylasilmadi',
    'kalibrasyon raporu paylasildi mi',
  ],
  pdfCount: ['pdf sayisi', 'pdf sayısı'],
  documentCount: ['toplam dokuman', 'toplam doküman', 'dokuman sayisi'],
  reportFolder: ['rapor klasoru', 'rapor klasörü', 'klasor yolu'],
  reportFile: ['ornek pdf', 'örnek pdf', 'rapor dosyasi', 'rapor dosyası'],
  deferralStatus: [
    'deferral durumu',
    'deferral baslatildi mi',
    'deferral sureci',
  ],
  note: ['aciklama', 'not', 'yorum'],
  updatedBy: [
    'personel adi',
    'personel adı',
    'guncelleyen',
    'kaydeden windows',
    'kaydeden',
    'kullanici',
    'sorumlu',
  ],
  updatedAt: [
    'son tarama tarihi',
    'guncelleme tarihi',
    'kayit tarihi',
    'kontrol tarihi',
    'tarih',
  ],
};

interface SheetCandidate<Field extends string> {
  name: string;
  headers: string[];
  rows: unknown[][];
  headerIndex: number;
  fieldMap: Partial<Record<Field, number>>;
  score: number;
}

const SCE_V2_REPORTING_START_YEAR = 2026;
const EXCLUDED_MAINTENANCE_TEXTS = [
  'tgs periyodik bakimi',
  'sil bakim plani',
  'enerji kritik',
];

export async function parseSCEV2SAPExcel(
  file: File,
  company: 'PETKIM' | 'STAR' = 'PETKIM',
): Promise<{ data: SCEV2Row[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return { data: [], error: { message: 'SAP sipariş durumları dosyası boş.' } };
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
    });
    const sheet = findBestSheet(workbook, SAP_ALIASES);
    if (!sheet) {
      return {
        data: [],
        error: { message: 'SAP sipariş durumları tablosu bulunamadı.' },
      };
    }

    const required: SAPField[] = [
      'businessArea',
      'orderNo',
      'equipmentNo',
      'userStatus',
      'maintenanceStartDate',
      'maintenanceEndDate',
      'tagNo',
      'maintenanceItemNo',
      'maintenancePlanNo',
    ];
    if (company === 'STAR') {
      required.push('plannedCompletionDate');
    } else {
      required.push('revision');
    }
    const missing = required.filter((field) => sheet.fieldMap[field] === undefined);
    if (missing.length > 0) {
      return {
        data: [],
        error: {
          message: 'SAP sipariş durumları dosyasında gerekli sütunlar eksik.',
          missing: missing.map((field) => SAP_ALIASES[field][0]),
          foundHeaders: sheet.headers,
          details: [`Seçilen sayfa: ${sheet.name}`],
        },
      };
    }

    const parsed = sheet.rows
      .map((cells, index) =>
        parseSAPRow(
          cells,
          sheet.fieldMap,
          index + sheet.headerIndex + 2,
          company,
        ),
      )
      .filter((row): row is SCEV2Row => row !== null)
      .filter((row) => !isExcludedMaintenanceText(row));
    const reportingRows = parsed.filter((row) =>
      isInSCEV2ReportingPeriod(row, company),
    );
    const data =
      company === 'STAR'
        ? buildSCEStarInventoryRows(reportingRows)
        : buildSCEPetkimInventoryRows(reportingRows, parsed);

    if (data.length === 0) {
      return {
        data: [],
        error: {
          message:
            'Dosyada 2026 ve sonrasına ait işlenebilir SCE ekipman kaydı bulunamadı.',
        },
      };
    }
    return { data };
  } catch {
    return {
      data: [],
      error: {
        message:
          'SAP sipariş durumları Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }
}

export async function parseSCEV2ControlExcel(
  file: File,
  company: 'PETKIM' | 'STAR' = 'PETKIM',
): Promise<{ data: SCEV2ControlRow[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return {
        data: [],
        error: {
          message: `${company === 'STAR' ? 'Star' : 'Petkim'} kontrol dosyası boş.`,
        },
      };
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
    });
    const sheet = findBestSheet(workbook, CONTROL_ALIASES);
    const hasOrder = sheet?.fieldMap.orderNo !== undefined;
    const hasEquipment = sheet?.fieldMap.equipmentNo !== undefined;
    const hasTag = sheet?.fieldMap.tagNo !== undefined;
    const hasIdentity =
      company === 'STAR' ? hasEquipment || hasTag : hasOrder || hasEquipment;
    if (!sheet || !hasIdentity) {
      return {
        data: [],
        error: {
          message:
            company === 'STAR'
              ? 'Star kontrol dosyasında Ekipman No veya Tag No sütunu bulunamadı.'
              : 'Petkim kontrol dosyasında Ekipman No veya Sipariş No sütunu bulunamadı.',
          details: [
            company === 'STAR'
              ? 'Beklenen temel başlıklar: Ekipman No, Tag No, Kalibrasyon Raporu, PDF Sayısı ve Toplam Doküman.'
              : 'Beklenen temel başlıklar: Ekipman No, Kalibrasyon Raporu, PDF Sayısı ve Toplam Doküman. Eski Sipariş No tabanlı dosyalar da desteklenir.',
          ],
        },
      };
    }

    const hasCalibration = sheet.fieldMap.calibrationStatus !== undefined;
    const hasDeferral = sheet.fieldMap.deferralStatus !== undefined;
    if (!hasCalibration && !hasDeferral) {
      return {
        data: [],
        error: {
          message:
            `${company === 'STAR' ? 'Star' : 'Petkim'} kontrol dosyasında Kalibrasyon Raporu veya Deferral Durumu sütunu bulunamadı.`,
          foundHeaders: sheet.headers,
        },
      };
    }

    const data = sheet.rows
      .map((cells, index) =>
        parseControlRow(cells, sheet.fieldMap, index + sheet.headerIndex + 2),
      )
      .filter((row): row is SCEV2ControlRow => row !== null);

    if (data.length === 0) {
      return {
        data: [],
        error: {
          message:
            company === 'STAR'
              ? 'Star kontrol dosyasında eşleştirilecek ekipman veya Tag bulunamadı.'
              : 'Petkim kontrol dosyasında eşleştirilecek ekipman veya sipariş bulunamadı.',
        },
      };
    }
    return { data };
  } catch {
    return {
      data: [],
      error: {
        message:
          `${company === 'STAR' ? 'Star' : 'Petkim'} kontrol Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.`,
      },
    };
  }
}

function parseSAPRow(
  cells: unknown[],
  fieldMap: Partial<Record<SAPField, number>>,
  sourceRow: number,
  company: 'PETKIM' | 'STAR',
): SCEV2Row | null {
  const value = (field: SAPField) =>
    fieldMap[field] === undefined ? '' : cells[fieldMap[field] ?? -1];
  const text = (field: SAPField) => compact(value(field));
  const equipmentNo = text('equipmentNo');
  const orderNo = text('orderNo');
  const tagNo = text('tagNo');
  const businessArea = text('businessArea');
  if (!equipmentNo && !orderNo && !tagNo) return null;

  const userStatus = text('userStatus');
  const starInfo =
    company === 'STAR' ? getSCEStarEquipmentInfo(equipmentNo) : undefined;
  const unit =
    company === 'STAR'
      ? businessArea
        ? `U-${businessArea}`
        : 'U-BELIRSIZ'
      : resolveFactory(businessArea);
  return {
    rowId: `sce-v2-${company}-${sourceRow}-${equipmentNo || tagNo || orderNo}`,
    sourceRow,
    company,
    factory: unit,
    businessArea,
    unit,
    consoleName:
      company === 'STAR'
        ? getSCEStarConsoleByUnit(businessArea) ?? starInfo?.consoleName ?? ''
        : '',
    categoryType: starInfo?.categoryType ?? '',
    equipmentType:
      company === 'STAR'
        ? starInfo
          ? [starInfo.categoryType, starInfo.equipmentType]
              .filter(Boolean)
              .join(' - ')
          : ''
        : getSCEPetkimEquipmentType(equipmentNo),
    equipmentNo,
    tagNo,
    equipmentDescription: text('equipmentDescription'),
    notificationNo: text('notificationNo'),
    orderNo,
    revision: text('revision'),
    userStatus,
    maintenanceStartDate: parseDate(value('maintenanceStartDate')),
    maintenanceEndDate: parseDate(value('maintenanceEndDate')),
    plannedCompletionDate: parseDate(value('plannedCompletionDate')),
    maintenanceItemNo: text('maintenanceItemNo'),
    maintenancePlanNo: text('maintenancePlanNo'),
    maintenancePeriod: '5 Yıl',
    shutdownRequirement: '',
    shutdownExplanation: '',
    maintenanceStatus: resolveMaintenanceStatus(userStatus),
    raw: Object.fromEntries(
      Object.entries(fieldMap).map(([field, column]) => [
        field,
        compact(cells[column ?? -1]),
      ]),
    ),
  };
}

function parseControlRow(
  cells: unknown[],
  fieldMap: Partial<Record<ControlField, number>>,
  sourceRow: number,
): SCEV2ControlRow | null {
  const value = (field: ControlField) =>
    fieldMap[field] === undefined ? '' : cells[fieldMap[field] ?? -1];
  const text = (field: ControlField) => compact(value(field));
  const orderNo = text('orderNo');
  const equipmentNo = text('equipmentNo');
  const tagNo = text('tagNo');
  if (!orderNo && !equipmentNo && !tagNo) return null;
  const calibrationRaw = text('calibrationStatus');
  const deferralRaw = text('deferralStatus');

  return {
    rowId: `sce-v2-control-${sourceRow}-${orderNo || equipmentNo || tagNo}`,
    sourceRow,
    company: text('company'),
    equipmentNo,
    tagNo,
    orderNo,
    calibrationStatus: resolveCalibrationStatus(calibrationRaw),
    pdfCount: parseCount(value('pdfCount')),
    documentCount: parseCount(value('documentCount')),
    reportFolder: text('reportFolder'),
    reportFile: text('reportFile'),
    deferralStarted: isAffirmativeDeferral(deferralRaw),
    deferralRaw,
    calibrationRaw,
    note: text('note'),
    updatedBy: text('updatedBy'),
    updatedAt: parseDate(value('updatedAt')),
  };
}

function parseCount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

const FACTORY_BY_BUSINESS_AREA: Record<string, string> = {
  '100': 'ISKELE',
  '205': 'YYPE',
  '206': 'AYPE',
  '207': 'PP',
  '212': 'PA',
  '214': 'ETILEN',
  '215': 'AROMATIKLER',
  '219': 'AYPE-T',
};

function resolveFactory(value: string) {
  return FACTORY_BY_BUSINESS_AREA[value.trim()] ?? 'DIGER';
}

function resolveMaintenanceStatus(value: string): SCEV2MaintenanceStatus {
  const clean = normalize(value);
  if (clean.includes('kpli') || clean.includes('shtm')) return 'completed';
  if (clean.includes('bek')) return 'shutdown_deferred';
  return 'maintenance_not_completed';
}

function resolveCalibrationStatus(value: string): SCEV2CalibrationStatus {
  const clean = normalize(value);
  if (!clean) return 'unknown';
  if (
    clean.includes('paylasilmadi') ||
    clean.includes('paylasilmamis') ||
    clean === 'hayir' ||
    clean === 'yok'
  ) {
    return 'not_shared';
  }
  if (
    clean.includes('paylasildi') ||
    clean === 'evet' ||
    clean === 'var' ||
    clean === 'x'
  ) {
    return 'shared';
  }
  return 'unknown';
}

function isAffirmativeDeferral(value: string) {
  const clean = normalize(value);
  if (!clean) return false;
  if (
    clean.includes('baslatilmadi') ||
    clean.includes('baslatilmamis') ||
    clean === 'hayir' ||
    clean === 'yok'
  ) {
    return false;
  }
  return (
    clean.includes('baslatildi') ||
    clean === 'evet' ||
    clean === 'var' ||
    clean === 'x'
  );
}

function findBestSheet<Field extends string>(
  workbook: XLSX.WorkBook,
  aliases: Record<Field, string[]>,
): SheetCandidate<Field> | null {
  let best: SheetCandidate<Field> | null = null;
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });
    for (
      let headerIndex = 0;
      headerIndex < Math.min(matrix.length, 20);
      headerIndex += 1
    ) {
      const headers = matrix[headerIndex].map(toDisplayString);
      const fieldMap = buildFieldMap(headers, aliases);
      const score = Object.keys(fieldMap).length;
      if (!best || score > best.score) {
        best = {
          name,
          headers,
          rows: matrix.slice(headerIndex + 1),
          headerIndex,
          fieldMap,
          score,
        };
      }
    }
  }
  return best && best.score > 0 ? best : null;
}

function buildFieldMap<Field extends string>(
  headers: string[],
  aliases: Record<Field, string[]>,
) {
  return (Object.keys(aliases) as Field[]).reduce<
    Partial<Record<Field, number>>
  >((map, field) => {
    const normalizedAliases = aliases[field].map(normalizeHeader);
    const index = headers.findIndex((header) =>
      normalizedAliases.includes(normalizeHeader(header)),
    );
    if (index >= 0) map[field] = index;
    return map;
  }, {});
}

function deduplicateSAPRows(rows: SCEV2Row[]) {
  const bestByKey = new Map<string, SCEV2Row>();
  for (const row of rows) {
    const key = [
      normalizeKey(row.equipmentNo),
      normalizeKey(row.orderNo),
      normalizeKey(row.maintenancePlanNo),
      normalizeKey(row.maintenanceItemNo),
    ].join('|');
    const current = bestByKey.get(key);
    if (!current || completenessScore(row) > completenessScore(current)) {
      bestByKey.set(key, row);
    }
  }
  return [...bestByKey.values()];
}

function buildSCEStarInventoryRows(rows: SCEV2Row[]) {
  const latestByEquipment = new Map<string, SCEV2Row>();
  for (const row of rows) {
    const key = normalizeKey(row.equipmentNo);
    if (!key) continue;
    const current = latestByEquipment.get(key);
    if (!current || compareInventoryRowRecency(row, current) > 0) {
      latestByEquipment.set(key, row);
    }
  }

  return getAllSCEStarEquipmentInfo().map((info) => {
    const latest = latestByEquipment.get(normalizeKey(info.equipmentNo));
    const unit = info.sourceUnit ? `U-${info.sourceUnit}` : 'U-BELIRSIZ';
    const equipmentType = [info.categoryType, info.equipmentType]
      .filter(Boolean)
      .join(' - ');

    if (latest) {
      return {
        ...latest,
        rowId: `sce-v2-STAR-inventory-${info.equipmentNo}`,
        businessArea: info.sourceUnit,
        factory: unit,
        unit,
        consoleName: info.consoleName,
        categoryType: info.categoryType,
        equipmentType,
        equipmentNo: info.equipmentNo,
        tagNo: info.tagNo || latest.tagNo,
      };
    }

    return {
      rowId: `sce-v2-STAR-inventory-${info.equipmentNo}`,
      sourceRow: 0,
      company: 'STAR' as const,
      factory: unit,
      businessArea: info.sourceUnit,
      unit,
      consoleName: info.consoleName,
      categoryType: info.categoryType,
      equipmentType,
      equipmentNo: info.equipmentNo,
      tagNo: info.tagNo,
      equipmentDescription: info.equipmentType,
      notificationNo: '',
      orderNo: '',
      revision: '',
      userStatus: 'Sipariş Bulunamadı',
      maintenanceStartDate: null,
      maintenanceEndDate: null,
      plannedCompletionDate: null,
      maintenanceItemNo: '',
      maintenancePlanNo: '',
      maintenancePeriod: '5 Yıl',
      shutdownRequirement: '',
      shutdownExplanation: '',
      maintenanceStatus: 'order_not_found' as const,
      raw: {},
    };
  });
}

function buildSCEPetkimInventoryRows(
  rows: SCEV2Row[],
  sourceRows: SCEV2Row[],
) {
  const latestByEquipment = new Map<string, SCEV2Row>();
  for (const row of deduplicateSAPRows(rows)) {
    const key = normalizeKey(row.equipmentNo);
    if (!key) continue;
    const current = latestByEquipment.get(key);
    if (!current || compareInventoryRowRecency(row, current) > 0) {
      latestByEquipment.set(key, row);
    }
  }
  const latestSourceByEquipment = new Map<string, SCEV2Row>();
  for (const row of deduplicateSAPRows(sourceRows)) {
    const key = normalizeKey(row.equipmentNo);
    if (!key) continue;
    const current = latestSourceByEquipment.get(key);
    if (!current || compareInventoryRowRecency(row, current) > 0) {
      latestSourceByEquipment.set(key, row);
    }
  }

  return getAllSCEPetkimEquipmentInfo().map((info) => {
    const equipmentKey = normalizeKey(info.equipmentNo);
    const latest = latestByEquipment.get(equipmentKey);
    const latestSource = latestSourceByEquipment.get(equipmentKey);
    const businessArea = info.tagNo.match(/^(\d{3})/)?.[1] ?? '';
    const factory = resolvePetkimInventoryFactory(businessArea);

    if (latest) {
      return {
        ...latest,
        rowId: `sce-v2-PETKIM-inventory-${info.equipmentNo}`,
        businessArea,
        factory,
        unit: factory,
        equipmentNo: info.equipmentNo,
        tagNo: info.tagNo || latest.tagNo,
        equipmentType: info.equipmentType || latest.equipmentType,
        maintenanceItemNo:
          latest.maintenanceItemNo || info.maintenanceItemNo,
        maintenancePlanNo:
          latest.maintenancePlanNo || info.maintenancePlanNo,
        shutdownRequirement: info.shutdownRequirement,
        shutdownExplanation: info.shutdownExplanation,
      };
    }

    return {
      rowId: `sce-v2-PETKIM-inventory-${info.equipmentNo}`,
      sourceRow: 0,
      company: 'PETKIM' as const,
      factory,
      businessArea,
      unit: factory,
      consoleName: '',
      categoryType: '',
      equipmentType: info.equipmentType,
      equipmentNo: info.equipmentNo,
      tagNo: info.tagNo,
      equipmentDescription: info.sceReason || info.equipmentType,
      notificationNo: latestSource?.notificationNo ?? '',
      orderNo: latestSource?.orderNo ?? '',
      revision: latestSource?.revision ?? '',
      userStatus: 'Sipariş Bulunamadı',
      maintenanceStartDate: null,
      maintenanceEndDate: null,
      plannedCompletionDate: null,
      maintenanceItemNo: info.maintenanceItemNo,
      maintenancePlanNo: info.maintenancePlanNo,
      maintenancePeriod: '5 Yıl',
      shutdownRequirement: info.shutdownRequirement,
      shutdownExplanation: info.shutdownExplanation,
      maintenanceStatus: 'order_not_found' as const,
      raw: {
        sceGroup: info.sceGroup,
        sceReason: info.sceReason,
        maintenanceArea: info.maintenanceArea,
      },
    };
  });
}

function resolvePetkimInventoryFactory(businessArea: string) {
  if (businessArea === '278') return 'ISKELE';
  return resolveFactory(businessArea);
}

function compareInventoryRowRecency(candidate: SCEV2Row, current: SCEV2Row) {
  const candidateDate =
    candidate.plannedCompletionDate?.getTime() ??
    latestMaintenanceTimestamp(candidate);
  const currentDate =
    current.plannedCompletionDate?.getTime() ??
    latestMaintenanceTimestamp(current);
  const candidateOrder = numericKey(candidate.orderNo);
  const currentOrder = numericKey(current.orderNo);

  if (candidateDate !== null && currentDate !== null) {
    if (candidateDate !== currentDate) return candidateDate - currentDate;
  } else if (candidateDate === null && currentDate === null) {
    if (candidateOrder !== currentOrder) return candidateOrder - currentOrder;
  } else {
    if (candidateOrder !== currentOrder) return candidateOrder - currentOrder;
    return candidateDate !== null ? 1 : -1;
  }

  if (candidateOrder !== currentOrder) return candidateOrder - currentOrder;

  const notificationDifference =
    numericKey(candidate.notificationNo) - numericKey(current.notificationNo);
  if (notificationDifference !== 0) return notificationDifference;

  const completenessDifference =
    completenessScore(candidate) - completenessScore(current);
  if (completenessDifference !== 0) return completenessDifference;
  return candidate.sourceRow - current.sourceRow;
}

function latestMaintenanceTimestamp(row: SCEV2Row) {
  const timestamps = [row.maintenanceStartDate, row.maintenanceEndDate]
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime())
    .filter(Number.isFinite);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function isInSCEV2ReportingPeriod(
  row: SCEV2Row,
  company: 'PETKIM' | 'STAR',
) {
  const dates = [
    row.maintenanceStartDate,
    row.maintenanceEndDate,
    company === 'STAR' ? row.plannedCompletionDate : null,
  ].filter((date): date is Date => date instanceof Date);

  if (dates.length === 0) {
    return (
      row.maintenanceStatus === 'shutdown_deferred' ||
      (company === 'PETKIM' && Boolean(row.revision.trim()))
    );
  }

  return dates.every(
    (date) => date.getFullYear() >= SCE_V2_REPORTING_START_YEAR,
  );
}

function isExcludedMaintenanceText(row: SCEV2Row) {
  const description = normalize(row.equipmentDescription);
  return EXCLUDED_MAINTENANCE_TEXTS.some((text) => description.includes(text));
}

function numericKey(value: string) {
  const numeric = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function completenessScore(row: SCEV2Row) {
  return (
    Number(Boolean(row.maintenanceStartDate)) +
    Number(Boolean(row.maintenanceEndDate)) +
    Number(Boolean(row.plannedCompletionDate)) +
    Number(Boolean(row.revision)) +
    Number(Boolean(row.tagNo)) +
    Number(Boolean(row.equipmentDescription))
  );
}

function normalizeKey(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function compact(value: unknown) {
  return toDisplayString(value).replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value: unknown) {
  return normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
}
