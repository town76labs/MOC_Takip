import * as XLSX from 'xlsx';
import type {
  ParseError,
  SATBudgetUsageRow,
  SATBudgetUsageStage,
  SATExportRow,
} from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';
import {
  getSATBudgetSource,
  isSTADOpexBudgetSource,
} from './satBudgetParser';

const COLUMNS = {
  referenceNo: 0, // A
  previousDocumentNo: 1, // B
  referenceItemNo: 2, // C
  valueType: 3, // D
  documentDate: 5, // F
  description: 7, // H
  amountUsd: 8, // I
  sourceCode: 10, // K
  vendor: 14, // O
  transactionAmount: 15, // P
  transactionCurrency: 16, // Q
  user: 17, // R
} as const;

export async function parseSATBudgetUsageExcel(
  file: File,
  exportRows: SATExportRow[],
): Promise<{ data: SATBudgetUsageRow[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return {
        data: [],
        error: { message: 'SAT bütçe kullanım detayı dosyası boş görünüyor.' },
      };
    }
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: true,
    });
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
          normalize(row[COLUMNS.referenceNo]) === 'referans belge numarasi' &&
          normalize(row[COLUMNS.valueType]) === 'deger tipi mtn.' &&
          normalize(row[COLUMNS.sourceCode]) === 'mali merkez',
      );
      if (headerIndex < 0) continue;

      const satBySas = buildSATBySASMap(exportRows);
      const data = matrix
        .slice(headerIndex + 1)
        .map((cells, index): SATBudgetUsageRow | null => {
          const stage = parseStage(cells[COLUMNS.valueType]);
          const sourceCode = toDisplayString(cells[COLUMNS.sourceCode]);
          const source = getSATBudgetSource(sourceCode);
          const user = toDisplayString(cells[COLUMNS.user]);
          const referenceNo = toDisplayString(cells[COLUMNS.referenceNo]);
          const previousDocumentNo = toDisplayString(
            cells[COLUMNS.previousDocumentNo],
          );
          if (
            !stage ||
            !source ||
            !referenceNo ||
            (isSTADOpexBudgetSource(sourceCode) && normalize(user) !== 'tpinar')
          ) {
            return null;
          }

          const satNo =
            stage === 'SAT'
              ? referenceNo
              : stage === 'SAS'
                ? previousDocumentNo
                : satBySas.get(previousDocumentNo) ?? '';
          return {
            rowId: `sat-budget-usage-${index + headerIndex + 2}`,
            sourceRow: index + headerIndex + 2,
            company: source.company,
            budgetType: source.budgetType,
            sourceCode,
            sourceLabel: source.label,
            stage,
            amountUsd: parseSignedAmount(cells[COLUMNS.amountUsd]),
            referenceNo,
            previousDocumentNo,
            referenceItemNo: toDisplayString(cells[COLUMNS.referenceItemNo]),
            satNo,
            sasNo: stage === 'SAS' ? referenceNo : stage === 'FAT' ? previousDocumentNo : '',
            invoiceNo: stage === 'FAT' ? referenceNo : '',
            documentDate: parseDate(cells[COLUMNS.documentDate]),
            description: toDisplayString(cells[COLUMNS.description]),
            vendor: toDisplayString(cells[COLUMNS.vendor]),
            transactionAmount: parseSignedAmount(
              cells[COLUMNS.transactionAmount],
            ),
            transactionCurrency:
              toDisplayString(cells[COLUMNS.transactionCurrency]) || 'USD',
            user,
          };
        })
        .filter((row): row is SATBudgetUsageRow => row !== null);

      if (data.length > 0) return { data };
    }
    return {
      data: [],
      error: {
        message: 'Tanımlı bütçe kaynaklarına ait SAT/SAS/FAT kaydı bulunamadı.',
        details: [
          'Beklenen alanlar: A referans belge, B önceki belge, D değer tipi, I USD tutarı, K mali merkez.',
        ],
      },
    };
  } catch {
    return {
      data: [],
      error: { message: 'SAT bütçe kullanım detayı Excel dosyası okunamadı.' },
    };
  }
}

export function linkSATBudgetUsageToExport(
  rows: SATBudgetUsageRow[],
  exportRows: SATExportRow[],
) {
  const satBySas = buildSATBySASMap(exportRows);
  return rows.map((row) =>
    row.stage === 'FAT'
      ? { ...row, satNo: satBySas.get(row.sasNo) ?? '' }
      : row,
  );
}

function buildSATBySASMap(rows: SATExportRow[]) {
  const map = new Map<string, string>();
  rows.forEach((row) => {
    if (row.sasNo && row.satNo && !map.has(row.sasNo)) {
      map.set(row.sasNo, row.satNo);
    }
  });
  return map;
}

function parseStage(value: unknown): SATBudgetUsageStage | null {
  const clean = normalize(value);
  if (clean === 'satinalma talepleri') return 'SAT';
  if (clean === 'satinalma siparisleri') return 'SAS';
  if (clean === 'faturalar' || clean === 'fatura') return 'FAT';
  return null;
}

function parseSignedAmount(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = toDisplayString(value).replace(/\s/g, '');
  if (!text) return 0;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/,/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}
