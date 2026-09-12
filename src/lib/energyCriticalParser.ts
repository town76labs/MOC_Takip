import * as XLSX from 'xlsx';
import type {
  ParseError,
  SCEV2MaintenanceStatus,
  SCEV2Row,
} from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';
import {
  getAllEnergyCriticalEquipmentInfo,
  getEnergyCriticalEquipmentInfo,
} from './energyCriticalLookup';

type EnergySAPField =
  | 'businessArea'
  | 'notificationNo'
  | 'orderNo'
  | 'equipmentNo'
  | 'equipmentDescription'
  | 'userStatus'
  | 'systemStatus'
  | 'maintenanceStartDate'
  | 'maintenanceEndDate'
  | 'plannedCompletionDate'
  | 'maintenanceDeadlineDate'
  | 'revision'
  | 'tagNo'
  | 'maintenanceItemNo'
  | 'maintenancePlanNo';

const ALIASES: Record<EnergySAPField, string[]> = {
  businessArea: ['isletme alani', 'işletme alanı'],
  notificationNo: ['bildirim'],
  orderNo: ['siparis', 'sipariş'],
  equipmentNo: ['ekipman'],
  equipmentDescription: ['kisa metin', 'kısa metin', 'tanim', 'tanım'],
  userStatus: ['kullanici durumu', 'kullanıcı durumu', 'kullanici drm'],
  systemStatus: ['islem sistem durumu', 'işlem sistem durumu', 'sistem durumu'],
  maintenanceStartDate: [
    'fiili yurutme baslangic tarihi',
    'fiili yürütme başlangıç tarihi',
    'yurutme baslangic tarihi',
  ],
  maintenanceEndDate: [
    'fiili yurutme bitis tarihi',
    'fiili yürütme bitiş tarihi',
    'yurutme bitis tarihi',
  ],
  plannedCompletionDate: [
    'planlanan bitis termini',
    'planlanan bitiş termini',
  ],
  maintenanceDeadlineDate: ['planlanan tarih'],
  revision: ['revizyon'],
  tagNo: ['teknik birim'],
  maintenanceItemNo: ['bakim kalemi', 'bakım kalemi'],
  maintenancePlanNo: ['bakim plani', 'bakım planı'],
};

interface SheetCandidate {
  name: string;
  headers: string[];
  rows: unknown[][];
  headerIndex: number;
  fieldMap: Partial<Record<EnergySAPField, number>>;
  score: number;
}

export async function parseEnergyCriticalSAPExcel(
  file: File,
): Promise<{ data: SCEV2Row[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return { data: [], error: { message: 'IW37N Kritik dosyası boş.' } };
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: false,
    });
    const sheet = findBestSheet(workbook);
    if (!sheet) {
      return {
        data: [],
        error: { message: 'IW37N Kritik bakım tablosu bulunamadı.' },
      };
    }

    const required: EnergySAPField[] = [
      'businessArea',
      'orderNo',
      'equipmentNo',
      'userStatus',
      'systemStatus',
      'maintenanceStartDate',
      'maintenanceEndDate',
      'maintenanceDeadlineDate',
      'tagNo',
      'maintenanceItemNo',
      'maintenancePlanNo',
      'revision',
    ];
    const missing = required.filter(
      (field) => sheet.fieldMap[field] === undefined,
    );
    if (missing.length > 0) {
      return {
        data: [],
        error: {
          message: 'IW37N Kritik dosyasında gerekli sütunlar eksik.',
          missing: missing.map((field) => ALIASES[field][0]),
          foundHeaders: sheet.headers,
          details: [`Seçilen sayfa: ${sheet.name}`],
        },
      };
    }

    const sourceRows = sheet.rows
      .map((cells, index) =>
        parseRow(cells, sheet.fieldMap, index + sheet.headerIndex + 2),
      )
      .filter((row): row is SCEV2Row => row !== null);
    const matchedRows = sourceRows.filter((row) =>
      getEnergyCriticalEquipmentInfo(row.equipmentNo),
    );

    if (matchedRows.length === 0) {
      return {
        data: [],
        error: {
          message:
            'Dosyada gömülü Enerji Kritik ekipman listesiyle eşleşen kayıt bulunamadı.',
        },
      };
    }

    return { data: buildInventoryRows(matchedRows) };
  } catch {
    return {
      data: [],
      error: {
        message:
          'IW37N Kritik Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }
}

function parseRow(
  cells: unknown[],
  fieldMap: Partial<Record<EnergySAPField, number>>,
  sourceRow: number,
): SCEV2Row | null {
  const value = (field: EnergySAPField) =>
    fieldMap[field] === undefined ? '' : cells[fieldMap[field] ?? -1];
  const text = (field: EnergySAPField) => compact(value(field));
  const equipmentNo = text('equipmentNo');
  if (!equipmentNo) return null;

  const businessArea = text('businessArea') || resolveBusinessArea(text('tagNo'));
  const userStatus = text('userStatus');
  const systemStatus = text('systemStatus');
  return {
    rowId: `energy-critical-${sourceRow}-${equipmentNo}`,
    sourceRow,
    company: 'ENERGY',
    factory: businessArea || 'BELIRSIZ',
    businessArea,
    unit: businessArea,
    consoleName: '',
    categoryType: '',
    equipmentType: '',
    equipmentNo,
    tagNo: text('tagNo'),
    equipmentDescription: text('equipmentDescription'),
    notificationNo: text('notificationNo'),
    orderNo: text('orderNo'),
    revision: text('revision'),
    userStatus,
    maintenanceStartDate: parseDate(value('maintenanceStartDate')),
    maintenanceEndDate: parseDate(value('maintenanceEndDate')),
    plannedCompletionDate: parseDate(value('plannedCompletionDate')),
    maintenanceDeadlineDate: parseDate(value('maintenanceDeadlineDate')),
    maintenanceItemNo: text('maintenanceItemNo'),
    maintenancePlanNo: text('maintenancePlanNo'),
    maintenancePeriod: 'Bakım planı bazlı',
    shutdownRequirement: '',
    shutdownExplanation: '',
    maintenanceStatus: resolveMaintenanceStatus(userStatus, systemStatus),
    raw: Object.fromEntries(
      Object.entries(fieldMap).map(([field, column]) => [
        field,
        compact(cells[column ?? -1]),
      ]),
    ),
  };
}

function buildInventoryRows(rows: SCEV2Row[]) {
  const latestByEquipment = new Map<string, SCEV2Row>();
  for (const row of rows) {
    const key = normalizeKey(row.equipmentNo);
    const current = latestByEquipment.get(key);
    if (!current || compareRecency(row, current) > 0) {
      latestByEquipment.set(key, row);
    }
  }

  return getAllEnergyCriticalEquipmentInfo().map((info) => {
    const current = latestByEquipment.get(normalizeKey(info.equipmentNo));
    const businessArea =
      current?.businessArea || resolveBusinessArea(info.tagNo) || 'BELIRSIZ';

    if (current) {
      return {
        ...current,
        rowId: `energy-critical-inventory-${info.equipmentNo}`,
        factory: businessArea,
        businessArea,
        unit: businessArea,
        equipmentNo: info.equipmentNo,
        tagNo: info.tagNo || current.tagNo,
        equipmentDescription:
          current.equipmentDescription || info.maintenanceDescription,
        equipmentType: info.equipmentType,
        categoryType: info.technicalObjectDescription,
        maintenanceItemNo:
          current.maintenanceItemNo || info.maintenanceItemNo,
        maintenancePlanNo:
          current.maintenancePlanNo || info.maintenancePlanNo,
        raw: {
          ...current.raw,
          masterMaintenanceDescription: info.maintenanceDescription,
          masterTechnicalObjectDescription: info.technicalObjectDescription,
          masterPlannerGroup: info.plannerGroup,
          masterWorkCenter: info.workCenter,
          masterLastOrder: info.lastOrder,
          masterCostCenter: info.costCenter,
        },
      };
    }

    return {
      rowId: `energy-critical-inventory-${info.equipmentNo}`,
      sourceRow: 0,
      company: 'ENERGY' as const,
      factory: businessArea,
      businessArea,
      unit: businessArea,
      consoleName: '',
      categoryType: info.technicalObjectDescription,
      equipmentType: info.equipmentType,
      equipmentNo: info.equipmentNo,
      tagNo: info.tagNo,
      equipmentDescription: info.maintenanceDescription,
      notificationNo: '',
      orderNo: '',
      revision: '',
      userStatus: 'Sipariş Bulunamadı',
      maintenanceStartDate: null,
      maintenanceEndDate: null,
      plannedCompletionDate: null,
      maintenanceDeadlineDate: null,
      maintenanceItemNo: info.maintenanceItemNo,
      maintenancePlanNo: info.maintenancePlanNo,
      maintenancePeriod: 'Bakım planı bazlı',
      shutdownRequirement: '',
      shutdownExplanation: '',
      maintenanceStatus: 'order_not_found' as const,
      raw: {
        masterMaintenanceDescription: info.maintenanceDescription,
        masterTechnicalObjectDescription: info.technicalObjectDescription,
        masterPlannerGroup: info.plannerGroup,
        masterWorkCenter: info.workCenter,
        masterLastOrder: info.lastOrder,
        masterCostCenter: info.costCenter,
      },
    };
  });
}

function resolveMaintenanceStatus(
  userStatus: string,
  systemStatus: string,
): SCEV2MaintenanceStatus {
  const cleanUserStatus = normalize(userStatus);
  const systemTokens = normalize(systemStatus).split(/\s+/);
  if (
    cleanUserStatus.includes('kpli') ||
    cleanUserStatus.includes('shtm') ||
    systemTokens.includes('tyte')
  ) {
    return 'completed';
  }
  if (cleanUserStatus.includes('bek')) return 'shutdown_deferred';
  return 'maintenance_not_completed';
}

function findBestSheet(workbook: XLSX.WorkBook): SheetCandidate | null {
  let best: SheetCandidate | null = null;
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
      const fieldMap = buildFieldMap(headers);
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

function buildFieldMap(headers: string[]) {
  return (Object.keys(ALIASES) as EnergySAPField[]).reduce<
    Partial<Record<EnergySAPField, number>>
  >((map, field) => {
    const aliases = ALIASES[field].map(normalizeHeader);
    const index = headers.findIndex((header) =>
      aliases.includes(normalizeHeader(header)),
    );
    if (index >= 0) map[field] = index;
    return map;
  }, {});
}

function compareRecency(candidate: SCEV2Row, current: SCEV2Row) {
  const candidateDate = latestDate(candidate);
  const currentDate = latestDate(current);
  if (candidateDate !== currentDate) return candidateDate - currentDate;
  const orderDifference = numericKey(candidate.orderNo) - numericKey(current.orderNo);
  return orderDifference || candidate.sourceRow - current.sourceRow;
}

function latestDate(row: SCEV2Row) {
  return Math.max(
    row.maintenanceStartDate?.getTime() ?? 0,
    row.maintenanceEndDate?.getTime() ?? 0,
    row.plannedCompletionDate?.getTime() ?? 0,
    row.maintenanceDeadlineDate?.getTime() ?? 0,
  );
}

function resolveBusinessArea(tagNo: string) {
  return tagNo.match(/^(\d{3})/)?.[1] ?? '';
}

function numericKey(value: string) {
  const parsed = Number(value.replace(/\D/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
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
