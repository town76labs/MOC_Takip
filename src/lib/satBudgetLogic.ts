import type {
  SATBudgetCompany,
  SATBudgetRow,
  SATBudgetType,
  SATBudgetUsageRow,
  SATBudgetUsageStage,
} from '../types';
import {
  SAT_BUDGET_SOURCES,
} from './satBudgetParser';

const MASKED_BUDGET_SOURCE_CODES = new Set<string>();

export const SAT_BUDGET_COMPANIES: SATBudgetCompany[] = [
  'PETKIM',
  'STAR',
  'STAD',
];

export const SAT_BUDGET_TYPE_CONFIG: {
  key: SATBudgetType;
  label: string;
  color: string;
}[] = [
  { key: 'CAPEX', label: 'CAPEX', color: '#38bdf8' },
  { key: 'OPEX', label: 'OPEX', color: '#f59e0b' },
  {
    key: 'OPERATIONAL_CAPEX',
    label: 'Operational CAPEX',
    color: '#8b5cf6',
  },
];

export const SAT_BUDGET_USAGE_STAGE_CONFIG: {
  key: SATBudgetUsageStage | 'UNUSED';
  label: string;
  color: string;
}[] = [
  { key: 'SAT', label: 'SAT', color: '#38bdf8' },
  { key: 'SAS', label: 'SAS', color: '#8b5cf6' },
  { key: 'FAT', label: 'FAT', color: '#10b981' },
  { key: 'UNUSED', label: 'Kullanılmayan', color: '#64748b' },
];

export function companyLabel(company: SATBudgetCompany) {
  return company === 'PETKIM' ? 'Petkim' : company === 'STAR' ? 'Star' : 'STAD';
}

export function budgetTypeLabel(type: SATBudgetType) {
  return SAT_BUDGET_TYPE_CONFIG.find((item) => item.key === type)?.label ?? type;
}

export function budgetSourceCode(
  company: SATBudgetCompany,
  type: SATBudgetType,
) {
  return (
    SAT_BUDGET_SOURCES.find(
      (source) => source.company === company && source.budgetType === type,
    )?.code ?? '—'
  );
}

export function isMaskedBudgetRow(row: SATBudgetRow) {
  return MASKED_BUDGET_SOURCE_CODES.has(row.sourceCode);
}

export function budgetTotals(rows: SATBudgetRow[]) {
  const inflow = sum(rows.filter((row) => row.amount > 0).map((row) => row.amount));
  const signedOutflow = sum(
    rows.filter((row) => row.amount < 0).map((row) => row.amount),
  );
  return {
    inflow,
    outflow: Math.abs(signedOutflow),
    net: inflow + signedOutflow,
    count: rows.length,
  };
}

export function budgetTypeSummary(rows: SATBudgetRow[]) {
  return SAT_BUDGET_TYPE_CONFIG.map((config) => {
    const typeRows = rows.filter((row) => row.budgetType === config.key);
    return { ...config, ...budgetTotals(typeRows) };
  });
}

export function budgetCompanySummary(rows: SATBudgetRow[]) {
  return SAT_BUDGET_COMPANIES.map((company) => {
    const companyRows = rows.filter((row) => row.company === company);
    return {
      company,
      label: companyLabel(company),
      rows: companyRows,
      totals: budgetTotals(companyRows),
      types: budgetTypeSummary(companyRows).map((type) => ({
        ...type,
        sourceCode: budgetSourceCode(company, type.key),
        masked: false,
      })),
    };
  });
}

export function budgetUsageSummary(
  budgetRows: SATBudgetRow[],
  usageRows: SATBudgetUsageRow[],
  company: SATBudgetCompany,
) {
  return SAT_BUDGET_TYPE_CONFIG.map((type) => {
    const totalBudget = Math.max(
      0,
      budgetTotals(
        budgetRows.filter(
          (row) => row.company === company && row.budgetType === type.key,
        ),
      ).net,
    );
    const typeUsageRows = usageRows.filter(
      (row) => row.company === company && row.budgetType === type.key,
    );
    const stageAmount = (stage: SATBudgetUsageStage) =>
      Math.max(
        0,
        sum(
          typeUsageRows
            .filter((row) => row.stage === stage)
            .map((row) => row.amountUsd),
        ),
      );
    const sat = stageAmount('SAT');
    const sas = stageAmount('SAS');
    const fat = stageAmount('FAT');
    const used = sat + sas + fat;
    const unused = Math.max(0, totalBudget - used);
    return {
      ...type,
      sourceCode: budgetSourceCode(company, type.key),
      masked: false,
      totalBudget,
      used,
      unused,
      overrun: Math.max(0, used - totalBudget),
      rowCount: typeUsageRows.length,
      segments: SAT_BUDGET_USAGE_STAGE_CONFIG.map((segment) => ({
        ...segment,
        value:
          segment.key === 'SAT'
            ? sat
            : segment.key === 'SAS'
              ? sas
              : segment.key === 'FAT'
                ? fat
                : unused,
      })),
    };
  });
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
