import type { TechnicalMOC } from '../types';
import {
  openTechnicalTerminDates,
  summarize,
  technicalOpinionItems,
  usersWithoutTechnicalOpinion,
} from './technicalLogic';
import { formatDate } from './normalize';

interface TechnicalReportOptions {
  mocs: TechnicalMOC[];
  scopeLabel: string;
}

interface PendingReportRow {
  mocNo: string;
  company: string;
  unit: string;
  topic: string;
  pendingUsers: string;
  terminDates: string;
  status: string;
}

interface DetailReportSection {
  title: string;
  description: string;
  emptyMessage: string;
  color: string;
  rows: PendingReportRow[];
}

interface PdfImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_MARGIN = 60;
const PAGE_BOTTOM = PAGE_HEIGHT - PAGE_MARGIN;
const TABLE_HEADER_HEIGHT = 44;
const SECTION_TITLE_HEIGHT = 70;
const SECTION_GAP = 44;
const EMPTY_STATE_HEIGHT = 90;
const MIN_TABLE_ROW_HEIGHT = 70;
const MAX_TABLE_ROW_HEIGHT = 300;
const TABLE_ROW_GAP = 12;
const TABLE_ROW_LINE_HEIGHT = 24;
const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

const STATUS_COLORS = {
  tamamlandi: '#10b981',
  bilgiNotuPaylasilmamis: '#8b5cf6',
  gecikmis: '#ef4444',
  bekliyor: '#f59e0b',
  geriGonderildi: '#38bdf8',
};

const TABLE_COLUMNS = [
  { key: 'mocNo', label: 'MOC No', width: 128 },
  { key: 'company', label: 'Şirket', width: 100 },
  { key: 'unit', label: 'Ünite', width: 130 },
  { key: 'topic', label: 'MOC Konusu', width: 250 },
  { key: 'pendingUsers', label: 'Kullanıcılar', width: 260 },
  { key: 'terminDates', label: 'Termin Tarihi', width: 112 },
  { key: 'status', label: 'Durum', width: 140 },
] as const;

type TableColumnKey = (typeof TABLE_COLUMNS)[number]['key'];

export async function downloadTechnicalReportPdf({
  mocs,
  scopeLabel,
}: TechnicalReportOptions) {
  const pages = renderReportPages(mocs, scopeLabel);
  const pdf = buildPdf(pages);
  const url = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(`teknik-gorus-${scopeLabel}`)}-rapor.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderReportPages(mocs: TechnicalMOC[], scopeLabel: string): PdfImage[] {
  const summary = summarize(mocs);
  const detailSections = buildDetailSections(mocs);
  const pages: PdfImage[] = [];
  let sectionIndex = 0;
  let rowIndex = 0;
  let firstPage = true;

  while (firstPage || sectionIndex < detailSections.length) {
    const { canvas, ctx } = createCanvasPage();
    const introPage = firstPage;
    let y = firstPage
      ? drawReportIntro(ctx, scopeLabel, summary)
      : drawContinuationHeader(ctx, scopeLabel);

    firstPage = false;
    let drewDetail = false;

    while (sectionIndex < detailSections.length) {
      const section = detailSections[sectionIndex];
      const neededHeight =
        SECTION_TITLE_HEIGHT +
        (section.rows.length === 0
          ? EMPTY_STATE_HEIGHT
          : TABLE_HEADER_HEIGHT + MIN_TABLE_ROW_HEIGHT);

      if (drewDetail && y + neededHeight > PAGE_BOTTOM) break;
      if (introPage && !drewDetail && y + neededHeight > PAGE_BOTTOM) break;

      y = drawDetailSectionTitle(ctx, y, section, rowIndex > 0);
      drewDetail = true;

      if (section.rows.length === 0) {
        drawEmptyDetailState(ctx, y, section.emptyMessage);
        y += EMPTY_STATE_HEIGHT + SECTION_GAP;
        sectionIndex++;
        rowIndex = 0;
        continue;
      }

      const result = drawDetailRows(ctx, section.rows, rowIndex, y);
      rowIndex = result.nextIndex;
      y = result.y;

      if (rowIndex < section.rows.length) break;
      sectionIndex++;
      rowIndex = 0;
      y += SECTION_GAP;
    }

    pages.push(canvasToJpeg(canvas));
  }

  return pages;
}

function buildDetailSections(mocs: TechnicalMOC[]): DetailReportSection[] {
  return [
    {
      title: 'Gecikmiş',
      description:
        'Durumu gecikmiş olan MOC teknik görüşleri, bekleyen kullanıcılar ve termin tarihleri.',
      emptyMessage: 'Gecikmiş MOC bulunmuyor.',
      color: STATUS_COLORS.gecikmis,
      rows: toSortedRows(
        mocs
          .filter((moc) => moc.status === 'gecikmis')
          .map((moc) => toReportRow(moc, 'open')),
      ),
    },
    {
      title: 'Teknik Görüş Bekleyen',
      description:
        'Teknik görüşü henüz alınmamış MOC kayıtları ve bekleyen kullanıcılar.',
      emptyMessage: 'Teknik görüş bekleyen MOC bulunmuyor.',
      color: STATUS_COLORS.bekliyor,
      rows: toSortedRows(
        mocs
          .filter((moc) => moc.status === 'bekliyor')
          .map((moc) => toReportRow(moc, 'open')),
      ),
    },
    {
      title: 'MOC Bilgi Notu Eklenmemiş',
      description:
        'MOC Takip Excelinde bulunmayan MOC kayıtları ve teknik görüş kullanıcıları.',
      emptyMessage: 'MOC bilgi notu eklenmemiş kayıt bulunmuyor.',
      color: STATUS_COLORS.bilgiNotuPaylasilmamis,
      rows: toSortedRows(
        mocs
          .filter((moc) => moc.bilgiNotuPaylasilmamis)
          .map((moc) => toReportRow(moc, 'all')),
      ),
    },
    {
      title: 'Değişiklik Geri Gönderilmiş',
      description: 'Değişiklik geri gönderildi durumundaki MOC teknik görüşleri.',
      emptyMessage: 'Değişiklik geri gönderilmiş MOC bulunmuyor.',
      color: STATUS_COLORS.geriGonderildi,
      rows: toSortedRows(
        mocs
          .filter((moc) => moc.status === 'geri_gonderildi')
          .map((moc) => toReportRow(moc, 'all')),
      ),
    },
  ];
}

function toReportRow(
  moc: TechnicalMOC,
  userMode: 'open' | 'all',
): PendingReportRow {
  return {
    mocNo: moc.mocFormNo || '-',
    company: moc.sirket || '(belirtilmemiş)',
    unit: moc.uniteAdi || '-',
    topic: moc.mocKonusu || '-',
    pendingUsers:
      userMode === 'all'
        ? formatAllTechnicalUsers(moc)
        : usersWithoutTechnicalOpinion(moc).join(', ') || '-',
    terminDates: formatTerminDates(moc, userMode),
    status: formatMocStatus(moc),
  };
}

function formatAllTechnicalUsers(moc: TechnicalMOC) {
  return (
    technicalOpinionItems(moc)
      .map((item) =>
        item.durum ? `${item.kullanici} (${item.durum})` : item.kullanici,
      )
      .join(', ') || '-'
  );
}

function formatTerminDates(moc: TechnicalMOC, userMode: 'open' | 'all') {
  const dates =
    userMode === 'all'
      ? uniqueDates(technicalOpinionItems(moc).map((item) => item.terminTarihi))
      : openTechnicalTerminDates(moc);
  return dates.map((date) => formatDate(date)).join(', ') || '-';
}

function uniqueDates(dates: (Date | null)[]) {
  const unique = new Map<number, Date>();
  dates.forEach((date) => {
    if (date) unique.set(date.getTime(), date);
  });
  return Array.from(unique.values()).sort((a, b) => a.getTime() - b.getTime());
}

function formatMocStatus(moc: TechnicalMOC) {
  const primaryStatus =
    moc.status === 'gecikmis'
      ? 'Gecikmiş'
      : moc.status === 'bekliyor'
        ? 'Bekleyen'
        : moc.status === 'tamamlandi'
          ? 'Tamamlandı'
          : moc.status === 'geri_gonderildi'
            ? 'Geri Gönderildi'
            : 'Bilgi Notu Yok';
  return [primaryStatus, moc.bilgiNotuPaylasilmamis ? 'Bilgi Notu Yok' : '']
    .filter(Boolean)
    .join(' / ');
}

function toSortedRows(rows: PendingReportRow[]) {
  return rows.sort(
    (a, b) =>
      a.company.localeCompare(b.company, 'tr') ||
      a.mocNo.localeCompare(b.mocNo, 'tr'),
  );
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
  ctx.fillText('Teknik Görüş Raporu', PAGE_MARGIN, 72);

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
      label: 'Toplam MOC',
      value: summary.total,
      note: '',
      color: '#cbd5e1',
    },
    {
      label: 'Teknik Görüşü Tamamlanan',
      value: summary.tamamlandi,
      note: `%${Math.round(summary.tamamlanmaOrani * 100)} tamamlandı`,
      color: STATUS_COLORS.tamamlandi,
    },
    {
      label: 'MOC Bilgi Notu Paylaşılmamış',
      value: summary.bilgiNotuPaylasilmamis,
      note: '',
      color: STATUS_COLORS.bilgiNotuPaylasilmamis,
    },
    {
      label: 'Gecikmiş',
      value: summary.gecikmis,
      note: '',
      color: STATUS_COLORS.gecikmis,
    },
    {
      label: 'Bekleyen',
      value: summary.bekliyor,
      note: '',
      color: STATUS_COLORS.bekliyor,
    },
    {
      label: 'Değişiklik Geri Gönderildi',
      value: summary.geriGonderildi,
      note: '',
      color: STATUS_COLORS.geriGonderildi,
    },
  ];

  const gap = 18;
  const cardWidth = (PAGE_WIDTH - PAGE_MARGIN * 2 - gap * 5) / 6;
  const y = 150;

  cards.forEach((card, index) => {
    const x = PAGE_MARGIN + index * (cardWidth + gap);
    roundedRect(ctx, x, y, cardWidth, 126, 10, '#0d0d0d');
    roundedRect(ctx, x, y, cardWidth, 8, 6, card.color);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 17px ${FONT_FAMILY}`;
    drawCardLabel(ctx, card.label, x + 24, y + 42, cardWidth - 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 34px ${FONT_FAMILY}`;
    ctx.fillText(String(card.value), x + 24, y + 102);

    if (card.note) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `400 16px ${FONT_FAMILY}`;
      drawSingleLine(ctx, card.note, x + 24, y + 122, cardWidth - 48);
    }
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
      label: 'Tamamlandı',
      value: summary.tamamlandi,
      color: STATUS_COLORS.tamamlandi,
    },
    {
      label: 'Bilgi Notu Paylaşılmamış',
      value: summary.bilgiNotuPaylasilmamis,
      color: STATUS_COLORS.bilgiNotuPaylasilmamis,
    },
    {
      label: 'Gecikmiş',
      value: summary.gecikmis,
      color: STATUS_COLORS.gecikmis,
    },
    {
      label: 'Bekliyor',
      value: summary.bekliyor,
      color: STATUS_COLORS.bekliyor,
    },
    {
      label: 'Geri Gönderildi',
      value: summary.geriGonderildi,
      color: STATUS_COLORS.geriGonderildi,
    },
  ].filter((item) => item.value > 0);

  drawDonutChart(ctx, donutData, x + width / 2, y + 212, 106, 62);
  drawLegend(ctx, donutData, x + width / 2, y + 360);
}

function drawStatusSummary(
  ctx: CanvasRenderingContext2D,
  summary: ReturnType<typeof summarize>,
) {
  let y = 770;
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 26px ${FONT_FAMILY}`;
  ctx.fillText('Durum Özeti', PAGE_MARGIN, y);
  y += 34;

  const rows = [
    ['Toplam MOC', summary.total],
    ['Teknik görüşü tamamlanan MOC sayısı', summary.tamamlandi],
    ['MOC bilgi notu paylaşılmamış MOC sayısı', summary.bilgiNotuPaylasilmamis],
    ['Gecikmiş MOC sayısı', summary.gecikmis],
    ['Bekleyen MOC sayısı', summary.bekliyor],
    ['Değişiklik geri gönderilen MOC sayısı', summary.geriGonderildi],
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
  ctx.fillText('Teknik Görüş Raporu', PAGE_MARGIN, 72);
  ctx.fillStyle = '#475569';
  ctx.font = `400 20px ${FONT_FAMILY}`;
  ctx.fillText(`${scopeLabel} · MOC Detayları`, PAGE_MARGIN, 108);
  return 156;
}

function drawDetailSectionTitle(
  ctx: CanvasRenderingContext2D,
  y: number,
  section: DetailReportSection,
  continuation: boolean,
) {
  ctx.fillStyle = section.color;
  roundedRect(ctx, PAGE_MARGIN, y - 24, 8, 32, 4);
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 26px ${FONT_FAMILY}`;
  ctx.fillText(
    continuation
      ? `${section.title} (devam)`
      : `${section.title} (${section.rows.length})`,
    PAGE_MARGIN + 18,
    y,
  );

  ctx.fillStyle = '#64748b';
  ctx.font = `400 18px ${FONT_FAMILY}`;
  ctx.fillText(section.description, PAGE_MARGIN + 18, y + 30);

  return y + SECTION_TITLE_HEIGHT;
}

function drawEmptyDetailState(
  ctx: CanvasRenderingContext2D,
  y: number,
  message: string,
) {
  roundedRect(
    ctx,
    PAGE_MARGIN,
    y,
    PAGE_WIDTH - PAGE_MARGIN * 2,
    EMPTY_STATE_HEIGHT,
    8,
    '#ffffff',
  );
  ctx.fillStyle = '#475569';
  ctx.font = `600 22px ${FONT_FAMILY}`;
  ctx.fillText(message, PAGE_MARGIN + 24, y + 54);
}

function drawDetailRows(
  ctx: CanvasRenderingContext2D,
  rows: PendingReportRow[],
  startIndex: number,
  y: number,
) {
  drawTableHeader(ctx, y);
  y += TABLE_HEADER_HEIGHT + 10;

  let index = startIndex;
  while (index < rows.length) {
    const row = rows[index];
    const rowHeight = measureRowHeight(ctx, row);
    if (y + rowHeight + TABLE_ROW_GAP > PAGE_BOTTOM) break;
    drawTableRow(ctx, row, y, rowHeight, index);
    y += rowHeight + TABLE_ROW_GAP;
    index++;
  }

  return { nextIndex: index, y };
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
  row: PendingReportRow,
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
    6,
    index % 2 === 0 ? '#ffffff' : '#eef2f7',
  );

  let x = PAGE_MARGIN + 14;
  TABLE_COLUMNS.forEach((column) => {
    const value = row[column.key as TableColumnKey];
    const maxLines = Math.max(
      1,
      Math.floor((height - 34) / TABLE_ROW_LINE_HEIGHT),
    );
    ctx.fillStyle =
      column.key === 'pendingUsers'
        ? '#b45309'
        : column.key === 'status' && row.status.includes('Gecikmiş')
          ? '#be123c'
          : '#334155';
    ctx.font = `600 17px ${FONT_FAMILY}`;
    drawWrappedText(
      ctx,
      value,
      x,
      y + 30,
      column.width - 18,
      TABLE_ROW_LINE_HEIGHT,
      maxLines,
    );
    x += column.width;
  });
}

function measureRowHeight(
  ctx: CanvasRenderingContext2D,
  row: PendingReportRow,
) {
  ctx.font = `600 17px ${FONT_FAMILY}`;
  const lineCounts = TABLE_COLUMNS.map(
    (column) => wrapText(ctx, row[column.key], column.width - 18).length,
  );
  return Math.min(
    MAX_TABLE_ROW_HEIGHT,
    Math.max(
      MIN_TABLE_ROW_HEIGHT,
      Math.max(...lineCounts) * TABLE_ROW_LINE_HEIGHT + 36,
    ),
  );
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
  maxLines?: number,
) {
  const lines = wrapText(ctx, text, maxWidth);
  const visibleLines = maxLines ? lines.slice(0, maxLines) : lines;
  if (maxLines && lines.length > maxLines && visibleLines.length > 0) {
    visibleLines[visibleLines.length - 1] = truncateLine(
      ctx,
      visibleLines[visibleLines.length - 1],
      maxWidth,
    );
  }

  visibleLines.forEach((line, index) => {
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
    ctx.fillText(line, x, y + index * 19);
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

function drawSingleLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  let output = text;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  ctx.fillText(`${output}…`, x, y);
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
  return lines;
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
