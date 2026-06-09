// String/tarih normalize yardımcıları.
// Karşılaştırmalar trim + lowercase + Türkçe karakter normalizasyonu üzerinden yapılır.

const TR_MAP: Record<string, string> = {
  ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
};

/** Türkçe karakterleri ASCII'ye çevirir, küçük harfe çevirir, fazla boşlukları temizler. */
export function normalize(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value).trim();
  s = s.replace(/[ıİşŞğĞüÜöÖçÇ]/g, (ch) => TR_MAP[ch] ?? ch);
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase();
  // birden fazla boşluğu tek boşluğa indir
  s = s.replace(/\s+/g, ' ');
  return s;
}

/** Hücre değerini güvenli string'e çevirir (görüntüleme için). */
export function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value);
  return String(value).trim();
}

/** MOC numaralarını karşılaştırma için tek forma indirir. */
export function normalizeMocNo(value: unknown): string {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

/** MOC numarasını gösterim için sadeleştirir. */
export function formatMocNo(value: unknown): string {
  return toDisplayString(value).replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
}

/**
 * Excel hücresinden tarih değeri okur.
 * - Date objesi -> aynen döner
 * - Sayı (Excel seri tarih) -> Date'e çevrilir
 * - String -> tr-TR (dd/mm/yyyy veya dd.mm.yyyy) ve ISO denemesi
 */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    // Excel serial date -> JS Date
    // Excel epoch: 1899-12-30
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400; // saniye
    const dateInfo = new Date(utcValue * 1000);
    const fractionalDay = value - Math.floor(value) + 0.0000001;
    let totalSeconds = Math.floor(86400 * fractionalDay);
    const seconds = totalSeconds % 60;
    totalSeconds -= seconds;
    const hours = Math.floor(totalSeconds / (60 * 60));
    const minutes = Math.floor(totalSeconds / 60) % 60;
    return new Date(
      Date.UTC(
        dateInfo.getUTCFullYear(),
        dateInfo.getUTCMonth(),
        dateInfo.getUTCDate(),
        hours,
        minutes,
        seconds,
      ),
    );
  }

  const s = String(value).trim();
  // dd/mm/yyyy veya dd.mm.yyyy veya dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }
  // ISO veya diğer parse edilebilir formatlar
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Tarihi tr-TR (gg/aa/yyyy) formatında göster. */
export function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Bir tarihin "bugünden önce" olup olmadığını döner (gecikme kontrolü). */
export function isPastDue(d: Date | null | undefined, now = new Date()): boolean {
  if (!d) return false;
  // saat farkını yok say: yalnız gün karşılaştır
  const dn = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nn = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dn.getTime() < nn.getTime();
}

/** Aynı string'leri normalize karşılaştır. */
export function eq(a: unknown, b: unknown): boolean {
  return normalize(a) === normalize(b);
}

/** "İçeriyor mu?" — normalize edilmiş aramayla. */
export function includes(a: unknown, b: unknown): boolean {
  return normalize(a).includes(normalize(b));
}
