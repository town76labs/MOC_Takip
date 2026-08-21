import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from 'pdfmake/interfaces';
import type { SCEV2DashboardRow } from '../types';
import { formatDate } from './normalize';

export type SCEV2ReportType = 'executive' | 'detailed';

interface SCEV2ReportOptions {
  rows: SCEV2DashboardRow[];
  company: 'PETKIM' | 'STAR';
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
  gray: '#64748b',
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
      `${slugify(`sce-v2-${companyLabel(options.company)}-${reportName}`)}.pdf`,
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
      title: `SCE V2 ${companyLabel(company)} ${reportName}`,
      author: 'Enstrüman Bakım Müdürlüğü',
      subject: scopeLabel,
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#334155' },
    styles,
    content: buildReportContent(rows, company, type, scopeLabel),
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: `Enstrüman Bakım Müdürlüğü · SCE V2 · ${companyLabel(company)}`,
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
  company: 'PETKIM' | 'STAR',
  type: SCEV2ReportType,
  scopeLabel: string,
): Content[] {
  const metrics = buildMetrics(rows);
  const accent = company === 'STAR' ? COLORS.star : COLORS.sky;
  const completionRows = buildCompletionRows(rows, company);
  const statusDistribution: DistributionRow[] = [
    { label: 'Bakımı Tamamlanan', value: metrics.completed, color: COLORS.green },
    { label: 'Duruşa Ertelenen', value: metrics.deferred, color: COLORS.amber },
    { label: 'Bakımı Yapılmayan', value: metrics.notCompleted, color: COLORS.rose },
    { label: 'Sipariş Kaydı Yok', value: metrics.orderNotFound, color: COLORS.gray },
  ];

  const content: Content[] = [
    ...reportHeading(company, type, scopeLabel, accent),
    kpiGrid([
      [
        'Toplam Ekipman',
        formatNumber(metrics.total),
        company === 'STAR'
          ? `${formatNumber(metrics.orderNotFound)} sipariş kaydı yok`
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
    {
      columns: [
        {
          width: 250,
          stack: [
            sectionTitle('Genel Bakım Durumu'),
            vectorBarChart(statusDistribution, metrics.total, 220),
          ],
        },
        { width: 18, text: '' },
        {
          width: '*',
          stack: [
            sectionTitle(
              company === 'STAR'
                ? 'Konsol Bazlı Tamamlanma Oranları'
                : 'Fabrika Bazlı Tamamlanma Oranları',
            ),
            completionChart(completionRows, 420, accent),
          ],
        },
      ],
    },
    controlStatusOverview(metrics),
  ];

  if (type === 'detailed') {
    const equipmentTypes = buildEquipmentTypeCompletionRows(rows);
    const actionRows = rows
      .filter((row) => row.maintenanceStatus !== 'completed')
      .sort(compareActionRows);
    content.push(
      {
        text: 'Ekipman Tipi Tamamlanma Oranları',
        style: 'section',
        pageBreak: 'before',
      },
      {
        text: 'Her ekipman tipi için tamamlanan / toplam ekipman adedi ve tamamlanma yüzdesi',
        style: 'small',
        margin: [0, 0, 0, 8],
      },
      completionChart(equipmentTypes, 500, accent),
      {
        text: 'Aksiyon Gerektiren Ekipmanlar',
        style: 'section',
        pageBreak: 'before',
      },
      actionRows.length > 0
        ? equipmentTable(actionRows, company)
        : emptyNote('Seçili kapsamda aksiyon gerektiren ekipman bulunmuyor.'),
    );
  }

  return content;
}

function reportHeading(
  company: 'PETKIM' | 'STAR',
  type: SCEV2ReportType,
  scopeLabel: string,
  accent: string,
): Content[] {
  const reportName = type === 'executive' ? 'Yönetici Özeti' : 'Detaylı Rapor';
  return [
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              text: 'Enstrüman Bakım Müdürlüğü',
              style: 'eyebrow',
              color: accent,
            },
            {
              text: `${companyLabel(company)} SCE V2 ${reportName}`,
              style: 'title',
            },
            {
              text: `Kapsam: ${scopeLabel} · Dönem: 2026 ve sonrası`,
              style: 'subtitle',
            },
          ],
        },
        {
          width: 165,
          stack: [
            {
              text: `${companyLabel(company).toLocaleUpperCase('tr-TR')} · SCE V2`,
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
          lineWidth: 1.4,
          lineColor: accent,
        },
      ],
      margin: [0, 13, 0, 10],
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
): Content {
  const deferralTotal = metrics.deferralStarted + metrics.deferralRequired;
  const calibrationTotal =
    metrics.calibrationShared +
    metrics.calibrationNotShared +
    metrics.calibrationUnknown;
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
                    text: `%${percent(metrics.deferralStarted, deferralTotal)} başlatıldı · Overdue: ${metrics.deferralOverdue}`,
                    width: 82,
                    alignment: 'right',
                    fontSize: 7.5,
                    bold: true,
                    color: COLORS.sky,
                  },
                ],
                margin: [0, 0, 0, 6],
              },
              vectorBarChart(
                [
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
                ],
                deferralTotal,
                330,
              ),
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
  };
}

function equipmentTable(
  rows: SCEV2DashboardRow[],
  company: 'PETKIM' | 'STAR',
): Content {
  const groupHeader = company === 'STAR' ? 'Konsol / Ünite' : 'Fabrika';
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
      'Deferral',
      'Kalibrasyon',
    ],
    rows.map((row) => [
      company === 'STAR'
        ? `${row.consoleName || '—'} / ${row.unit || '—'}`
        : FACTORY_LABELS[row.factory] ?? row.factory,
      row.equipmentNo || '—',
      row.tagNo || '—',
      row.equipmentType || '—',
      row.orderNo || '—',
      row.userStatus || '—',
      formatDate(row.maintenanceStartDate),
      formatDate(row.maintenanceEndDate),
      maintenanceLabel(row),
      deferralLabel(row),
      calibrationLabel(row),
    ]),
    [60, 58, 68, 118, 56, 52, 52, 52, 62, 52, 52],
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
    completed: rows.filter((row) => row.maintenanceStatus === 'completed').length,
    deferred: rows.filter((row) => row.maintenanceStatus === 'shutdown_deferred').length,
    notCompleted: rows.filter(
      (row) => row.maintenanceStatus === 'maintenance_not_completed',
    ).length,
    orderNotFound: rows.filter(
      (row) => row.maintenanceStatus === 'order_not_found',
    ).length,
    deferralStarted: rows.filter((row) => row.deferralStatus === 'started').length,
    deferralRequired: rows.filter((row) => row.deferralStatus === 'required').length,
    deferralOverdue: rows.filter((row) => row.deferralIsOverdue).length,
    calibrationShared: rows.filter((row) => row.calibrationStatus === 'shared').length,
    calibrationNotShared: rows.filter(
      (row) => row.calibrationStatus === 'not_shared',
    ).length,
    calibrationUnknown: rows.filter(
      (row) => row.calibrationStatus === 'unknown',
    ).length,
  };
}

function buildCompletionRows(
  rows: SCEV2DashboardRow[],
  company: 'PETKIM' | 'STAR',
): CompletionRow[] {
  const groups = new Map<string, SCEV2DashboardRow[]>();
  for (const row of rows) {
    const key =
      company === 'STAR'
        ? row.consoleName || 'Konsol Belirsiz'
        : (FACTORY_LABELS[row.factory] ?? row.factory) || 'Fabrika Belirsiz';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([label, groupRows]) => ({
      label,
      total: groupRows.length,
      completed: groupRows.filter((row) => row.maintenanceStatus === 'completed')
        .length,
      deferred: groupRows.filter(
        (row) => row.maintenanceStatus === 'shutdown_deferred',
      ).length,
      notCompleted: groupRows.filter(
        (row) => row.maintenanceStatus === 'maintenance_not_completed',
      ).length,
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, 'tr', { numeric: true }),
    );
}

function buildEquipmentTypeCompletionRows(
  rows: SCEV2DashboardRow[],
): CompletionRow[] {
  const groups = new Map<string, SCEV2DashboardRow[]>();
  for (const row of rows) {
    const key = row.equipmentType || 'Ekipman tipi bulunamadı';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([label, groupRows]) => ({
      label,
      total: groupRows.length,
      completed: groupRows.filter(
        (row) => row.maintenanceStatus === 'completed',
      ).length,
      deferred: groupRows.filter(
        (row) => row.maintenanceStatus === 'shutdown_deferred',
      ).length,
      notCompleted: groupRows.filter(
        (row) => row.maintenanceStatus === 'maintenance_not_completed',
      ).length,
    }))
    .sort(
      (left, right) =>
        right.total - left.total ||
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

function calibrationLabel(row: SCEV2DashboardRow) {
  if (row.calibrationStatus === 'shared') return 'Paylaşıldı';
  if (row.calibrationStatus === 'not_shared') return 'Paylaşılmadı';
  if (row.calibrationStatus === 'not_applicable') return 'Uygulanmaz';
  return 'Bilgi Bekleniyor';
}

function compareActionRows(left: SCEV2DashboardRow, right: SCEV2DashboardRow) {
  return (
    maintenanceLabel(left).localeCompare(maintenanceLabel(right), 'tr') ||
    left.factory.localeCompare(right.factory, 'tr', { numeric: true }) ||
    left.equipmentNo.localeCompare(right.equipmentNo, 'tr', { numeric: true })
  );
}

function companyLabel(company: 'PETKIM' | 'STAR') {
  return company === 'STAR' ? 'Star' : 'Petkim';
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
