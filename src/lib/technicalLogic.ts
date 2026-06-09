// Dashboard 1 — Teknik Görüş / Teknik Kabul iş kuralları.
//
// Kurallar:
//  - MOC form no'ya göre grupla.
//  - MOC Takip Excel'inde olmayan MOC'lar bilgiNotuPaylasilmamis bayrağı alır.
//    Bu bayrak teknik durumdan bağımsızdır; aynı MOC hem gecikmiş/bekleyen
//    hem de bilgi notu paylaşılmamış olabilir.
//  - Herhangi bir satırın Durum değeri "Teknik Görüş Alındı" ise MOC
//    tamamlandi olur. Bir onay MOC için yeterlidir.
//  - Herhangi bir satır "geri gönderildi" sinyali taşıyorsa MOC
//    geri_gonderildi olur.
//  - Herhangi bir satırın Durum değeri "Gecikmiş" ise MOC gecikmis olur.
//  - Aksi halde MOC bekliyor sayılır.

import { eq, formatMocNo, includes, normalize, normalizeMocNo } from './normalize';
import type { TechnicalMOC, TechnicalRow, TechnicalStatus } from '../types';

const COMPLETED_STATUS_SIGNAL = 'teknik gorus alindi';
const RETURNED_STATUS_SIGNALS = ['geri gonderildi'];
const LATE_STATUS_SIGNAL = 'gecikmis';

export function isTechnicalCompletionSignal(durum: string): boolean {
  const status = normalize(durum);
  return status === COMPLETED_STATUS_SIGNAL;
}

export function isTechnicalReturnedSignal(durum: string): boolean {
  const status = normalize(durum);
  return RETURNED_STATUS_SIGNALS.some((signal) => status.includes(signal));
}

export function isTechnicalLateSignal(durum: string): boolean {
  const status = normalize(durum);
  return status === LATE_STATUS_SIGNAL;
}

/** Tek bir satırın durumunu yorumlar. */
function classifyRowStatus(row: TechnicalRow): TechnicalStatus | null {
  if (isTechnicalCompletionSignal(row.durum)) return 'tamamlandi';
  if (isTechnicalReturnedSignal(row.durum)) return 'geri_gonderildi';
  if (isTechnicalLateSignal(row.durum)) return 'gecikmis';
  return null; // bekliyor için aşağıda fallback uygulanır
}

/** MOC bazında grupla ve duruma karar ver. */
export function buildTechnicalMOCs(
  rows: TechnicalRow[],
  mocTakipMocNos: string[] = [],
): TechnicalMOC[] {
  const map = new Map<string, TechnicalMOC>();
  const mocTakipSet = new Set(
    mocTakipMocNos.map((mocNo) => normalizeMocNo(mocNo)).filter(Boolean),
  );
  const shouldCheckMocTakip = mocTakipSet.size > 0;

  for (const row of rows) {
    const key = normalizeMocNo(row.mocFormNo);
    if (!key) continue;

    let item = map.get(key);
    if (!item) {
      item = {
        mocFormNo: formatMocNo(row.mocFormNo),
        sirket: row.sirket,
        mocKonusu: row.mocKonusu,
        uniteAdi: row.uniteAdi,
        kullanicilar: [],
        status: 'bekliyor',
        bilgiNotuPaylasilmamis: false,
      };
      map.set(key, item);
    }

    // Konu/ünite alanları boş geldiyse sonradan dolu satırla zenginleştir.
    if (!item.mocKonusu && row.mocKonusu) item.mocKonusu = row.mocKonusu;
    if (!item.uniteAdi && row.uniteAdi) item.uniteAdi = row.uniteAdi;
    if (!item.sirket && row.sirket) item.sirket = row.sirket;

    item.kullanicilar.push({
      kullanici: row.kullanici,
      durum: row.durum,
      disiplin: row.disiplin,
      terminTarihi: row.terminTarihi,
      yetkiListesi: row.yetkiListesi,
    });

    const cls = classifyRowStatus(row);
    if (cls === 'tamamlandi') {
      item.status = 'tamamlandi';
    } else if (cls === 'geri_gonderildi' && item.status !== 'tamamlandi') {
      item.status = 'geri_gonderildi';
    } else if (
      cls === 'gecikmis' &&
      item.status !== 'tamamlandi' &&
      item.status !== 'geri_gonderildi'
    ) {
      item.status = 'gecikmis';
    }
  }

  const mocs = Array.from(map.values());
  if (!shouldCheckMocTakip) return mocs;

  return mocs.map((moc) =>
    mocTakipSet.has(normalizeMocNo(moc.mocFormNo))
      ? moc
      : { ...moc, bilgiNotuPaylasilmamis: true },
  );
}

/** Şirket listesi (unique). */
export function uniqueCompanies(rows: TechnicalRow[]): string[] {
  const set = new Set<string>();
  rows.forEach((r) => r.sirket && set.add(r.sirket.trim()));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
}

export interface TechnicalSummary {
  total: number;
  tamamlandi: number;
  bilgiNotuPaylasilmamis: number;
  gecikmis: number;
  bekliyor: number;
  geriGonderildi: number;
  tamamlanmaOrani: number; // 0..1
}

export function summarize(mocs: TechnicalMOC[]): TechnicalSummary {
  const total = mocs.length;
  let tamamlandi = 0;
  let bilgiNotuPaylasilmamis = 0;
  let gecikmis = 0;
  let bekliyor = 0;
  let geriGonderildi = 0;
  for (const m of mocs) {
    if (m.bilgiNotuPaylasilmamis) bilgiNotuPaylasilmamis++;
    if (m.status === 'tamamlandi') tamamlandi++;
    else if (m.status === 'gecikmis') gecikmis++;
    else if (m.status === 'geri_gonderildi') geriGonderildi++;
    else bekliyor++;
  }
  return {
    total,
    tamamlandi,
    bilgiNotuPaylasilmamis,
    gecikmis,
    bekliyor,
    geriGonderildi,
    tamamlanmaOrani: total > 0 ? tamamlandi / total : 0,
  };
}

/** Şirket filtresi uygula (boş seçim = tümü). */
export function filterByCompanies(
  mocs: TechnicalMOC[],
  selected: string[],
): TechnicalMOC[] {
  if (selected.length === 0) return mocs;
  return mocs.filter((m) =>
    selected.some((s) => eq(s, m.sirket) || includes(m.sirket, s)),
  );
}

/** Teknik durum filtresi uygula (boş seçim = tümü). */
export function filterByStatuses(
  mocs: TechnicalMOC[],
  selected: TechnicalStatus[],
): TechnicalMOC[] {
  if (selected.length === 0) return mocs;
  return mocs.filter((m) =>
    selected.some((status) =>
      status === 'bilgi_notu_paylasilmamis'
        ? m.bilgiNotuPaylasilmamis
        : m.status === status,
    ),
  );
}

/** Teknik görüş vermeyen kullanıcıları döner. */
export function usersWithoutTechnicalOpinion(moc: TechnicalMOC): string[] {
  const users: string[] = [];
  for (const item of moc.kullanicilar) {
    const name = item.kullanici.trim();
    if (!name) continue;
    if (isTechnicalCompletionSignal(item.durum)) continue;
    if (!users.some((u) => eq(u, name))) users.push(name);
  }
  return users;
}

export function openTechnicalOpinionItems(moc: TechnicalMOC): {
  kullanici: string;
  terminTarihi: Date | null;
}[] {
  const items: { kullanici: string; terminTarihi: Date | null }[] = [];
  const seen = new Set<string>();

  for (const item of moc.kullanicilar) {
    const name = item.kullanici.trim();
    if (!name) continue;
    if (isTechnicalCompletionSignal(item.durum)) continue;

    const dateKey = item.terminTarihi?.getTime() ?? 'no-date';
    const key = `${normalize(name)}|${dateKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ kullanici: name, terminTarihi: item.terminTarihi });
  }

  return items.sort((a, b) => {
    const at = a.terminTarihi?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.terminTarihi?.getTime() ?? Number.POSITIVE_INFINITY;
    return at - bt || a.kullanici.localeCompare(b.kullanici, 'tr');
  });
}

export function technicalOpinionItems(moc: TechnicalMOC): {
  kullanici: string;
  durum: string;
  terminTarihi: Date | null;
}[] {
  const items: {
    kullanici: string;
    durum: string;
    terminTarihi: Date | null;
  }[] = [];
  const seen = new Set<string>();

  for (const item of moc.kullanicilar) {
    const name = item.kullanici.trim();
    if (!name) continue;

    const status = item.durum.trim();
    const dateKey = item.terminTarihi?.getTime() ?? 'no-date';
    const key = `${normalize(name)}|${normalize(status)}|${dateKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      kullanici: name,
      durum: status,
      terminTarihi: item.terminTarihi,
    });
  }

  return items.sort((a, b) => {
    const at = a.terminTarihi?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.terminTarihi?.getTime() ?? Number.POSITIVE_INFINITY;
    return at - bt || a.kullanici.localeCompare(b.kullanici, 'tr');
  });
}

export function openTechnicalTerminDates(moc: TechnicalMOC): Date[] {
  const dates = openTechnicalOpinionItems(moc)
    .map((item) => item.terminTarihi)
    .filter((date): date is Date => !!date);
  const unique = new Map<number, Date>();
  dates.forEach((date) => unique.set(date.getTime(), date));
  return Array.from(unique.values()).sort((a, b) => a.getTime() - b.getTime());
}
