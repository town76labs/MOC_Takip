import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from 'pdfmake/interfaces';
import type { SATBudgetRow } from '../types';
import {
  budgetCompanySummary,
  budgetTotals,
  budgetTypeLabel,
  companyLabel,
  isMaskedBudgetRow,
} from './satBudgetLogic';

interface SATBudgetReportOptions {
  rows: SATBudgetRow[];
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
};

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
  rows,
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
    .createPdf(buildSATBudgetReportDefinition(rows, scopeLabel))
    .download(`${slugify(`sat-butce-genel-bakis-${scopeLabel}`)}.pdf`);
}

export function buildSATBudgetReportDefinition(
  rows: SATBudgetRow[],
  scopeLabel: string,
): TDocumentDefinitions {
  const totals = budgetTotals(rows);
  const companies = budgetCompanySummary(rows);
  const reportMasked = rows.some(isMaskedBudgetRow);
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
            { text: 'SAT Bütçe Genel Bakış Raporu', style: 'title' },
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
    kpiGrid([
      ['Net Toplam Bütçe', reportMasked ? 'XXX USD' : formatUsd(totals.net), reportMasked ? 'Gizli bütçe dahil' : 'Giriş - çıkış'],
      ['Toplam Giriş', reportMasked ? 'XXX USD' : formatUsd(totals.inflow), reportMasked ? 'Gizli bütçe dahil' : 'Pozitif hareketler'],
      ['Toplam Çıkış', reportMasked ? 'XXX USD' : formatUsd(totals.outflow), reportMasked ? 'Gizli bütçe dahil' : 'Negatif hareketler'],
      ['Bütçe Hareketi', formatNumber(totals.count), 'Excel satırı'],
    ]),
    sectionTitle('Şirket ve Bütçe Türü Dağılımı'),
    {
      columns: companies.map((company) => ({
        width: '*',
        stack: [
          {
            text: company.label,
            bold: true,
            color: COLORS.navy,
            fontSize: 11,
          },
          {
            text: company.types.some((type) => type.masked)
              ? 'XXX USD'
              : formatUsd(company.totals.net),
            bold: true,
            color: COLORS.cyan,
            fontSize: 15,
            margin: [0, 3, 0, 6],
          },
          ...company.types.map((type) =>
            budgetBar(
              `${type.label} - ${type.sourceCode}`,
              type.net,
              Math.max(
                ...company.types
                  .filter((item) => !item.masked)
                  .map((item) => Math.abs(item.net)),
                1,
              ),
              type.color,
              type.masked,
            ),
          ),
        ],
      })),
      columnGap: 16,
    },
    sectionTitle('Net Bütçe Özeti'),
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
    { text: 'Bütçe Hareket Detayı', style: 'section', pageBreak: 'before' },
    standardTable(
      ['Tarih', 'Şirket', 'Bütçe Türü', 'Bütçe Tanımı', 'İşlem', 'Tutar', 'Kullanıcı', 'Açıklama'],
      [...rows]
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
      title: 'SAT Bütçe Genel Bakış Raporu',
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

function budgetBar(
  label: string,
  value: number,
  max: number,
  color: string,
  masked = false,
): Content {
  return {
    stack: [
      {
        columns: [
          { text: label, fontSize: 7.5, color: COLORS.slate },
          {
            text: masked ? 'XXX USD' : formatUsd(value),
            alignment: 'right',
            fontSize: 7.5,
            color: value < 0 ? COLORS.red : COLORS.navy,
          },
        ],
      },
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 210, h: 7, color: '#e2e8f0' },
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: masked ? 210 : Math.max(1, (Math.abs(value) / max) * 210),
            h: 7,
            color: masked ? '#94a3b8' : color,
          },
        ],
        margin: [0, 3, 0, 7],
      },
    ],
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
