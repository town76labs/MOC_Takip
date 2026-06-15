// Ham (raw) Excel satırı: anahtarlar normalize edilmiş başlık.
export type RawRow = Record<string, unknown>;

// Teknik Görüş / Görev Listesi Excel satırı
export interface TechnicalRow {
  sirket: string;
  mocFormNo: string;
  mocKonusu: string;
  uniteAdi: string;
  disiplin: string;
  terminTarihi: Date | null;
  kullanici: string;
  durum: string;
  yetkiListesi?: string;
}

// Aksiyonlar Excel satırı
export interface ActionRow {
  sirket: string;
  mocFormNo: string;
  mocKonusu: string;
  uniteAdi: string;
  sorumlular: string;
  aksiyonAciklamasi: string;
  durum: string;
  mocDurumu: string;
  hedefTarih: Date | null;
}

// MOC bazında gruplanmış teknik görüş kaydı
export type TechnicalStatus =
  | 'tamamlandi'
  | 'bilgi_notu_paylasilmamis'
  | 'gecikmis'
  | 'geri_gonderildi'
  | 'bekliyor';

export interface TechnicalMOC {
  mocFormNo: string;
  sirket: string;
  mocKonusu: string;
  uniteAdi: string;
  kullanicilar: {
    kullanici: string;
    durum: string;
    disiplin: string;
    terminTarihi: Date | null;
    yetkiListesi?: string;
  }[];
  status: TechnicalStatus;
  bilgiNotuPaylasilmamis: boolean;
}

// Aksiyon kategorileri
export type ActionCategory =
  | 'tamamlanmis'
  | 'tamamlanmayan'
  | 'gecikmis'
  | 'atama_yapilmadi';

export interface ActionMOC {
  rowId: string;
  mocFormNo: string;
  sirket: string;
  mocKonusu: string;
  uniteAdi: string;
  sorumlular: string[]; // birleştirilmiş tüm sorumlular
  aksiyonAciklamasi: string;
  durum: string;
  mocDurumu: string;
  hedefTarih: Date | null;
  category: ActionCategory | null;
}

// Excel başlık eşleştirmesi için
export interface ColumnMapping {
  [normalizedHeader: string]: string; // beklenen anahtar -> bulunan başlık
}

export interface ParseError {
  message: string;
  missing?: string[];
  foundHeaders?: string[];
  details?: string[];
}

export type SCECompany = 'PETKIM' | 'STAR' | 'STAD';

export type SCEFactory =
  | 'ISKELE'
  | 'ETILEN'
  | 'AROMATIKLER'
  | 'AYPE'
  | 'AYPE-T'
  | 'PA'
  | 'PP'
  | 'YYPE';

export type SCECategory = 'all' | 'plans' | 'periodic';

export interface SCERow {
  rowId: string;
  sirket: SCECompany;
  fabrika: SCEFactory;
  fabrikaKodu: string;
  ekipmanNo: string;
  tagNo: string;
  ekipmanAdi: string;
  sutunELabel: string;
  sutunE: string;
  sutunFLabel: string;
  sutunF: string;
  sutunGLabel: string;
  sutunG: string;
  ekipmanTuru: string;
  sceGrubu: string;
  sceGozdenGecirme: string;
  sceSebebi: string;
  bakimPlaniNo: string;
  bakimKalemiNo: string;
  bakimPlani: string;
  bakimPeriyodu: string;
  deferralSureci: string;
  periyodikBakimDurumu: string;
  sonBakimTarihi: string;
  sonBakimBildirimSiparis: string;
  sonrakiBakimTarihi: string;
  raw: Record<string, string>;
}
