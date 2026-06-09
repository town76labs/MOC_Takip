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
