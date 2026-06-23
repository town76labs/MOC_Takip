import * as XLSX from 'xlsx';
import type {
  ParseError,
  SCECompany,
  SCEFactory,
  SCERow,
} from '../types';
import { normalize, toDisplayString } from './normalize';

export const SCE_COMPANIES: SCECompany[] = ['PETKIM', 'STAR', 'STAD'];

export const SCE_FACTORY_CODES: Record<string, SCEFactory> = {
  '1000': 'ISKELE',
  '1001': 'ETILEN',
  '1002': 'AROMATIKLER',
  '1007': 'AYPE',
  '1008': 'AYPE-T',
  '1009': 'YYPE',
  '1010': 'PP',
  '1014': 'PA',
};

export const SCE_FACTORIES = Object.values(SCE_FACTORY_CODES);

const FIELD_ALIASES = {
  sirket: ['sirket', 'şirket', 'firma', 'company'],
  ekipmanNo: [
    'ekipman no',
    'ekipman numarasi',
    'ekipman numarası',
    'equipment no',
    'equipment number',
    'tag no',
    'tag',
    'sap no',
  ],
  ekipmanAdi: [
    'ekipman adi',
    'ekipman adı',
    'equipment name',
    'tanim',
    'tanım',
    'aciklama',
    'açıklama',
  ],
  bakimPlani: [
    'bakim plani',
    'bakım planı',
    'bakim plan',
    'maintenance plan',
    'plan',
  ],
  bakimPeriyodu: [
    'bakim periyodu',
    'bakım periyodu',
    'periyot',
    'period',
    'frequency',
    'siklik',
    'sıklık',
  ],
  periyodikBakimDurumu: [
    'periyodik bakim durumu',
    'periyodik bakım durumu',
    'bakim durumu',
    'bakım durumu',
    'maintenance status',
    'durum',
    'status',
  ],
  sonBakimTarihi: [
    'son bakim tarihi',
    'son bakım tarihi',
    'last maintenance date',
    'gerceklesen tarih',
    'gerçekleşen tarih',
  ],
  sonrakiBakimTarihi: [
    'sonraki bakim tarihi',
    'sonraki bakım tarihi',
    'gelecek bakim tarihi',
    'gelecek bakım tarihi',
    'planlanan tarih',
    'next maintenance date',
    'termin tarihi',
  ],
} as const;

type SCEField = keyof typeof FIELD_ALIASES;

interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: unknown[][];
  headerIndex: number;
  score: number;
}

export async function parseSCEExcel(
  file: File,
): Promise<{ data: SCERow[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return {
        data: [],
        error: { message: 'SCE dosyası boş görünüyor.' },
      };
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
    });
    const sheet = findBestSheet(workbook);

    if (!sheet || sheet.rows.length === 0) {
      return {
        data: [],
        error: {
          message: 'SCE Excel dosyasında okunabilir veri bulunamadı.',
        },
      };
    }

    const fieldMap = buildFieldMap(sheet.headers);
    const parsedRows = sheet.rows
      .map((cells, index) =>
        parseSCERow(cells, sheet.headers, fieldMap, index + sheet.headerIndex + 2),
      )
      .filter((row): row is SCERow => !!row);

    if (parsedRows.length === 0) {
      return {
        data: [],
        error: {
          message:
            'A sütununda tanımlı SCE fabrika kodlarından biri bulunamadı.',
          foundHeaders: sheet.headers,
          details: [
            `Seçilen sayfa: ${sheet.sheetName}`,
            'Beklenen kodlar: 1000, 1001, 1002, 1007, 1008, 1009, 1010, 1014',
          ],
        },
      };
    }

    return { data: parsedRows };
  } catch {
    return {
      data: [],
      error: {
        message:
          'SCE Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }
}

function findBestSheet(workbook: XLSX.WorkBook): ParsedSheet | null {
  let best: ParsedSheet | null = null;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    });
    const nonEmpty = matrix.filter((row) =>
      row.some((cell) => toDisplayString(cell)),
    );
    if (nonEmpty.length === 0) continue;

    const headerIndex = findHeaderIndex(nonEmpty);
    const headers = makeUniqueHeaders(nonEmpty[headerIndex] ?? []);
    const rows = nonEmpty
      .slice(headerIndex + 1)
      .filter((row) => row.some((cell) => toDisplayString(cell)));
    const score =
      headerScore(headers) +
      rows.filter((row) => !!extractFactoryCode(row[0])).length * 2;
    const candidate = { sheetName, headers, rows, headerIndex, score };

    if (
      !best ||
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.rows.length > best.rows.length)
    ) {
      best = candidate;
    }
  }

  return best;
}

function findHeaderIndex(rows: unknown[][]) {
  let bestIndex = 0;
  let bestScore = -1;
  rows.slice(0, 40).forEach((row, index) => {
    const headers = row.map((cell) => toDisplayString(cell));
    const score = headerScore(headers);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestIndex;
}

function headerScore(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return (Object.keys(FIELD_ALIASES) as SCEField[]).filter((field) =>
    FIELD_ALIASES[field].some((alias) =>
      normalizedHeaders.some((header) => header === normalizeHeader(alias)),
    ),
  ).length;
}

function makeUniqueHeaders(cells: unknown[]) {
  const seen = new Map<string, number>();
  return cells.map((cell, index) => {
    const base = toDisplayString(cell) || `Sütun ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function buildFieldMap(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return (Object.keys(FIELD_ALIASES) as SCEField[]).reduce<
    Partial<Record<SCEField, number>>
  >((map, field) => {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);
    const index = normalizedHeaders.findIndex((header) =>
      aliases.some(
        (alias) =>
          header === alias ||
          (alias.length >= 6 &&
            (header.includes(alias) || alias.includes(header))),
      ),
    );
    if (index >= 0) map[field] = index;
    return map;
  }, {});
}

function parseSCERow(
  cells: unknown[],
  headers: string[],
  fieldMap: Partial<Record<SCEField, number>>,
  sourceRow: number,
): SCERow | null {
  const fabrikaKodu = extractFactoryCode(cells[0]);
  const fabrika = fabrikaKodu ? SCE_FACTORY_CODES[fabrikaKodu] : undefined;
  if (!fabrikaKodu || !fabrika) return null;

  const raw = headers.reduce<Record<string, string>>((record, header, index) => {
    const value = toDisplayString(cells[index]);
    if (value) record[header] = value;
    return record;
  }, {});
  const value = (field: SCEField, fallbackIndex?: number) => {
    const index = fieldMap[field] ?? fallbackIndex;
    return index === undefined ? '' : toDisplayString(cells[index]);
  };

  return {
    rowId: `${fabrikaKodu}-${sourceRow}`,
    sirket: resolveCompany(value('sirket'), cells),
    fabrika,
    fabrikaKodu,
    ekipmanNo: valueAt(cells, 1),
    tagNo: valueAt(cells, 2),
    ekipmanAdi: value('ekipmanAdi'),
    sutunELabel: headerAt(headers, 4, 'Excel E Sütunu'),
    sutunE: valueAt(cells, 4),
    sutunFLabel: headerAt(headers, 5, 'Excel F Sütunu'),
    sutunF: valueAt(cells, 5),
    sutunGLabel: headerAt(headers, 6, 'Excel G Sütunu'),
    sutunG: valueAt(cells, 6),
    ekipmanTuru: valueAt(cells, 18),
    sceGrubu: valueAt(cells, 16),
    sceGozdenGecirme: valueAt(cells, 27),
    sceSebebi: valueAt(cells, 17),
    bakimPlaniNo: valueAt(cells, 7),
    bakimKalemiNo: valueAt(cells, 8),
    bakimPlani: value('bakimPlani'),
    bakimPeriyodu: valueAt(cells, 11),
    durusGereklilikYorumu: valueAt(cells, 13),
    deferralSureci: valueAt(cells, 14),
    periyodikBakimDurumu: value('periyodikBakimDurumu'),
    sonBakimTarihi: valueAt(cells, 9),
    sonBakimBildirimSiparis: valueAt(cells, 10),
    sonrakiBakimTarihi: value('sonrakiBakimTarihi'),
    raw,
  };
}

function valueAt(cells: unknown[], index: number) {
  return toDisplayString(cells[index]);
}

function headerAt(headers: string[], index: number, fallback: string) {
  return toDisplayString(headers[index]) || fallback;
}

function resolveCompany(value: string, cells: unknown[]): SCECompany {
  const direct = companyFromText(value);
  if (direct) return direct;

  for (const cell of cells) {
    const company = companyFromText(toDisplayString(cell));
    if (company) return company;
  }

  return 'PETKIM';
}

function companyFromText(value: string): SCECompany | null {
  const clean = normalize(value);
  if (clean.includes('petkim')) return 'PETKIM';
  if (clean.includes('stad')) return 'STAD';
  if (clean.includes('star')) return 'STAR';
  return null;
}

function extractFactoryCode(value: unknown) {
  const text = toDisplayString(value);
  return Object.keys(SCE_FACTORY_CODES).find((code) =>
    new RegExp(`(^|\\D)${code}(\\D|$)`).test(text),
  );
}

function normalizeHeader(value: unknown) {
  return normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
}
