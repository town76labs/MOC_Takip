import type { ActionCategory, ActionMOC } from '../types';
import { summarize } from './actionsLogic';
import { formatDate } from './normalize';

interface ActionReportOptions {
  mocs: ActionMOC[];
  scopeLabel: string;
}

interface ActionReportRow {
  mocNo: string;
  company: string;
  responsible: string;
  targetDate: string;
  description: string;
}

interface DetailSection {
  category: Exclude<ActionCategory, 'tamamlanmis'>;
  title: string;
  color: string;
  rows: ActionReportRow[];
}

interface PdfImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_MARGIN = 60;
const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const ROW_LINE_HEIGHT = 22;
const MAX_CELL_LINES = 8;

const STATUS_COLORS = {
  tamamlanmis: '#10b981',
  tamamlanmayan: '#f59e0b',
  gecikmis: '#ef4444',
  atamaYapilmadi: '#38bdf8',
};

const TABLE_COLUMNS = [
  { key: 'mocNo', label: 'MOC No', width: 135 },
  { key: 'company', label: 'Şirket', width: 135 },
  { key: 'responsible', label: 'Sorumlular', width: 250 },
  { key: 'targetDate', label: 'Hedef Tarih', width: 120 },
  { key: 'description', label: 'Aksiyon Açıklaması', width: 470 },
] as const;

type TableColumnKey = (typeof TABLE_COLUMNS)[number]['key'];

export async function downloadActionReportPdf({
  mocs,
  scopeLabel,
}: ActionReportOptions) {
  const pages = renderReportPages(mocs, scopeLabel);
  const pdf = buildPdf(pages);
  const url = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(`aksiyonlar-${scopeLabel}`)}-rapor.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderReportPages(mocs: ActionMOC[], scopeLabel: string): PdfImage[] {
  const summary = summarize(mocs);
  const sections = buildDetailSections(mocs);
  const allDetailRowsEmpty = sections.every((section) => section.rows.length === 0);
  const pages: PdfImage[] = [];
  let sectionIndex = 0;
  let rowIndex = 0;
  let firstPage = true;

  while (firstPage || sectionIndex < sections.length) {
    const { canvas, ctx } = createCanvasPage();
    let y = firstPage
      ? drawReportIntro(ctx, scopeLabel, summary)
      : drawContinuationHeader(ctx, scopeLabel);

    if (allDetailRowsEmpty) {
      drawNoDetailsState(ctx, y);
      sectionIndex = sections.length;
    } else {
      while (sectionIndex < sections.length) {
        const section = sections[sectionIndex];
        if (y + 104 > PAGE_HEIGHT - PAGE_MARGIN) break;

        y = drawDetailSectionTitle(ctx, y, section, rowIndex > 0);
        if (section.rows.length === 0) {
          drawEmptySectionState(ctx, y, section);
          y += 74;
          sectionIndex++;
          continue;
        }

        drawTableHeader(ctx, y);
        y += 44;

        while (rowIndex < section.rows.length) {
          const row = section.rows[rowIndex];
          const rowHeight = measureRowHeight(ctx, row);
          if (y + rowHeight > PAGE_HEIGHT - PAGE_MARGIN) break;
          drawTableRow(ctx, row, y, rowHeight, rowIndex, section);
          y += rowHeight;
          rowIndex++;
        }

        if (rowIndex < section.rows.length) break;
        sectionIndex++;
        rowIndex = 0;
        y += 26;
      }
    }

    pages.push(canvasToJpeg(canvas));
    firstPage = false;
  }

  return pages;
}

function buildDetailSections(mocs: ActionMOC[]): DetailSection[] {
  return [
    {
      category: 'tamamlanmayan',
      title: 'Tamamlanmayan Aksiyon Detayları',
      color: STATUS_COLORS.tamamlanmayan,
      rows: buildRows(mocs, 'tamamlanmayan'),
    },
    {
      category: 'gecikmis',
      title: 'Gecikmiş Aksiyon Detayları',
      color: STATUS_COLORS.gecikmis,
      rows: buildRows(mocs, 'gecikmis'),
    },
    {
      category: 'atama_yapilmadi',
      title: 'Aksiyon Ataması Yapılmadı Detayları',
      color: STATUS_COLORS.atamaYapilmadi,
      rows: buildRows(mocs, 'atama_yapilmadi'),
    },
  ];
}

function buildRows(
  mocs: ActionMOC[],
  category: Exclude<ActionCategory, 'tamamlanmis'>,
): ActionReportRow[] {
  return mocs
    .filter((moc) => moc.category === category)
    .map((moc) => ({
      mocNo: moc.mocFormNo || '-',
      company: moc.sirket || '(belirtilmemiş)',
      responsible: visibleResponsible(moc).join(', ') || '-',
      targetDate: formatDate(moc.hedefTarih),
      description: moc.aksiyonAciklamasi || moc.mocKonusu || '-',
    }))
    .sort(
      (a, b) =>
        a.company.localeCompare(b.company, 'tr') ||
        a.mocNo.localeCompare(b.mocNo, 'tr'),
    );
}

function visibleResponsible(moc: ActionMOC) {
  return moc.sorumlular;
}

function createCanvasPage() {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('PDF raporu için canvas oluşturulamadı.');
  }

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return { canvas, ctx };
}

function drawReportIntro(
  ctx: CanvasRenderingContext2D,
  scopeLabel: string,
  summary: ReturnType<typeof summarize>,
) {
  drawHeader(ctx, scopeLabel);
  drawSummaryCards(ctx, summary);
  drawDistributionCard(ctx, summary);
  return drawStatusSummary(ctx, summary);
}

function drawHeader(ctx: CanvasRenderingContext2D, scopeLabel: string) {
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 38px ${FONT_FAMILY}`;
  ctx.fillText('Aksiyonlar Raporu', PAGE_MARGIN, 72);

  ctx.fillStyle = '#475569';
  ctx.font = `400 22px ${FONT_FAMILY}`;
  ctx.fillText(scopeLabel, PAGE_MARGIN, 110);

  ctx.textAlign = 'right';
  ctx.fillText(formatReportDate(new Date()), PAGE_WIDTH - PAGE_MARGIN, 110);
  ctx.textAlign = 'left';
}

function drawSummaryCards(
  ctx: CanvasRenderingContext2D,
  summary: ReturnType<typeof summarize>,
) {
  const cards = [
    {
      label: 'Tamamlanmış Aksiyonlar',
      value: summary.tamamlanmis,
      color: STATUS_COLORS.tamamlanmis,
    },
    {
      label: 'Tamamlanmayan Aksiyonlar',
      value: summary.tamamlanmayan,
      color: STATUS_COLORS.tamamlanmayan,
    },
    {
      label: 'Gecikmiş Aksiyonlar',
      value: summary.gecikmis,
      color: STATUS_COLORS.gecikmis,
    },
    {
      label: 'Aksiyon Ataması Yapılmadı',
      value: summary.atama_yapilmadi,
      color: STATUS_COLORS.atamaYapilmadi,
    },
  ];

  const gap = 18;
  const cardWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - gap * 3) / 4;
  const y = 150;

  cards.forEach((card, index) => {
    const x = PAGE_MARGIN + index * (cardWidth + gap);
    roundedRect(ctx, x, y, cardWidth, 126, 10, '#0d0d0d');
    roundedRect(ctx, x, y, cardWidth, 8, 6, card.color);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 18px ${FONT_FAMILY}`;
    drawCardLabel(ctx, card.label, x + 24, y + 42, cardWidth - 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 34px ${FONT_FAMILY}`;
    ctx.fillText(String(card.value), x + 24, y + 102);
  });
}

function drawDistributionCard(
  ctx: CanvasRenderingContext2D,
  summary: ReturnType<typeof summarize>,
) {
  const x = PAGE_MARGIN;
  const y = 310;
  const width = PAGE_WIDTH - PAGE_MARGIN * 2;
  const height = 410;
  roundedRect(ctx, x, y, width, height, 10, '#0d0d0d');

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 24px ${FONT_FAMILY}`;
  ctx.fillText('Durum Dağılımı', x + 28, y + 48);

  const donutData = [
    {
      label: 'Tamamlanmış',
      value: summary.tamamlanmis,
      color: STATUS_COLORS.tamamlanmis,
    },
    {
      label: 'Tamamlanmayan',
      value: summary.tamamlanmayan,
      color: STATUS_COLORS.tamamlanmayan,
    },
    {
      label: 'Gecikmiş',
      value: summary.gecikmis,
      color: STATUS_COLORS.gecikmis,
    },
    {
      label: 'Atama Yapılmadı',
      value: summary.atama_yapilmadi,
      color: STATUS_COLORS.atamaYapilmadi,
    },
  ].filter((item) => item.value > 0);

  drawDonutChart(ctx, donutData, x + width / 2, y + 212, 106, 62);
  drawLegend(ctx, donutData, x + width / 2, y + 360);
}

function drawStatusSummary(
  ctx: CanvasRenderingContext2D,
  summary: ReturnType<typeof summarize>,
) {
  const total =
    summary.tamamlanmis +
    summary.tamamlanmayan +
    summary.gecikmis +
    summary.atama_yapilmadi;
  let y = 770;

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 26px ${FONT_FAMILY}`;
  ctx.fillText('Durum Özeti', PAGE_MARGIN, y);
  y += 34;

  const rows = [
    ['Toplam aksiyon MOC sayısı', total],
    ['Tamamlanmış aksiyon sayısı', summary.tamamlanmis],
    ['Tamamlanmayan aksiyon sayısı', summary.tamamlanmayan],
    ['Gecikmiş aksiyon sayısı', summary.gecikmis],
    ['Aksiyon ataması yapılmadı sayısı', summary.atama_yapilmadi],
  ];

  rows.forEach(([label, value], index) => {
    const rowY = y + index * 44;
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#eef2f7';
    roundedRect(ctx, PAGE_MARGIN, rowY, PAGE_WIDTH - PAGE_MARGIN * 2, 38, 6);
    ctx.fillStyle = '#334155';
    ctx.font = `600 20px ${FONT_FAMILY}`;
    ctx.fillText(String(label), PAGE_MARGIN + 18, rowY + 26);
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 22px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(value), PAGE_WIDTH - PAGE_MARGIN - 18, rowY + 27);
    ctx.textAlign = 'left';
  });

  return y + rows.length * 44 + 44;
}

function drawContinuationHeader(
  ctx: CanvasRenderingContext2D,
  scopeLabel: string,
) {
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 30px ${FONT_FAMILY}`;
  ctx.fillText('Aksiyonlar Raporu', PAGE_MARGIN, 72);
  ctx.fillStyle = '#475569';
  ctx.font = `400 20px ${FONT_FAMILY}`;
  ctx.fillText(`${scopeLabel} · Aksiyon Detayları`, PAGE_MARGIN, 108);
  return 156;
}

function drawDetailSectionTitle(
  ctx: CanvasRenderingContext2D,
  y: number,
  section: DetailSection,
  continuation: boolean,
) {
  ctx.fillStyle = section.color;
  ctx.fillRect(PAGE_MARGIN, y - 20, 8, 32);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 26px ${FONT_FAMILY}`;
  ctx.fillText(
    continuation
      ? `${section.title} (devam)`
      : `${section.title} (${section.rows.length})`,
    PAGE_MARGIN + 18,
    y,
  );

  return y + 28;
}

function drawNoDetailsState(ctx: CanvasRenderingContext2D, y: number) {
  roundedRect(ctx, PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN * 2, 90, 8, '#ffffff');
  ctx.fillStyle = '#475569';
  ctx.font = `600 22px ${FONT_FAMILY}`;
  ctx.fillText(
    'Detaylandırılacak tamamlanmayan, gecikmiş veya atamasız aksiyon bulunmuyor.',
    PAGE_MARGIN + 24,
    y + 54,
  );
}

function drawEmptySectionState(
  ctx: CanvasRenderingContext2D,
  y: number,
  section: DetailSection,
) {
  roundedRect(ctx, PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN * 2, 54, 8, '#ffffff');
  ctx.fillStyle = '#475569';
  ctx.font = `600 18px ${FONT_FAMILY}`;
  ctx.fillText(`${section.title.replace(' Detayları', '')} bulunmuyor.`, PAGE_MARGIN + 20, y + 34);
}

function drawTableHeader(ctx: CanvasRenderingContext2D, y: number) {
  roundedRect(ctx, PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN * 2, 44, 6, '#111827');
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 17px ${FONT_FAMILY}`;

  let x = PAGE_MARGIN + 14;
  TABLE_COLUMNS.forEach((column) => {
    ctx.fillText(column.label, x, y + 29);
    x += column.width;
  });
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  row: ActionReportRow,
  y: number,
  height: number,
  index: number,
  section: DetailSection,
) {
  roundedRect(
    ctx,
    PAGE_MARGIN,
    y,
    PAGE_WIDTH - PAGE_MARGIN * 2,
    height - 4,
    6,
    index % 2 === 0 ? '#ffffff' : '#eef2f7',
  );

  let x = PAGE_MARGIN + 14;
  TABLE_COLUMNS.forEach((column) => {
    const value = row[column.key as TableColumnKey];
    ctx.fillStyle =
      column.key === 'responsible' || column.key === 'targetDate'
        ? section.color
        : '#334155';
    ctx.font = `600 17px ${FONT_FAMILY}`;
    drawWrappedText(ctx, value, x, y + 28, column.width - 18, ROW_LINE_HEIGHT);
    x += column.width;
  });
}

function measureRowHeight(
  ctx: CanvasRenderingContext2D,
  row: ActionReportRow,
) {
  ctx.font = `600 17px ${FONT_FAMILY}`;
  const lineCounts = TABLE_COLUMNS.map(
    (column) => wrapText(ctx, row[column.key], column.width - 18).length,
  );
  return Math.max(58, Math.max(...lineCounts) * ROW_LINE_HEIGHT + 30);
}

function drawDonutChart(
  ctx: CanvasRenderingContext2D,
  data: { label: string; value: number; color: string }[],
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return;

  let startAngle = -Math.PI / 2;
  data.forEach((item) => {
    const angle = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + angle);
    ctx.arc(cx, cy, innerRadius, startAngle + angle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
    startAngle += angle;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0d0d';
  ctx.fill();
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  data: { label: string; value: number; color: string }[],
  centerX: number,
  y: number,
) {
  ctx.font = `600 20px ${FONT_FAMILY}`;
  const entries = data.map((item) => ({
    ...item,
    width: ctx.measureText(`${item.label} ${item.value}`).width + 40,
  }));
  const totalWidth = entries.reduce((sum, item) => sum + item.width, 0);
  let x = centerX - totalWidth / 2;

  entries.forEach((item) => {
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - 16, 20, 20);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${item.label} ${item.value}`, x + 28, y);
    x += item.width;
  });
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  wrapText(ctx, text, maxWidth).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function drawCardLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  const lines = wrapText(ctx, text, maxWidth);
  const visibleLines = lines.slice(0, 2);
  if (lines.length > 2 && visibleLines.length > 0) {
    visibleLines[visibleLines.length - 1] = truncateLine(
      ctx,
      visibleLines[visibleLines.length - 1],
      maxWidth,
    );
  }

  visibleLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * 20);
  });
}

function truncateLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  let output = text;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const clean = text.trim() || '-';
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }

    if (current) lines.push(current);
    current = word;

    while (ctx.measureText(current).width > maxWidth && current.length > 1) {
      let sliceLength = current.length - 1;
      while (
        sliceLength > 1 &&
        ctx.measureText(`${current.slice(0, sliceLength)}-`).width > maxWidth
      ) {
        sliceLength--;
      }
      lines.push(`${current.slice(0, sliceLength)}-`);
      current = current.slice(sliceLength);
    }
  });

  if (current) lines.push(current);
  if (lines.length <= MAX_CELL_LINES) return lines;

  const limited = lines.slice(0, MAX_CELL_LINES);
  const lastLine = limited[MAX_CELL_LINES - 1];
  limited[MAX_CELL_LINES - 1] =
    lastLine.length > 1 ? `${lastLine.slice(0, -1)}…` : '…';
  return limited;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fillStyle) ctx.fillStyle = fillStyle;
  ctx.fill();
}

function canvasToJpeg(canvas: HTMLCanvasElement): PdfImage {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    data[i] = binary.charCodeAt(i);
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

  return new Blob([concatBytes(parts) as BlobPart], {
    type: 'application/pdf',
  });
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
