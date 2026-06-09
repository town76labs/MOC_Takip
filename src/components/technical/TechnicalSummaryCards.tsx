import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCcw,
  Layers,
} from 'lucide-react';
import type { TechnicalSummary } from '../../lib/technicalLogic';
import type { TechnicalStatus } from '../../types';

interface Props {
  summary: TechnicalSummary;
  activeStatus: TechnicalStatus | null;
  onStatusToggle: (status: TechnicalStatus | null) => void;
}

export function TechnicalSummaryCards({
  summary,
  activeStatus,
  onStatusToggle,
}: Props) {
  const pct = (summary.tamamlanmaOrani * 100).toFixed(0);

  const cards = [
    {
      label: 'Toplam MOC',
      value: summary.total,
      status: null,
      icon: <Layers size={18} />,
      tone: 'text-slate-600 bg-slate-100',
      activeClass: 'border-slate-300 ring-slate-200',
      accent: 'before:bg-slate-400',
    },
    {
      label: 'Teknik Görüşü Tamamlanan',
      value: summary.tamamlandi,
      status: 'tamamlandi' as const,
      hint: `%${pct} tamamlanma`,
      icon: <CheckCircle2 size={18} />,
      tone: 'text-emerald-700 bg-emerald-100',
      activeClass: 'border-emerald-300 ring-emerald-100',
      accent: 'before:bg-emerald-500',
    },
    {
      label: 'MOC Bilgi Notu Paylaşılmamış',
      value: summary.bilgiNotuPaylasilmamis,
      status: 'bilgi_notu_paylasilmamis' as const,
      icon: <FileText size={18} />,
      tone: 'text-violet-700 bg-violet-100',
      activeClass: 'border-violet-300 ring-violet-100',
      accent: 'before:bg-violet-500',
    },
    {
      label: 'Gecikmiş',
      value: summary.gecikmis,
      status: 'gecikmis' as const,
      icon: <AlertTriangle size={18} />,
      tone: 'text-rose-700 bg-rose-100',
      activeClass: 'border-rose-300 ring-rose-100',
      accent: 'before:bg-rose-500',
    },
    {
      label: 'Bekleyen',
      value: summary.bekliyor,
      status: 'bekliyor' as const,
      icon: <Clock size={18} />,
      tone: 'text-amber-700 bg-amber-100',
      activeClass: 'border-amber-300 ring-amber-100',
      accent: 'before:bg-amber-500',
    },
    {
      label: 'Değişiklik Geri Gönderildi',
      value: summary.geriGonderildi,
      status: 'geri_gonderildi' as const,
      icon: <RefreshCcw size={18} />,
      tone: 'text-sky-700 bg-sky-100',
      activeClass: 'border-sky-300 ring-sky-100',
      accent: 'before:bg-sky-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const active =
          c.status === null ? activeStatus === null : activeStatus === c.status;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => onStatusToggle(c.status)}
            className={`metric-card text-left focus:outline-none focus:ring-2 focus:ring-brand-200 ${c.accent} ${
              active ? `${c.activeClass} ring-2` : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <span className={`p-1.5 rounded-lg ${c.tone}`}>{c.icon}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
              {c.value}
            </div>
            {'hint' in c && c.hint && (
              <div className="text-xs text-slate-500 mt-0.5">{c.hint}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
