import * as XLSX from 'xlsx';
import type {
  ParseError,
  SCEV2CalibrationStatus,
  SCEV2ControlRow,
  SCEV2MaintenanceStatus,
  SCEV2Row,
} from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';

type SAPField =
  | 'notificationNo'
  | 'orderNo'
  | 'equipmentNo'
  | 'equipmentDescription'
  | 'userStatus'
  | 'maintenanceStartDate'
  | 'maintenanceEndDate'
  | 'tagNo'
  | 'maintenanceItemNo'
  | 'maintenancePlanNo';

type ControlField =
  | 'equipmentNo'
  | 'calibrationStatus'
  | 'deferralStatus'
  | 'note'
  | 'updatedBy'
  | 'updatedAt';

const SAP_ALIASES: Record<SAPField, string[]> = {
  notificationNo: ['bildirim'],
  orderNo: ['siparis', 'sipariş'],
  equipmentNo: ['ekipman'],
  equipmentDescription: ['tanim', 'tanım', 'kisa metin', 'kısa metin'],
  userStatus: ['kullanici drm', 'kullanıcı drm', 'kullanici durumu'],
  maintenanceStartDate: [
    'yurutme bsl tarihi',
    'yürütme bşl tarihi',
    'yurutme baslangic tarihi',
  ],
  maintenanceEndDate: [
    'yurutme bitis tarihi',
    'yürütme bitiş tarihi',
  ],
  tagNo: ['teknik birim'],
  maintenanceItemNo: ['bakim kalemi', 'bakım kalemi'],
  maintenancePlanNo: ['bakim plani', 'bakım planı'],
};

const CONTROL_ALIASES: Record<ControlField, string[]> = {
  equipmentNo: ['ekipman', 'ekipman no', 'ekipman numarasi'],
  calibrationStatus: [
    'kalibrasyon raporu',
    'kalibrasyon raporu durumu',
    'kalibrasyon raporu paylasildi paylasilmadi',
    'kalibrasyon raporu paylasildi mi',
  ],
  deferralStatus: [
    'deferral durumu',
    'deferral baslatildi mi',
    'deferral sureci',
  ],
  note: ['aciklama', 'not', 'yorum'],
  updatedBy: [
    'guncelleyen',
    'kaydeden windows',
    'kaydeden',
    'kullanici',
    'sorumlu',
  ],
  updatedAt: [
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

export async function parseSCEV2SAPExcel(
  file: File,
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
      'orderNo',
      'equipmentNo',
      'userStatus',
      'maintenanceStartDate',
      'maintenanceEndDate',
      'tagNo',
      'maintenanceItemNo',
      'maintenancePlanNo',
    ];
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
        parseSAPRow(cells, sheet.fieldMap, index + sheet.headerIndex + 2),
      )
      .filter((row): row is SCEV2Row => row !== null);
    const data = deduplicateSAPRows(parsed);

    if (data.length === 0) {
      return {
        data: [],
        error: { message: 'Dosyada işlenebilir SCE V2 ekipman kaydı bulunamadı.' },
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
): Promise<{ data: SCEV2ControlRow[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return { data: [], error: { message: 'Saha kontrol dosyası boş.' } };
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
    });
    const sheet = findBestSheet(workbook, CONTROL_ALIASES);
    if (!sheet || sheet.fieldMap.equipmentNo === undefined) {
      return {
        data: [],
        error: {
          message: 'Saha kontrol dosyasında Ekipman sütunu bulunamadı.',
          details: [
            'Beklenen temel başlıklar: Ekipman, Kalibrasyon Raporu, Deferral Durumu.',
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
            'Saha kontrol dosyasında Kalibrasyon Raporu veya Deferral Durumu sütunu bulunamadı.',
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
        error: { message: 'Saha kontrol dosyasında eşleştirilecek ekipman bulunamadı.' },
      };
    }
    return { data };
  } catch {
    return {
      data: [],
      error: {
        message:
          'Saha kontrol Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }
}

function parseSAPRow(
  cells: unknown[],
  fieldMap: Partial<Record<SAPField, number>>,
  sourceRow: number,
): SCEV2Row | null {
  const value = (field: SAPField) =>
    fieldMap[field] === undefined ? '' : cells[fieldMap[field] ?? -1];
  const text = (field: SAPField) => compact(value(field));
  const equipmentNo = text('equipmentNo');
  const orderNo = text('orderNo');
  const tagNo = text('tagNo');
  if (!equipmentNo && !orderNo && !tagNo) return null;

  const userStatus = text('userStatus');
  return {
    rowId: `sce-v2-${sourceRow}-${equipmentNo || tagNo || orderNo}`,
    sourceRow,
    equipmentNo,
    tagNo,
    equipmentDescription: text('equipmentDescription'),
    notificationNo: text('notificationNo'),
    orderNo,
    userStatus,
    maintenanceStartDate: parseDate(value('maintenanceStartDate')),
    maintenanceEndDate: parseDate(value('maintenanceEndDate')),
    maintenanceItemNo: text('maintenanceItemNo'),
    maintenancePlanNo: text('maintenancePlanNo'),
    maintenancePeriod: '5 Yıl',
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
  const equipmentNo = text('equipmentNo');
  if (!equipmentNo) return null;
  const calibrationRaw = text('calibrationStatus');
  const deferralRaw = text('deferralStatus');

  return {
    rowId: `sce-v2-control-${sourceRow}-${equipmentNo}`,
    sourceRow,
    equipmentNo,
    calibrationStatus: resolveCalibrationStatus(calibrationRaw),
    deferralStarted: isAffirmativeDeferral(deferralRaw),
    deferralRaw,
    calibrationRaw,
    note: text('note'),
    updatedBy: text('updatedBy'),
    updatedAt: parseDate(value('updatedAt')),
  };
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

function completenessScore(row: SCEV2Row) {
  return (
    Number(Boolean(row.maintenanceStartDate)) +
    Number(Boolean(row.maintenanceEndDate)) +
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
