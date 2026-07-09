import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from 'pdfmake/interfaces';
import type { RCACompany, RCARow } from '../types';
import { formatDate } from './normalize';

interface RCAReportOptions {
  rows: RCARow[];
  scopeLabel: string;
}

interface DistributionRow {
  label: string;
  value: number;
  color: string;
}

const COLORS = {
  navy: '#0f172a',
  slate: '#475569',
  muted: '#94a3b8',
  line: '#dbe4ef',
  soft: '#f1f5f9',
  cyan: '#0284c7',
  red: '#dc2626',
  green: '#16a34a',
  amber: '#d97706',
  rose: '#e11d48',
  emerald: '#059669',
};

const COMPANY_COLORS: Record<RCACompany, string> = {
  PETKIM: COLORS.cyan,
  STAR: COLORS.red,
  STAD: COLORS.green,
};

const styles: StyleDictionary = {
  eyebrow: { fontSize: 9, bold: true, color: COLORS.cyan },
  title: { fontSize: 23, bold: true, color: COLORS.navy },
  subtitle: { fontSize: 9, color: COLORS.slate, margin: [0, 5, 0, 0] },
  section: {
    fontSize: 13,
    bold: true,
    color: COLORS.navy,
    margin: [0, 16, 0, 7],
  },
  tableHeader: { bold: true, color: '#ffffff', fontSize: 7.4 },
  tableCell: { fontSize: 7, color: '#334155' },
  small: { fontSize: 7, color: COLORS.slate },
};

export async function downloadRCAReportPdf({
  rows,
  scopeLabel,
}: RCAReportOptions) {
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
    .createPdf(buildRCAReportDefinition(rows, scopeLabel))
    .download(`${slugify(`rca-aksiyon-takip-${scopeLabel}`)}.pdf`);
}

export function buildRCAReportDefinition(
  rows: RCARow[],
  scopeLabel: string,
): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 34, 30, 34],
    info: {
      title: 'RCA Aksiyon Takip Raporu',
      author: 'Enstrüman Bakım Müdürlüğü',
      subject: scopeLabel,
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#334155' },
    styles,
    content: buildReportContent(rows, scopeLabel),
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Enstrüman Bakım Müdürlüğü · RCA Takip', alignment: 'left' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right' },
      ],
      margin: [30, 8, 30, 0],
      fontSize: 7,
      color: '#94a3b8',
    }),
  };
}

function buildReportContent(rows: RCARow[], scopeLabel: string): Content[] {
  const openRows = rows.filter((row) => row.status === 'open');
  const overdueRows = openRows.filter((row) => row.overdue);
  const completedRows = rows.filter((row) => row.status === 'completed');
  const companyDistribution = buildCompanyDistribution(rows);
  const ownerDistribution = buildOwnerDistribution(openRows);

  return [
    ...reportHeading(scopeLabel),
    kpiGrid([
      ['Toplam RCA Aksiyonu', formatNumber(rows.length), scopeLabel],
      ['Tamamlanmayan', formatNumber(openRows.length), 'CREATED'],
      ['Geciken Açık Aksiyon', formatNumber(overdueRows.length), 'Hedef tarih geçmiş'],
      ['Tamamlanan', formatNumber(completedRows.length), 'IMPLEMENTED'],
    ]),
    {
      columns: [
        {
          width: '*',
          stack: [
            sectionTitle('Şirket Kırılımı'),
            vectorBarChart(companyDistribution, rows.length, 350),
          ],
        },
        { width: 14, text: '' },
        {
          width: '*',
          stack: [
            sectionTitle('Aksiyon Sahibi İş Yükü'),
            ownerDistribution.length > 0
              ? vectorBarChart(ownerDistribution, maxValue(ownerDistribution), 350)
              : emptyNote('Açık RCA aksiyonu bulunmuyor.'),
          ],
        },
      ],
    },
    sectionTitle('Geciken RCA Aksiyonları'),
    overdueRows.length > 0
      ? actionTable(overdueRows)
      : emptyNote('Seçili kapsamda geciken açık RCA aksiyonu yok.'),
    { text: 'Tamamlanmayan RCA Aksiyonları', style: 'section', pageBreak: 'before' },
    openRows.length > 0
      ? actionTable(openRows)
      : emptyNote('Seçili kapsamda tamamlanmayan RCA aksiyonu yok.'),
  ];
}

function reportHeading(scopeLabel: string): Content[] {
  return [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'Enstrüman Bakım Müdürlüğü', style: 'eyebrow' },
            { text: 'RCA Aksiyon Takip Raporu', style: 'title' },
            {
              text: `Kapsam: ${scopeLabel}`,
              style: 'subtitle',
            },
          ],
        },
        {
          width: 160,
          stack: [
            {
              text: 'RCA DASHBOARD',
              alignment: 'right',
              bold: true,
              color: COLORS.navy,
            },
            {
              text: formatReportDate(new Date()),
              alignment: 'right',
              fontSize: 8,
              color: COLORS.muted,
              margin: [0, 6, 0, 0],
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
          x2: 782,
          y2: 0,
          lineWidth: 1,
          lineColor: COLORS.line,
        },
      ],
      margin: [0, 13, 0, 10],
    },
  ];
}

function kpiGrid(items: [string, string, string][]): Content {
  return {
    columns: items.map(([label, value, helper]) => ({
      width: '*',
      stack: [
        { text: label, fontSize: 8, color: COLORS.slate },
        {
          text: value,
          fontSize: 18,
          bold: true,
          color: COLORS.navy,
          margin: [0, 5, 0, 0],
        },
        { text: helper, fontSize: 7, color: COLORS.muted, margin: [0, 4, 0, 0] },
      ],
      margin: [0, 0, 8, 0],
      fillColor: COLORS.soft,
    })),
    columnGap: 8,
    margin: [0, 4, 0, 4],
  };
}

function sectionTitle(text: string): Content {
  return { text, style: 'section' };
}

function actionTable(rows: RCARow[]): Content {
  return standardTable(
    [
      'Risk',
      'Recommendation ID',
      'Analysis ID',
      'Şirket',
      'Aksiyon Sahibi',
      'Target Date',
      'Job Title',
      'Aksiyon',
    ],
    rows.map((row) => [
      row.overdue ? 'Geciken' : 'Açık',
      row.recommendationId || '—',
      row.analysisId || '—',
      companyLabel(row.company),
      row.owner || ownerDisplayName(row.assignedToName),
      formatDate(row.targetCompletionDate),
      row.jobTitle || '—',
      row.headline || row.description || '—',
    ]),
    [44, 76, 70, 48, 76, 58, 112, '*'],
  );
}

function standardTable(
  headers: string[],
  rows: string[][],
  widths: (number | '*')[],
): Content {
  return {
    table: {
      headerRows: 1,
      widths,
      body: [
        headers.map((header): TableCell => ({
          text: header,
          style: 'tableHeader',
          fillColor: COLORS.navy,
          margin: [4, 5, 4, 5],
        })),
        ...rows.map((row, index) =>
          row.map((cell): TableCell => ({
            text: cell,
            style: 'tableCell',
            fillColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
            margin: [4, 4, 4, 4],
          })),
        ),
      ],
    },
    layout: {
      hLineColor: () => COLORS.line,
      vLineColor: () => COLORS.line,
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
    },
  };
}

function vectorBarChart(
  rows: DistributionRow[],
  total: number,
  width: number,
): Content {
  const safeTotal = Math.max(total, 1);
  return {
    stack: rows.map((row) => {
      const barWidth = Math.max(4, (row.value / safeTotal) * width);
      return {
        margin: [0, 0, 0, 7],
        stack: [
          {
            columns: [
              {
                text: row.label,
                width: '*',
                fontSize: 8,
                color: COLORS.slate,
              },
              {
                text: formatNumber(row.value),
                width: 52,
                alignment: 'right',
                fontSize: 8,
                bold: true,
                color: COLORS.navy,
              },
            ],
          },
          {
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: width,
                h: 7,
                r: 3,
                color: '#e2e8f0',
              },
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: barWidth,
                h: 7,
                r: 3,
                color: row.color,
              },
            ],
            margin: [0, 3, 0, 0],
          },
        ],
      };
    }),
  };
}

function emptyNote(text: string): Content {
  return {
    text,
    fontSize: 8,
    color: COLORS.slate,
    italics: true,
    margin: [0, 4, 0, 6],
  };
}

function buildCompanyDistribution(rows: RCARow[]): DistributionRow[] {
  return (['PETKIM', 'STAR', 'STAD'] as RCACompany[]).map((company) => ({
    label: companyLabel(company),
    value: rows.filter((row) => row.company === company).length,
    color: COMPANY_COLORS[company],
  }));
}

function buildOwnerDistribution(rows: RCARow[]): DistributionRow[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.owner || ownerDisplayName(row.assignedToName) || 'Atanmamış';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, color: COLORS.amber }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'))
    .slice(0, 10);
}

function maxValue(rows: DistributionRow[]) {
  return Math.max(...rows.map((row) => row.value), 1);
}

function ownerDisplayName(value: string) {
  return value.split('~')[0]?.trim() || '';
}

function companyLabel(company: RCACompany) {
  if (company === 'PETKIM') return 'Petkim';
  if (company === 'STAR') return 'Star';
  return 'STAD';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatReportDate(date: Date) {
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
