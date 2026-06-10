import * as XLSX from 'xlsx';
import { formatMocNo, normalize, normalizeMocNo, parseDate, toDisplayString } from './normalize';
import type {
  ActionRow,
  ParseError,
  RawRow,
  TechnicalRow,
} from '../types';

// Her beklenen alan için kabul edilecek olası başlıkların listesi.
// Tüm karşılaştırmalar normalize() üzerinden yapılır → küçük/büyük harf,
// boşluk ve Türkçe karakter farkları görmezden gelinir.
const TECHNICAL_FIELD_ALIASES: Record<keyof TechnicalRow, string[]> = {
  sirket: ['sirket', 'şirket', 'sirket ismi', 'şirket ismi', 'firma', 'firma adi', 'firma adı', 'company'],
  mocFormNo: ['moc form no', 'moc no', 'moc formno', 'mocformno', 'moc form numarasi', 'moc form numarası'],
  mocKonusu: ['moc konusu', 'konu', 'moc subject'],
  uniteAdi: ['unite adi', 'ünite adı', 'uniteler', 'üniteler', 'unite', 'ünite', 'unit'],
  disiplin: ['disiplin', 'discipline'],
  terminTarihi: ['termin tarihi', 'termin', 'tarih', 'hedef tarih', 'son tarih', 'due date', 'deadline'],
  kullanici: ['kullanici', 'kullanıcı', 'user', 'kisi', 'kişi'],
  durum: ['durum', 'status'],
  yetkiListesi: ['yetki listesi', 'yetkilistesi', 'gorev listesi', 'görev listesi', 'gorev tipi', 'görev tipi', 'rol'],
};

const TECHNICAL_REQUIRED_FIELDS: Array<keyof TechnicalRow> = [
  'sirket',
  'mocFormNo',
  'mocKonusu',
  'uniteAdi',
  'disiplin',
  'terminTarihi',
  'kullanici',
  'durum',
];

const TECHNICAL_TARGET_USERS = [
  'Sarkhan HAJIZADA',
  'İlhan KESKİN',
  'Yunus GÜNEŞ',
  'Mevlüt ÖZ',
  'Mehmet AYDOĞAN',
  'Ömer Sinan AKAYDIN',
  'Mustafa Oğuz BALTA',
  'Eren YILDIRIM',
  'Mehmet ZEVKER',
  'Nihat ÇELİK',
  'Onur KARADUMAN',
  'Gökhan KAYA',
  'Hüseyin Kaan AYAZ',
  'Burak ARICILAR',
  'Hakan ÇELİK',
  'Fatih ALTINDAŞ',
  'Tuna PINAR',
];

const TECHNICAL_TARGET_USER_SET = new Set(
  TECHNICAL_TARGET_USERS.map((name) => normalize(name)),
);

const MOC_TAKIP_FIELD_ALIASES = {
  mocFormNo: [
    'moc no',
    'moc form no',
    'moc formno',
    'mocformno',
    'moc form numarasi',
    'moc form numarası',
  ],
};

const ACTION_FIELD_ALIASES: Record<keyof ActionRow, string[]> = {
  sirket: ['sirket', 'şirket', 'sirket ismi', 'şirket ismi', 'firma', 'firma adi', 'firma adı', 'company'],
  mocFormNo: ['moc form no', 'moc no', 'moc formno', 'mocformno', 'moc form numarasi', 'moc form numarası'],
  mocKonusu: ['moc konusu', 'konu', 'moc subject'],
  uniteAdi: ['unite adi', 'ünite adı', 'uniteler', 'üniteler', 'unite', 'ünite', 'unit'],
  sorumlular: ['sorumlular', 'sorumlu', 'atananlar', 'assignees', 'assignee'],
  aksiyonAciklamasi: ['aksiyon', 'aksiyon aciklamasi', 'aksiyon açıklaması', 'aciklama', 'açıklama', 'action description'],
  durum: ['durum', 'aksiyon durumu', 'status'],
  mocDurumu: ['moc durumu', 'moc status'],
  hedefTarih: [
    'hedeflenen tamamlama tarihi',
    'hedeflenen tamamlanma tarihi',
    'hedef tarih',
    'tamamlama tarihi',
    'son tarih',
    'due date',
    'target date',
  ],
};

interface SheetReadResult {
  raw: RawRow[];
  details: string[];
  foundHeaders?: string[];
  score: number;
}

/** Başlık eşleştirmesinde noktalama/boşluk farklarını yumuşatır. */
function normalizeHeader(value: unknown): string {
  return normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function rowHasValue(row: unknown[]): boolean {
  return row.some((cell) => toDisplayString(cell));
}

function headerMatchScore<T extends string>(
  row: unknown[],
  aliases: Record<T, string[]>,
): number {
  const cells = row.map(normalizeHeader);
  return (Object.keys(aliases) as T[]).filter((field) => {
    const candidates = aliases[field].map(normalizeHeader);
    return cells.some((cell) => headerMatchesAnyAlias(cell, candidates));
  }).length;
}

function headerMatchesAnyAlias(cell: string, candidates: string[]): boolean {
  if (!cell) return false;
  if (candidates.includes(cell)) return true;
  return candidates.some(
    (candidate) =>
      cell.length >= 7 &&
      candidate.length >= 7 &&
      (cell.includes(candidate) || candidate.includes(cell)),
  );
}

function repairWorksheetRange(ws: XLSX.WorkSheet) {
  const cellRefs = Object.keys(ws).filter((key) => !key.startsWith('!'));
  if (cellRefs.length === 0) return;

  const range = cellRefs.reduce(
    (acc, ref) => {
      const cell = XLSX.utils.decode_cell(ref);
      return {
        s: {
          r: Math.min(acc.s.r, cell.r),
          c: Math.min(acc.s.c, cell.c),
        },
        e: {
          r: Math.max(acc.e.r, cell.r),
          c: Math.max(acc.e.c, cell.c),
        },
      };
    },
    {
      s: { r: Number.POSITIVE_INFINITY, c: Number.POSITIVE_INFINITY },
      e: { r: 0, c: 0 },
    },
  );

  ws['!ref'] = XLSX.utils.encode_range(range);
}

function worksheetToRawRows<T extends string>(
  ws: XLSX.WorkSheet,
  aliases: Record<T, string[]>,
): {
  raw: RawRow[];
  score: number;
  headers: string[];
  headerIndex: number;
  rowCount: number;
} {
  repairWorksheetRange(ws);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: false,
  });
  const rowCount = rows.filter(rowHasValue).length;

  let headerIndex = -1;
  let bestScore = 0;
  rows.forEach((row, index) => {
    const score = headerMatchScore(row, aliases);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });

  if (headerIndex < 0 || bestScore === 0) {
    return { raw: [], score: 0, headers: [], headerIndex: -1, rowCount };
  }

  const headers = rows[headerIndex].map((cell, index) => {
    const header = toDisplayString(cell);
    return header || `__EMPTY_${index}`;
  });

  const raw = rows
    .slice(headerIndex + 1)
    .filter(rowHasValue)
    .map((row) => {
      const out: RawRow = {};
      headers.forEach((header, index) => {
        out[header] = row[index] ?? '';
      });
      return out;
    });

  return { raw, score: bestScore, headers, headerIndex, rowCount };
}

/** Workbook'taki sayfaları tarayıp beklenen başlıklara en uygun sayfayı okur. */
async function readSheet<T extends string>(
  file: File,
  aliases: Record<T, string[]>,
): Promise<SheetReadResult> {
  const fileSizeKb = `${(file.size / 1024).toFixed(1)} KB`;
  if (file.size === 0) {
    return {
      raw: [],
      score: 0,
      details: [`Dosya tarayıcıya 0 KB olarak geliyor: ${file.name}`],
    };
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  let best: {
    raw: RawRow[];
    score: number;
    headers: string[];
    headerIndex: number;
    rowCount: number;
    sheetName: string;
  } = {
    raw: [],
    score: 0,
    headers: [],
    headerIndex: -1,
    rowCount: 0,
    sheetName: '',
  };
  let fallback: RawRow[] = [];
  const details = [`Dosya: ${file.name} (${fileSizeKb})`];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const candidate = worksheetToRawRows(ws, aliases);
    details.push(
      `Sayfa "${sheetName}": ${candidate.rowCount} satır, ${candidate.score} başlık eşleşmesi`,
    );
    if (
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.raw.length > best.raw.length)
    ) {
      best = { ...candidate, sheetName };
    }

    if (fallback.length === 0) {
      repairWorksheetRange(ws);
      fallback = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '', raw: true });
    }
  }

  if (best.score > 0) {
    details.push(
      `Seçilen sayfa: "${best.sheetName}", başlık satırı: ${best.headerIndex + 1}`,
    );
    return {
      raw: best.raw,
      score: best.score,
      foundHeaders: best.headers,
      details,
    };
  }

  return { raw: fallback, score: 0, details };
}

/**
 * Verilen ham satırdaki başlıklardan, beklenen alan adlarına eşleme üretir.
 * Bulunamayanlar `missing` listesine yazılır.
 */
function buildHeaderMap<T extends string>(
  sample: RawRow,
  aliases: Record<T, string[]>,
  requiredFields?: readonly T[],
): { map: Record<T, string | null>; missing: T[]; headers: string[] } {
  const headers = Object.keys(sample);
  const normalizedHeaders = headers.map((h) => ({ raw: h, n: normalizeHeader(h) }));
  const required = requiredFields ?? (Object.keys(aliases) as T[]);

  const map = {} as Record<T, string | null>;
  const missing: T[] = [];

  (Object.keys(aliases) as T[]).forEach((field) => {
    const candidates = aliases[field].map(normalizeHeader);
    const exactHit = normalizedHeaders.find((h) => candidates.includes(h.n));
    const fuzzyHit = exactHit
      ? null
      : normalizedHeaders.find((h) =>
          headerMatchesAnyAlias(h.n, candidates),
        );
    const hit = exactHit ?? fuzzyHit;
    map[field] = hit ? hit.raw : null;
    if (!hit && required.includes(field)) missing.push(field);
  });

  return { map, missing, headers };
}

function getStringField(row: RawRow, header: string | null): string {
  if (!header) return '';
  return toDisplayString(row[header]);
}

/** Teknik Görüş veya Görev Listesi Excel'ini ayrıştırır. */
export async function parseTechnicalExcel(
  file: File,
): Promise<{ data: TechnicalRow[]; error?: ParseError }> {
  let result: SheetReadResult;
  try {
    result = await readSheet(file, TECHNICAL_FIELD_ALIASES);
  } catch {
    return {
      data: [],
      error: {
        message:
          'Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }

  const raw = result.raw;
  if (raw.length === 0) {
    return {
      data: [],
      error: {
        message:
          result.score > 0
            ? 'Teknik Görüş / Görev Listesi dosyasında başlıklar bulundu ancak veri satırı bulunamadı.'
            : 'Teknik Görüş / Görev Listesi dosyasında okunabilir veri satırı bulunamadı.',
        foundHeaders: result.foundHeaders,
        details: result.details,
      },
    };
  }

  const { map, missing, headers } = buildHeaderMap(
    raw[0],
    TECHNICAL_FIELD_ALIASES,
    TECHNICAL_REQUIRED_FIELDS,
  );
  if (missing.length > 0) {
    return {
      data: [],
      error: {
        message:
          'Teknik Görüş / Görev Listesi dosyasında beklenen sütunlardan bazıları bulunamadı.',
        missing,
        foundHeaders: headers,
        details: result.details,
      },
    };
  }

  const parsedData: TechnicalRow[] = raw
    .map((row) => ({
      sirket: getStringField(row, map.sirket),
      mocFormNo: getStringField(row, map.mocFormNo),
      mocKonusu: getStringField(row, map.mocKonusu),
      uniteAdi: getStringField(row, map.uniteAdi),
      disiplin: getStringField(row, map.disiplin),
      terminTarihi: parseDate(map.terminTarihi ? row[map.terminTarihi] : null),
      kullanici: getStringField(row, map.kullanici),
      durum: getStringField(row, map.durum),
      yetkiListesi: getStringField(row, map.yetkiListesi),
    }))
    // tamamen boş satırları at
    .filter((r) => r.mocFormNo || r.kullanici || r.durum);

  if (parsedData.length === 0) {
    return {
      data: [],
      error: {
        message:
          'Teknik Görüş / Görev Listesi dosyasında başlıklar bulundu ancak MOC no, kullanıcı veya durum içeren satır bulunamadı.',
        foundHeaders: headers,
        details: result.details,
      },
    };
  }

  const data = parsedData.filter((row) =>
    TECHNICAL_TARGET_USER_SET.has(normalize(row.kullanici)),
  );

  if (data.length === 0) {
    return {
      data: [],
      error: {
        message:
          'Teknik Görüş dosyasında hedef kullanıcı listesine uyan satır bulunamadı.',
        foundHeaders: headers,
        details: result.details,
      },
    };
  }

  return { data };
}

/** MOC Takip Excel'inden MOC numaralarını okur. */
export async function parseMOCTakipExcel(
  file: File,
): Promise<{ data: string[]; error?: ParseError }> {
  let result: SheetReadResult;
  try {
    result = await readSheet(file, MOC_TAKIP_FIELD_ALIASES);
  } catch {
    return {
      data: [],
      error: {
        message:
          'MOC Takip dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }

  const raw = result.raw;
  if (raw.length === 0) {
    return {
      data: [],
      error: {
        message:
          result.score > 0
            ? 'MOC Takip dosyasında başlık bulundu ancak veri satırı bulunamadı.'
            : 'MOC Takip dosyasında okunabilir MOC no satırı bulunamadı.',
        foundHeaders: result.foundHeaders,
        details: result.details,
      },
    };
  }

  const { map, missing, headers } = buildHeaderMap(
    raw[0],
    MOC_TAKIP_FIELD_ALIASES,
  );
  if (missing.length > 0) {
    return {
      data: [],
      error: {
        message: 'MOC Takip dosyasında MOC No sütunu bulunamadı.',
        missing,
        foundHeaders: headers,
        details: result.details,
      },
    };
  }

  const unique = new Map<string, string>();
  raw.forEach((row) => {
    const mocNo = getStringField(row, map.mocFormNo);
    if (!mocNo) return;
    unique.set(normalizeMocNo(mocNo), formatMocNo(mocNo));
  });

  const data = Array.from(unique.values());
  if (data.length === 0) {
    return {
      data: [],
      error: {
        message: 'MOC Takip dosyasında MOC No içeren satır bulunamadı.',
        foundHeaders: headers,
        details: result.details,
      },
    };
  }

  return { data };
}

/** Aksiyon sütunundaki sorumlular metnini liste haline getirir. */
function splitSorumlular(s: string): string[] {
  if (!s) return [];
  // virgül, noktalı virgül, "/" ve "ve" ayırıcıları
  return s
    .split(/[,;/]|(?:\s+ve\s+)/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Aksiyonlar Excel'ini ayrıştırır. */
export async function parseActionsExcel(
  file: File,
): Promise<{ data: ActionRow[]; error?: ParseError }> {
  let result: SheetReadResult;
  try {
    result = await readSheet(file, ACTION_FIELD_ALIASES);
  } catch {
    return {
      data: [],
      error: {
        message:
          'Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }

  const raw = result.raw;
  if (raw.length === 0) {
    return {
      data: [],
      error: {
        message:
          result.score > 0
            ? 'Aksiyonlar dosyasında başlıklar bulundu ancak veri satırı bulunamadı.'
            : 'Aksiyonlar dosyasında okunabilir veri satırı bulunamadı.',
        foundHeaders: result.foundHeaders,
        details: result.details,
      },
    };
  }

  const { map, missing, headers } = buildHeaderMap(raw[0], ACTION_FIELD_ALIASES);
  if (missing.length > 0) {
    return {
      data: [],
      error: {
        message:
          'Aksiyonlar dosyasında beklenen sütunlardan bazıları bulunamadı.',
        missing,
        foundHeaders: headers,
        details: result.details,
      },
    };
  }

  const data: ActionRow[] = raw
    .map((row) => ({
      sirket: getStringField(row, map.sirket),
      mocFormNo: getStringField(row, map.mocFormNo),
      mocKonusu: getStringField(row, map.mocKonusu),
      uniteAdi: getStringField(row, map.uniteAdi),
      sorumlular: getStringField(row, map.sorumlular),
      aksiyonAciklamasi: getStringField(row, map.aksiyonAciklamasi),
      durum: getStringField(row, map.durum),
      mocDurumu: getStringField(row, map.mocDurumu),
      hedefTarih: parseDate(map.hedefTarih ? row[map.hedefTarih] : null),
    }))
    .filter((r) => r.mocFormNo || r.sorumlular || r.durum);

  if (data.length === 0) {
    return {
      data: [],
      error: {
        message:
          'Aksiyonlar dosyasında başlıklar bulundu ancak MOC no, sorumlular veya durum içeren satır bulunamadı.',
        foundHeaders: headers,
        details: result.details,
      },
    };
  }

  return { data };
}

export { splitSorumlular };
