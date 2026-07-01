import * as XLSX from 'xlsx';
import type { SATExportRow } from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';
import { getSATBudgetSource } from './satBudgetParser';

const COLUMNS = {
  companyCode: 0, // A
  satNo: 1, // B
  createdAt: 2, // C
  sourceTotalSatUsd: 3, // D
  sasNo: 4, // E
  sasTotalUsd: 5, // F
  sasItemNo: 6, // G
  sasCreatedAt: 7, // H
  materialDescription: 8, // I
  satItemNo: 10, // K
  poText: 11, // L
  material: 13, // N
  satQuantity: 14, // O
  sasQuantity: 15, // P
  goodsReceiptQuantity: 16, // Q
  satApprovalDate: 18, // S
  sasApprovalDate: 20, // U
  invoiceCurrency: 21, // V
  sasUnitPrice: 24, // Y
  sasUnitQuantity: 25, // Z
  sasCreator: 28, // AC
  deliveryDate: 31, // AF
  vendorName: 32, // AG
  satItemUsd: 34, // AI
  approvalStatusDescription: 35, // AJ
  sourceCode: 38, // AM
  pypCode: 39, // AN
  pypDescription: 40, // AO
  materialGroup: 41, // AP
  summaryStatusDescription: 42, // AQ
  summaryStatus: 43, // AR
  satCreator: 44, // AS
} as const;

const HEADER_SIGNATURES = [
  [COLUMNS.companyCode, 'Şirket kodu'],
  [COLUMNS.satNo, 'SAT Belge Numarası'],
  [COLUMNS.createdAt, 'SAT Yaratılma Tarihi'],
  [COLUMNS.sourceTotalSatUsd, 'Toplam SAT USD Tutarı'],
  [COLUMNS.sasNo, 'SAS Belge No'],
  [COLUMNS.sasTotalUsd, 'SAS Toplam USD Tutar'],
  [COLUMNS.satItemNo, 'SAT Kalem Numarası'],
  [COLUMNS.satItemUsd, 'SAT USD tutar'],
  [COLUMNS.sourceCode, 'Mali merkez'],
  [COLUMNS.summaryStatus, 'Satınalma Özet Durum Bilgisi'],
  [COLUMNS.satCreator, 'SAT Yaratan'],
] as const;

interface TrackingSheet {
  matrix: unknown[][];
  headerIndex: number;
}

export function parseSATTrackingListExport(
  workbook: XLSX.WorkBook,
): SATExportRow[] {
  const sheet = findTrackingSheet(workbook);
  if (!sheet) return [];

  const rows = sheet.matrix.slice(sheet.headerIndex + 1);
  const sasRowCounts = buildSasRowCounts(rows);

  return rows
    .map((cells, index): SATExportRow | null => {
      const satNo = compact(cells[COLUMNS.satNo]);
      if (!satNo) return null;

      const sasNo = compact(cells[COLUMNS.sasNo]);
      const goodsReceiptQuantity = parseAmount(
        cells[COLUMNS.goodsReceiptQuantity],
      );
      const invoiceCurrency = compact(cells[COLUMNS.invoiceCurrency]);
      const description = compact(cells[COLUMNS.materialDescription]);
      const poText = compact(cells[COLUMNS.poText]);
      const summaryStatus = compact(cells[COLUMNS.summaryStatus]);
      const sourceCode = compact(cells[COLUMNS.sourceCode]);
      const budgetSource = getSATBudgetSource(sourceCode);

      return {
        rowId: `sat-tracking-list-${index + sheet.headerIndex + 2}`,
        sourceRow: index + sheet.headerIndex + 2,
        satCreator: compact(cells[COLUMNS.satCreator]),
        companyCode: compact(cells[COLUMNS.companyCode]),
        satNo,
        satItemNo: compact(cells[COLUMNS.satItemNo]),
        sasNo,
        sasItemNo: compact(cells[COLUMNS.sasItemNo]),
        satQuantity: parseAmount(cells[COLUMNS.satQuantity]),
        satItemUsd: parseAmount(cells[COLUMNS.satItemUsd]),
        sourceTotalSatUsd: parseAmount(cells[COLUMNS.sourceTotalSatUsd]),
        createdAt: parseDate(cells[COLUMNS.createdAt]),
        completed: Boolean(sasNo),
        lastDelivery: goodsReceiptQuantity > 0,
        lastInvoice: Boolean(invoiceCurrency),
        sasUsdAmount: allocatedSasUsd(cells, sasRowCounts),
        deliveryDate: parseDate(cells[COLUMNS.deliveryDate]),
        sasUnitPrice: parseAmount(cells[COLUMNS.sasUnitPrice]),
        approvalCode: compact(cells[COLUMNS.approvalStatusDescription]),
        waybill: '',
        summaryStatus,
        materialDescription: description || poText,
        material: compact(cells[COLUMNS.material]),
        sasCreator: compact(cells[COLUMNS.sasCreator]),
        vendorName: compact(cells[COLUMNS.vendorName]),
        materialGroup:
          compact(cells[COLUMNS.materialGroup]) ||
          compact(cells[COLUMNS.pypDescription]),
        approvalStatusDescription: compact(
          cells[COLUMNS.approvalStatusDescription],
        ),
        budgetCompany: budgetSource?.company,
        budgetType: budgetSource?.budgetType,
        budgetSourceCode: budgetSource?.code ?? sourceCode,
        budgetSourceLabel: budgetSource?.label ?? '',
      };
    })
    .filter((row): row is SATExportRow => row !== null);
}

function findTrackingSheet(workbook: XLSX.WorkBook): TrackingSheet | null {
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
        HEADER_SIGNATURES.filter(
          ([column, header]) =>
            normalizeHeader(row[column]) === normalizeHeader(header),
        ).length >= 8,
    );
    if (headerIndex >= 0) return { matrix, headerIndex };
  }
  return null;
}

function buildSasRowCounts(rows: unknown[][]) {
  const counts = new Map<string, number>();
  rows.forEach((cells) => {
    const sasNo = compact(cells[COLUMNS.sasNo]);
    if (!sasNo) return;
    counts.set(sasNo, (counts.get(sasNo) ?? 0) + 1);
  });
  return counts;
}

function allocatedSasUsd(cells: unknown[], sasRowCounts: Map<string, number>) {
  const sasNo = compact(cells[COLUMNS.sasNo]);
  if (!sasNo) return 0;
  const total = parseAmount(cells[COLUMNS.sasTotalUsd]);
  const count = Math.max(1, sasRowCounts.get(sasNo) ?? 1);
  return total / count;
}

function parseAmount(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = toDisplayString(value).replace(/[$€₺\s]/g, '');
  if (!text) return 0;
  const commaIndex = text.lastIndexOf(',');
  const dotIndex = text.lastIndexOf('.');
  const normalized =
    commaIndex >= 0 && dotIndex >= 0
      ? commaIndex > dotIndex
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '')
      : commaIndex >= 0
        ? text.length - commaIndex - 1 <= 2
          ? text.replace(/\./g, '').replace(',', '.')
          : text.replace(/,/g, '')
        : text.replace(/,/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function compact(value: unknown) {
  return toDisplayString(value).replace(/\s+/g, ' ').trim();
}

function normalizeHeader(value: unknown) {
  return normalize(value).replace(/[^a-z0-9]+/g, ' ').trim();
}
