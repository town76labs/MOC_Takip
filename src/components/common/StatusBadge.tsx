import type { ActionCategory, TechnicalStatus } from '../../types';

const TECHNICAL_LABEL: Record<TechnicalStatus, string> = {
  tamamlandi: 'Tamamlandı',
  bilgi_notu_paylasilmamis: 'MOC Bilgi Notu Paylaşılmamış',
  gecikmis: 'Gecikmiş',
  bekliyor: 'Bekliyor',
  geri_gonderildi: 'Geri Gönderildi',
};

const TECHNICAL_CLASS: Record<TechnicalStatus, string> = {
  tamamlandi: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  bilgi_notu_paylasilmamis: 'bg-violet-50 text-violet-700 border border-violet-200',
  gecikmis: 'bg-rose-50 text-rose-700 border border-rose-200',
  bekliyor: 'bg-amber-50 text-amber-700 border border-amber-200',
  geri_gonderildi: 'bg-sky-50 text-sky-700 border border-sky-200',
};

const ACTION_LABEL: Record<ActionCategory, string> = {
  tamamlanmis: 'Tamamlanmış',
  tamamlanmayan: 'Tamamlanmayan',
  gecikmis: 'Gecikmiş',
  atama_yapilmadi: 'Atama Yapılmadı',
};

const ACTION_CLASS: Record<ActionCategory, string> = {
  tamamlanmis: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  tamamlanmayan: 'bg-amber-50 text-amber-700 border border-amber-200',
  gecikmis: 'bg-rose-50 text-rose-700 border border-rose-200',
  atama_yapilmadi: 'bg-sky-50 text-sky-700 border border-sky-200',
};

export function TechnicalStatusBadge({ status }: { status: TechnicalStatus }) {
  return (
    <span className={`badge ${TECHNICAL_CLASS[status]}`}>
      {TECHNICAL_LABEL[status]}
    </span>
  );
}

export function ActionCategoryBadge({ category }: { category: ActionCategory }) {
  return (
    <span className={`badge ${ACTION_CLASS[category]}`}>
      {ACTION_LABEL[category]}
    </span>
  );
}
