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
  SATBudgetType,
  SATBudgetUsageRow,
  SATBudgetUsageStage,
} from '../types';
import {
  budgetTotals,
  budgetTypeLabel,
  budgetUsageSummary,
  companyLabel,
  isMaskedBudgetRow,
  SAT_BUDGET_COMPANIES,
} from './satBudgetLogic';
import {
  isSTADOpexBudgetSource,
  SAT_BUDGET_SOURCES,
} from './satBudgetParser';

interface SATBudgetReportOptions {
  budgetRows: SATBudgetRow[];
  usageRows: SATBudgetUsageRow[];
  company: SATBudgetCompany | null;
  scopeLabel: string;
}

interface BudgetSourceSummary {
  key: string;
  label: string;
  displayLabel: string;
  sourceCode: string;
  type: SATBudgetType;
  typeLabel: string;
  value: number;
  count: number;
  masked: boolean;
  used: number;
  unused: number;
  utilizationPercent: number;
  barPercent: number;
}

interface CompanySourceSummary {
  company: SATBudgetCompany;
  label: string;
  total: number;
  masked: boolean;
  sources: BudgetSourceSummary[];
}

const COLORS = {
  navy: '#0f172a',
  slate: '#475569',
  line: '#cbd5e1',
  soft: '#f1f5f9',
  darkPanel: '#ffffff',
  darkCard: '#ffffff',
  darkCardSoft: '#f8fafc',
  darkBorder: '#e2e8f0',
  white: '#0f172a',
  mutedDark: '#64748b',
  cyan: '#0891b2',
  orange: '#d97706',
  purple: '#7c3aed',
  green: '#16a34a',
  red: '#dc2626',
  blue: '#2563eb',
  gray: '#64748b',
};

const REPORT_TITLE = 'Bütçe Yönetici Özeti';

const SOURCE_TYPE_ORDER: SATBudgetType[] = [
  'OPERATIONAL_CAPEX',
  'OPEX',
  'CAPEX',
];

const COMPANY_THEME: Record<
  SATBudgetCompany,
  { color: string; soft: string; border: string }
> = {
  PETKIM: {
    color: '#38bdf8',
    soft: '#e0f2fe',
    border: '#7dd3fc',
  },
  STAR: {
    color: '#ef4444',
    soft: '#fee2e2',
    border: '#fca5a5',
  },
  STAD: {
    color: '#22c55e',
    soft: '#dcfce7',
    border: '#86efac',
  },
};

const USAGE_CARD_THEMES = [
  COMPANY_THEME.PETKIM,
  COMPANY_THEME.STAR,
  COMPANY_THEME.STAD,
];

const STAGE_THEME: Record<
  SATBudgetUsageStage | 'UNUSED',
  { color: string; soft: string }
> = {
  SAT: { color: '#38bdf8', soft: '#e0f2fe' },
  SAS: { color: '#ef4444', soft: '#fee2e2' },
  FAT: { color: '#22c55e', soft: '#dcfce7' },
  UNUSED: { color: '#64748b', soft: '#e2e8f0' },
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

type UsageSummary = ReturnType<typeof budgetUsageSummary>[number];

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
  const reportCompanies = selectedCompany
    ? [selectedCompany]
    : SAT_BUDGET_COMPANIES;
  const companySources = buildCompanySourceSummary(
    budgetRows,
    usageRows,
    reportCompanies,
  );
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
    budgetSourcesDashboard(companySources),
    ...reportCompanies.flatMap((company, index) =>
      companyUsageDashboard(
        company,
        budgetRows,
        usageRows,
        index > 0,
      ),
    ),
    {
      text: 'Bütçe Hareket Detayı',
      style: 'section',
      pageBreak: 'before',
    },
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

function budgetSourcesDashboard(companies: CompanySourceSummary[]): Content {
  return {
    stack: [
      {
        columns: [
          {
            stack: [
              {
                text: 'Bütçe Kaynakları',
                bold: true,
                fontSize: 13,
                color: COLORS.navy,
              },
              {
                text: 'Şirket bazında net bütçe kaynakları; Operational CAPEX, OPEX ve CAPEX sırasıyla gösterilir.',
                fontSize: 8,
                color: COLORS.slate,
                margin: [0, 4, 0, 0],
              },
            ],
          },
          {
            width: 110,
            text: `${companies.length} kapsam`,
            alignment: 'right',
            fontSize: 8,
            color: COLORS.slate,
            margin: [0, 3, 0, 0],
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
            lineWidth: 0.6,
            lineColor: COLORS.line,
          },
        ],
        margin: [0, 8, 0, 10],
      },
      {
        columns: companies.map(
          (company) => ({
            width: '*',
            stack: [companySourceCard(company)],
          }) as unknown as Content,
        ),
        columnGap: 9,
      },
    ],
    margin: [0, 0, 0, 16],
  };
}

function companySourceCard(company: CompanySourceSummary): Content {
  const theme = COMPANY_THEME[company.company];
  return {
    stack: [
      {
        columns: [
          {
            stack: [
              {
                text: company.label,
                bold: true,
                fontSize: 12,
                color: COLORS.navy,
              },
              {
                text: `${company.sources.length} bütçe kaynağı`,
                fontSize: 8,
                color: COLORS.mutedDark,
                margin: [0, 4, 0, 0],
              },
            ],
          },
          {
            width: 95,
            stack: [
              {
                text: company.masked ? 'XXX USD' : formatCompactUsd(company.total),
                alignment: 'right',
                bold: true,
                fontSize: 11,
                color: theme.color,
              },
              {
                text: 'Net toplam',
                alignment: 'right',
                fontSize: 7,
                color: COLORS.mutedDark,
                margin: [0, 3, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 8],
      },
      ...company.sources.map((source) => sourceSummaryCard(source, theme)),
    ],
  };
}

function sourceSummaryCard(
  source: BudgetSourceSummary,
  theme: (typeof COMPANY_THEME)[SATBudgetCompany],
): Content {
  return themedCard(
    [
      {
        columns: [
          {
            stack: [
              {
                text: source.typeLabel.toLocaleUpperCase('tr-TR'),
                bold: true,
                fontSize: 8,
                color: theme.color,
                characterSpacing: 0.8,
              },
              {
                text: source.displayLabel,
                bold: true,
                fontSize: 9.5,
                color: COLORS.navy,
                margin: [0, 4, 0, 0],
              },
              {
                text: source.sourceCode,
                fontSize: 7.2,
                color: '#64748b',
                margin: [0, 3, 0, 0],
              },
            ],
          },
          {
            width: 86,
            stack: [
              {
                text: source.masked ? 'XXX USD' : formatCompactUsd(source.value),
                alignment: 'right',
                bold: true,
                fontSize: 9.5,
                color: theme.color,
              },
              {
                text: 'Net bütçe',
                alignment: 'right',
                fontSize: 7,
                color: COLORS.mutedDark,
                margin: [0, 3, 0, 0],
              },
            ],
          },
        ],
      },
      {
        text: `${formatNumber(source.count)} hareket`,
        fontSize: 7,
        color: COLORS.mutedDark,
        margin: [0, 7, 0, 0],
      },
      {
        columns: [
          {
            text: 'Kullanım oranı',
            fontSize: 7.2,
            color: COLORS.mutedDark,
          },
          {
            text: `%${source.utilizationPercent} kullanıldı`,
            alignment: 'right',
            bold: true,
            fontSize: 7.2,
            color: theme.color,
          },
        ],
        margin: [0, 8, 0, 3],
      },
      progressBar(source.barPercent, theme.color, 168, 6),
      {
        columns: [
          {
            text: `Kullanılan: ${formatCompactUsd(source.used)}`,
            fontSize: 6.8,
            color: '#64748b',
          },
          {
            text: `Kalan: ${formatCompactUsd(source.unused)}`,
            alignment: 'right',
            fontSize: 6.8,
            color: '#64748b',
          },
        ],
        margin: [0, 4, 0, 0],
      },
    ],
    theme,
    [0, 10, 0, 0],
    COLORS.darkCardSoft,
  );
}

function companyUsageDashboard(
  company: SATBudgetCompany,
  budgetRows: SATBudgetRow[],
  usageRows: SATBudgetUsageRow[],
  separatedFromPrevious: boolean,
): Content[] {
  const summaries = budgetUsageSummary(budgetRows, usageRows, company);
  const companyUsageRows = usageRows.filter((row) => row.company === company);
  const companyTheme = COMPANY_THEME[company];
  const dashboard = dashboardPanel(
    [
      {
        columns: [
          {
            width: 30,
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: 24,
                h: 24,
                r: 5,
                color: companyTheme.soft,
              },
              {
                type: 'rect',
                x: 7,
                y: 5,
                w: 5,
                h: 5,
                r: 1,
                lineColor: companyTheme.color,
                lineWidth: 1.2,
              },
              {
                type: 'rect',
                x: 13,
                y: 12,
                w: 5,
                h: 5,
                r: 1,
                lineColor: companyTheme.color,
                lineWidth: 1.2,
              },
            ],
          },
          {
            stack: [
              {
                text: `${companyLabel(company)} Bütçe Kullanım Aşamaları`,
                bold: true,
                fontSize: 13,
                color: COLORS.white,
              },
              {
                text: 'CAPEX, OPEX ve Operational CAPEX bütçelerinin SAT · SAS · FAT · Kullanılmayan dağılımı',
                fontSize: 8,
                color: COLORS.mutedDark,
                margin: [0, 4, 0, 0],
              },
            ],
          },
        ],
      },
      {
        columns: summaries.map(
          (summary, index) => ({
            width: '*',
            stack: [
              usageSummaryCard(
                summary,
                USAGE_CARD_THEMES[index] ?? USAGE_CARD_THEMES[0],
              ),
            ],
          }) as unknown as Content,
        ),
        columnGap: 9,
        margin: [0, 12, 0, 0],
      },
    ],
    [0, separatedFromPrevious ? 16 : 0, 0, 12],
    separatedFromPrevious ? 'before' : undefined,
  );
  return [
    dashboard,
    sectionTitle(`${companyLabel(company)} Bütçe Kullanım Tablosu`),
    standardTable(
      ['Bütçe Türü / Kod', 'Toplam Bütçe', 'SAT', 'SAS', 'FAT', 'Kullanılmayan', 'Kullanım'],
      summaries.map((summary) => [
        budgetTypeCodeAndDescription(summary.label, summary.sourceCode),
        formatUsd(summary.totalBudget),
        formatStageTableValue(summary, 'SAT'),
        formatStageTableValue(summary, 'SAS'),
        formatStageTableValue(summary, 'FAT'),
        `${formatUsd(summary.unused)}\n%${utilizationPercent(summary.unused, summary.totalBudget)}`,
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

function usageSummaryCard(
  summary: UsageSummary,
  theme: (typeof COMPANY_THEME)[SATBudgetCompany],
): Content {
  const utilization = utilizationPercent(summary.used, summary.totalBudget);
  return themedCard(
    [
      {
        columns: [
          {
            stack: [
              {
                text: `${summary.label} - ${budgetUsageDisplayLabel(summary.sourceCode)}`,
                bold: true,
                fontSize: 10.2,
                color: COLORS.white,
              },
              {
                text: `${summary.sourceCode} · ${formatNumber(summary.rowCount)} kullanım hareketi`,
                fontSize: 7.3,
                color: COLORS.mutedDark,
                margin: [0, 4, 0, 0],
              },
            ],
          },
          {
            width: 86,
            stack: [
              {
                text: summary.masked
                  ? 'XXX USD'
                  : isSTADOpexBudgetSource(summary.sourceCode)
                    ? formatUsd(summary.totalBudget)
                    : formatCompactUsd(summary.totalBudget),
                alignment: 'right',
                bold: true,
                fontSize: 10.2,
                color: theme.color,
              },
              {
                text: 'Toplam bütçe',
                alignment: 'right',
                fontSize: 7,
                color: COLORS.mutedDark,
                margin: [0, 3, 0, 0],
              },
            ],
          },
        ],
      },
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    columns: [
                      {
                        stack: [
                          {
                            text: 'Kullanım oranı',
                            fontSize: 7.2,
                            color: COLORS.mutedDark,
                          },
                          {
                            text: summary.masked ? 'XXX' : `%${utilization}`,
                            bold: true,
                            fontSize: 15,
                            color: COLORS.white,
                            margin: [0, 3, 0, 0],
                          },
                        ],
                      },
                      {
                        width: 80,
                        stack: [
                          {
                            text: 'Kullanılan',
                            alignment: 'right',
                            fontSize: 7.2,
                            color: COLORS.mutedDark,
                          },
                          {
                            text: formatCompactUsd(summary.used),
                            alignment: 'right',
                            bold: true,
                            fontSize: 8.2,
                            color: COLORS.navy,
                            margin: [0, 4, 0, 0],
                          },
                        ],
                      },
                    ],
                  },
                  usageStackedBar(
                    summary.segments,
                    summary.totalBudget,
                    summary.used,
                    176,
                    12,
                    [0, 7, 0, 0],
                  ),
                  {
                    columns: [
                      { text: '0', fontSize: 6.6, color: '#64748b' },
                      {
                        text: formatCompactUsd(summary.totalBudget),
                        alignment: 'right',
                        fontSize: 6.6,
                        color: '#64748b',
                      },
                    ],
                    margin: [0, 4, 0, 0],
                  },
                ],
                fillColor: COLORS.darkCard,
                margin: [8, 7, 8, 7],
              },
            ],
          ],
        },
        layout: borderLayout(theme.border),
        margin: [0, 12, 0, 10],
      },
      stageRows(summary),
      ...(summary.overrun > 0
        ? [
            {
              text: `Bütçe aşımı: ${formatUsd(summary.overrun)}`,
              fontSize: 7,
              bold: true,
              color: COLORS.red,
              margin: [0, 6, 0, 0],
            } as Content,
          ]
        : []),
    ],
    theme,
    [0, 0, 0, 0],
  );
}

function stageRows(summary: UsageSummary): Content {
  return {
    table: {
      widths: [82, 54, '*'],
      body: summary.segments.map((segment) => {
        const stageTheme = STAGE_THEME[segment.key];
        const percent = utilizationPercent(segment.value, summary.totalBudget);
        return [
          {
            columns: [
              {
                width: 9,
                canvas: [
                  {
                    type: 'ellipse',
                    x: 4,
                    y: 5,
                    r1: 3.5,
                    r2: 3.5,
                    color: stageTheme.color,
                  },
                ],
              },
              {
                text: segment.label,
                fontSize: 7.7,
                color: COLORS.slate,
              },
              {
                text: `%${percent}`,
                fontSize: 6.6,
                bold: true,
                color: COLORS.slate,
                fillColor: COLORS.soft,
                margin: [2, 1, 2, 1],
              },
            ],
            margin: [0, 2, 0, 2],
          },
          progressBar(percent, stageTheme.color, 52, 5, stageTheme.soft),
          {
            text:
              summary.masked && segment.key === 'UNUSED'
                ? 'XXX USD'
                : formatUsd(segment.value),
            alignment: 'right',
            bold: true,
            fontSize: 7.5,
            color: COLORS.navy,
            margin: [0, 1, 0, 0],
          },
        ];
      }),
    },
    layout: 'noBorders',
  };
}

function usageStackedBar(
  segments: { key: SATBudgetUsageStage | 'UNUSED'; value: number }[],
  totalBudget: number,
  used: number,
  width = 210,
  height = 12,
  margin: [number, number, number, number] = [0, 0, 0, 0],
): Content {
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
        h: height,
        color: STAGE_THEME[segment.key].color,
      };
      x = Math.min(width, x + segmentWidth);
      return rect;
    });
  return {
    canvas: [
      { type: 'rect', x: 0, y: 0, w: width, h: height, color: '#e2e8f0' },
      ...bars,
    ],
    margin,
  };
}

function dashboardPanel(
  stack: Content[],
  margin: [number, number, number, number],
  pageBreak?: 'before' | 'after',
): Content {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack,
            fillColor: COLORS.darkPanel,
            margin: [12, 12, 12, 12],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin,
    ...(pageBreak ? { pageBreak } : {}),
  };
}

function themedCard(
  stack: Content[],
  theme: (typeof COMPANY_THEME)[SATBudgetCompany],
  margin: [number, number, number, number],
  fillColor = COLORS.darkCard,
): Content {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack,
            fillColor,
            margin: [9, 9, 9, 9],
          },
        ],
      ],
    },
    layout: borderLayout(theme.border, 0.7),
    margin,
    unbreakable: true,
  };
}

function borderLayout(color: string, width = 0.5) {
  return {
    hLineColor: () => color,
    vLineColor: () => color,
    hLineWidth: () => width,
    vLineWidth: () => width,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  };
}

function progressBar(
  percent: number,
  color: string,
  width: number,
  height: number,
  background = '#e2e8f0',
): Content {
  const normalized = clamp(percent, 0, 100);
  const fillWidth = normalized > 0 ? Math.max(1, (normalized / 100) * width) : 0;
  return {
    canvas: [
      { type: 'rect', x: 0, y: 0, w: width, h: height, color: background },
      ...(fillWidth > 0
        ? [
            {
              type: 'rect' as const,
              x: 0,
              y: 0,
              w: fillWidth,
              h: height,
              color,
            },
          ]
        : []),
    ],
  };
}

function utilizationPercent(used: number, total: number) {
  return total ? Math.round((used / total) * 100) : 0;
}

function budgetTypeCodeAndDescription(typeLabel: string, sourceCode: string) {
  const description = budgetUsageDisplayLabel(sourceCode);
  return description
    ? `${typeLabel} - ${description}\n${sourceCode}`
    : `${typeLabel}\n${sourceCode}`;
}

function formatStageTableValue(
  summary: UsageSummary,
  stage: SATBudgetUsageStage,
) {
  const value =
    summary.segments.find((segment) => segment.key === stage)?.value ?? 0;
  return `${formatUsd(value)}\n%${utilizationPercent(value, summary.totalBudget)}`;
}

function buildCompanySourceSummary(
  rows: SATBudgetRow[],
  usageRows: SATBudgetUsageRow[],
  companies: SATBudgetCompany[],
): CompanySourceSummary[] {
  return companies.map((company) => {
    const usageByType = new Map(
      budgetUsageSummary(rows, usageRows, company).map((summary) => [
        summary.key,
        summary,
      ]),
    );
    const sources = SAT_BUDGET_SOURCES.filter(
      (source) => source.company === company,
    )
      .sort(
        (a, b) =>
          SOURCE_TYPE_ORDER.indexOf(a.budgetType) -
          SOURCE_TYPE_ORDER.indexOf(b.budgetType),
      )
      .map((source): BudgetSourceSummary => {
        const sourceRows = rows.filter(
          (row) =>
            row.company === company &&
            row.budgetType === source.budgetType &&
            row.sourceCode === source.code,
        );
        const totals = budgetTotals(sourceRows);
        const usage = usageByType.get(source.budgetType);
        const totalBudget = Math.max(0, totals.net);
        const used = usage?.used ?? 0;
        const unused = Math.max(0, totalBudget - used);
        const utilization = totalBudget > 0 ? (used / totalBudget) * 100 : 0;
        return {
          key: `${company}-${source.code}`,
          label: source.label,
          displayLabel: sourceDisplayLabel(source.label),
          sourceCode: source.code,
          type: source.budgetType,
          typeLabel: budgetTypeLabel(source.budgetType),
          value: totals.net,
          count: totals.count,
          masked: sourceRows.some(isMaskedBudgetRow),
          used,
          unused,
          utilizationPercent: Math.round(utilization),
          barPercent: clamp(utilization, 0, 100),
        };
      });
    return {
      company,
      label: companyLabel(company),
      total: sources.reduce((total, source) => total + source.value, 0),
      masked: sources.some((source) => source.masked),
      sources,
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sourceDisplayLabel(label: string) {
  return label
    .replace(/^Operational\s+CAPEX\s*\/\s*/i, '')
    .replace(/^CAPEX\s*\/\s*/i, '')
    .replace(/^OPEX\s*\/\s*/i, '')
    .trim();
}

function budgetUsageDisplayLabel(sourceCode: string) {
  const source = SAT_BUDGET_SOURCES.find(
    (item) =>
      item.code.toLocaleUpperCase('tr-TR') ===
      sourceCode.toLocaleUpperCase('tr-TR'),
  );
  return source ? sourceDisplayLabel(source.label) : 'Tanımlı Kaynak Yok';
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

function formatCompactUsd(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${new Intl.NumberFormat('tr-TR', {
      maximumFractionDigits: 2,
    }).format(value / 1_000_000)} Mn USD`;
  }
  if (abs >= 1_000) {
    return `${new Intl.NumberFormat('tr-TR', {
      maximumFractionDigits: 2,
    }).format(value / 1_000)} B USD`;
  }
  return formatUsd(value);
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
