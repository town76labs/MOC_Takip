import * as XLSX from 'xlsx';
import type { ParseError, SCEV2DeferralRow } from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';

type DeferralField =
  | 'routeId'
  | 'equipmentNo'
  | 'tagNo'
  | 'workCenter'
  | 'action'
  | 'overdueDate';

const ALIASES: Record<DeferralField, string[]> = {
  routeId: ['route id'],
  equipmentNo: ['equipment id'],
  tagNo: ['equipment technical number'],
  workCenter: ['main work center'],
  action: ['bakim erteleme baslat', 'bakım erteleme başlat'],
  overdueDate: ['overdue date'],
};

const NOT_STARTED_TEXT = normalize(
  'Bakım Erteleme Başlatmak için tıklayınız',
);

export async function parseSCEV2DeferralExcel(
  file: File,
): Promise<{ data: SCEV2DeferralRow[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return { data: [], error: { message: 'Deferral PM dosyası boş.' } };
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
    });
    const candidate = findSheet(workbook);
    if (!candidate) {
      return {
        data: [],
        error: {
          message: 'Deferral PM tablosu veya gerekli sütunlar bulunamadı.',
          details: [
            'Beklenen başlıklar: Equipment ID, Main Work Center, Bakım Erteleme Başlat ve Overdue Date.',
          ],
        },
      };
    }

    const latestByEquipment = new Map<string, SCEV2DeferralRow>();
    for (let index = candidate.headerIndex + 1; index < candidate.rows.length; index += 1) {
      const cells = candidate.rows[index];
      const value = (field: DeferralField) =>
        cells[candidate.fieldMap[field] ?? -1];
      const workCenter = toDisplayString(value('workCenter'));
      if (normalize(workCenter) !== 'ens') continue;

      const equipmentNo = normalizeEquipmentNo(value('equipmentNo'));
      if (!equipmentNo) continue;
      const actionRaw = toDisplayString(value('action'));
      const row: SCEV2DeferralRow = {
        rowId: `sce-v2-deferral-${index + 1}-${equipmentNo}`,
        sourceRow: index + 1,
        routeId: toDisplayString(value('routeId')),
        equipmentNo,
        tagNo: toDisplayString(value('tagNo')),
        workCenter,
        actionRaw,
        deferralStarted: normalize(actionRaw) !== NOT_STARTED_TEXT,
        overdueDate: parseDate(value('overdueDate')),
      };
      const current = latestByEquipment.get(equipmentNo);
      if (!current || compareRecency(row, current) > 0) {
        latestByEquipment.set(equipmentNo, row);
      }
    }

    const data = [...latestByEquipment.values()];
    if (data.length === 0) {
      return {
        data: [],
        error: {
          message: 'Deferral PM dosyasında Main Work Center değeri ENS olan ekipman bulunamadı.',
        },
      };
    }
    return { data };
  } catch {
    return {
      data: [],
      error: {
        message:
          'Deferral PM Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }
}

function findSheet(workbook: XLSX.WorkBook) {
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });
    for (let headerIndex = 0; headerIndex < Math.min(rows.length, 20); headerIndex += 1) {
      const headers = rows[headerIndex].map((value) => toDisplayString(value));
      const fieldMap = buildFieldMap(headers);
      if (
        fieldMap.equipmentNo !== undefined &&
        fieldMap.workCenter !== undefined &&
        fieldMap.action !== undefined &&
        fieldMap.overdueDate !== undefined
      ) {
        return { rows, headerIndex, fieldMap };
      }
    }
  }
  return null;
}

function buildFieldMap(headers: string[]) {
  return (Object.keys(ALIASES) as DeferralField[]).reduce<
    Partial<Record<DeferralField, number>>
  >((map, field) => {
    const aliases = ALIASES[field].map(normalizeHeader);
    const index = headers.findIndex((header) =>
      aliases.includes(normalizeHeader(header)),
    );
    if (index >= 0) map[field] = index;
    return map;
  }, {});
}

function normalizeHeader(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeEquipmentNo(value: unknown) {
  return toDisplayString(value)
    .replace(/\.0+$/, '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
}

function compareRecency(
  candidate: SCEV2DeferralRow,
  current: SCEV2DeferralRow,
) {
  const candidateTime = candidate.overdueDate?.getTime() ?? 0;
  const currentTime = current.overdueDate?.getTime() ?? 0;
  return candidateTime - currentTime || candidate.sourceRow - current.sourceRow;
}
