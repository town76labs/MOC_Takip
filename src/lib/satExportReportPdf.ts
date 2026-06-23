import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from 'pdfmake/interfaces';
import type { SATExportRow } from '../types';
import {
  getUniqueSATItemRows,
  sumSATItemUsd,
} from './satExportMetrics';

export type SATExportReportType =
  | 'executive'
  | 'performance'
  | 'delivery_risk'
  | 'detail';

interface SATExportReportOptions {
  rows: SATExportRow[];
  type: SATExportReportType;
  scopeLabel: string;
}

interface ReportDocument {
  satNo: string;
  creator: string;
  totalSatUsd: number;
  createdAt: Date | null;
  status: string;
  approval: string;
  rows: SATExportRow[];
}

interface DistributionRow {
  label: string;
  value: number;
  amount?: number;
}

const REPORT_NAMES: Record<SATExportReportType, string> = {
  executive: 'Yönetici Özeti',
  performance: 'Süreç Performans Raporu',
  delivery_risk: 'Teslimat ve Risk Raporu',
  detail: 'Detaylı SAT Dökümü',
};

const COLORS = {
  navy: '#0f172a',
  slate: '#475569',
  line: '#cbd5e1',
  soft: '#f1f5f9',
  cyan: '#0891b2',
  teal: '#0f766e',
  purple: '#7c3aed',
  orange: '#ea580c',
  amber: '#d97706',
  red: '#dc2626',
  green: '#16a34a',
};

const styles: StyleDictionary = {
  title: { fontSize: 21, bold: true, color: COLORS.navy },
  subtitle: { fontSize: 10, color: COLORS.slate, margin: [0, 5, 0, 0] },
  section: {
    fontSize: 13,
    bold: true,
    color: COLORS.navy,
    margin: [0, 16, 0, 7],
  },
  tableHeader: { bold: true, color: '#ffffff', fontSize: 8 },
  tableCell: { fontSize: 7.5, color: '#334155' },
  small: { fontSize: 7, color: '#64748b' },
};

export async function downloadSATExportReportPdf({
  rows,
  type,
  scopeLabel,
}: SATExportReportOptions) {
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
  const definition = buildSATExportReportDefinition(rows, type, scopeLabel);
  const filename = `${slugify(`sat-${REPORT_NAMES[type]}-${scopeLabel}`)}.pdf`;
  await pdfMake.createPdf(definition).download(filename);
}

export function buildSATExportReportDefinition(
  rows: SATExportRow[],
  type: SATExportReportType,
  scopeLabel: string,
): TDocumentDefinitions {
  const documents = buildDocuments(rows);
  const content =
    type === 'executive'
      ? buildExecutiveReport(rows, documents, scopeLabel)
      : type === 'performance'
        ? buildPerformanceReport(rows, documents, scopeLabel)
        : type === 'delivery_risk'
          ? buildDeliveryRiskReport(rows, documents, scopeLabel)
          : buildDetailReport(rows, documents, scopeLabel);
  const landscape = type === 'delivery_risk' || type === 'detail';
  return {
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: landscape ? [30, 34, 30, 34] : [38, 38, 38, 38],
    info: {
      title: `SAT Takip - ${REPORT_NAMES[type]}`,
      author: 'Enstrüman Bakım Müdürlüğü',
      subject: scopeLabel,
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#334155' },
    styles,
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: 'Enstrüman Bakım Müdürlüğü · SAT Takip',
          alignment: 'left',
        },
        {
          text: `${currentPage} / ${pageCount}`,
          alignment: 'right',
        },
      ],
      margin: landscape ? [30, 8, 30, 0] : [38, 8, 38, 0],
      fontSize: 7,
      color: '#94a3b8',
    }),
  };
}

function buildExecutiveReport(
  rows: SATExportRow[],
  documents: ReportDocument[],
  scopeLabel: string,
): Content[] {
  const itemRows = getUniqueSATItemRows(rows);
  const risks = deliveryRiskRows(rows);
  const openDocuments = documents.filter((document) => !isDocumentComplete(document));
  const aged = openDocuments.filter((document) => ageDays(document.createdAt) > 60);
  const funnel = buildFunnel(documents);
  const materialGroups = buildMaterialGroups(rows).slice(0, 8);
  const processStatus = topWithOther(
    countDocuments(
      documents,
      (document) => document.status || 'Durum Girilmemiş',
    ),
    6,
  );
  const critical = [...openDocuments]
    .sort(
      (a, b) =>
        ageDays(b.createdAt) - ageDays(a.createdAt) ||
        b.totalSatUsd - a.totalSatUsd,
    )
    .slice(0, 10);
  return [
    ...reportHeading(REPORT_NAMES.executive, scopeLabel),
    kpiGrid([
      ['Tekil SAT', formatNumber(documents.length), 'Belge'],
      ['SAT Kalemi', formatNumber(itemRows.length), 'Tekil C + D kalemi'],
      ['Toplam SAT', formatCompactUsd(sum(documents.map((item) => item.totalSatUsd))), 'USD'],
      ['SAS Tutarı', formatCompactUsd(sum(rows.map((item) => item.sasUsdAmount))), 'USD'],
      ['60+ Gün Açık', formatNumber(aged.length), 'SAT belgesi'],
      ['Gecikmiş Teslimat', formatNumber(risks.overdue.length), formatUsd(risks.overdueUsd)],
    ]),
    sectionTitle('Yönetim Notları'),
    callout([
      `${openDocuments.length} açık SAT belgesinin ${aged.length} adedi 60 günden uzun süredir bekliyor.`,
      `${risks.overdue.length} kalemin teslim tarihi geçmiş; gecikmiş SAS tutarı ${formatUsd(risks.overdueUsd)}.`,
      `${risks.missing.length} açık kalemde teslim tarihi bulunmuyor.`,
    ]),
    sectionTitle('Süreç Durumu Görsel Özeti'),
    vectorDonutChart(processStatus, {
      total: documents.length,
      centerLabel: 'SAT',
      centerValue: formatNumber(documents.length),
    }),
    sectionTitle('Satınalma Süreç Hunisi'),
    funnelTable(funnel),
    sectionTitle('Mal Grubu Pareto Özeti'),
    vectorBarChart(materialGroups, {
      total: itemRows.length,
      width: 450,
      color: COLORS.cyan,
      cumulative: true,
      valueFormatter: (item, cumulative) =>
        `${formatNumber(item.value)} kalem · ${percent(item.value, itemRows.length)} · Küm. ${percent(cumulative, itemRows.length)} · ${formatUsd(item.amount ?? 0)}`,
    }),
    sectionTitle('Öncelikli Açık SAT Belgeleri'),
    standardTable(
      ['SAT No', 'SAT Yaratan', 'Özet Durum', 'Bekleme', 'SAT USD'],
      critical.map((document) => [
        document.satNo,
        document.creator || '—',
        document.status || 'Durum Girilmemiş',
        document.createdAt ? `${ageDays(document.createdAt)} gün` : 'Tarih yok',
        formatUsd(document.totalSatUsd),
      ]),
      ['auto', '*', '*', 52, 80],
    ),
  ];
}

function buildPerformanceReport(
  rows: SATExportRow[],
  documents: ReportDocument[],
  scopeLabel: string,
): Content[] {
  const itemRows = getUniqueSATItemRows(rows);
  const statuses = countDocuments(documents, (document) => document.status || 'Durum Girilmemiş');
  const creators = countDocuments(documents, (document) => document.creator || 'Atanmamış').slice(0, 10);
  const sasCreators = countRowsAsDocuments(
    documents,
    (row) => row.sasCreator || 'Atanmamış',
  ).slice(0, 10);
  const aging = buildAging(documents);
  const monthly = buildMonthly(documents);
  return [
    ...reportHeading(REPORT_NAMES.performance, scopeLabel),
    kpiGrid([
      ['SAT Belgesi', formatNumber(documents.length), 'Tekil belge'],
      ['Tamamlanan Kalem', formatNumber(itemRows.filter((row) => row.completed).length), percent(itemRows.filter((row) => row.completed).length, itemRows.length)],
      ['Teslimat Tamam', formatNumber(itemRows.filter((row) => row.lastDelivery).length), percent(itemRows.filter((row) => row.lastDelivery).length, itemRows.length)],
      ['Fatura Tamam', formatNumber(itemRows.filter((row) => row.lastInvoice).length), percent(itemRows.filter((row) => row.lastInvoice).length, itemRows.length)],
    ]),
    sectionTitle('Süreç Durum Dağılımı'),
    vectorDonutChart(topWithOther(statuses, 6), {
      total: documents.length,
      centerLabel: 'Belge',
      centerValue: formatNumber(documents.length),
    }),
    sectionTitle('SAT - SAS - Teslimat - Fatura Dönüşümü'),
    funnelTable(buildFunnel(documents)),
    sectionTitle('Açık SAT Yaşlandırma'),
    vectorBarChart(aging, {
      total: sum(aging.map((item) => item.value)),
      width: 450,
      color: COLORS.orange,
    }),
    sectionTitle('Aylık SAT Oluşturma Trendi'),
    distributionTable(monthly, documents.length, 'SAT Belgesi'),
    {
      columns: [
        {
          width: '*',
          stack: [
            sectionTitle('SAT Yaratan İş Yükü'),
            distributionTable(creators, documents.length, 'SAT Belgesi'),
          ],
        },
        { width: 12, text: '' },
        {
          width: '*',
          stack: [
            sectionTitle('SAS Yaratan İş Yükü'),
            distributionTable(sasCreators, documents.length, 'SAT Belgesi'),
          ],
        },
      ],
      columnGap: 0,
    },
  ];
}

function buildDeliveryRiskReport(
  rows: SATExportRow[],
  documents: ReportDocument[],
  scopeLabel: string,
): Content[] {
  const risks = deliveryRiskRows(rows);
  const riskRows = [...risks.overdue, ...risks.next7, ...risks.next30, ...risks.missing];
  const groups: DistributionRow[] = [
    { label: 'Gecikmiş', value: risks.overdue.length, amount: risks.overdueUsd },
    { label: 'Önümüzdeki 7 Gün', value: risks.next7.length },
    { label: '8–30 Gün', value: risks.next30.length },
    { label: 'Teslim Tarihi Yok', value: risks.missing.length },
  ];
  const highestOverdue = risks.overdue
    .filter((item) => item.row.sasUsdAmount > 0)
    .sort((a, b) => b.row.sasUsdAmount - a.row.sasUsdAmount)
    .slice(0, 8)
    .map((item) => ({
      label: `${item.row.satNo} · ${shortText(item.row.materialDescription || item.row.material, 46)}`,
      value: item.row.sasUsdAmount,
    }));
  return [
    ...reportHeading(REPORT_NAMES.delivery_risk, scopeLabel),
    kpiGrid([
      ['Gecikmiş Kalem', formatNumber(risks.overdue.length), formatUsd(risks.overdueUsd)],
      ['7 Gün İçinde', formatNumber(risks.next7.length), 'Açık kalem'],
      ['8–30 Gün', formatNumber(risks.next30.length), 'Açık kalem'],
      ['Tarihi Olmayan', formatNumber(risks.missing.length), 'Veri kalitesi riski'],
    ]),
    sectionTitle('Teslimat Risk Dağılımı'),
    vectorDonutChart(groups, {
      total: riskRows.length,
      centerLabel: 'Riskli Kalem',
      centerValue: formatNumber(riskRows.length),
    }),
    sectionTitle('En Yüksek Gecikmiş SAS Tutarları'),
    highestOverdue.length
      ? vectorBarChart(highestOverdue, {
          width: 690,
          color: COLORS.amber,
          currency: true,
        })
      : callout(['SAS tutarı bulunan gecikmiş kalem yok.']),
    sectionTitle('Riskli Kalem Detayı'),
    standardTable(
      ['Risk', 'SAT No', 'SAT Yaratan', 'Malzeme / Tanım', 'Mal Grubu', 'Satıcı', 'SAS Yaratan', 'Teslim', 'Gecikme', 'SAS USD'],
      riskRows.map((item) => [
        item.risk,
        item.row.satNo,
        item.row.satCreator || '—',
        joinMaterial(item.row),
        item.row.materialGroup || '—',
        item.row.vendorName || '—',
        item.row.sasCreator || '—',
        formatDate(item.row.deliveryDate),
        item.daysLate === null ? '—' : `${item.daysLate} gün`,
        formatUsd(item.row.sasUsdAmount),
      ]),
      [50, 46, 58, '*', 68, 65, 55, 48, 40, 55],
      6.4,
    ),
    {
      text: `Not: Bu rapor ${formatNumber(documents.length)} tekil SAT belgesi içinden son teslimatı tamamlanmamış kalemleri gösterir.`,
      style: 'small',
      margin: [0, 8, 0, 0],
    },
  ];
}

function buildDetailReport(
  rows: SATExportRow[],
  documents: ReportDocument[],
  scopeLabel: string,
): Content[] {
  const itemRows = getUniqueSATItemRows(rows);
  const materialGroups = buildMaterialGroups(rows);
  return [
    ...reportHeading(REPORT_NAMES.detail, scopeLabel),
    kpiGrid([
      ['SAT Belgesi', formatNumber(documents.length), 'Tekil belge'],
      ['SAT Kalemi', formatNumber(itemRows.length), `${formatNumber(rows.length)} SAT/SAS satırı`],
      ['Toplam SAT', formatCompactUsd(sum(documents.map((item) => item.totalSatUsd))), 'USD'],
      ['Toplam SAS', formatCompactUsd(sum(rows.map((item) => item.sasUsdAmount))), 'USD'],
    ]),
    sectionTitle('Mal Grubu Görsel Dağılımı'),
    vectorDonutChart(topWithOther(materialGroups, 6), {
      total: itemRows.length,
      centerLabel: 'SAT Kalemi',
      centerValue: formatNumber(itemRows.length),
    }),
    { text: 'SAT Kalemleri', style: 'section', pageBreak: 'before' },
    standardTable(
      ['SAT No', 'Kalem', 'Miktar', 'Şirket', 'Yaratılma', 'SAT Yaratan', 'Mal Grubu', 'Malzeme / Tanım', 'Özet Durum', 'SAS Yaratan', 'Satıcı', 'Teslim', 'Kalem SAT USD', 'SAS USD'],
      [...rows]
        .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
        .map((row) => [
          row.satNo,
          row.satItemNo || '—',
          formatNumber(row.satQuantity),
          row.companyCode || '—',
          formatDate(row.createdAt),
          row.satCreator || '—',
          row.materialGroup || '—',
          joinMaterial(row),
          row.summaryStatus || 'Durum Girilmemiş',
          row.sasCreator || '—',
          row.vendorName || '—',
          formatDate(row.deliveryDate),
          formatUsd(row.satItemUsd),
          formatUsd(row.sasUsdAmount),
        ]),
      [42, 29, 32, 34, 44, 48, 58, '*', 54, 48, 54, 44, 53, 50],
      5.7,
    ),
  ];
}

function reportHeading(title: string, scopeLabel: string): Content[] {
  return [
    {
      columns: [
        {
          stack: [
            { text: 'Enstrüman Bakım Müdürlüğü', color: COLORS.cyan, bold: true, fontSize: 9 },
            { text: title, style: 'title' },
            { text: `Kapsam: ${scopeLabel}`, style: 'subtitle' },
          ],
        },
        {
          width: 120,
          stack: [
            { text: 'SAT TAKİP', alignment: 'right', bold: true, color: COLORS.navy },
            { text: formatReportDate(new Date()), alignment: 'right', style: 'small', margin: [0, 5, 0, 0] },
          ],
        },
      ],
    },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: COLORS.line }],
      margin: [0, 12, 0, 12],
    },
  ];
}

function kpiGrid(items: [string, string, string][]): Content {
  const cells: TableCell[] = items.map(([label, value, helper]) => ({
    stack: [
      { text: label, fontSize: 7.5, color: COLORS.slate },
      { text: value, fontSize: 16, bold: true, color: COLORS.navy, margin: [0, 5, 0, 2] },
      { text: helper, fontSize: 6.8, color: '#94a3b8' },
    ],
    fillColor: COLORS.soft,
    margin: [7, 7, 7, 7],
  }));
  const columns = items.length >= 6 ? 3 : items.length;
  const body: TableCell[][] = [];
  for (let index = 0; index < cells.length; index += columns) {
    body.push(cells.slice(index, index + columns));
  }
  return {
    table: { widths: Array(columns).fill('*'), body },
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

function callout(lines: string[]): Content {
  return {
    table: {
      widths: ['*'],
      body: [[{ ul: lines, fillColor: '#ecfeff', color: '#155e75', margin: [8, 7, 8, 7] }]],
    },
    layout: {
      hLineColor: () => '#a5f3fc',
      vLineColor: () => '#a5f3fc',
    },
  };
}

function funnelTable(
  stages: { label: string; count: number; totalUsd: number; color: string }[],
): Content {
  const base = stages[0]?.count || 1;
  return {
    table: {
      headerRows: 1,
      widths: ['*', 55, 62, 88],
      body: [
        tableHeader(['Aşama', 'Belge', 'Dönüşüm', 'SAT USD']),
        ...stages.map((stage) => [
          { text: stage.label, bold: true, color: stage.color },
          formatNumber(stage.count),
          percent(stage.count, base),
          formatUsd(stage.totalUsd),
        ]),
      ],
    },
    layout: 'lightHorizontalLines',
  };
}

function vectorDonutChart(
  rows: DistributionRow[],
  options: { total?: number; centerLabel: string; centerValue: string },
): Content {
  const chartRows = rows.filter((item) => item.value > 0);
  if (chartRows.length === 0) return callout(['Grafik için veri bulunamadı.']);
  const total = options.total ?? sum(chartRows.map((item) => item.value));
  const colors = [
    COLORS.cyan,
    COLORS.purple,
    COLORS.orange,
    COLORS.green,
    COLORS.red,
    '#2563eb',
    '#64748b',
  ];
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = chartRows
    .map((item, index) => {
      const length = total ? (item.value / total) * circumference : 0;
      const gap = Math.min(1.5, length * 0.2);
      const segment = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="28" stroke-dasharray="${Math.max(length - gap, 0.2)} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"/>`;
      offset += length;
      return segment;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="28"/>${segments}<circle cx="80" cy="80" r="34" fill="#ffffff"/></svg>`;
  const legendBody: TableCell[][] = chartRows.map((item, index) => [
    {
      canvas: [
        {
          type: 'rect',
          x: 0,
          y: 1,
          w: 8,
          h: 8,
          color: colors[index % colors.length],
        },
      ],
    },
    { text: item.label, fontSize: 8, color: COLORS.navy },
    {
      text: `${formatNumber(item.value)} · ${percent(item.value, total)}`,
      alignment: 'right',
      fontSize: 8,
      color: COLORS.slate,
    },
  ]);
  return {
    columns: [
      { width: 165, svg, fit: [150, 150], margin: [8, 0, 0, 0] },
      {
        width: '*',
        stack: [
          {
            columns: [
              { text: options.centerLabel, bold: true, color: COLORS.slate },
              {
                text: options.centerValue,
                alignment: 'right',
                bold: true,
                fontSize: 15,
                color: COLORS.navy,
              },
            ],
            margin: [0, 3, 0, 7],
          },
          {
            table: { widths: [12, '*', 70], body: legendBody },
            layout: 'noBorders',
          },
        ],
      },
    ],
    columnGap: 14,
  };
}

function vectorBarChart(
  rows: DistributionRow[],
  options: {
    width: number;
    color: string;
    total?: number;
    currency?: boolean;
    cumulative?: boolean;
    valueFormatter?: (item: DistributionRow, cumulative: number) => string;
  },
): Content {
  if (rows.length === 0) return callout(['Grafik için veri bulunamadı.']);
  const max = Math.max(...rows.map((item) => item.value), 1);
  const total = options.total ?? sum(rows.map((item) => item.value));
  let cumulative = 0;
  const body: TableCell[][] = rows.map((item): TableCell[] => {
    cumulative += item.value;
    const valueText = options.valueFormatter
      ? options.valueFormatter(item, cumulative)
      : options.currency
        ? formatUsd(item.value)
        : `${formatNumber(item.value)} · ${percent(item.value, total)}`;
    return [
      {
        stack: [
          {
            columns: [
              {
                text: item.label,
                bold: true,
                fontSize: 8,
                color: COLORS.navy,
              },
              {
                text: valueText,
                alignment: 'right',
                fontSize: 7.5,
                color: COLORS.slate,
              },
            ],
          },
          {
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: options.width,
                h: 8,
                color: '#e2e8f0',
              },
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: Math.max(2, (item.value / max) * options.width),
                h: 8,
                color: options.color,
              },
            ],
            margin: [0, 4, 0, 0],
          },
        ],
        margin: [0, 3, 0, 3],
      },
    ];
  });
  return {
    table: { widths: ['*'], body },
    layout: 'noBorders',
  };
}

function distributionTable(
  rows: DistributionRow[],
  total: number,
  valueLabel: string,
  showAmount = false,
): Content {
  const max = Math.max(...rows.map((item) => item.value), 1);
  const widths: (number | string)[] = ['*', 55, 48, 85];
  if (showAmount) widths.push(75);
  return {
    table: {
      headerRows: 1,
      widths,
      body: [
        tableHeader([
          'Kategori',
          valueLabel,
          'Pay',
          'Görsel Dağılım',
          ...(showAmount ? ['SAS USD'] : []),
        ]),
        ...rows.map((item) => [
          item.label,
          formatNumber(item.value),
          percent(item.value, total),
          barCell(item.value, max),
          ...(showAmount ? [formatUsd(item.amount ?? 0)] : []),
        ]),
      ],
    },
    layout: 'lightHorizontalLines',
  };
}

function standardTable(
  headers: string[],
  rows: string[][],
  widths: (number | string)[],
  fontSize = 7.5,
): Content {
  const body: TableCell[][] = [
    tableHeader(headers),
    ...rows.map((row, rowIndex): TableCell[] =>
      row.map((value): TableCell => ({
        text: value || '—',
        fontSize,
        color: '#334155',
        fillColor: rowIndex % 2 ? '#f8fafc' : '#ffffff',
        margin: [2, 3, 2, 3],
      })),
    ),
  ];
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths,
      body,
    },
    layout: {
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0',
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
  };
}

function tableHeader(labels: string[]): TableCell[] {
  return labels.map((label) => ({
    text: label,
    style: 'tableHeader',
    fillColor: COLORS.navy,
    margin: [2, 4, 2, 4],
  }));
}

function barCell(value: number, max: number): TableCell {
  return {
    canvas: [
      { type: 'rect', x: 0, y: 0, w: 70, h: 6, color: '#e2e8f0' },
      {
        type: 'rect',
        x: 0,
        y: 0,
        w: Math.max(1, (value / max) * 70),
        h: 6,
        color: COLORS.cyan,
      },
    ],
    margin: [0, 4, 0, 0],
  };
}

function buildDocuments(rows: SATExportRow[]): ReportDocument[] {
  const documents = new Map<string, ReportDocument>();
  rows.forEach((row) => {
    const current = documents.get(row.satNo) ?? {
      satNo: row.satNo,
      creator: row.satCreator,
      totalSatUsd: 0,
      createdAt: row.createdAt,
      status: row.summaryStatus,
      approval: row.approvalStatusDescription,
      rows: [],
    };
    current.rows.push(row);
    if (!current.status && row.summaryStatus) current.status = row.summaryStatus;
    documents.set(row.satNo, current);
  });
  return [...documents.values()].map((document) => ({
    ...document,
    totalSatUsd: sumSATItemUsd(document.rows),
  }));
}

function buildMaterialGroups(rows: SATExportRow[]): DistributionRow[] {
  const groups = new Map<string, DistributionRow>();
  getUniqueSATItemRows(rows).forEach((row) => {
    const label = row.materialGroup || 'Mal Grubu Yok';
    const current = groups.get(label) ?? { label, value: 0, amount: 0 };
    current.value += 1;
    groups.set(label, current);
  });
  rows.forEach((row) => {
    const label = row.materialGroup || 'Mal Grubu Yok';
    const current = groups.get(label) ?? { label, value: 0, amount: 0 };
    current.amount = (current.amount ?? 0) + row.sasUsdAmount;
    groups.set(label, current);
  });
  return [...groups.values()].sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'),
  );
}

function topWithOther(rows: DistributionRow[], limit: number) {
  const sorted = [...rows].sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'),
  );
  const top = sorted.slice(0, limit).map((item) => ({ ...item }));
  const remaining = sorted.slice(limit);
  if (remaining.length > 0) {
    top.push({
      label: `Diğer (${remaining.length} kategori)`,
      value: sum(remaining.map((item) => item.value)),
      amount: sum(remaining.map((item) => item.amount ?? 0)),
    });
  }
  return top;
}

function countDocuments(
  documents: ReportDocument[],
  getLabel: (document: ReportDocument) => string,
): DistributionRow[] {
  const counts = new Map<string, number>();
  documents.forEach((document) => {
    const label = getLabel(document);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return toDistributionRows(counts);
}

function countRowsAsDocuments(
  documents: ReportDocument[],
  getLabel: (row: SATExportRow) => string,
): DistributionRow[] {
  const counts = new Map<string, number>();
  documents.forEach((document) => {
    new Set(document.rows.map(getLabel)).forEach((label) =>
      counts.set(label, (counts.get(label) ?? 0) + 1),
    );
  });
  return toDistributionRows(counts);
}

function toDistributionRows(counts: Map<string, number>) {
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

function buildAging(documents: ReportDocument[]): DistributionRow[] {
  const buckets: DistributionRow[] = [
    { label: '0–15 Gün', value: 0 },
    { label: '16–30 Gün', value: 0 },
    { label: '31–60 Gün', value: 0 },
    { label: '60+ Gün', value: 0 },
    { label: 'Tarih Yok', value: 0 },
  ];
  documents
    .filter((document) => !isDocumentComplete(document))
    .forEach((document) => {
      if (!document.createdAt) buckets[4].value += 1;
      else {
        const days = ageDays(document.createdAt);
        if (days <= 15) buckets[0].value += 1;
        else if (days <= 30) buckets[1].value += 1;
        else if (days <= 60) buckets[2].value += 1;
        else buckets[3].value += 1;
      }
    });
  return buckets;
}

function buildMonthly(documents: ReportDocument[]): DistributionRow[] {
  const counts = new Map<string, number>();
  documents.forEach((document) => {
    if (!document.createdAt) return;
    const key = `${document.createdAt.getFullYear()}-${String(document.createdAt.getMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        label: new Date(year, month - 1, 1).toLocaleDateString('tr-TR', {
          month: 'long',
          year: 'numeric',
        }),
        value,
      };
    });
}

function buildFunnel(documents: ReportDocument[]) {
  const created = documents;
  const processing = created.filter(
    (document) =>
      document.status || document.rows.some((row) => row.sasUsdAmount > 0),
  );
  const ordered = processing.filter((document) =>
    document.rows.some(
      (row) => row.sasUsdAmount > 0 || row.lastDelivery || row.lastInvoice,
    ),
  );
  const delivered = ordered.filter((document) =>
    document.rows.some((row) => row.lastDelivery),
  );
  const invoiced = delivered.filter((document) =>
    document.rows.some((row) => row.lastInvoice),
  );
  return [
    { label: 'SAT Oluşturuldu', documents: created, color: COLORS.cyan },
    { label: 'İşleme Alındı', documents: processing, color: COLORS.purple },
    { label: 'SAS / Sipariş', documents: ordered, color: COLORS.amber },
    { label: 'Teslim Edildi', documents: delivered, color: COLORS.teal },
    { label: 'Faturalandı', documents: invoiced, color: COLORS.green },
  ].map((stage) => ({
    label: stage.label,
    count: stage.documents.length,
    totalUsd: sum(stage.documents.map((document) => document.totalSatUsd)),
    color: stage.color,
  }));
}

function deliveryRiskRows(rows: SATExportRow[]) {
  const today = startOfDay(new Date());
  const sevenDays = addDays(today, 7);
  const thirtyDays = addDays(today, 30);
  const overdue: RiskRow[] = [];
  const next7: RiskRow[] = [];
  const next30: RiskRow[] = [];
  const missing: RiskRow[] = [];
  rows
    .filter((row) => !row.lastDelivery)
    .forEach((row) => {
      if (!row.deliveryDate) {
        missing.push({ risk: 'Tarih Yok', row, daysLate: null });
        return;
      }
      const delivery = startOfDay(row.deliveryDate);
      if (delivery < today) {
        overdue.push({
          risk: 'Gecikmiş',
          row,
          daysLate: Math.floor((today.getTime() - delivery.getTime()) / 86400000),
        });
      } else if (delivery <= sevenDays) {
        next7.push({ risk: '7 Gün İçinde', row, daysLate: 0 });
      } else if (delivery <= thirtyDays) {
        next30.push({ risk: '8–30 Gün', row, daysLate: 0 });
      }
    });
  overdue.sort((a, b) => (b.daysLate ?? 0) - (a.daysLate ?? 0));
  return {
    overdue,
    next7,
    next30,
    missing,
    overdueUsd: sum(overdue.map((item) => item.row.sasUsdAmount)),
  };
}

interface RiskRow {
  risk: string;
  row: SATExportRow;
  daysLate: number | null;
}

function isDocumentComplete(document: ReportDocument) {
  return document.rows.every((row) => row.completed);
}

function ageDays(date: Date | null) {
  if (!date) return -1;
  return Math.max(
    0,
    Math.floor(
      (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86400000,
    ),
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function joinMaterial(row: SATExportRow) {
  return [row.material, row.materialDescription].filter(Boolean).join(' · ') || '—';
}

function shortText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatDate(date: Date | null) {
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('tr-TR')
    : '—';
}

function formatReportDate(date: Date) {
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dateValue(date: Date | null) {
  return date?.getTime() ?? 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatUsd(value: number) {
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} USD`;
}

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number, total: number) {
  return total ? `%${Math.round((value / total) * 100)}` : '%0';
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
