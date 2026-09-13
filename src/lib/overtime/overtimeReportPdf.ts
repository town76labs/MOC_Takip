import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from 'pdfmake/interfaces';
import {
  formatClock,
  formatDate,
  formatEndClock,
  slugify,
  type OvertimeReportData,
} from './overtimeReport';

export type OvertimePdfReportType = 'executive' | 'detailed';

const COLORS = {
  navy: '#0f172a',
  slate: '#475569',
  muted: '#94a3b8',
  line: '#dbe4ef',
  soft: '#f1f5f9',
  purple: '#7c3aed',
  violet: '#8b5cf6',
  green: '#059669',
  amber: '#d97706',
  sky: '#0284c7',
  white: '#ffffff',
};

const styles: StyleDictionary = {
  eyebrow: { fontSize: 8, bold: true, color: COLORS.purple },
  title: { fontSize: 21, bold: true, color: COLORS.navy },
  subtitle: { fontSize: 8.5, color: COLORS.slate, margin: [0, 5, 0, 0] },
  section: {
    fontSize: 12.5,
    bold: true,
    color: COLORS.navy,
    margin: [0, 15, 0, 7],
  },
  tableHeader: { bold: true, color: COLORS.white, fontSize: 6.5 },
  tableCell: { fontSize: 6.2, color: '#334155' },
  small: { fontSize: 7, color: COLORS.slate },
};

export async function downloadOvertimeReportPdf(
  report: OvertimeReportData,
  type: OvertimePdfReportType,
) {
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
  const reportName = type === 'executive' ? 'Yönetici Özeti' : 'Detaylı Rapor';
  await pdfMake
    .createPdf(buildOvertimeReportPdfDefinition(report, type))
    .download(
      `${slugify(`Mesai-Takip-${reportName}-${report.filters.startsOn}-${report.filters.endsOn}`)}.pdf`,
    );
}

export function buildOvertimeReportPdfDefinition(
  report: OvertimeReportData,
  type: OvertimePdfReportType,
): TDocumentDefinitions {
  const reportName = type === 'executive' ? 'Yönetici Özeti' : 'Detaylı Rapor';
  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 34, 30, 34],
    info: {
      title: `Mesai Takip Raporu - ${reportName}`,
      author: 'Enstrüman Bakım Müdürlüğü',
      subject: report.scopeLabel,
    },
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: '#334155' },
    styles,
    content: buildContent(report, type),
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Enstrüman Bakım Müdürlüğü · Mesai Takibi', alignment: 'left' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right' },
      ],
      margin: [30, 8, 30, 0],
      fontSize: 7,
      color: COLORS.muted,
    }),
  };
}

function buildContent(
  report: OvertimeReportData,
  type: OvertimePdfReportType,
): Content[] {
  const metrics = report.metrics;
  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'ENSTRÜMAN BAKIM MÜDÜRLÜĞÜ', style: 'eyebrow' },
            { text: 'Mesai Takip Raporu', style: 'title', margin: [0, 3, 0, 0] },
            {
              text: type === 'executive' ? 'Yönetici Özeti' : 'Detaylı Rapor',
              fontSize: 11,
              bold: true,
              color: COLORS.purple,
            },
            { text: report.scopeLabel, style: 'subtitle' },
          ],
        },
        {
          width: 135,
          alignment: 'right',
          stack: [
            { text: 'MESAİ TAKİBİ', bold: true, color: COLORS.navy, fontSize: 9 },
            {
              text: report.generatedAt.toLocaleString('tr-TR', {
                timeZone: 'Europe/Istanbul',
              }),
              color: COLORS.muted,
              fontSize: 8,
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
          x2: 780,
          y2: 0,
          lineWidth: 1.5,
          lineColor: COLORS.purple,
        },
      ],
      margin: [0, 14, 0, 12],
    },
    kpiGrid([
      ['Toplam Mesai', formatNumber(metrics.occurrenceCount), 'Mesaiye geliş sayısı'],
      ['Toplam Yevmiye', formatNumber(metrics.wageCreditTotal), 'Detay ve devreden toplamı'],
      ['Katılan Personel', formatNumber(metrics.participatingPersonnel), 'Seçili kapsamda'],
      ['Detaylı Kayıt', formatNumber(metrics.detailedRecords), 'Tarih ve işi bulunan kayıt'],
    ]),
    { text: 'Dağılım Özeti', style: 'section' },
    {
      columns: [
        distributionTable('Mesai Türü', [
          ['Tam Gün Mesaisi', metrics.fullDayCount],
          ['Devam Mesaisi', metrics.continuationCount],
        ]),
        distributionTable('Personel Tipi', [
          ['Formen', metrics.foremanOccurrences],
          ['Teknisyen', metrics.technicianOccurrences],
        ]),
        distributionTable('Yevmiye Kaynağı', [
          ['Detaylı Kayıtlar', metrics.detailedWageCredit],
          ['Devreden / Düzeltme', metrics.adjustmentWageCredit],
        ]),
      ],
      columnGap: 12,
    },
    { text: 'Personel Mesai Özeti', style: 'section' },
    personnelSummaryTable(
      type === 'executive'
        ? report.personnelSummary.slice(0, 18)
        : report.personnelSummary,
    ),
  ];

  if (type === 'executive' && report.personnelSummary.length > 18) {
    content.push({
      text: `İlk 18 personel gösterildi. Tüm personel için detaylı raporu veya Excel listesini kullanın.`,
      style: 'small',
      margin: [0, 5, 0, 0],
    });
  }

  if (type === 'detailed') {
    content.push(
      { text: 'Mesai Kayıtları', style: 'section', pageBreak: 'before' },
      detailTable(report),
    );
    if (report.adjustments.length > 0) {
      content.push(
        { text: 'Devreden Bakiye ve Düzeltmeler', style: 'section', pageBreak: 'before' },
        adjustmentTable(report),
      );
    }
  }

  return content;
}

function kpiGrid(items: Array<[string, string, string]>): Content {
  return {
    table: {
      widths: ['*', '*', '*', '*'],
      body: [
        items.map(([label, value, helper]) => ({
          stack: [
            { text: label, color: COLORS.slate, fontSize: 7.5 },
            { text: value, color: COLORS.navy, fontSize: 18, bold: true, margin: [0, 5, 0, 2] },
            { text: helper, color: COLORS.muted, fontSize: 6.8 },
          ],
          fillColor: COLORS.soft,
          margin: [8, 7, 8, 7],
        })),
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 2,
      vLineColor: () => COLORS.white,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

function distributionTable(
  title: string,
  rows: Array<[string, number]>,
): Content {
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  const body: TableCell[][] = [
    [
      {
        text: title,
        bold: true,
        color: COLORS.navy,
        colSpan: 2,
        margin: [0, 0, 0, 4],
      },
      {},
    ],
    ...rows.map(([label, value]): TableCell[] => [
      tableCell(label),
      {
        text: `${formatNumber(value)} · %${percent(value, total)}`,
        alignment: 'right',
        bold: true,
        fontSize: 7,
        color: COLORS.navy,
      },
    ]),
  ];
  return {
    table: {
      widths: ['*', 48],
      body,
    },
    layout: {
      hLineColor: () => COLORS.line,
      vLineWidth: () => 0,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
  };
}

function personnelSummaryTable(
  rows: OvertimeReportData['personnelSummary'],
): Content {
  const header = ['Sicil', 'Ad Soyad', 'Tip', 'Grup', 'Birim', 'Mesai', 'Yevmiye'];
  return {
    table: {
      headerRows: 1,
      widths: [48, '*', 52, 35, 62, 42, 48],
      body: [
        header.map(tableHeader),
        ...rows.map((row) => [
          tableCell(row.employeeNo),
          tableCell(row.fullName),
          tableCell(row.personnelRole === 'foreman' ? 'Formen' : 'Teknisyen'),
          tableCell(row.workGroup),
          tableCell(row.unit),
          tableCell(formatNumber(row.occurrenceCount), 'right'),
          tableCell(formatNumber(row.wageCreditTotal), 'right', true),
        ]),
      ],
    },
    layout: lightTableLayout(),
  };
}

function detailTable(report: OvertimeReportData): Content {
  const header = [
    'Tarih', 'Sicil', 'Personel', 'Tip', 'Grup', 'Tür', 'Saat', 'Yevmiye',
    'Çalışma Yeri', 'Yapılan İş',
  ];
  const detailRows: TableCell[][] = report.rows.length > 0
    ? report.rows.map((row) => [
        tableCell(formatDate(row.workDate)),
        tableCell(row.employeeNo),
        tableCell(row.fullName),
        tableCell(row.personnelRole === 'foreman' ? 'Formen' : 'Teknisyen'),
        tableCell(row.workGroup),
        tableCell(row.overtimeType === 'full_day' ? 'Tam Gün' : 'Devam'),
        tableCell(`${formatClock(row.startsAt)}–${formatEndClock(row.workDate, row.endsAt)}`),
        tableCell(formatNumber(row.wageCredit), 'right', true),
        tableCell(row.location || '—'),
        tableCell(row.tasks.join('; ') || row.callNote || '—'),
      ])
    : [[
        {
          text: 'Seçili kapsamda ayrıntılı mesai kaydı bulunmuyor.',
          colSpan: header.length,
          alignment: 'center',
          color: COLORS.muted,
          margin: [0, 10, 0, 10],
        },
        ...Array.from({ length: header.length - 1 }, () => ({})),
      ]];
  return {
    table: {
      headerRows: 1,
      widths: [45, 42, 72, 40, 27, 37, 51, 40, 68, '*'],
      body: [
        header.map(tableHeader),
        ...detailRows,
      ],
    },
    layout: lightTableLayout(),
  };
}

function adjustmentTable(report: OvertimeReportData): Content {
  const header = ['Tarih', 'Sicil', 'Personel', 'Tip', 'Grup', 'Mesai', 'Yevmiye', 'Açıklama'];
  return {
    table: {
      headerRows: 1,
      widths: [52, 48, 90, 50, 32, 45, 52, '*'],
      body: [
        header.map(tableHeader),
        ...report.adjustments.map((row) => [
          tableCell(formatDate(row.effectiveDate)),
          tableCell(row.employeeNo),
          tableCell(row.fullName),
          tableCell(row.personnelRole === 'foreman' ? 'Formen' : 'Teknisyen'),
          tableCell(row.workGroup),
          tableCell(formatNumber(row.occurrenceDelta), 'right'),
          tableCell(formatNumber(row.wageCreditDelta), 'right', true),
          tableCell(row.description),
        ]),
      ],
    },
    layout: lightTableLayout(),
  };
}

function tableHeader(text: string): TableCell {
  return {
    text,
    style: 'tableHeader',
    fillColor: COLORS.navy,
    alignment: 'center',
    margin: [3, 4, 3, 4],
  };
}

function tableCell(
  text: string,
  alignment: 'left' | 'right' | 'center' = 'left',
  bold = false,
): TableCell {
  return {
    text,
    style: 'tableCell',
    alignment,
    bold,
    margin: [3, 3, 3, 3],
  };
}

function lightTableLayout() {
  return {
    hLineColor: () => COLORS.line,
    vLineColor: () => COLORS.line,
    hLineWidth: (index: number) => (index === 0 ? 0 : 0.5),
    vLineWidth: () => 0,
    fillColor: (rowIndex: number) =>
      rowIndex > 0 && rowIndex % 2 === 0 ? '#f8fafc' : null,
    paddingLeft: () => 2,
    paddingRight: () => 2,
    paddingTop: () => 1,
    paddingBottom: () => 1,
  };
}

function formatNumber(value: number) {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 3 });
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
