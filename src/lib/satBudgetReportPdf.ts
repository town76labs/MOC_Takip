import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from 'pdfmake/interfaces';
import type {
  SATBudgetCompany,
  SATBudgetRow,
  SATBudgetUsageRow,
} from '../types';
import {
  budgetCompanySummary,
  budgetTotals,
  budgetTypeLabel,
  budgetUsageSummary,
  companyLabel,
  isMaskedBudgetRow,
  SAT_BUDGET_COMPANIES,
} from './satBudgetLogic';
import { SAT_BUDGET_SOURCES } from './satBudgetParser';

interface SATBudgetReportOptions {
  budgetRows: SATBudgetRow[];
  usageRows: SATBudgetUsageRow[];
  company: SATBudgetCompany | null;
  scopeLabel: string;
}

const COLORS = {
  navy: '#0f172a',
  slate: '#475569',
  line: '#cbd5e1',
  soft: '#f1f5f9',
  cyan: '#0891b2',
  orange: '#d97706',
  purple: '#7c3aed',
  green: '#16a34a',
  red: '#dc2626',
  blue: '#2563eb',
  gray: '#64748b',
};

const REPORT_TITLE = 'Bütçe Yönetici Özeti';

const styles: StyleDictionary = {
  title: { fontSize: 21, bold: true, color: COLORS.navy },
  subtitle: { fontSize: 9, color: COLORS.slate, margin: [0, 4, 0, 0] },
  section: {
    fontSize: 13,
    bold: true,
    color: COLORS.navy,
    margin: [0, 15, 0, 7],
  },
  tableHeader: { bold: true, color: '#ffffff', fontSize: 7.5 },
};

export async function downloadSATBudgetReportPdf({
  budgetRows,
  usageRows,
  company,
  scopeLabel,
}: SATBudgetReportOptions) {
  const [pdfMakeModule, fontVfsModule] = await Promise.all([
    import('pdfmake/build/pdfmake.js'),
    import('pdfmake/build/vfs_fonts.js'),
  ]);
  const pdfMake =
    (pdfMakeModule as unknown as { default?: typeof pdfMakeModule }).default ??
    pdfMakeModule;
  const fontVfs =
    (fontVfsModule as unknown as { default?: typeof fontVfsModule }).default ??
    fontVfsModule;
  pdfMake.addVirtualFileSystem(fontVfs as unknown as TVirtualFileSystem);
  await pdfMake
    .createPdf(
      buildSATBudgetReportDefinition(
        budgetRows,
        usageRows,
        company,
        scopeLabel,
      ),
    )
    .download(`${slugify(`${REPORT_TITLE}-${scopeLabel}`)}.pdf`);
}

export function buildSATBudgetReportDefinition(
  budgetRows: SATBudgetRow[],
  usageRows: SATBudgetUsageRow[],
  selectedCompany: SATBudgetCompany | null,
  scopeLabel: string,
): TDocumentDefinitions {
  const totals = budgetTotals(budgetRows);
  const reportCompanies = selectedCompany
    ? [selectedCompany]
    : SAT_BUDGET_COMPANIES;
  const companies = budgetCompanySummary(budgetRows).filter((company) =>
    reportCompanies.includes(company.company),
  );
  const reportMasked = budgetRows.some(isMaskedBudgetRow);
  const content: Content[] = [
    {
      columns: [
        {
          stack: [
            {
              text: 'Enstrüman Bakım Müdürlüğü',
              color: COLORS.cyan,
              bold: true,
              fontSize: 9,
            },
            { text: REPORT_TITLE, style: 'title' },
            { text: `Kapsam: ${scopeLabel}`, style: 'subtitle' },
          ],
        },
        {
          width: 130,
          stack: [
            { text: 'SAT TAKİP', alignment: 'right', bold: true },
            {
              text: new Date().toLocaleString('tr-TR'),
              alignment: 'right',
              fontSize: 7,
              color: '#94a3b8',
              margin: [0, 5, 0, 0],
            },
          ],
        },
      ],
    },
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 760,
          y2: 0,
          lineWidth: 1,
          lineColor: COLORS.line,
        },
      ],
      margin: [0, 12, 0, 12],
    },
    ...reportCompanies.flatMap((company, index) =>
      companyUsageDashboard(
        company,
        budgetRows,
        usageRows,
        index > 0,
      ),
    ),
    kpiGrid([
      ['Net Toplam Bütçe', reportMasked ? 'XXX USD' : formatUsd(totals.net), reportMasked ? 'Gizli bütçe dahil' : 'Giriş - çıkış'],
      ['Toplam Giriş', reportMasked ? 'XXX USD' : formatUsd(totals.inflow), reportMasked ? 'Gizli bütçe dahil' : 'Pozitif hareketler'],
      ['Toplam Çıkış', reportMasked ? 'XXX USD' : formatUsd(totals.outflow), reportMasked ? 'Gizli bütçe dahil' : 'Negatif hareketler'],
      ['Bütçe Hareketi', formatNumber(totals.count), 'Excel satırı'],
    ]),
    {
      text: 'Net Bütçe Özeti',
      style: 'section',
      pageBreak: 'before',
    },
    standardTable(
      ['Şirket', 'CAPEX', 'OPEX', 'Operational CAPEX', 'Net Toplam'],
      companies.map((company) => [
        company.label,
        formatUsd(company.types.find((item) => item.key === 'CAPEX')?.net ?? 0),
        company.types.find((item) => item.key === 'OPEX')?.masked
          ? 'XXX USD'
          : formatUsd(company.types.find((item) => item.key === 'OPEX')?.net ?? 0),
        formatUsd(
          company.types.find((item) => item.key === 'OPERATIONAL_CAPEX')?.net ?? 0,
        ),
        company.types.some((type) => type.masked)
          ? 'XXX USD'
          : formatUsd(company.totals.net),
      ]),
      [80, 115, 115, 145, 125],
    ),
    sectionTitle('Bütçe Hareket Detayı'),
    standardTable(
      ['Tarih', 'Şirket', 'Bütçe Türü', 'Bütçe Tanımı', 'İşlem', 'Tutar', 'Kullanıcı', 'Açıklama'],
      [...budgetRows]
        .sort((a, b) => dateValue(b.documentDate) - dateValue(a.documentDate))
        .map((row) => [
          formatDate(row.documentDate),
          companyLabel(row.company),
          budgetTypeLabel(row.budgetType),
          row.sourceLabel,
          row.transactionType || '—',
          isMaskedBudgetRow(row) ? 'XXX USD' : formatSignedUsd(row.amount),
          row.user || '—',
          row.description || '—',
        ]),
      [52, 45, 72, 150, 50, 72, 55, '*'],
      6.5,
    ),
  ];

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 34, 30, 34],
    info: {
      title: REPORT_TITLE,
      author: 'Enstrüman Bakım Müdürlüğü',
      subject: scopeLabel,
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#334155' },
    styles,
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Enstrüman Bakım Müdürlüğü · SAT Bütçe', alignment: 'left' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right' },
      ],
      margin: [30, 8, 30, 0],
      fontSize: 7,
      color: '#94a3b8',
    }),
  };
}

function companyUsageDashboard(
  company: SATBudgetCompany,
  budgetRows: SATBudgetRow[],
  usageRows: SATBudgetUsageRow[],
  separatedFromPrevious: boolean,
): Content[] {
  const summaries = budgetUsageSummary(budgetRows, usageRows, company);
  const companyUsageRows = usageRows.filter((row) => row.company === company);
  return [
    {
      text: companyLabel(company),
      bold: true,
      fontSize: 16,
      color: COLORS.navy,
      margin: [0, separatedFromPrevious ? 18 : 6, 0, 0],
    },
    {
      text: `${companyLabel(company)} Bütçe Kullanım Aşamaları`,
      style: 'section',
      margin: [0, 6, 0, 7],
    },
    {
      text: 'CAPEX, OPEX ve Operational CAPEX bütçelerinin SAT · SAS · FAT · Kullanılmayan dağılımı',
      style: 'subtitle',
      margin: [0, 0, 0, 10],
    },
    {
      columns: summaries.map((summary) => ({
        width: '*',
        stack: [
          {
            text: `${summary.label} - ${summary.sourceCode}`,
            bold: true,
            fontSize: 10,
            color: COLORS.navy,
          },
          {
            columns: [
              {
                text: formatUsd(summary.totalBudget),
                bold: true,
                fontSize: 13,
                color: COLORS.cyan,
                margin: [0, 4, 0, 0],
              },
              {
                text: `%${utilizationPercent(summary.used, summary.totalBudget)}`,
                alignment: 'right',
                bold: true,
                fontSize: 11,
                color: summary.overrun > 0 ? COLORS.red : COLORS.navy,
                margin: [0, 5, 0, 0],
              },
            ],
          },
          {
            text: `${formatNumber(summary.rowCount)} kullanım hareketi · Toplam bütçe / kullanım oranı`,
            fontSize: 6.8,
            color: '#94a3b8',
            margin: [0, 2, 0, 7],
          },
          usageStackedBar(summary.segments, summary.totalBudget, summary.used),
          {
            table: {
              widths: ['*', 28, 70],
              body: summary.segments.map((segment) => [
                {
                  columns: [
                    {
                      canvas: [
                        {
                          type: 'rect',
                          x: 0,
                          y: 1,
                          w: 7,
                          h: 7,
                          color: segment.color,
                        },
                      ],
                      width: 11,
                    },
                    { text: segment.label, fontSize: 7, color: COLORS.slate },
                  ],
                },
                {
                  text: `%${utilizationPercent(segment.value, summary.totalBudget)}`,
                  alignment: 'center',
                  fontSize: 6.5,
                  bold: true,
                  color: COLORS.slate,
                  fillColor: '#f1f5f9',
                  margin: [2, 1, 2, 1],
                },
                {
                  text: formatUsd(segment.value),
                  alignment: 'right',
                  fontSize: 7,
                  bold: true,
                  color: COLORS.navy,
                },
              ]),
            },
            layout: 'noBorders',
            margin: [0, 7, 0, 0],
          },
          ...(summary.overrun > 0
            ? [
                {
                  text: `Bütçe aşımı: ${formatUsd(summary.overrun)}`,
                  fontSize: 7,
                  bold: true,
                  color: COLORS.red,
                  margin: [0, 5, 0, 0],
                } as Content,
              ]
            : []),
        ],
        margin: [8, 8, 8, 8],
      })),
      columnGap: 10,
    },
    sectionTitle(`${companyLabel(company)} Bütçe Kullanım Tablosu`),
    standardTable(
      ['Bütçe Türü / Kod', 'Toplam Bütçe', 'SAT', 'SAS', 'FAT', 'Kullanılmayan', 'Kullanım'],
      summaries.map((summary) => [
        budgetTypeCodeAndDescription(summary.label, summary.sourceCode),
        formatUsd(summary.totalBudget),
        formatUsd(summary.segments.find((segment) => segment.key === 'SAT')?.value ?? 0),
        formatUsd(summary.segments.find((segment) => segment.key === 'SAS')?.value ?? 0),
        formatUsd(summary.segments.find((segment) => segment.key === 'FAT')?.value ?? 0),
        formatUsd(summary.unused),
        `%${utilizationPercent(summary.used, summary.totalBudget)}`,
      ]),
      [155, 90, 80, 80, 80, 95, 50],
      6.8,
    ),
    {
      text: `${formatNumber(companyUsageRows.length)} SAT/SAS/FAT bütçe kullanım hareketi bu kapsamda değerlendirilmiştir.`,
      fontSize: 7,
      color: '#64748b',
      margin: [0, 7, 0, 0],
    },
  ];
}

function usageStackedBar(
  segments: { value: number; color: string }[],
  totalBudget: number,
  used: number,
): Content {
  const width = 210;
  const scaleTotal = Math.max(totalBudget, used, 1);
  let x = 0;
  const bars = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const segmentWidth = Math.max(1, (segment.value / scaleTotal) * width);
      const rect = {
        type: 'rect' as const,
        x,
        y: 0,
        w: Math.min(segmentWidth, width - x),
        h: 12,
        color: segment.color,
      };
      x = Math.min(width, x + segmentWidth);
      return rect;
    });
  return {
    canvas: [
      { type: 'rect', x: 0, y: 0, w: width, h: 12, color: '#e2e8f0' },
      ...bars,
    ],
  };
}

function utilizationPercent(used: number, total: number) {
  return total ? Math.round((used / total) * 100) : 0;
}

function budgetTypeCodeAndDescription(typeLabel: string, sourceCode: string) {
  const source = SAT_BUDGET_SOURCES.find((item) => item.code === sourceCode);
  const description = source
    ? source.label.replace(new RegExp(`^${escapeRegExp(typeLabel)}\\s*/\\s*`, 'i'), '')
    : '';
  return description
    ? `${typeLabel} - ${sourceCode}\n${description}`
    : `${typeLabel} - ${sourceCode}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function kpiGrid(items: [string, string, string][]): Content {
  return {
    table: {
      widths: Array(items.length).fill('*'),
      body: [
        items.map(([label, value, helper]): TableCell => ({
          stack: [
            { text: label, fontSize: 7.5, color: COLORS.slate },
            {
              text: value,
              fontSize: 15,
              bold: true,
              color: COLORS.navy,
              margin: [0, 5, 0, 2],
            },
            { text: helper, fontSize: 6.8, color: '#94a3b8' },
          ],
          fillColor: COLORS.soft,
          margin: [7, 7, 7, 7],
        })),
      ],
    },
    layout: {
      hLineColor: () => '#ffffff',
      vLineColor: () => '#ffffff',
      hLineWidth: () => 3,
      vLineWidth: () => 3,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

function sectionTitle(text: string): Content {
  return { text, style: 'section' };
}

function standardTable(
  headers: string[],
  rows: string[][],
  widths: (number | string)[],
  fontSize = 7.2,
): Content {
  const body: TableCell[][] = [
    headers.map((header): TableCell => ({
      text: header,
      style: 'tableHeader',
      fillColor: COLORS.navy,
      margin: [2, 4, 2, 4],
    })),
    ...rows.map((row, rowIndex) =>
      row.map((value): TableCell => ({
        text: value,
        fontSize,
        color: '#334155',
        fillColor: rowIndex % 2 ? '#f8fafc' : '#ffffff',
        margin: [2, 3, 2, 3],
      })),
    ),
  ];
  return {
    table: { headerRows: 1, dontBreakRows: true, widths, body },
    layout: {
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0',
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
  };
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString('tr-TR') : '—';
}

function dateValue(date: Date | null) {
  return date?.getTime() ?? 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatUsd(value: number) {
  return `${new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
  }).format(value)} USD`;
}

function formatSignedUsd(value: number) {
  return `${value > 0 ? '+' : ''}${formatUsd(value)}`;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
