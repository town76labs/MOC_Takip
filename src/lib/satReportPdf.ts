import type { SATRow, SATStage } from '../types';
import { formatDate, normalize } from './normalize';

interface SATReportOptions {
  rows: SATRow[];
  scopeLabel: string;
}

interface PdfImage {
  data: Uint8Array;
  width: number;
  height: number;
}

interface ReportRow {
  satNo: string;
  date: string;
  unit: string;
  owner: string;
  description: string;
  amount: string;
  stage: string;
  buyer: string;
  stageKey: SATStage;
}

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_MARGIN = 60;
const PAGE_BOTTOM = PAGE_HEIGHT - 72;
const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const TABLE_HEADER_HEIGHT = 48;
const TABLE_LINE_HEIGHT = 21;
const MAX_CELL_LINES = 4;

const STAGES: {
  key: SATStage;
  label: string;
  color: string;
}[] = [
  { key: 'durum_girilmemis', label: 'Durum Girilmemiş', color: '#94a3b8' },
  { key: 'mail_onayi', label: 'Mail Onayı', color: '#f59e0b' },
  { key: 'sap_onayi', label: 'SAP Onayı', color: '#f97316' },
  { key: 'satina_aktarilacak', label: 'Satın Almaya Aktarılacak', color: '#06b6d4' },
  { key: 'teklif_bekleniyor', label: 'Teklif Bekleniyor', color: '#3b82f6' },
  {
    key: 'teklif_degerlendiriliyor',
    label: 'Teklif Değerlendiriliyor',
    color: '#8b5cf6',
  },
  {
    key: 'teklif_degerlendirildi',
    label: 'Teklif Değerlendirildi',
    color: '#6366f1',
  },
  { key: 'sas_verildi', label: 'SAS Verildi', color: '#14b8a6' },
  { key: 'tamamlandi', label: 'Tamamlandı', color: '#22c55e' },
  { key: 'diger', label: 'Diğer', color: '#f43f5e' },
];

const TABLE_COLUMNS = [
  { key: 'satNo', label: 'SAT No', width: 112 },
  { key: 'date', label: 'Tarih', width: 94 },
  { key: 'unit', label: 'Ünite', width: 88 },
  { key: 'owner', label: 'Talep Sahibi', width: 135 },
  { key: 'description', label: 'Talep Açıklaması', width: 274 },
  { key: 'amount', label: 'Tutar', width: 115 },
  { key: 'stage', label: 'Süreç', width: 155 },
  { key: 'buyer', label: 'SAT Sorumlusu', width: 147 },
] as const;

type TableKey = (typeof TABLE_COLUMNS)[number]['key'];

export async function downloadSATReportPdf({
  rows,
  scopeLabel,
}: SATReportOptions) {
  const pages = renderReportPages(rows, scopeLabel);
  const pdf = buildPdf(pages);
  const url = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(`sat-takip-${scopeLabel}`)}-rapor.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderReportPages(rows: SATRow[], scopeLabel: string): PdfImage[] {
  const pages: PdfImage[] = [];
  const cover = createCanvasPage();
  drawDashboardPage(cover.ctx, rows, scopeLabel);
  drawFooter(cover.ctx, 1);
  pages.push(canvasToJpeg(cover.canvas));

  const reportRows = toReportRows(rows);
  let rowIndex = 0;
  let pageNumber = 2;

  while (rowIndex < reportRows.length) {
    const { canvas, ctx } = createCanvasPage();
    let y = drawDetailHeader(ctx, scopeLabel, reportRows.length);
    drawTableHeader(ctx, y);
    y += TABLE_HEADER_HEIGHT;

    while (rowIndex < reportRows.length) {
      const row = reportRows[rowIndex];
      const height = measureRowHeight(ctx, row);
      if (y + height > PAGE_BOTTOM) break;
      drawTableRow(ctx, row, y, height, rowIndex);
      y += height;
      rowIndex++;
    }

    drawFooter(ctx, pageNumber);
    pages.push(canvasToJpeg(canvas));
    pageNumber++;
  }

  if (reportRows.length === 0) {
    const { canvas, ctx } = createCanvasPage();
    const y = drawDetailHeader(ctx, scopeLabel, 0);
    roundedRect(
      ctx,
      PAGE_MARGIN,
      y,
      PAGE_WIDTH - PAGE_MARGIN * 2,
      120,
      12,
      '#ffffff',
    );
    ctx.fillStyle = '#475569';
    ctx.font = `600 22px ${FONT_FAMILY}`;
    ctx.fillText('Seçili filtrelerde raporlanacak SAT kaydı bulunamadı.', PAGE_MARGIN + 30, y + 70);
    drawFooter(ctx, 2);
    pages.push(canvasToJpeg(canvas));
  }

  return pages;
}

function drawDashboardPage(
  ctx: CanvasRenderingContext2D,
  rows: SATRow[],
  scopeLabel: string,
) {
  drawHero(ctx, scopeLabel);
  drawSummaryCards(ctx, rows);
  drawProcessDistribution(ctx, rows);
  drawUnitAndQualityPanels(ctx, rows);
}

function drawHero(ctx: CanvasRenderingContext2D, scopeLabel: string) {
  const gradient = ctx.createLinearGradient(0, 0, PAGE_WIDTH, 220);
  gradient.addColorStop(0, '#082f49');
  gradient.addColorStop(0.55, '#0e7490');
  gradient.addColorStop(1, '#0f766e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PAGE_WIDTH, 220);

  ctx.fillStyle = '#cffafe';
  ctx.font = `600 19px ${FONT_FAMILY}`;
  ctx.fillText('ENSTRÜMAN BAKIM MÜDÜRLÜĞÜ', PAGE_MARGIN, 55);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 42px ${FONT_FAMILY}`;
  ctx.fillText('SAT Takip Raporu', PAGE_MARGIN, 112);

  ctx.fillStyle = '#ccfbf1';
  ctx.font = `400 21px ${FONT_FAMILY}`;
  drawSingleLine(ctx, scopeLabel, PAGE_MARGIN, 157, 760);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ecfeff';
  ctx.font = `500 19px ${FONT_FAMILY}`;
  ctx.fillText(formatReportDate(new Date()), PAGE_WIDTH - PAGE_MARGIN, 60);
  ctx.fillText('Satın Alma Talepleri ve Bütçe Takibi', PAGE_WIDTH - PAGE_MARGIN, 157);
  ctx.textAlign = 'left';
}

function drawSummaryCards(ctx: CanvasRenderingContext2D, rows: SATRow[]) {
  const approvalCompleted = rows.filter((row) =>
    normalize(row.onayDurumu).includes('tamamlandi'),
  ).length;
  const activeProcurement = rows.filter((row) =>
    [
      'satina_aktarilacak',
      'teklif_bekleniyor',
      'teklif_degerlendiriliyor',
      'teklif_degerlendirildi',
      'sas_verildi',
    ].includes(row.stage),
  ).length;
  const cards = [
    { label: 'Toplam Talep', value: formatNumber(rows.length), note: 'Kayıt', color: '#38bdf8' },
    {
      label: 'Onayı Tamamlanan',
      value: formatNumber(approvalCompleted),
      note: percent(approvalCompleted, rows.length),
      color: '#8b5cf6',
    },
    {
      label: 'Aktif Satın Alma',
      value: formatNumber(activeProcurement),
      note: 'Devam eden',
      color: '#f59e0b',
    },
    {
      label: 'Tamamlanan',
      value: formatNumber(rows.filter((row) => row.stage === 'tamamlandi').length),
      note: 'Kapalı talep',
      color: '#22c55e',
    },
    {
      label: 'EUR Talep Tutarı',
      value: formatCompactAmount(sumCurrency(rows, 'EUR')),
      note: formatAmount(sumCurrency(rows, 'EUR'), 'EUR'),
      color: '#06b6d4',
    },
    {
      label: 'USD Talep Tutarı',
      value: formatCompactAmount(sumCurrency(rows, 'USD')),
      note: formatAmount(sumCurrency(rows, 'USD'), 'USD'),
      color: '#10b981',
    },
  ];

  const gap = 14;
  const width = (PAGE_WIDTH - PAGE_MARGIN * 2 - gap * 5) / 6;
  const y = 252;
  cards.forEach((card, index) => {
    const x = PAGE_MARGIN + index * (width + gap);
    roundedRect(ctx, x, y, width, 132, 11, '#0d0d0d');
    roundedRect(ctx, x, y, width, 8, 7, card.color);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 16px ${FONT_FAMILY}`;
    drawCardLabel(ctx, card.label, x + 18, y + 38, width - 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 30px ${FONT_FAMILY}`;
    drawSingleLine(ctx, card.value, x + 18, y + 92, width - 36);
    ctx.fillStyle = '#64748b';
    ctx.font = `500 13px ${FONT_FAMILY}`;
    drawSingleLine(ctx, card.note, x + 18, y + 118, width - 36);
  });
}

function drawProcessDistribution(ctx: CanvasRenderingContext2D, rows: SATRow[]) {
  const x = PAGE_MARGIN;
  const y = 420;
  const width = PAGE_WIDTH - PAGE_MARGIN * 2;
  const height = 590;
  roundedRect(ctx, x, y, width, height, 12, '#0d0d0d');

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 25px ${FONT_FAMILY}`;
  ctx.fillText('SAT Süreç Dağılımı', x + 28, y + 48);
  ctx.fillStyle = '#64748b';
  ctx.font = `400 16px ${FONT_FAMILY}`;
  ctx.fillText('Talep adedi ve süreçteki parasal büyüklükler', x + 28, y + 76);

  const summaries = STAGES.map((stage) => {
    const stageRows = rows.filter((row) => row.stage === stage.key);
    return {
      ...stage,
      count: stageRows.length,
      eur: sumCurrency(stageRows, 'EUR'),
      usd: sumCurrency(stageRows, 'USD'),
    };
  }).filter((stage) => stage.count > 0 || stage.key !== 'diger');
  const maxCount = Math.max(...summaries.map((stage) => stage.count), 1);
  const labelWidth = 230;
  const countWidth = 56;
  const amountWidth = 285;
  const barX = x + 28 + labelWidth;
  const barMax = width - 56 - labelWidth - countWidth - amountWidth;
  const startY = y + 115;

  summaries.forEach((stage, index) => {
    const rowY = startY + index * 49;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 16px ${FONT_FAMILY}`;
    drawSingleLine(ctx, `${index + 1}. ${stage.label}`, x + 28, rowY + 19, labelWidth - 16);

    roundedRect(ctx, barX, rowY, barMax, 25, 7, '#1f2937');
    if (stage.count > 0) {
      roundedRect(
        ctx,
        barX,
        rowY,
        Math.max(8, (stage.count / maxCount) * barMax),
        25,
        7,
        stage.color,
      );
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(stage.count), barX + barMax + countWidth / 2, rowY + 20);
    ctx.textAlign = 'left';

    const amounts = [
      stage.eur > 0 ? formatAmount(stage.eur, 'EUR') : '',
      stage.usd > 0 ? formatAmount(stage.usd, 'USD') : '',
    ]
      .filter(Boolean)
      .join(' · ');
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 14px ${FONT_FAMILY}`;
    drawSingleLine(
      ctx,
      amounts || 'Tutar yok',
      barX + barMax + countWidth,
      rowY + 19,
      amountWidth,
    );
  });
}

function drawUnitAndQualityPanels(ctx: CanvasRenderingContext2D, rows: SATRow[]) {
  const y = 1045;
  const gap = 20;
  const width = (PAGE_WIDTH - PAGE_MARGIN * 2 - gap) / 2;
  const height = 590;
  drawUnitPanel(ctx, PAGE_MARGIN, y, width, height, rows);
  drawQualityPanel(ctx, PAGE_MARGIN + width + gap, y, width, height, rows);
}

function drawUnitPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  rows: SATRow[],
) {
  roundedRect(ctx, x, y, width, height, 12, '#ffffff');
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 23px ${FONT_FAMILY}`;
  ctx.fillText('Ünite Bazında Talepler', x + 26, y + 44);
  ctx.fillStyle = '#64748b';
  ctx.font = `400 15px ${FONT_FAMILY}`;
  ctx.fillText('En fazla SAT açılan ilk sekiz ünite', x + 26, y + 70);

  const units = buildCountData(rows.map((row) => row.unite || 'Belirtilmemiş')).slice(0, 8);
  const max = Math.max(...units.map((unit) => unit.value), 1);
  units.forEach((unit, index) => {
    const rowY = y + 105 + index * 55;
    ctx.fillStyle = '#334155';
    ctx.font = `600 16px ${FONT_FAMILY}`;
    drawSingleLine(ctx, unit.name, x + 26, rowY + 18, 145);
    roundedRect(ctx, x + 180, rowY, width - 250, 22, 7, '#e2e8f0');
    roundedRect(
      ctx,
      x + 180,
      rowY,
      Math.max(7, ((width - 250) * unit.value) / max),
      22,
      7,
      '#06b6d4',
    );
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 17px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(unit.value), x + width - 26, rowY + 18);
    ctx.textAlign = 'left';
  });
}

function drawQualityPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  rows: SATRow[],
) {
  roundedRect(ctx, x, y, width, height, 12, '#ffffff');
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 23px ${FONT_FAMILY}`;
  ctx.fillText('Veri Kalitesi ve Yönetici Notları', x + 26, y + 44);
  ctx.fillStyle = '#64748b';
  ctx.font = `400 15px ${FONT_FAMILY}`;
  ctx.fillText('Rapor yorumlanırken dikkate alınması gereken alanlar', x + 26, y + 70);

  const quality = [
    {
      label: 'Hatalı tarih',
      value: rows.filter(hasInvalidYear).length,
      note: 'Yılı 2000–2100 dışında olan SAT tarihi',
      color: '#ef4444',
    },
    {
      label: 'SAT numarası eksik',
      value: rows.filter((row) => !row.satNo).length,
      note: 'Takip numarası bulunmayan talep',
      color: '#f97316',
    },
    {
      label: 'PYP / mali merkez eksik',
      value: rows.filter((row) => !row.pypKodu).length,
      note: 'Bütçe bağlantısı kurulamayan talep',
      color: '#8b5cf6',
    },
    {
      label: 'SAT sorumlusu atanmamış',
      value: rows.filter((row) => !row.satinAlmaSorumlusu).length,
      note: 'Satın alma sorumlusu boş olan talep',
      color: '#06b6d4',
    },
  ];

  quality.forEach((item, index) => {
    const rowY = y + 105 + index * 92;
    roundedRect(ctx, x + 26, rowY, width - 52, 76, 9, '#f8fafc');
    roundedRect(ctx, x + 26, rowY, 7, 76, 5, item.color);
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 27px ${FONT_FAMILY}`;
    ctx.fillText(String(item.value), x + 52, rowY + 42);
    ctx.fillStyle = '#334155';
    ctx.font = `600 16px ${FONT_FAMILY}`;
    ctx.fillText(item.label, x + 106, rowY + 29);
    ctx.fillStyle = '#64748b';
    ctx.font = `400 13px ${FONT_FAMILY}`;
    drawSingleLine(ctx, item.note, x + 106, rowY + 53, width - 150);
  });

  ctx.fillStyle = '#475569';
  ctx.font = `500 15px ${FONT_FAMILY}`;
  const note =
    'EUR ve USD tutarları kur bilgisi bulunmadığı için ayrı değerlendirilmiştir. PYP eşleşmesi olmayan talepler bütçe kullanım hesabına bağlanamaz.';
  drawWrappedText(ctx, note, x + 26, y + 510, width - 52, 21, 3);
}

function drawDetailHeader(
  ctx: CanvasRenderingContext2D,
  scopeLabel: string,
  totalRows: number,
) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, PAGE_WIDTH, 145);
  ctx.fillStyle = '#5eead4';
  ctx.font = `600 16px ${FONT_FAMILY}`;
  ctx.fillText('ENSTRÜMAN BAKIM MÜDÜRLÜĞÜ', PAGE_MARGIN, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 30px ${FONT_FAMILY}`;
  ctx.fillText('SAT Talep Detayları', PAGE_MARGIN, 83);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `400 16px ${FONT_FAMILY}`;
  drawSingleLine(ctx, scopeLabel, PAGE_MARGIN, 114, 720);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `600 18px ${FONT_FAMILY}`;
  ctx.fillText(`${totalRows} kayıt`, PAGE_WIDTH - PAGE_MARGIN, 82);
  ctx.textAlign = 'left';
  return 178;
}

function drawTableHeader(ctx: CanvasRenderingContext2D, y: number) {
  roundedRect(
    ctx,
    PAGE_MARGIN,
    y,
    PAGE_WIDTH - PAGE_MARGIN * 2,
    TABLE_HEADER_HEIGHT,
    8,
    '#0f766e',
  );
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 15px ${FONT_FAMILY}`;
  let x = PAGE_MARGIN + 10;
  TABLE_COLUMNS.forEach((column) => {
    ctx.fillText(column.label, x, y + 30);
    x += column.width;
  });
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  row: ReportRow,
  y: number,
  height: number,
  index: number,
) {
  roundedRect(
    ctx,
    PAGE_MARGIN,
    y,
    PAGE_WIDTH - PAGE_MARGIN * 2,
    height - 4,
    7,
    index % 2 === 0 ? '#ffffff' : '#eef2f7',
  );
  let x = PAGE_MARGIN + 10;
  TABLE_COLUMNS.forEach((column) => {
    const value = row[column.key as TableKey];
    ctx.fillStyle =
      column.key === 'stage'
        ? stageColor(row.stageKey)
        : column.key === 'amount'
          ? '#0f766e'
          : '#334155';
    ctx.font = `600 14px ${FONT_FAMILY}`;
    drawWrappedText(
      ctx,
      String(value),
      x,
      y + 25,
      column.width - 16,
      TABLE_LINE_HEIGHT,
      MAX_CELL_LINES,
    );
    x += column.width;
  });
}

function measureRowHeight(ctx: CanvasRenderingContext2D, row: ReportRow) {
  ctx.font = `600 14px ${FONT_FAMILY}`;
  const lines = TABLE_COLUMNS.map((column) =>
    wrapText(ctx, String(row[column.key]), column.width - 16, MAX_CELL_LINES).length,
  );
  return Math.max(58, Math.max(...lines) * TABLE_LINE_HEIGHT + 28);
}

function toReportRows(rows: SATRow[]): ReportRow[] {
  return [...rows]
    .sort((a, b) => {
      const stageDifference = stageIndex(a.stage) - stageIndex(b.stage);
      if (stageDifference !== 0) return stageDifference;
      return (b.satTarihi?.getTime() ?? 0) - (a.satTarihi?.getTime() ?? 0);
    })
    .map((row) => ({
      satNo: row.satNo || 'Eksik',
      date: formatDate(row.satTarihi),
      unit: row.unite || '-',
      owner: row.talepSahibi || '-',
      description: row.aciklama || '-',
      amount: formatAmount(row.toplamTutar, row.paraBirimi),
      stage: stageLabel(row.stage),
      buyer: row.satinAlmaSorumlusu || 'Atanmamış',
      stageKey: row.stage,
    }));
}

function createCanvasPage() {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('SAT PDF raporu için canvas oluşturulamadı.');
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return { canvas, ctx };
}

function drawFooter(ctx: CanvasRenderingContext2D, pageNumber: number) {
  ctx.fillStyle = '#64748b';
  ctx.font = `500 13px ${FONT_FAMILY}`;
  ctx.fillText('SAT Takip Dashboard · Veriler yüklenen Excel dosyasından oluşturulmuştur.', PAGE_MARGIN, PAGE_HEIGHT - 30);
  ctx.textAlign = 'right';
  ctx.fillText(`Sayfa ${pageNumber}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 30);
  ctx.textAlign = 'left';
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = Number.POSITIVE_INFINITY,
) {
  wrapText(ctx, text, maxWidth, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = Number.POSITIVE_INFINITY,
) {
  const words = (text.trim() || '-').split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    while (ctx.measureText(current).width > maxWidth && current.length > 1) {
      let slice = current.length - 1;
      while (slice > 1 && ctx.measureText(`${current.slice(0, slice)}-`).width > maxWidth) {
        slice--;
      }
      lines.push(`${current.slice(0, slice)}-`);
      current = current.slice(slice);
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const limited = lines.slice(0, maxLines);
  limited[limited.length - 1] = truncateLine(
    ctx,
    `${limited[limited.length - 1]}…`,
    maxWidth,
  );
  return limited;
}

function drawCardLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  wrapText(ctx, text, maxWidth, 2).forEach((line, index) => {
    ctx.fillText(line, x, y + index * 19);
  });
}

function drawSingleLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  ctx.fillText(truncateLine(ctx, text, maxWidth), x, y);
}

function truncateLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let output = text;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function canvasToJpeg(canvas: HTMLCanvasElement): PdfImage {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    data[index] = binary.charCodeAt(index);
  }
  return { data, width: canvas.width, height: canvas.height };
}

function buildPdf(images: PdfImage[]) {
  const encoder = new TextEncoder();
  const objects: Uint8Array[] = [];
  objects.push(encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(
    encoder.encode(
      `<< /Type /Pages /Kids [${images
        .map((_, index) => `${3 + index * 3} 0 R`)
        .join(' ')}] /Count ${images.length} >>`,
    ),
  );

  images.forEach((image, index) => {
    const pageObject = 3 + index * 3;
    const contentObject = pageObject + 1;
    const imageObject = pageObject + 2;
    const imageName = `Im${index}`;
    const content = `q ${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm /${imageName} Do Q`;
    objects.push(
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /XObject << /${imageName} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`,
      ),
    );
    objects.push(
      encoder.encode(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    );
    objects.push(
      concatBytes([
        encoder.encode(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`,
        ),
        image.data,
        encoder.encode('\nendstream'),
      ]),
    );
  });

  const header = encoder.encode('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  const parts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let offset = header.length;
  objects.forEach((object, index) => {
    const objectNumber = index + 1;
    const prefix = encoder.encode(`${objectNumber} 0 obj\n`);
    const suffix = encoder.encode('\nendobj\n');
    offsets[objectNumber] = offset;
    parts.push(prefix, object, suffix);
    offset += prefix.length + object.length + suffix.length;
  });

  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets
      .slice(1)
      .map((item) => `${String(item).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join('');
  parts.push(encoder.encode(xref));
  return new Blob([concatBytes(parts) as BlobPart], { type: 'application/pdf' });
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function buildCountData(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'tr'));
}

function sumCurrency(rows: SATRow[], currency: string) {
  return rows.reduce(
    (sum, row) => (row.paraBirimi === currency ? sum + row.toplamTutar : sum),
    0,
  );
}

function stageIndex(stage: SATStage) {
  return STAGES.findIndex((item) => item.key === stage);
}

function stageLabel(stage: SATStage) {
  return STAGES.find((item) => item.key === stage)?.label ?? 'Diğer';
}

function stageColor(stage: SATStage) {
  return STAGES.find((item) => item.key === stage)?.color ?? '#64748b';
}

function hasInvalidYear(row: SATRow) {
  const year = row.satTarihi?.getFullYear();
  return year !== undefined && (year < 2000 || year > 2100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatAmount(value: number, currency: string) {
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} ${currency || ''}`.trim();
}

function formatCompactAmount(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function percent(value: number, total: number) {
  return total ? `%${Math.round((value / total) * 100)}` : '%0';
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
    .toLowerCase()
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
