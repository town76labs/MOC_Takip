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
  durusGereklilikYorumu: string;
  durusAciklamasi: string;
  deferralSureci: string;
  periyodikBakimDurumu: string;
  sonKontrolTarihi: string;
  sonKontrolSutunuVar: boolean;
  sonBakimTarihi: string;
  sonBakimBildirimSiparis: string;
  sonrakiBakimTarihi: string;
  raw: Record<string, string>;
}

export type SCEV2MaintenanceStatus =
  | 'completed'
  | 'shutdown_deferred'
  | 'maintenance_not_completed'
  | 'order_not_found';

export type SCEV2DeferralStatus =
  | 'not_applicable'
  | 'started'
  | 'required';

export type SCEV2CalibrationStatus =
  | 'shared'
  | 'not_shared'
  | 'unknown'
  | 'not_applicable';

export interface SCEV2Row {
  rowId: string;
  sourceRow: number;
  company: 'PETKIM' | 'STAR';
  factory: string;
  businessArea: string;
  unit: string;
  consoleName: string;
  categoryType: string;
  equipmentType: string;
  equipmentNo: string;
  tagNo: string;
  equipmentDescription: string;
  notificationNo: string;
  orderNo: string;
  userStatus: string;
  maintenanceStartDate: Date | null;
  maintenanceEndDate: Date | null;
  plannedCompletionDate: Date | null;
  maintenanceItemNo: string;
  maintenancePlanNo: string;
  maintenancePeriod: string;
  maintenanceStatus: SCEV2MaintenanceStatus;
  raw: Record<string, string>;
}

export interface SCEV2ControlRow {
  rowId: string;
  sourceRow: number;
  company: string;
  equipmentNo: string;
  tagNo: string;
  orderNo: string;
  calibrationStatus: SCEV2CalibrationStatus;
  pdfCount: number;
  documentCount: number;
  reportFolder: string;
  reportFile: string;
  deferralStarted: boolean;
  deferralRaw: string;
  calibrationRaw: string;
  note: string;
  updatedBy: string;
  updatedAt: Date | null;
}

export interface SCEV2DeferralRow {
  rowId: string;
  sourceRow: number;
  routeId: string;
  equipmentNo: string;
  tagNo: string;
  workCenter: string;
  actionRaw: string;
  deferralStarted: boolean;
  overdueDate: Date | null;
}

export interface SCEV2DashboardRow extends SCEV2Row {
  calibrationStatus: SCEV2CalibrationStatus;
  deferralStatus: SCEV2DeferralStatus;
  controlNote: string;
  controlUpdatedBy: string;
  controlUpdatedAt: Date | null;
  calibrationPdfCount: number;
  calibrationDocumentCount: number;
  calibrationReportFolder: string;
  calibrationReportFile: string;
  deferralOverdueDate: Date | null;
  deferralIsOverdue: boolean;
}

export type RCACompany = 'PETKIM' | 'STAR' | 'STAD';

export type RCAStatus = 'completed' | 'open';

export interface RCARow {
  rowId: string;
  sourceRow: number;
  recommendationId: string;
  analysisId: string;
  headline: string;
  description: string;
  assignedToName: string;
  assignedToUserId: string;
  owner: string;
  jobTitle: string;
  company: RCACompany;
  statusRaw: string;
  status: RCAStatus;
  targetCompletionDate: Date | null;
  overdue: boolean;
  raw: Record<string, string>;
}

export type SATStage =
  | 'durum_girilmemis'
  | 'mail_onayi'
  | 'sap_onayi'
  | 'satina_aktarilacak'
  | 'teklif_bekleniyor'
  | 'teklif_degerlendiriliyor'
  | 'teklif_degerlendirildi'
  | 'sas_verildi'
  | 'tamamlandi'
  | 'diger';

export interface SATRow {
  rowId: string;
  sourceRow: number;
  sıraNo: string;
  butceSorumlusu: string;
  talepSahibi: string;
  unite: string;
  satNo: string;
  satTarihi: Date | null;
  aciklama: string;
  toplamTutar: number;
  paraBirimi: string;
  butceTuru: string;
  pypKodu: string;
  butceAciklama: string;
  onayDurumu: string;
  satDurumu: string;
  satinAlmaSorumlusu: string;
  malzemeGelisTarihi: string;
  notlar: string;
  stage: SATStage;
  raw: Record<string, string>;
}

export type SATFileFormat = 'legacy' | 'sap_export';

export type SATBudgetCompany = 'PETKIM' | 'STAR' | 'STAD';

export type SATBudgetType = 'CAPEX' | 'OPEX' | 'OPERATIONAL_CAPEX';

export interface SATExportRow {
  rowId: string;
  sourceRow: number;
  satCreator: string;
  companyCode: string;
  satNo: string;
  satItemNo: string;
  sasNo: string;
  sasItemNo: string;
  satQuantity: number;
  satItemUsd: number;
  sourceTotalSatUsd: number;
  createdAt: Date | null;
  completed: boolean;
  lastDelivery: boolean;
  lastInvoice: boolean;
  sasUsdAmount: number;
  deliveryDate: Date | null;
  sasUnitPrice: number;
  approvalCode: string;
  waybill: string;
  summaryStatus: string;
  materialDescription: string;
  material: string;
  sasCreator: string;
  vendorName: string;
  materialGroup: string;
  approvalStatusDescription: string;
  budgetCompany?: SATBudgetCompany;
  budgetType?: SATBudgetType;
  budgetSourceCode?: string;
  budgetSourceLabel?: string;
}

export interface SATBudgetRow {
  rowId: string;
  sourceRow: number;
  company: SATBudgetCompany;
  budgetType: SATBudgetType;
  sourceCode: string;
  sourceLabel: string;
  amount: number;
  currency: string;
  documentNo: string;
  transactionType: string;
  documentDate: Date | null;
  user: string;
  description: string;
}

export type SATBudgetUsageStage = 'SAT' | 'SAS' | 'FAT';

export interface SATBudgetUsageRow {
  rowId: string;
  sourceRow: number;
  company: SATBudgetCompany;
  budgetType: SATBudgetType;
  sourceCode: string;
  sourceLabel: string;
  stage: SATBudgetUsageStage;
  amountUsd: number;
  referenceNo: string;
  previousDocumentNo: string;
  referenceItemNo: string;
  satNo: string;
  sasNo: string;
  invoiceNo: string;
  documentDate: Date | null;
  description: string;
  vendor: string;
  transactionAmount: number;
  transactionCurrency: string;
  user: string;
}
