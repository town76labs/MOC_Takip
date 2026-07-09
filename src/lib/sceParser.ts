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
    'ekipman',
    'ekipman no',
    'ekipman numarasi',
    'ekipman numarası',
    'equipment no',
    'equipment number',
  ],
  tagNo: [
    'teknik tanitici numarasi',
    'teknik tanıtıcı numarası',
    'tag no',
    'tag',
    'sap no',
  ],
  ekipmanAdi: [
    'ekipman adi',
    'ekipman adı',
    'teknik nesne tanimi',
    'teknik nesne tanımı',
    'equipment name',
    'equipment description',
    'technical object description',
    'tanim',
    'tanım',
  ],
  ekipmanTuru: [
    'taxonomy type text',
    'taxonomy',
    'tip tanimi',
    'tip tanımı',
    'ekipman turu',
    'ekipman türü',
  ],
  sceGrubu: [
    'emnytce krit ekpman sce grubu',
    'emnytçe krit ekpman sce grubu',
    'emniyet kritik sce grubu',
    'emniyet kritik ekipman sce grubu',
    'sce grubu',
    'sce group',
  ],
  sceGozdenGecirme: [
    'sce gozden gecirme',
    'sce gözden geçirme',
    'gozden gecirme',
    'gözden geçirme',
  ],
  sceSebebi: [
    'sce sebebi',
    'sce nedeni',
    'sce reason',
  ],
  bakimPlaniNo: [
    'bakim plani numaralari',
    'bakım planı numaraları',
    'bakim plani numarasi',
    'bakım planı numarası',
    'maintenance plan number',
    'plan number',
  ],
  bakimKalemiNo: [
    'bakim kalemi',
    'bakım kalemi',
    'bakim kalemi no',
    'bakım kalemi no',
    'maintenance item',
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
    'bakim periyodlari',
    'bakım periyodları',
    'periyot',
    'period',
    'frequency',
    'siklik',
    'sıklık',
  ],
  durusGereklilikYorumu: [
    'durus gereklilik yapilabilirlik',
    'duruş gereklilik yapılabilirlik',
    'durus gereklilik ve yapilabilirlik',
    'duruş gereklilik ve yapılabilirlik',
    'durus gereklilik & yapilabilirlik',
    'duruş gereklilik & yapılabilirlik',
    'durus gerekliligi',
    'duruş gerekliliği',
    'shutdown requirement',
  ],
  durusAciklamasi: [
    'durus aciklamasi',
    'duruş açıklaması',
    'durus aciklama',
    'duruş açıklama',
    'aciklama',
    'açıklama',
    'explanation',
    'comment',
  ],
  deferralSureci: [
    'deferral sureci',
    'deferral süreci',
    'deferral',
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
  sonKontrolTarihi: [
    'son kontrolunun yapildigi tarih',
    'son kontrolünün yapıldığı tarih',
    'son kontrol yapildigi tarih',
    'son kontrol yapıldığı tarih',
    'last control date',
    'last inspection date',
    'last check date',
  ],
  sonBakimTarihi: [
    'son bakim tarihi',
    'son bakım tarihi',
    'son bakim yapildigi tarih',
    'son bakım yapıldığı tarih',
    'last maintenance date',
    'gerceklesen tarih',
    'gerçekleşen tarih',
  ],
  sonBakimBildirimSiparis: [
    'son bakim yapildigi siparis',
    'son bakım yapıldığı sipariş',
    'son bakim bildirim siparis',
    'son bakım bildirim sipariş',
    'last maintenance order',
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
  const hasControlDateColumn = fieldMap.sonKontrolTarihi !== undefined;
  const fallback = hasControlDateColumn
    ? {
        ekipmanAdi: 13, // N
        ekipmanTuru: 20, // U
        sceGrubu: 18, // S
        sceGozdenGecirme: 29, // AD
        sceSebebi: 19, // T
        bakimPeriyodu: 12, // M
        durusGereklilikYorumu: 14, // O
        durusAciklamasi: 15, // P
        deferralSureci: 16, // Q
        sonKontrolTarihi: 9, // J
        sonBakimTarihi: 10, // K
        sonBakimBildirimSiparis: 11, // L
      }
    : {
        ekipmanAdi: 12,
        ekipmanTuru: 18,
        sceGrubu: 16,
        sceGozdenGecirme: 27,
        sceSebebi: 17,
        bakimPeriyodu: 11,
        durusGereklilikYorumu: 13,
        durusAciklamasi: 14,
        deferralSureci: 15,
        sonKontrolTarihi: undefined,
        sonBakimTarihi: 9,
        sonBakimBildirimSiparis: 10,
      };

  return {
    rowId: `${fabrikaKodu}-${sourceRow}`,
    sirket: resolveCompany(value('sirket'), cells),
    fabrika,
    fabrikaKodu,
    ekipmanNo: value('ekipmanNo', 1),
    tagNo: value('tagNo', 2),
    ekipmanAdi: value('ekipmanAdi', fallback.ekipmanAdi),
    sutunELabel: headerAt(headers, 4, 'Excel E Sütunu'),
    sutunE: valueAt(cells, 4),
    sutunFLabel: headerAt(headers, 5, 'Excel F Sütunu'),
    sutunF: valueAt(cells, 5),
    sutunGLabel: headerAt(headers, 6, 'Excel G Sütunu'),
    sutunG: valueAt(cells, 6),
    ekipmanTuru: value('ekipmanTuru', fallback.ekipmanTuru),
    sceGrubu: value('sceGrubu', fallback.sceGrubu),
    sceGozdenGecirme: value('sceGozdenGecirme', fallback.sceGozdenGecirme),
    sceSebebi: value('sceSebebi', fallback.sceSebebi),
    bakimPlaniNo: value('bakimPlaniNo', 7),
    bakimKalemiNo: value('bakimKalemiNo', 8),
    bakimPlani: value('bakimPlani'),
    bakimPeriyodu: value('bakimPeriyodu', fallback.bakimPeriyodu),
    durusGereklilikYorumu: value(
      'durusGereklilikYorumu',
      fallback.durusGereklilikYorumu,
    ),
    durusAciklamasi: value('durusAciklamasi', fallback.durusAciklamasi),
    deferralSureci: value('deferralSureci', fallback.deferralSureci),
    periyodikBakimDurumu: value('periyodikBakimDurumu'),
    sonKontrolTarihi: value('sonKontrolTarihi', fallback.sonKontrolTarihi),
    sonKontrolSutunuVar: hasControlDateColumn,
    sonBakimTarihi: value('sonBakimTarihi', fallback.sonBakimTarihi),
    sonBakimBildirimSiparis: value(
      'sonBakimBildirimSiparis',
      fallback.sonBakimBildirimSiparis,
    ),
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
