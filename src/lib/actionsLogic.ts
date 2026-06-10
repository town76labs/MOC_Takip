// Dashboard 2 — Aksiyonlar iş kuralları.
//
// Kategorileme:
//  - tamamlanmis       : Durum = "Onaylandı"
//  - tamamlanmayan      : Durum = "Aksiyon Bekleniyor" & MOC durumu = "aksiyon aşamasında"
//  - gecikmis           : Durum = "Gecikmiş" & MOC durumu = "aksiyon aşamasında"
//  - atama_yapilmadi    : MOC durumu = "Teknik Görüş/Kabul Aşamasında"
//
// Aynı MOC numarası altında birden fazla aksiyon satırı olabilir.
// Aksiyon ekranında her aksiyon satırı ayrı takip edilir.

import { eq, normalize } from './normalize';
import { splitSorumlular } from './excelParser';
import type { ActionCategory, ActionMOC, ActionRow } from '../types';

const DURUM_AKSIYON_BEKLENIYOR = 'aksiyon bekleniyor';
const DURUM_GECIKMIS = 'gecikmis';
const DURUM_ONAYLANDI = 'onaylandi';
const DURUM_TAMAMLANDI = 'tamamlandi';
const MOCDURUMU_AKSIYON_ASAMASINDA = 'aksiyon asamasinda';
const MOCDURUMU_TEKNIK_GORUS_KABUL = 'teknik gorus/kabul asamasinda';

export const TARGET_SORUMLULAR = [
  'Sarkhan HAJIZADA',
  'İlhan KESKİN',
  'Yunus GÜNEŞ',
  'Mevlüt ÖZ',
  'Mehmet AYDOĞAN',
  'Ömer Sinan AKAYDIN',
  'Mustafa Oğuz BALTA',
  'Eren YILDIRIM',
  'Mehmet ZEVKER',
  'Nihat ÇELİK',
  'Onur KARADUMAN',
  'Gökhan KAYA',
  'Hüseyin Kaan AYAZ',
  'Burak ARICILAR',
  'Hakan ÇELİK',
  'Fatih ALTINDAŞ',
  'Tuna PINAR',
];

/** Bir satırı aksiyon kategorilerinden birine yerleştir. */
function classifyRow(row: ActionRow): ActionCategory | null {
  const durum = normalize(row.durum);
  const mocDurum = normalize(row.mocDurumu);
  const isActionStage = mocDurum === MOCDURUMU_AKSIYON_ASAMASINDA;

  if (mocDurum === MOCDURUMU_TEKNIK_GORUS_KABUL) {
    return 'atama_yapilmadi';
  }

  if (durum.includes(DURUM_ONAYLANDI) || durum.includes(DURUM_TAMAMLANDI)) {
    return 'tamamlanmis';
  }
  if (isActionStage && durum.includes(DURUM_GECIKMIS)) return 'gecikmis';
  if (isActionStage && durum.includes(DURUM_AKSIYON_BEKLENIYOR)) {
    return 'tamamlanmayan';
  }

  return null;
}

export function buildActionMOCs(rows: ActionRow[]): ActionMOC[] {
  return rows
    .map((row, index) => ({
      rowId: [
        row.mocFormNo,
        row.aksiyonAciklamasi,
        row.sorumlular,
        row.hedefTarih?.getTime() ?? '',
        index,
      ].join('|'),
      mocFormNo: row.mocFormNo,
      sirket: row.sirket,
      mocKonusu: row.mocKonusu,
      uniteAdi: row.uniteAdi,
      sorumlular: splitSorumlular(row.sorumlular),
      aksiyonAciklamasi: row.aksiyonAciklamasi,
      durum: row.durum,
      mocDurumu: row.mocDurumu,
      hedefTarih: row.hedefTarih,
      category: classifyRow(row),
    }))
    .filter(
      (item) =>
        item.mocFormNo ||
        item.sorumlular.length > 0 ||
        item.aksiyonAciklamasi ||
        item.durum,
    );
}

export function uniqueCompanies(rows: ActionRow[]): string[] {
  const set = new Set<string>();
  rows.forEach((r) => r.sirket && set.add(r.sirket.trim()));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
}

/** Şirket + sorumlu listesi filtresi uygula. sorumlularFilter boş ise tümü dahil. */
export function applyFilters(
  mocs: ActionMOC[],
  selectedCompanies: string[],
  sorumlularFilter: string[],
): ActionMOC[] {
  return mocs.filter((m) => {
    if (selectedCompanies.length > 0) {
      const hit = selectedCompanies.some((s) => eq(s, m.sirket));
      if (!hit) return false;
    }
    if (sorumlularFilter.length > 0) {
      const hit = m.sorumlular.some((sr) =>
        sorumlularFilter.some((sel) => eq(sel, sr)),
      );
      if (!hit) return false;
    }
    return true;
  });
}

export interface ActionsSummary {
  tamamlanmis: number;
  tamamlanmayan: number;
  gecikmis: number;
  atama_yapilmadi: number;
}

export function summarize(mocs: ActionMOC[]): ActionsSummary {
  const out: ActionsSummary = {
    tamamlanmis: 0,
    tamamlanmayan: 0,
    gecikmis: 0,
    atama_yapilmadi: 0,
  };
  for (const m of mocs) {
    if (m.category) out[m.category]++;
  }
  return out;
}

export function byCategory(mocs: ActionMOC[], cat: ActionCategory): ActionMOC[] {
  return mocs.filter((m) => m.category === cat);
}
