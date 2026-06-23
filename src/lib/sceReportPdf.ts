import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
  TVirtualFileSystem,
} from 'pdfmake/interfaces';
import type { SCERow } from '../types';
import { formatDate, normalize, parseDate } from './normalize';
import { classifySCEMaintenance } from './sceMaintenance';

export type SCEReportView = 'overview' | 'tracking';

interface SCEReportOptions {
  rows: SCERow[];
  view: SCEReportView;
  scopeLabel: string;
}

interface DistributionRow {
  label: string;
  value: number;
  color?: string;
}

const COLORS = {
  navy: '#0f172a',
  slate: '#475569',
  line: '#cbd5e1',
  soft: '#f1f5f9',
  cyan: '#0891b2',
  purple: '#7c3aed',
  orange: '#ea580c',
  amber: '#d97706',
  red: '#dc2626',
  green: '#16a34a',
  blue: '#2563eb',
};

const styles: StyleDictionary = {
  title: { fontSize: 21, bold: true, color: COLORS.navy },
  subtitle: { fontSize: 9, color: COLORS.slate, margin: [0, 5, 0, 0] },
  section: {
    fontSize: 13,
    bold: true,
    color: COLORS.navy,
    margin: [0, 15, 0, 7],
  },
  tableHeader: { bold: true, color: '#ffffff', fontSize: 7.5 },
  tableCell: { fontSize: 7, color: '#334155' },
  small: { fontSize: 7, color: '#64748b' },
};

const VIEW_NAMES: Record<SCEReportView, string> = {
  overview: 'SCE Genel Bakış Raporu',
  tracking: 'SCE Takip Detay Raporu',
};

export async function downloadSCEReportPdf({
  rows,
  view,
  scopeLabel,
}: SCEReportOptions) {
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
  const definition = buildSCEReportDefinition(rows, view, scopeLabel);
  const filename = slugify(`${VIEW_NAMES[view]}-${scopeLabel}`) + '.pdf';
  await pdfMake.createPdf(definition).download(filename);
}

export function buildSCEReportDefinition(
  rows: SCERow[],
  view: SCEReportView,
  scopeLabel: string,
): TDocumentDefinitions {
  const landscape = view === 'tracking';
  return {
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: landscape ? [30, 34, 30, 34] : [38, 38, 38, 38],
    info: {
      title: VIEW_NAMES[view],
      author: 'Enstrüman Bakım Müdürlüğü',
      subject: scopeLabel,
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#334155' },
    styles,
    content:
      view === 'overview'
        ? buildOverviewReport(rows, scopeLabel)
        : buildTrackingReport(rows, scopeLabel),
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Enstrüman Bakım Müdürlüğü · SCE Takip', alignment: 'left' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right' },
      ],
      margin: landscape ? [30, 8, 30, 0] : [38, 8, 38, 0],
      fontSize: 7,
      color: '#94a3b8',
    }),
  };
}

function buildOverviewReport(rows: SCERow[], scopeLabel: string): Content[] {
  const summary = buildSummary(rows);
  const maintenance = buildMaintenanceDistribution(rows);
  const companies = buildDistribution(rows.map((row) => row.sirket));
  const factories = buildDistribution(rows.map((row) => row.fabrika));
  const groups = buildDistribution(
    rows.map((row) => row.sceGrubu || 'Belirtilmemiş'),
  );
  const critical = buildCriticalRows(rows);

  return [
    ...reportHeading(VIEW_NAMES.overview, scopeLabel),
    kpiGrid([
      ['Toplam SCE', formatNumber(summary.total), 'Ekipman'],
      ['Bakım Planı Hazır', formatNumber(summary.planned), percent(summary.planned, summary.total)],
      ['Bakım Planı Eksik', formatNumber(summary.unplanned), 'Ekipman'],
      ['Bakımı Yapılan', formatNumber(summary.completed), percent(summary.completed, summary.planned)],
      ['Gecikmiş Bakım', formatNumber(summary.overdue), 'Takip gerekli'],
      ['Deferral Başlatılmadı', formatNumber(summary.deferralNotStarted), 'Duruş gerekli'],
    ]),
    sectionTitle('Periyodik Bakım Durumu'),
    vectorBarChart(maintenance, rows.length, 450),
    {
      columns: [
        {
          width: '*',
          stack: [
            sectionTitle('Şirket Dağılımı'),
            distributionTable(companies, rows.length),
          ],
        },
        { width: 12, text: '' },
        {
          width: '*',
          stack: [
            sectionTitle('Fabrika / Ünite Dağılımı'),
            distributionTable(factories.slice(0, 12), rows.length),
          ],
        },
      ],
      columnGap: 0,
    },
    sectionTitle('SCE Grubu Dağılımı'),
    vectorBarChart(topWithOther(groups, 10), rows.length, 450),
    { text: 'Kritik SCE Takip Listesi', style: 'section', pageBreak: 'before' },
    standardTable(
      ['Risk', 'Şirket', 'Fabrika', 'Ekipman / Tag', 'SCE Grubu', 'Bakım Planı', 'Sonraki Bakım'],
      critical.map((item) => [
        item.risk,
        item.row.sirket,
        item.row.fabrika,
        equipmentTitle(item.row),
        item.row.sceGrubu || '—',
        item.row.bakimPlaniNo || '—',
        formatMaintenanceDate(item.row.sonrakiBakimTarihi),
      ]),
      [70, 48, 58, '*', 76, 68, 62],
      7,
    ),
    critical.length === 0
      ? { text: 'Seçili kapsamda kritik ekipman bulunmuyor.', style: 'small' }
      : { text: `${formatNumber(critical.length)} kritik kayıt listelenmiştir.`, style: 'small', margin: [0, 7, 0, 0] },
  ];
}

function buildTrackingReport(rows: SCERow[], scopeLabel: string): Content[] {
  const summary = buildSummary(rows);
  const maintenance = buildMaintenanceDistribution(rows);
  const shutdown = buildShutdownDistribution(rows);
  const factories = buildDistribution(rows.map((row) => row.fabrika));

  return [
    ...reportHeading(VIEW_NAMES.tracking, scopeLabel, true),
    kpiGrid([
      ['Toplam Kayıt', formatNumber(summary.total), 'Ekipman'],
      ['Planlı Bakım', formatNumber(summary.planned), percent(summary.planned, summary.total)],
      ['Bakımı Yapılan', formatNumber(summary.completed), percent(summary.completed, summary.planned)],
      ['Deferral Başlatılan', formatNumber(summary.deferralStarted), 'Ekipman'],
      ['Deferral Başlatılmadı', formatNumber(summary.deferralNotStarted), 'Ekipman'],
      ['Gecikmiş Bakım', formatNumber(summary.overdue), 'Ekipman'],
    ]),
    {
      columns: [
        {
          width: '*',
          stack: [
            sectionTitle('Bakım Durumu'),
            vectorBarChart(maintenance, rows.length, 335),
          ],
        },
        { width: 14, text: '' },
        {
          width: '*',
          stack: [
            sectionTitle('Duruş Gerekliliği'),
            vectorBarChart(shutdown, sum(shutdown.map((item) => item.value)), 335),
          ],
        },
      ],
      columnGap: 0,
    },
    sectionTitle('Fabrika / Ünite Dağılımı'),
    distributionTable(factories, rows.length),
    { text: 'SCE Ekipman Detayı', style: 'section', pageBreak: 'before' },
    standardTable(
      [
        'Şirket',
        'Fabrika',
        'Ekipman / Tag',
        'Ekipman Türü',
        'SCE Grubu',
        'Bakım Planı',
        'Periyot',
        'Duruş Gerekliliği',
        'Deferral',
        'Son Bakım',
        'Sonraki Bakım',
        'Durum',
      ],
      rows.map((row) => [
        row.sirket,
        row.fabrika,
        equipmentTitle(row),
        row.ekipmanTuru || '—',
        row.sceGrubu || '—',
        row.bakimPlaniNo || '—',
        row.bakimPeriyodu || '—',
        row.durusGereklilikYorumu || '—',
        row.deferralSureci || '—',
        row.sonBakimTarihi || '—',
        row.sonrakiBakimTarihi || '—',
        maintenanceStatusLabel(row),
      ]),
      [40, 48, 72, 58, 58, 54, 42, 70, 48, 48, 50, 65],
      5.6,
    ),
  ];
}

function reportHeading(
  title: string,
  scopeLabel: string,
  landscape = false,
): Content[] {
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
            { text: 'SCE TAKİP', alignment: 'right', bold: true, color: COLORS.navy },
            { text: formatDate(new Date()), alignment: 'right', style: 'small', margin: [0, 5, 0, 0] },
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
          x2: landscape ? 720 : 515,
          y2: 0,
          lineWidth: 1,
          lineColor: COLORS.line,
        },
      ],
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
  const body: TableCell[][] = [];
  for (let index = 0; index < cells.length; index += 3) {
    body.push(cells.slice(index, index + 3));
  }
  return {
    table: { widths: ['*', '*', '*'], body },
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

function vectorBarChart(
  rows: DistributionRow[],
  total: number,
  width: number,
): Content {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return {
    table: {
      widths: [120, '*', 44, 45],
      body: rows.map((row) => [
        { text: row.label, fontSize: 7.5, color: COLORS.slate },
        {
          canvas: [
            { type: 'rect', x: 0, y: 0, w: Math.max(40, width - 220), h: 7, color: '#e2e8f0' },
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: Math.max(1, (row.value / max) * Math.max(40, width - 220)),
              h: 7,
              color: row.color ?? COLORS.cyan,
            },
          ],
          margin: [0, 3, 0, 0],
        },
        { text: formatNumber(row.value), alignment: 'right', bold: true, fontSize: 7.5 },
        { text: percent(row.value, total), alignment: 'right', fontSize: 7, color: COLORS.slate },
      ]),
    },
    layout: 'noBorders',
  };
}

function distributionTable(rows: DistributionRow[], total: number): Content {
  const body: TableCell[][] = [
    tableHeader(['Başlık', 'Adet', 'Oran']),
    ...rows.map(
      (row): TableCell[] => [
        row.label,
        { text: formatNumber(row.value), alignment: 'right' },
        { text: percent(row.value, total), alignment: 'right' },
      ],
    ),
  ];
  return {
    table: {
      headerRows: 1,
      widths: ['*', 45, 48],
      body,
    },
    layout: 'lightHorizontalLines',
  };
}

function standardTable(
  headers: string[],
  rows: string[][],
  widths: Array<string | number>,
  fontSize: number,
): Content {
  return {
    table: {
      headerRows: 1,
      dontBreakRows: false,
      widths,
      body: [
        tableHeader(headers),
        ...(rows.length ? rows : [headers.map(() => '—')]),
      ],
    },
    layout: {
      fillColor: (rowIndex: number) =>
        rowIndex === 0 ? COLORS.navy : rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff',
      hLineColor: () => '#dbe3ee',
      vLineColor: () => '#dbe3ee',
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    fontSize,
  };
}

function tableHeader(headers: string[]): TableCell[] {
  return headers.map((header) => ({
    text: header,
    style: 'tableHeader',
    fillColor: COLORS.navy,
  }));
}

function buildSummary(rows: SCERow[]) {
  const statuses = rows.map(classifySCEMaintenance);
  const count = (status: ReturnType<typeof classifySCEMaintenance>) =>
    statuses.filter((item) => item === status).length;
  const unplanned = count('unplanned');
  return {
    total: rows.length,
    planned: rows.length - unplanned,
    unplanned,
    completed: count('completed'),
    deferralStarted: count('deferral_started'),
    deferralNotStarted: count('deferral_not_started'),
    deferralNotRequired: count('deferral_not_required'),
    assessmentMissing: count('assessment_missing'),
    overdue: rows.filter(isMaintenanceOverdue).length,
  };
}

function buildMaintenanceDistribution(rows: SCERow[]): DistributionRow[] {
  const summary = buildSummary(rows);
  return [
    { label: 'Bakımı Yapılan', value: summary.completed, color: COLORS.green },
    { label: 'Deferral Başlatılan', value: summary.deferralStarted, color: COLORS.blue },
    { label: 'Deferral Başlatılmayan', value: summary.deferralNotStarted, color: COLORS.amber },
    { label: 'Deferral Gerektirmeyen', value: summary.deferralNotRequired, color: COLORS.purple },
    { label: 'Bakım Planı Eksik', value: summary.unplanned, color: COLORS.orange },
  ].filter((item) => item.value > 0);
}

function buildShutdownDistribution(rows: SCERow[]): DistributionRow[] {
  const definitions = [
    ['Duruş Gereklidir', 'durus gereklidir', COLORS.orange],
    ['Duruş Gerekli Değildir', 'durus gerekli degildir', COLORS.green],
    ['Force ile Yapılabilir', 'force ile yapilabilir', COLORS.purple],
  ] as const;
  return definitions.map(([label, value, color]) => ({
    label,
    color,
    value: rows.filter(
      (row) => normalize(row.durusGereklilikYorumu) === value,
    ).length,
  }));
}

function buildDistribution(values: string[]): DistributionRow[] {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) =>
    counts.set(value, (counts.get(value) ?? 0) + 1),
  );
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

function topWithOther(rows: DistributionRow[], limit: number) {
  const top = rows.slice(0, limit).map((row) => ({ ...row }));
  const remaining = rows.slice(limit);
  if (remaining.length) {
    top.push({
      label: `Diğer (${remaining.length} grup)`,
      value: sum(remaining.map((row) => row.value)),
      color: COLORS.slate,
    });
  }
  return top;
}

function buildCriticalRows(rows: SCERow[]) {
  return rows
    .map((row) => {
      if (isMaintenanceOverdue(row)) return { row, risk: 'Gecikmiş Bakım', priority: 0 };
      const status = classifySCEMaintenance(row);
      if (status === 'deferral_not_started') return { row, risk: 'Deferral Yok', priority: 1 };
      if (status === 'unplanned') return { row, risk: 'Plan Eksik', priority: 2 };
      return null;
    })
    .filter((item): item is { row: SCERow; risk: string; priority: number } => item !== null)
    .sort((a, b) => a.priority - b.priority || equipmentTitle(a.row).localeCompare(equipmentTitle(b.row), 'tr'));
}

function maintenanceStatusLabel(row: SCERow) {
  const labels = {
    completed: 'Bakımı Yapılan',
    deferral_started: 'Deferral Başlatılan',
    deferral_not_started: 'Deferral Başlatılmadı',
    deferral_not_required: 'Deferral Gerektirmeyen',
    assessment_missing: 'Değerlendirme Eksik',
    unplanned: 'Bakım Planı Eksik',
  };
  return labels[classifySCEMaintenance(row)];
}

function isMaintenanceOverdue(row: SCERow) {
  const date = parseMaintenanceDate(row.sonrakiBakimTarihi);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function parseMaintenanceDate(value: string) {
  const date = parseDate(value);
  if (!date || date.getFullYear() < 2000 || date.getFullYear() > 2100) return null;
  return date;
}

function formatMaintenanceDate(value: string) {
  return formatDate(parseMaintenanceDate(value));
}

function equipmentTitle(row: SCERow) {
  if (row.ekipmanNo && row.tagNo) return `${row.ekipmanNo} / ${row.tagNo}`;
  return row.ekipmanNo || row.tagNo || row.ekipmanAdi || 'SCE Ekipmanı';
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function percent(value: number, total: number) {
  return total ? `%${Math.round((value / total) * 100)}` : '%0';
}

function slugify(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'sce-raporu';
}
