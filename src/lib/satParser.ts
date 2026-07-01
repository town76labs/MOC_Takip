import * as XLSX from 'xlsx';
import type {
  ParseError,
  SATExportRow,
  SATFileFormat,
  SATRow,
  SATStage,
} from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';
import { parseSATTrackingListExport } from './satTrackingListParser';

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
    const trackingListData = parseSATTrackingListExport(workbook);
    if (trackingListData.length > 0) {
      return { data: [], exportData: trackingListData, format: 'sap_export' };
    }
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

const SAP_EXPORT_COLUMNS = {
  satCreator: 0, // A
  companyCodeOrSatNo: 1, // B
  satNoFallback: 2, // C - mevcut exportta zorunlu teknik belge kimliği
  satItemNo: 3, // D
  totalSatUsd: 4, // E
  createdAt: 5, // F
  sasNo: 6, // G
  sasItemNo: 7, // H
  satQuantity: 8, // I
  satItemUsd: 11, // L
  completed: 16, // Q
  lastDelivery: 17, // R
  lastInvoice: 18, // S
  sasUsdAmount: 21, // V
  deliveryDate: 23, // X
  sasUnitPrice: 40, // AO
  approvalCode: 42, // AQ
  materialGroup: 86, // CI
  waybill: 88, // CK
  summaryStatus: 105, // DB
  materialDescription: 116, // DM
  material: 121, // DR
  sasCreator: 128, // DY
  vendorName: 129, // DZ
  approvalStatusDescription: 131, // EB
} as const;

const SAP_EXPORT_HEADER_SIGNATURES = [
  [SAP_EXPORT_COLUMNS.satCreator, 'SAT Yaratan'],
  [SAP_EXPORT_COLUMNS.satItemNo, 'SAT Kalem Numarası'],
  [SAP_EXPORT_COLUMNS.totalSatUsd, 'Toplam SAT USD Tutarı'],
  [SAP_EXPORT_COLUMNS.createdAt, 'SAT Yaratılma Tarihi'],
  [SAP_EXPORT_COLUMNS.sasNo, 'SAS Belge No'],
  [SAP_EXPORT_COLUMNS.sasItemNo, 'SAS Kalem Numarası'],
  [SAP_EXPORT_COLUMNS.satQuantity, 'SAT Miktarı'],
  [SAP_EXPORT_COLUMNS.satItemUsd, 'SAT USD tutar'],
  [SAP_EXPORT_COLUMNS.completed, 'Tamam'],
  [SAP_EXPORT_COLUMNS.sasUsdAmount, 'SAS USD Tutar'],
  [SAP_EXPORT_COLUMNS.materialGroup, 'SAT Mal Grubu Tanımı'],
  [SAP_EXPORT_COLUMNS.summaryStatus, 'Satınalma Özet Durum Bilgisi'],
  [SAP_EXPORT_COLUMNS.materialDescription, 'Malzeme Tanımı'],
  [SAP_EXPORT_COLUMNS.material, 'Malzeme'],
  [SAP_EXPORT_COLUMNS.approvalStatusDescription, 'SAT Onay Durum Tanımı'],
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
    const headerIndex = matrix.slice(0, 20).findIndex(
      (row) =>
        SAP_EXPORT_HEADER_SIGNATURES.filter(
          ([column, header]) =>
            normalizeHeader(row[column]) === normalizeHeader(header),
        ).length >= 7,
    );
    if (headerIndex < 0) continue;

    const headerRow = matrix[headerIndex];
    const bContainsSatNo =
      normalizeHeader(headerRow[SAP_EXPORT_COLUMNS.companyCodeOrSatNo]) ===
      normalizeHeader('SAT Belge Numarası');
    const value = (cells: unknown[], column: number) => cells[column];
    return matrix
      .slice(headerIndex + 1)
      .map((cells, index): SATExportRow | null => {
        const satNo = compact(
          value(
            cells,
            bContainsSatNo
              ? SAP_EXPORT_COLUMNS.companyCodeOrSatNo
              : SAP_EXPORT_COLUMNS.satNoFallback,
          ),
        );
        if (!satNo) return null;
        return {
          rowId: `sat-export-${index + headerIndex + 2}`,
          sourceRow: index + headerIndex + 2,
          satCreator: compact(value(cells, SAP_EXPORT_COLUMNS.satCreator)),
          companyCode: bContainsSatNo
            ? ''
            : compact(value(cells, SAP_EXPORT_COLUMNS.companyCodeOrSatNo)),
          satNo,
          satItemNo: compact(value(cells, SAP_EXPORT_COLUMNS.satItemNo)),
          sasNo: compact(value(cells, SAP_EXPORT_COLUMNS.sasNo)),
          sasItemNo: compact(value(cells, SAP_EXPORT_COLUMNS.sasItemNo)),
          satQuantity: parseAmount(value(cells, SAP_EXPORT_COLUMNS.satQuantity)),
          satItemUsd: parseAmount(value(cells, SAP_EXPORT_COLUMNS.satItemUsd)),
          sourceTotalSatUsd: parseAmount(
            value(cells, SAP_EXPORT_COLUMNS.totalSatUsd),
          ),
          createdAt: parseDate(value(cells, SAP_EXPORT_COLUMNS.createdAt)),
          completed: isMarked(value(cells, SAP_EXPORT_COLUMNS.completed)),
          lastDelivery: isMarked(value(cells, SAP_EXPORT_COLUMNS.lastDelivery)),
          lastInvoice: isMarked(value(cells, SAP_EXPORT_COLUMNS.lastInvoice)),
          sasUsdAmount: parseAmount(value(cells, SAP_EXPORT_COLUMNS.sasUsdAmount)),
          deliveryDate: parseDate(value(cells, SAP_EXPORT_COLUMNS.deliveryDate)),
          sasUnitPrice: parseAmount(value(cells, SAP_EXPORT_COLUMNS.sasUnitPrice)),
          approvalCode: compact(value(cells, SAP_EXPORT_COLUMNS.approvalCode)),
          waybill: compact(value(cells, SAP_EXPORT_COLUMNS.waybill)),
          summaryStatus: compact(value(cells, SAP_EXPORT_COLUMNS.summaryStatus)),
          materialDescription: compact(
            value(cells, SAP_EXPORT_COLUMNS.materialDescription),
          ),
          material: compact(value(cells, SAP_EXPORT_COLUMNS.material)),
          sasCreator: compact(value(cells, SAP_EXPORT_COLUMNS.sasCreator)),
          vendorName: compact(value(cells, SAP_EXPORT_COLUMNS.vendorName)),
          materialGroup: compact(value(cells, SAP_EXPORT_COLUMNS.materialGroup)),
          approvalStatusDescription: compact(
            value(cells, SAP_EXPORT_COLUMNS.approvalStatusDescription),
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
