import type {
  SATBudgetCompany,
  SATBudgetRow,
  SATBudgetType,
} from '../types';

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

export function companyLabel(company: SATBudgetCompany) {
  return company === 'PETKIM' ? 'Petkim' : company === 'STAR' ? 'Star' : 'STAD';
}

export function budgetTypeLabel(type: SATBudgetType) {
  return SAT_BUDGET_TYPE_CONFIG.find((item) => item.key === type)?.label ?? type;
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
      types: budgetTypeSummary(companyRows),
    };
  });
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
