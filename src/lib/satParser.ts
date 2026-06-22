import * as XLSX from 'xlsx';
import type {
  ParseError,
  SATExportRow,
  SATFileFormat,
  SATRow,
  SATStage,
} from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';

type SATField =
  | 'sıraNo'
  | 'butceSorumlusu'
  | 'talepSahibi'
  | 'unite'
  | 'satNo'
  | 'satTarihi'
  | 'aciklama'
  | 'toplamTutar'
  | 'paraBirimi'
  | 'butceTuru'
  | 'pypKodu'
  | 'butceAciklama'
  | 'onayDurumu'
  | 'satDurumu'
  | 'satinAlmaSorumlusu'
  | 'malzemeGelisTarihi'
  | 'notlar';

const FIELD_ALIASES: Record<SATField, string[]> = {
  sıraNo: ['#', 'sira no', 'sıra no'],
  butceSorumlusu: ['butce sorumlusu', 'bütçe sorumlusu'],
  talepSahibi: ['talep sahibi'],
  unite: ['unite', 'ünite', 'fabrika'],
  satNo: ['sat no', 'sat numarasi', 'sat numarası'],
  satTarihi: ['sat tarihi', 'talep tarihi'],
  aciklama: [
    'satin alma talebi aciklamasi',
    'satın alma talebi açıklaması',
    'talep aciklamasi',
    'talep açıklaması',
  ],
  toplamTutar: ['toplam tutar', 'tutar'],
  paraBirimi: ['para birimi', 'doviz', 'döviz'],
  butceTuru: ['butce turu', 'bütçe türü'],
  pypKodu: [
    'pyp kodu mali merkez kalem',
    'pyp kodu - mali merkez/kalem',
    'pyp kodu',
    'mali merkez',
  ],
  butceAciklama: ['butce aciklama', 'bütçe açıklama'],
  onayDurumu: ['onay durumu'],
  satDurumu: ['sat durumu', 'satin alma durumu', 'satın alma durumu'],
  satinAlmaSorumlusu: [
    'satin alma sorumlusu',
    'satın alma sorumlusu',
    'buyer',
  ],
  malzemeGelisTarihi: [
    'malzeme gelecegi tarih',
    'malzeme geleceği tarih',
    'malzeme gelis tarihi',
    'malzeme geliş tarihi',
  ],
  notlar: ['notlar', 'not', 'aciklama notu', 'açıklama notu'],
};

const REQUIRED_FIELDS: SATField[] = [
  'unite',
  'satNo',
  'satTarihi',
  'aciklama',
  'toplamTutar',
  'paraBirimi',
  'onayDurumu',
  'satDurumu',
];

interface SheetCandidate {
  name: string;
  headers: string[];
  rows: unknown[][];
  headerIndex: number;
  fieldMap: Partial<Record<SATField, number>>;
  score: number;
}

export async function parseSATExcel(
  file: File,
): Promise<{
  data: SATRow[];
  exportData: SATExportRow[];
  format: SATFileFormat | null;
  error?: ParseError;
}> {
  try {
    if (file.size === 0) {
      return {
        data: [],
        exportData: [],
        format: null,
        error: { message: 'SAT Takip dosyası boş görünüyor.' },
      };
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
    });
    const exportData = parseSAPExport(workbook);
    if (exportData.length > 0) {
      return { data: [], exportData, format: 'sap_export' };
    }
    const sheet = findBestSheet(workbook);

    if (!sheet || sheet.score === 0) {
      return {
        data: [],
        exportData: [],
        format: null,
        error: {
          message: 'SAT Takip tablosunun başlıkları bulunamadı.',
          details: ['Beklenen sayfa örneği: SAT LİSTESİ'],
        },
      };
    }

    const missing = REQUIRED_FIELDS.filter(
      (field) => sheet.fieldMap[field] === undefined,
    );
    if (missing.length > 0) {
      return {
        data: [],
        exportData: [],
        format: null,
        error: {
          message: 'SAT Takip dosyasında gerekli sütunlar eksik.',
          missing: missing.map((field) => FIELD_ALIASES[field][0]),
          foundHeaders: sheet.headers,
          details: [`Seçilen sayfa: ${sheet.name}`],
        },
      };
    }

    const data = sheet.rows
      .map((cells, index) =>
        parseRow(
          cells,
          sheet.headers,
          sheet.fieldMap,
          index + sheet.headerIndex + 2,
        ),
      )
      .filter((row): row is SATRow => row !== null);

    if (data.length === 0) {
      return {
        data: [],
        exportData: [],
        format: null,
        error: {
          message: 'SAT Takip sayfasında gerçek talep kaydı bulunamadı.',
          details: [`Seçilen sayfa: ${sheet.name}`],
        },
      };
    }

    return { data, exportData: [], format: 'legacy' };
  } catch {
    return {
      data: [],
      exportData: [],
      format: null,
      error: {
        message:
          'SAT Takip Excel dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.',
      },
    };
  }
}

const SAP_EXPORT_HEADERS = [
  'SAT Yaratan',
  'SAT Belge Numarası',
  'Toplam SAT USD Tutarı',
  'SAT Yaratılma Tarihi',
  'Tamam',
  'SAS Son Teslimat',
  'SAS Son Fatura',
  'SAS USD Tutar',
  'Teslim Tarihi',
  'SAS Birim Fiyat',
  'SAT Onay Durum',
  'İrsaliye',
  'Satınalma Özet Durum Bilgisi',
  'Malzeme Tanımı',
  'Malzeme',
  'SAS Yaratan',
  'Satıcı Adı',
  'SAT Onay Durum Tanımı',
] as const;

function parseSAPExport(workbook: XLSX.WorkBook): SATExportRow[] {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });
    const headerIndex = matrix.slice(0, 20).findIndex((row) => {
      const headers = new Set(row.map(normalizeHeader));
      return SAP_EXPORT_HEADERS.filter((header) =>
        headers.has(normalizeHeader(header)),
      ).length >= 14;
    });
    if (headerIndex < 0) continue;

    const headers = matrix[headerIndex].map(normalizeHeader);
    const indexOf = (header: (typeof SAP_EXPORT_HEADERS)[number]) =>
      headers.indexOf(normalizeHeader(header));
    const indexes = Object.fromEntries(
      SAP_EXPORT_HEADERS.map((header) => [header, indexOf(header)]),
    ) as Record<(typeof SAP_EXPORT_HEADERS)[number], number>;
    if (
      indexes['SAT Belge Numarası'] < 0 ||
      indexes['SAT Yaratan'] < 0 ||
      indexes['Malzeme Tanımı'] < 0
    ) {
      continue;
    }

    const value = (
      cells: unknown[],
      header: (typeof SAP_EXPORT_HEADERS)[number],
    ) => cells[indexes[header]];
    return matrix
      .slice(headerIndex + 1)
      .map((cells, index): SATExportRow | null => {
        const satNo = compact(value(cells, 'SAT Belge Numarası'));
        if (!satNo) return null;
        return {
          rowId: `sat-export-${index + headerIndex + 2}`,
          sourceRow: index + headerIndex + 2,
          satCreator: compact(value(cells, 'SAT Yaratan')),
          satNo,
          totalSatUsd: parseAmount(value(cells, 'Toplam SAT USD Tutarı')),
          createdAt: parseDate(value(cells, 'SAT Yaratılma Tarihi')),
          completed: isMarked(value(cells, 'Tamam')),
          lastDelivery: isMarked(value(cells, 'SAS Son Teslimat')),
          lastInvoice: isMarked(value(cells, 'SAS Son Fatura')),
          sasUsdAmount: parseAmount(value(cells, 'SAS USD Tutar')),
          deliveryDate: parseDate(value(cells, 'Teslim Tarihi')),
          sasUnitPrice: parseAmount(value(cells, 'SAS Birim Fiyat')),
          approvalCode: compact(value(cells, 'SAT Onay Durum')),
          waybill: compact(value(cells, 'İrsaliye')),
          summaryStatus: compact(
            value(cells, 'Satınalma Özet Durum Bilgisi'),
          ),
          materialDescription: compact(value(cells, 'Malzeme Tanımı')),
          material: compact(value(cells, 'Malzeme')),
          sasCreator: compact(value(cells, 'SAS Yaratan')),
          vendorName: compact(value(cells, 'Satıcı Adı')),
          approvalStatusDescription: compact(
            value(cells, 'SAT Onay Durum Tanımı'),
          ),
        };
      })
      .filter((row): row is SATExportRow => row !== null);
  }
  return [];
}

function isMarked(value: unknown) {
  const clean = normalize(value);
  return clean === 'x' || clean === 'evet' || clean === '1';
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

    let headerIndex = -1;
    let score = 0;
    let fieldMap: Partial<Record<SATField, number>> = {};

    matrix.slice(0, 40).forEach((row, index) => {
      const candidateMap = buildFieldMap(row);
      const candidateScore = Object.keys(candidateMap).length;
      if (candidateScore > score) {
        headerIndex = index;
        score = candidateScore;
        fieldMap = candidateMap;
      }
    });

    if (headerIndex < 0) continue;
    const headers = matrix[headerIndex].map(
      (cell, index) => toDisplayString(cell) || `Sütun ${index + 1}`,
    );
    const rows = matrix.slice(headerIndex + 1);
    const candidate = { name, headers, rows, headerIndex, fieldMap, score };

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

function buildFieldMap(row: unknown[]) {
  const normalizedHeaders = row.map(normalizeHeader);
  return (Object.keys(FIELD_ALIASES) as SATField[]).reduce<
    Partial<Record<SATField, number>>
  >((map, field) => {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);
    const index = normalizedHeaders.findIndex((header) =>
      aliases.some(
        (alias) =>
          header === alias ||
          (header.length >= 6 &&
            alias.length >= 6 &&
            (header.includes(alias) || alias.includes(header))),
      ),
    );
    if (index >= 0) map[field] = index;
    return map;
  }, {});
}

function parseRow(
  cells: unknown[],
  headers: string[],
  fieldMap: Partial<Record<SATField, number>>,
  sourceRow: number,
): SATRow | null {
  const cell = (field: SATField) => {
    const index = fieldMap[field];
    return index === undefined ? '' : cells[index];
  };
  const text = (field: SATField) => compact(cell(field));
  const satNo = text('satNo');
  const aciklama = text('aciklama');

  // Excel tablosu biçimlendirilmiş yüzlerce boş satır içerebilir.
  if (!satNo && !aciklama) return null;

  const raw = headers.reduce<Record<string, string>>((record, header, index) => {
    const value = toDisplayString(cells[index]);
    if (value) record[header] = value;
    return record;
  }, {});
  const onayDurumu = text('onayDurumu');
  const satDurumu = text('satDurumu');

  return {
    rowId: `sat-${sourceRow}`,
    sourceRow,
    sıraNo: text('sıraNo'),
    butceSorumlusu: text('butceSorumlusu'),
    talepSahibi: text('talepSahibi'),
    unite: text('unite'),
    satNo,
    satTarihi: parseDate(cell('satTarihi')),
    aciklama,
    toplamTutar: parseAmount(cell('toplamTutar')),
    paraBirimi: text('paraBirimi').toLocaleUpperCase('tr-TR'),
    butceTuru: text('butceTuru'),
    pypKodu: text('pypKodu'),
    butceAciklama: text('butceAciklama'),
    onayDurumu,
    satDurumu,
    satinAlmaSorumlusu: text('satinAlmaSorumlusu'),
    malzemeGelisTarihi: text('malzemeGelisTarihi'),
    notlar: text('notlar'),
    stage: resolveSATStage(onayDurumu, satDurumu),
    raw,
  };
}

export function resolveSATStage(
  approvalStatus: string,
  procurementStatus: string,
): SATStage {
  const approval = normalize(approvalStatus);
  const procurement = normalize(procurementStatus);

  if (!approval) return 'durum_girilmemis';
  if (approval.includes('mail') && approval.includes('bekliyor')) {
    return 'mail_onayi';
  }
  if (approval.includes('sap')) return 'sap_onayi';
  if (!procurement && approval.includes('tamamlandi')) {
    return 'satina_aktarilacak';
  }
  if (procurement.includes('teklif bekleniyor')) return 'teklif_bekleniyor';
  if (procurement.includes('teklif degerlendiriliyor')) {
    return 'teklif_degerlendiriliyor';
  }
  if (procurement.includes('teklif degerlendirildi')) {
    return 'teklif_degerlendirildi';
  }
  if (procurement.includes('sas')) return 'sas_verildi';
  if (procurement.includes('tamamlandi')) return 'tamamlandi';
  return 'diger';
}

function parseAmount(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const clean = toDisplayString(value)
    .replace(/[$€₺\s]/g, '')
    .replace(/,/g, '');
  const amount = Number(clean);
  return Number.isFinite(amount) ? amount : 0;
}

function compact(value: unknown) {
  return toDisplayString(value).replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value: unknown) {
  return normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
}
