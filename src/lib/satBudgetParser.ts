import * as XLSX from 'xlsx';
import type {
  ParseError,
  SATBudgetCompany,
  SATBudgetRow,
  SATBudgetType,
} from '../types';
import { normalize, parseDate, toDisplayString } from './normalize';

export interface SATBudgetSourceDefinition {
  code: string;
  label: string;
  company: SATBudgetCompany;
  budgetType: SATBudgetType;
}

export const SAT_BUDGET_SOURCES: SATBudgetSourceDefinition[] = [
  {
    code: 'SR01.C21.110.007',
    label: 'CAPEX / 2025 Yılı Star Vana Alım',
    company: 'STAR',
    budgetType: 'CAPEX',
  },
  {
    code: '1000.C24.110.054',
    label: 'CAPEX / 2025 Yılı Petkim Vana Alım',
    company: 'PETKIM',
    budgetType: 'CAPEX',
  },
  {
    code: '3124',
    label: 'OPEX / Star Hizmet',
    company: 'STAR',
    budgetType: 'OPEX',
  },
  {
    code: '75033124',
    label: 'OPEX / Petkim Hizmet',
    company: 'PETKIM',
    budgetType: 'OPEX',
  },
  {
    code: 'SR01.STOK.ENSTR',
    label: 'Operational CAPEX / Star Malzeme',
    company: 'STAR',
    budgetType: 'OPERATIONAL_CAPEX',
  },
  {
    code: '1000.STOK.ENSTR',
    label: 'Operational CAPEX / Petkim Malzeme',
    company: 'PETKIM',
    budgetType: 'OPERATIONAL_CAPEX',
  },
  {
    code: 'SM01.STOK.ENSTR',
    label: 'Operational CAPEX / STAD Malzeme',
    company: 'STAD',
    budgetType: 'OPERATIONAL_CAPEX',
  },
  {
    code: '55044108',
    label: 'OPEX / STAD Hizmet',
    company: 'STAD',
    budgetType: 'OPEX',
  },
];

export const STAD_OPEX_BUDGET_SOURCE_CODE = '55044108';
export const STAD_OPEX_BUDGET_AMOUNT_USD = 331_908;

const SOURCE_BY_CODE = new Map(
  SAT_BUDGET_SOURCES.map((source) => [normalizeCode(source.code), source]),
);

export function getSATBudgetSource(value: unknown) {
  return SOURCE_BY_CODE.get(normalizeCode(value));
}

export function isSTADOpexBudgetSource(value: unknown) {
  return normalizeCode(value) === STAD_OPEX_BUDGET_SOURCE_CODE;
}

export async function parseSATBudgetExcel(
  file: File,
): Promise<{ data: SATBudgetRow[]; error?: ParseError }> {
  try {
    if (file.size === 0) {
      return { data: [], error: { message: 'SAT bütçe dosyası boş görünüyor.' } };
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
          normalize(row[7]) === 'mali merkez' &&
          normalize(row[11]).includes('islem toplami'),
      );
      if (headerIndex < 0) continue;

      const data = matrix
        .slice(headerIndex + 1)
        .map((cells, index): SATBudgetRow | null => {
          const sourceCode = toDisplayString(cells[7]);
          const source = getSATBudgetSource(sourceCode);
          if (!source) return null;
          return {
            rowId: `sat-budget-${index + headerIndex + 2}`,
            sourceRow: index + headerIndex + 2,
            company: source.company,
            budgetType: source.budgetType,
            sourceCode,
            sourceLabel: source.label,
            amount: parseSignedAmount(cells[11]),
            currency: toDisplayString(cells[12]) || 'USD',
            documentNo: toDisplayString(cells[1]),
            transactionType: toDisplayString(cells[4]),
            documentDate: parseDate(cells[13]),
            user: toDisplayString(cells[14]),
            description: toDisplayString(cells[15]),
          };
        })
        .filter((row): row is SATBudgetRow => row !== null);
      if (data.length > 0) return { data: normalizeSTADOpexBudget(data) };
    }
    return {
      data: [],
      error: {
        message: 'Tanımlı SAT bütçe kodlarını içeren kayıt bulunamadı.',
        details: ['Beklenen alanlar: H sütunu Mali merkez, L sütunu işlem toplamı'],
      },
    };
  } catch {
    return {
      data: [],
      error: {
        message: 'SAT bütçe Excel dosyası okunamadı.',
      },
    };
  }
}

function normalizeSTADOpexBudget(rows: SATBudgetRow[]) {
  const stadRows = rows.filter((row) => isSTADOpexBudgetSource(row.sourceCode));
  if (stadRows.length === 0) return rows;
  const first = stadRows[0];
  return [
    ...rows.filter((row) => !isSTADOpexBudgetSource(row.sourceCode)),
    {
      ...first,
      rowId: 'sat-budget-stad-opex-fixed',
      amount: STAD_OPEX_BUDGET_AMOUNT_USD,
      documentNo: STAD_OPEX_BUDGET_SOURCE_CODE,
      transactionType: 'Tanımlı Bütçe',
      user: '',
      description: 'STAD OPEX Hizmet bütçesi',
    },
  ];
}

function normalizeCode(value: unknown) {
  return toDisplayString(value).replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
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
