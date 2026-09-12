import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from 'pdfmake/interfaces';
import type { SCEV2Company, SCEV2DashboardRow } from '../types';
import { energyCriticalFactoryLabel } from './energyCriticalFactories';
import { formatDate } from './normalize';

export type SCEV2ReportType = 'executive' | 'detailed';

interface SCEV2ReportOptions {
  rows: SCEV2DashboardRow[];
  company: SCEV2Company;
  type: SCEV2ReportType;
  scopeLabel: string;
}

interface DistributionRow {
  label: string;
  value: number;
  color: string;
}

interface CompletionRow {
  label: string;
  total: number;
  completed: number;
  deferred: number;
  notCompleted: number;
}

const COLORS = {
  navy: '#0f172a',
  slate: '#475569',
  muted: '#94a3b8',
  line: '#dbe4ef',
  soft: '#f1f5f9',
  sky: '#0284c7',
  star: '#dc2626',
  green: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
  purple: '#8b5cf6',
  gray: '#64748b',
  white: '#ffffff',
};

const FACTORY_LABELS: Record<string, string> = {
  ISKELE: 'İskele',
  ETILEN: 'Etilen',
  AROMATIKLER: 'Aromatikler',
  AYPE: 'AYPE',
  'AYPE-T': 'AYPE-T',
  YYPE: 'YYPE',
  PP: 'PP',
  PA: 'PA',
  DIGER: 'Diğer',
};

const styles: StyleDictionary = {
  eyebrow: { fontSize: 8.5, bold: true, color: COLORS.sky },
  title: { fontSize: 22, bold: true, color: COLORS.navy },
  subtitle: { fontSize: 8.5, color: COLORS.slate, margin: [0, 5, 0, 0] },
  section: {
    fontSize: 13,
    bold: true,
    color: COLORS.navy,
    margin: [0, 15, 0, 7],
  },
  tableHeader: { bold: true, color: '#ffffff', fontSize: 6.5 },
  tableCell: { fontSize: 5.8, color: '#334155' },
  small: { fontSize: 7, color: COLORS.slate },
};

export async function downloadSCEV2ReportPdf(options: SCEV2ReportOptions) {
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
  const reportName =
    options.type === 'executive' ? 'Yönetici Özeti' : 'Detaylı Rapor';
  await pdfMake
    .createPdf(buildSCEV2ReportDefinition(options))
    .download(
      `${slugify(`${reportTitle(options.company)}-${reportName}`)}.pdf`,
    );
}

export function buildSCEV2ReportDefinition({
  rows,
  company,
  type,
  scopeLabel,
}: SCEV2ReportOptions): TDocumentDefinitions {
  const reportName = type === 'executive' ? 'Yönetici Özeti' : 'Detaylı Rapor';
  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 34, 30, 34],
    info: {
      title: `${reportTitle(company)} - ${reportName}`,
      author: 'Enstrüman Bakım Müdürlüğü',
      subject: scopeLabel,
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#334155' },
    styles,
    content: buildReportContent(rows, company, type, scopeLabel),
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: `Enstrüman Bakım Müdürlüğü · ${reportProductLabel(company)}`,
          alignment: 'left',
        },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right' },
      ],
      margin: [30, 8, 30, 0],
      fontSize: 7,
      color: COLORS.muted,
    }),
  };
}

function buildReportContent(
  rows: SCEV2DashboardRow[],
  company: SCEV2Company,
  type: SCEV2ReportType,
  scopeLabel: string,
): Content[] {
  const metrics = buildMetrics(rows);
  const accent =
    company === 'STAR'
      ? COLORS.star
      : company === 'ENERGY'
        ? COLORS.amber
        : COLORS.sky;
  const completionRows = buildCompletionRows(rows, company);
  const statusDistribution: DistributionRow[] = [
    { label: 'Bakımı Tamamlanan', value: metrics.completed, color: COLORS.green },
    { label: 'Duruşa Ertelenen', value: metrics.deferred, color: COLORS.amber },
    { label: 'Bakımı Yapılmayan', value: metrics.notCompleted, color: COLORS.rose },
    { label: 'Sipariş Kaydı Yok', value: metrics.orderNotFound, color: COLORS.gray },
    ...(company !== 'ENERGY'
      ? [
          {
            label: 'Programa Girmeyenler',
            value: metrics.notInProgram,
            color: COLORS.purple,
          },
        ]
      : []),
  ];

  const content: Content[] = [
    ...reportHeading(company, type, scopeLabel, accent),
    kpiGrid([
      [
        'Toplam Ekipman',
        formatNumber(metrics.total),
        company === 'STAR'
          ? `${formatNumber(metrics.orderNotFound)} sipariş kaydı yok`
          : company === 'ENERGY'
            ? 'Gömülü kritik ekipman envanteri'
            : 'Tekilleştirilmiş kayıt',
      ],
      [
        'Bakımı Tamamlanan',
        formatNumber(metrics.completed),
        `%${percent(metrics.completed, metrics.total)} tamamlanma`,
      ],
      ['Duruşa Ertelenen', formatNumber(metrics.deferred), 'BEK içeren kayıt'],
      ['Bakımı Yapılmayan', formatNumber(metrics.notCompleted), 'Aksiyon gerekli'],
    ], accent),
    kpiGrid(
      [
        [
          'Overdue',
          formatNumber(metrics.maintenanceOverdue),
          'Planlanan tarihi geçmiş, tamamlanmamış',
        ],
        [
          'Overdue Yaklaşıyor',
          formatNumber(metrics.maintenanceDueSoon),
          'Planlanan tarihe bir ay veya daha az kaldı',
        ],
      ],
      accent,
    ),
    {
      columns: [
        {
          width: '*',
          stack: [
            sectionTitle('Genel Bakım Durumu'),
            vectorBarChart(statusDistribution, metrics.total, 330),
          ],
        },
        { width: 18, text: '' },
        {
          width: '*',
          stack: [
            sectionTitle('Planlanan Tarih Takibi'),
            vectorBarChart(
              [
                {
                  label: 'Overdue',
                  value: metrics.maintenanceOverdue,
                  color: COLORS.rose,
                },
                {
                  label: 'Overdue Yaklaşıyor',
                  value: metrics.maintenanceDueSoon,
                  color: COLORS.amber,
                },
                {
                  label: 'Takviminde',
                  value: metrics.maintenanceOnTrack,
                  color: COLORS.green,
                },
              ],
              metrics.maintenanceOverdue +
                metrics.maintenanceDueSoon +
                metrics.maintenanceOnTrack,
              330,
            ),
          ],
        },
      ],
    },
  ];

  content.push(
    buildMaintenanceOverviewPage(
      rows,
      completionRows,
      accent,
      metrics,
      company,
    ),
  );

  if (type === 'detailed') {
    const actionRows = rows
      .filter((row) => row.maintenanceStatus !== 'completed')
      .sort(compareActionRows);
    const overdueRows = actionRows
      .filter((row) => row.maintenanceDeadlineStatus === 'overdue')
      .sort(compareDeadlineRows);
    const dueSoonRows = actionRows
      .filter((row) => row.maintenanceDeadlineStatus === 'due_soon')
      .sort(compareDeadlineRows);
    const otherActionRows = actionRows.filter(
      (row) =>
        row.maintenanceDeadlineStatus !== 'overdue' &&
        row.maintenanceDeadlineStatus !== 'due_soon',
    );
    content.push(
      {
        stack: [
          {
            text: `Overdue Ekipmanlar (${formatNumber(overdueRows.length)})`,
            style: 'section',
          },
          overdueRows.length > 0
            ? equipmentTable(overdueRows, company)
            : emptyNote('Seçili kapsamda overdue ekipman bulunmuyor.'),
        ],
        pageBreak: 'before',
      },
      {
        stack: [
          {
            text: `Overdue Yaklaşan Ekipmanlar (${formatNumber(dueSoonRows.length)})`,
            style: 'section',
          },
          dueSoonRows.length > 0
            ? equipmentTable(dueSoonRows, company)
            : emptyNote('Seçili kapsamda overdue yaklaşan ekipman bulunmuyor.'),
        ],
        pageBreak: 'before',
      },
    );
    if (otherActionRows.length > 0) {
      content.push(
        {
          stack: [
            {
              text: `Diğer Aksiyon Gerektiren Ekipmanlar (${formatNumber(otherActionRows.length)})`,
              style: 'section',
            },
            equipmentTable(otherActionRows, company),
          ],
          pageBreak: 'before',
        },
      );
    }
  }

  return content;
}

function reportHeading(
  company: SCEV2Company,
  type: SCEV2ReportType,
  scopeLabel: string,
  accent: string,
): Content[] {
  const reportName = type === 'executive' ? 'Yönetici Özeti' : 'Detaylı Rapor';
  return modernReportHeading(company, reportName, scopeLabel, accent);
}

function modernReportHeading(
  company: SCEV2Company,
  reportName: string,
  scopeLabel: string,
  accent: string,
): Content[] {
  const scopePrefix =
    company === 'ENERGY'
      ? /^Enerji Kritik\s*·\s*/i
      : company === 'STAR'
        ? /^Star\s*·\s*/i
        : /^Petkim\s*·\s*/i;
  const cleanScope = scopeLabel.replace(scopePrefix, '');
  const headerAccent =
    company === 'ENERGY'
      ? '#fbbf24'
      : company === 'STAR'
        ? '#f87171'
        : '#38bdf8';
  const reportTone =
    company === 'ENERGY'
      ? '#fed7aa'
      : company === 'STAR'
        ? '#fecaca'
        : '#bae6fd';
  const scopeFill =
    company === 'ENERGY'
      ? '#fff7ed'
      : company === 'STAR'
        ? '#fef2f2'
        : '#f0f9ff';
  const scopeColor =
    company === 'ENERGY'
      ? '#b45309'
      : company === 'STAR'
        ? '#b91c1c'
        : '#0369a1';
  return [
    {
      table: {
        widths: [7, '*', 178],
        body: [
          [
            {
              text: '',
              fillColor: accent,
              margin: [0, 29, 0, 29],
            },
            {
              stack: [
                {
                  text: 'ENSTRÜMAN BAKIM MÜDÜRLÜĞÜ',
                  fontSize: 7.5,
                  bold: true,
                  characterSpacing: 1.4,
                  color: headerAccent,
                },
                {
                  text: reportTitle(company),
                  fontSize: 20,
                  bold: true,
                  color: COLORS.white,
                  margin: [0, 5, 0, 0],
                },
                {
                  text: reportName.toLocaleUpperCase('tr-TR'),
                  fontSize: 10,
                  bold: true,
                  color: reportTone,
                  margin: [0, 6, 0, 0],
                },
              ],
              fillColor: '#0f172a',
              margin: [16, 13, 10, 13],
            },
            {
              stack: [
                {
                  text:
                    company === 'ENERGY'
                      ? 'ENERJİ / ÇEVRE KRİTİK'
                      : company === 'STAR'
                        ? 'STAR SCE'
                        : 'PETKİM SCE',
                  alignment: 'right',
                  fontSize: 9,
                  bold: true,
                  color: COLORS.white,
                },
                {
                  text:
                    company === 'ENERGY'
                      ? 'BAKIM PERFORMANS RAPORU'
                      : 'PERİYODİK BAKIM RAPORU',
                  alignment: 'right',
                  fontSize: 7,
                  bold: true,
                  color: headerAccent,
                  margin: [0, 7, 0, 0],
                },
                {
                  text: formatReportDate(new Date()),
                  alignment: 'right',
                  fontSize: 8,
                  color: '#cbd5e1',
                  margin: [0, 14, 0, 0],
                },
              ],
              fillColor: '#0f172a',
              margin: [10, 15, 14, 13],
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 7],
    },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              columns: [
                {
                  text: 'KAPSAM',
                  width: 48,
                  fontSize: 7,
                  bold: true,
                  color: scopeColor,
                },
                {
                  text: cleanScope || 'Tüm Fabrikalar',
                  width: '*',
                  fontSize: 8,
                  bold: true,
                  color: COLORS.slate,
                },
              ],
              fillColor: scopeFill,
              margin: [12, 7, 12, 7],
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 5],
    },
  ];
}

function kpiGrid(items: [string, string, string][], accent: string): Content {
  return {
    columns: items.map(([label, value, helper], index) => ({
      width: '*',
      stack: [
        { text: label, fontSize: 8, color: COLORS.slate },
        {
          text: value,
          fontSize: 18,
          bold: true,
          color: index === 0 ? accent : COLORS.navy,
          margin: [0, 5, 0, 0],
        },
        { text: helper, fontSize: 7, color: COLORS.muted, margin: [0, 4, 0, 0] },
      ],
      margin: [10, 9, 10, 9],
      fillColor: COLORS.soft,
    })),
    columnGap: 8,
    margin: [0, 4, 0, 3],
  };
}

function completionChart(rows: CompletionRow[], width: number, accent: string): Content {
  return {
    stack: rows.map((row) => {
      const rate = percent(row.completed, row.total);
      const completedWidth =
        rate > 0 ? Math.max(3, (rate / 100) * width) : 0;
      return {
        margin: [0, 0, 0, 7],
        stack: [
          {
            columns: [
              { text: row.label, width: '*', fontSize: 7.5, color: COLORS.slate },
              {
                text: `${formatNumber(row.completed)} / ${formatNumber(row.total)} · %${rate}`,
                width: 105,
                alignment: 'right',
                fontSize: 7.5,
                bold: true,
                color: COLORS.navy,
              },
            ],
          },
          {
            canvas: [
              { type: 'rect', x: 0, y: 0, w: width, h: 7, r: 3, color: '#e2e8f0' },
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: completedWidth,
                h: 7,
                r: 3,
                color: accent,
              },
            ],
            margin: [0, 3, 0, 0],
          },
        ],
      };
    }),
  };
}

function buildMaintenanceOverviewPage(
  rows: SCEV2DashboardRow[],
  completionRows: CompletionRow[],
  accent: string,
  metrics: ReturnType<typeof buildMetrics>,
  company: SCEV2Company,
): Content {
  const splitIndex = Math.ceil(completionRows.length / 2);
  return {
    pageBreak: 'before',
    stack: [
      sectionTitle(
        company === 'STAR'
          ? 'Konsol Bazlı Tamamlanma Oranları'
          : 'Fabrika Bazlı Tamamlanma Oranları',
      ),
      {
        columns: [
          {
            width: '*',
            stack: [completionChart(completionRows.slice(0, splitIndex), 330, accent)],
          },
          { width: 18, text: '' },
          {
            width: '*',
            stack: [completionChart(completionRows.slice(splitIndex), 330, accent)],
          },
        ],
      },
      {
        stack: [controlStatusOverview(metrics, company)],
        margin: [0, 5, 0, 0],
      },
      deadlinePreviewColumns(rows, company),
    ],
  };
}

function deadlinePreviewColumns(
  rows: SCEV2DashboardRow[],
  company: SCEV2Company,
): Content {
  const overdueRows = rows
    .filter((row) => row.maintenanceDeadlineStatus === 'overdue')
    .sort(compareDeadlineRows);
  const dueSoonRows = rows
    .filter((row) => row.maintenanceDeadlineStatus === 'due_soon')
    .sort(compareDeadlineRows);
  return {
    columns: [
      {
        width: '*',
        stack: [
          deadlinePreviewTable(
            'Overdue Ekipmanlar',
            overdueRows,
            COLORS.rose,
            company,
          ),
        ],
      },
      { width: 18, text: '' },
      {
        width: '*',
        stack: [
          deadlinePreviewTable(
            'Overdue Yaklaşan Ekipmanlar',
            dueSoonRows,
            COLORS.amber,
            company,
          ),
        ],
      },
    ],
    margin: [0, 8, 0, 0],
  };
}

function deadlinePreviewTable(
  title: string,
  rows: SCEV2DashboardRow[],
  color: string,
  company: SCEV2Company,
): Content {
  const previewRows = rows.slice(0, 3);
  return {
    stack: [
      {
        text: `${title} (${formatNumber(rows.length)})`,
        style: 'section',
        color,
      },
      {
        text:
          rows.length > previewRows.length
            ? `Planlanan tarih sırasındaki ilk ${previewRows.length} kayıt gösteriliyor.`
            : 'Planlanan tarih sırasına göre tüm kayıtlar gösteriliyor.',
        style: 'small',
        margin: [0, 0, 0, 6],
      },
      previewRows.length > 0
        ? standardTable(
            [
              company === 'STAR' ? 'Konsol / Ünite' : 'Fabrika',
              'Tag / Ekipman',
              'Planlanan Tarih',
            ],
            previewRows.map((row) => [
              company === 'ENERGY'
                ? energyCriticalFactoryLabel(row.businessArea) || 'Belirsiz'
                : company === 'STAR'
                  ? `${row.consoleName || '—'} / ${row.unit || '—'}`
                  : FACTORY_LABELS[row.factory] ?? row.factory ?? 'Belirsiz',
              row.tagNo || row.equipmentNo || '—',
              formatDate(row.maintenanceDeadlineDate),
            ]),
            [70, 150, 75],
          )
        : emptyNote('Bu kategoride ekipman bulunmuyor.'),
    ],
    unbreakable: true,
  };
}

function vectorBarChart(
  rows: DistributionRow[],
  total: number,
  width: number,
): Content {
  const safeTotal = Math.max(total, 1);
  return {
    stack: rows.map((row) => ({
      margin: [0, 0, 0, 7],
      stack: [
        {
          columns: [
            { text: row.label, width: '*', fontSize: 7.5, color: COLORS.slate },
            {
              text: formatNumber(row.value),
              width: 48,
              alignment: 'right',
              fontSize: 7.5,
              bold: true,
              color: COLORS.navy,
            },
          ],
        },
        {
          canvas: [
            { type: 'rect', x: 0, y: 0, w: width, h: 7, r: 3, color: '#e2e8f0' },
            {
              type: 'rect',
              x: 0,
              y: 0,
              w:
                row.value > 0
                  ? Math.max(3, (row.value / safeTotal) * width)
                  : 0,
              h: 7,
              r: 3,
              color: row.color,
            },
          ],
          margin: [0, 3, 0, 0],
        },
      ],
    })),
  };
}

function controlStatusOverview(
  metrics: ReturnType<typeof buildMetrics>,
  company: SCEV2Company,
): Content {
  const deferralTotal = metrics.deferralStarted + metrics.deferralRequired;
  const calibrationTotal =
    metrics.calibrationShared +
    metrics.calibrationNotShared +
    metrics.calibrationUnknown;
  const deferralRows: DistributionRow[] = [
    {
      label: 'Deferral Başlatıldı',
      value: metrics.deferralStarted,
      color: COLORS.sky,
    },
    {
      label: 'Deferral Başlatılmalı',
      value: metrics.deferralRequired,
      color: COLORS.star,
    },
    ...(company === 'ENERGY'
      ? []
      : [
          {
            label: 'Overdue Aksiyon',
            value: metrics.deferralOverdue,
            color: COLORS.amber,
          },
        ]),
  ];
  return {
    stack: [
      sectionTitle('Deferral ve Kalibrasyon Takibi'),
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                columns: [
                  {
                    text: 'Duruşa Ertelenen Siparişlerin Deferral Durumu',
                    width: '*',
                    fontSize: 8,
                    bold: true,
                    color: COLORS.navy,
                  },
                  {
                    text:
                      company === 'ENERGY'
                        ? `%${percent(metrics.deferralStarted, deferralTotal)} başlatıldı`
                        : `%${percent(metrics.deferralStarted, deferralTotal)} başlatıldı\nOverdue: ${metrics.deferralOverdue}`,
                    width: 82,
                    alignment: 'right',
                    fontSize: 7.5,
                    bold: true,
                    color: COLORS.sky,
                  },
                ],
                margin: [0, 0, 0, 6],
              },
              vectorBarChart(deferralRows, deferralTotal, 330),
            ],
            fillColor: '#f8fafc',
            margin: [10, 9, 10, 5],
          },
          {
            width: '*',
            stack: [
              {
                columns: [
                  {
                    text: 'Tamamlanan Bakımların Kalibrasyon Raporu',
                    width: '*',
                    fontSize: 8,
                    bold: true,
                    color: COLORS.navy,
                  },
                  {
                    text: `%${percent(metrics.calibrationShared, calibrationTotal)} paylaşıldı`,
                    width: 82,
                    alignment: 'right',
                    fontSize: 7.5,
                    bold: true,
                    color: COLORS.green,
                  },
                ],
                margin: [0, 0, 0, 6],
              },
              vectorBarChart(
                [
                  {
                    label: 'Paylaşıldı',
                    value: metrics.calibrationShared,
                    color: COLORS.green,
                  },
                  {
                    label: 'Paylaşılmadı',
                    value: metrics.calibrationNotShared,
                    color: COLORS.rose,
                  },
                  {
                    label: 'Bilgi Bekleniyor',
                    value: metrics.calibrationUnknown,
                    color: COLORS.gray,
                  },
                ],
                calibrationTotal,
                330,
              ),
            ],
            fillColor: '#f8fafc',
            margin: [10, 9, 10, 5],
          },
        ],
        columnGap: 10,
      },
    ],
    margin: [0, 2, 0, 0],
    unbreakable: true,
  };
}

function equipmentTable(
  rows: SCEV2DashboardRow[],
  company: SCEV2Company,
): Content {
  const groupHeader =
    company === 'STAR'
      ? 'Konsol / Ünite'
      : company === 'ENERGY'
        ? 'Fabrika'
        : 'Fabrika';
  return standardTable(
    [
      groupHeader,
      'Ekipman',
      'Tag / Teknik Birim',
      'Ekipman Tipi',
      'Sipariş',
      'SAP Durumu',
      'Bakım Başlangıç',
      'Bakım Bitiş',
      'Bakım Durumu',
      'Planlanan Tarih',
      'Termin Durumu',
      'Deferral',
      'Kalibrasyon',
    ],
    rows.map((row) => [
      company === 'STAR'
        ? `${row.consoleName || '—'} / ${row.unit || '—'}`
        : company === 'ENERGY'
          ? energyCriticalFactoryLabel(row.businessArea) || 'Belirsiz'
          : FACTORY_LABELS[row.factory] ?? row.factory,
      row.equipmentNo || '—',
      row.tagNo || '—',
      row.equipmentType || '—',
      row.orderNo || '—',
      row.userStatus || '—',
      formatDate(row.maintenanceStartDate),
      formatDate(row.maintenanceEndDate),
      maintenanceLabel(row),
      formatDate(row.maintenanceDeadlineDate),
      maintenanceDeadlineLabel(row),
      deferralLabel(row),
      calibrationLabel(row),
    ]),
    [
      48, 48, 58, 70, 45, 44, 45, 45, 54, 48, 52, 45, 48,
    ],
  );
}

function standardTable(
  headers: string[],
  rows: string[][],
  widths: number[],
): Content {
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths,
      body: [
        headers.map((header): TableCell => ({
          text: header,
          style: 'tableHeader',
          fillColor: COLORS.navy,
          margin: [3, 5, 3, 5],
        })),
        ...rows.map((row, index) =>
          row.map((cell): TableCell => ({
            text: cell,
            style: 'tableCell',
            fillColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
            margin: [3, 3, 3, 3],
          })),
        ),
      ],
    },
    layout: {
      hLineColor: () => COLORS.line,
      vLineColor: () => COLORS.line,
      hLineWidth: () => 0.55,
      vLineWidth: () => 0.55,
    },
  };
}

function sectionTitle(text: string): Content {
  return { text, style: 'section' };
}

function emptyNote(text: string): Content {
  return { text, style: 'small', italics: true, margin: [0, 4, 0, 6] };
}

function buildMetrics(rows: SCEV2DashboardRow[]) {
  return {
    total: rows.length,
    completed: rows.filter(
      (row) => row.maintenanceStatus === 'completed' && !isNotInProgram(row),
    ).length,
    deferred: rows.filter(
      (row) =>
        row.maintenanceStatus === 'shutdown_deferred' && !isNotInProgram(row),
    ).length,
    notCompleted: rows.filter(
      (row) =>
        row.maintenanceStatus === 'maintenance_not_completed' &&
        !isNotInProgram(row),
    ).length,
    orderNotFound: rows.filter(
      (row) =>
        row.maintenanceStatus === 'order_not_found' && !isNotInProgram(row),
    ).length,
    notInProgram: rows.filter(isNotInProgram).length,
    deferralStarted: rows.filter((row) => row.deferralStatus === 'started').length,
    deferralRequired: rows.filter((row) => row.deferralStatus === 'required').length,
    deferralOverdue: rows.filter((row) => row.deferralIsOverdue).length,
    maintenanceOverdue: rows.filter(
      (row) => row.maintenanceDeadlineStatus === 'overdue',
    ).length,
    maintenanceDueSoon: rows.filter(
      (row) => row.maintenanceDeadlineStatus === 'due_soon',
    ).length,
    maintenanceOnTrack: rows.filter(
      (row) => row.maintenanceDeadlineStatus === 'on_track',
    ).length,
    calibrationShared: rows.filter((row) => row.calibrationStatus === 'shared').length,
    calibrationNotShared: rows.filter(
      (row) => row.calibrationStatus === 'not_shared',
    ).length,
    calibrationUnknown: rows.filter(
      (row) => row.calibrationStatus === 'unknown',
    ).length,
  };
}

function isNotInProgram(row: SCEV2DashboardRow) {
  if (row.company === 'STAR') {
    return Boolean(row.maintenancePlanNo?.trim()) && !row.revision?.trim();
  }
  return (
    row.maintenanceStatus === 'order_not_found' &&
    Boolean(row.maintenancePlanNo?.trim()) &&
    !row.revision?.trim()
  );
}

function buildCompletionRows(
  rows: SCEV2DashboardRow[],
  company: SCEV2Company,
): CompletionRow[] {
  const groups = new Map<string, SCEV2DashboardRow[]>();
  for (const row of rows) {
    const key =
      company === 'STAR'
        ? row.consoleName || 'Konsol Belirsiz'
        : company === 'ENERGY'
          ? energyCriticalFactoryLabel(row.businessArea) || 'Fabrika Belirsiz'
          : (FACTORY_LABELS[row.factory] ?? row.factory) || 'Fabrika Belirsiz';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([label, groupRows]) => ({
      label,
      total: groupRows.length,
      completed: groupRows.filter(
        (row) => row.maintenanceStatus === 'completed' && !isNotInProgram(row),
      ).length,
      deferred: groupRows.filter(
        (row) =>
          row.maintenanceStatus === 'shutdown_deferred' && !isNotInProgram(row),
      ).length,
      notCompleted: groupRows.filter(
        (row) =>
          row.maintenanceStatus === 'maintenance_not_completed' &&
          !isNotInProgram(row),
      ).length,
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, 'tr', { numeric: true }),
    );
}

function maintenanceLabel(row: SCEV2DashboardRow) {
  if (row.maintenanceStatus === 'completed') return 'Tamamlandı';
  if (row.maintenanceStatus === 'shutdown_deferred') return 'Duruşa Ertelendi';
  if (row.maintenanceStatus === 'order_not_found') return 'Sipariş Kaydı Yok';
  return 'Bakımı Yapılmadı';
}

function deferralLabel(row: SCEV2DashboardRow) {
  const overdue = row.deferralIsOverdue
    ? ` · Overdue ${formatDate(row.deferralOverdueDate)}`
    : '';
  if (row.deferralStatus === 'started') return `Başlatıldı${overdue}`;
  if (row.deferralStatus === 'required') return `Başlatılmalı${overdue}`;
  return 'Gerekmez';
}

function maintenanceDeadlineLabel(row: SCEV2DashboardRow) {
  return {
    not_applicable: 'Uygulanmaz',
    completed: 'Tamamlandı',
    overdue: 'Overdue',
    due_soon: 'Overdue Yaklaşıyor',
    on_track: 'Takviminde',
  }[row.maintenanceDeadlineStatus];
}

function calibrationLabel(row: SCEV2DashboardRow) {
  if (row.calibrationStatus === 'shared') return 'Paylaşıldı';
  if (row.calibrationStatus === 'not_shared') return 'Paylaşılmadı';
  if (row.calibrationStatus === 'not_applicable') return 'Uygulanmaz';
  return 'Bilgi Bekleniyor';
}

function compareDeadlineRows(
  left: SCEV2DashboardRow,
  right: SCEV2DashboardRow,
) {
  return (
    (left.maintenanceDeadlineDate?.getTime() ?? Infinity) -
      (right.maintenanceDeadlineDate?.getTime() ?? Infinity) ||
    left.factory.localeCompare(right.factory, 'tr', { numeric: true }) ||
    left.equipmentNo.localeCompare(right.equipmentNo, 'tr', { numeric: true })
  );
}

function compareActionRows(left: SCEV2DashboardRow, right: SCEV2DashboardRow) {
  const deadlinePriority = (row: SCEV2DashboardRow) => {
    if (row.maintenanceDeadlineStatus === 'overdue') return 0;
    if (row.maintenanceDeadlineStatus === 'due_soon') return 1;
    return 2;
  };
  return (
    deadlinePriority(left) - deadlinePriority(right) ||
    maintenanceLabel(left).localeCompare(maintenanceLabel(right), 'tr') ||
    left.factory.localeCompare(right.factory, 'tr', { numeric: true }) ||
    left.equipmentNo.localeCompare(right.equipmentNo, 'tr', { numeric: true })
  );
}

function companyLabel(company: SCEV2Company) {
  if (company === 'STAR') return 'Star';
  if (company === 'ENERGY') return 'Enerji Kritik';
  return 'Petkim';
}

function reportProductLabel(company: SCEV2Company) {
  return company === 'ENERGY'
    ? 'Enerji / Çevre Kritik'
    : `${companyLabel(company)} SCE`;
}

function reportTitle(company: SCEV2Company) {
  if (company === 'ENERGY') {
    return 'Enerji/Çevre Kritik Ekipman Bakımları Raporu';
  }
  if (company === 'PETKIM') {
    return 'Petkim SCE Ekipman Bakımları Raporu';
  }
  return 'Star SCE Ekipman Bakımları Raporu';
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
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
