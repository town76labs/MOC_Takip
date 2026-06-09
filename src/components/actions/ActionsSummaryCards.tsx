import { AlertTriangle, CheckCircle2, Clock, UserX } from 'lucide-react';
import type { ActionsSummary } from '../../lib/actionsLogic';
import type { ActionCategory } from '../../types';

interface Props {
  summary: ActionsSummary;
  activeCategory: ActionCategory | null;
  onCategoryToggle: (category: ActionCategory) => void;
}

export function ActionsSummaryCards({
  summary,
  activeCategory,
  onCategoryToggle,
}: Props) {
  const cards = [
    {
      label: 'Tamamlanmış Aksiyonlar',
      value: summary.tamamlanmis,
      category: 'tamamlanmis' as const,
      icon: <CheckCircle2 size={18} />,
      tone: 'text-emerald-700 bg-emerald-100',
      accent: 'before:bg-emerald-500',
      activeClass: 'border-emerald-300 ring-emerald-100',
    },
    {
      label: 'Tamamlanmayan Aksiyonlar',
      value: summary.tamamlanmayan,
      category: 'tamamlanmayan' as const,
      icon: <Clock size={18} />,
      tone: 'text-amber-700 bg-amber-100',
      accent: 'before:bg-amber-500',
      activeClass: 'border-amber-300 ring-amber-100',
    },
    {
      label: 'Gecikmiş Aksiyonlar',
      value: summary.gecikmis,
      category: 'gecikmis' as const,
      icon: <AlertTriangle size={18} />,
      tone: 'text-rose-700 bg-rose-100',
      accent: 'before:bg-rose-500',
      activeClass: 'border-rose-300 ring-rose-100',
    },
    {
      label: 'Aksiyon Ataması Yapılmadı',
      value: summary.atama_yapilmadi,
      category: 'atama_yapilmadi' as const,
      icon: <UserX size={18} />,
      tone: 'text-sky-700 bg-sky-100',
      accent: 'before:bg-sky-500',
      activeClass: 'border-sky-300 ring-sky-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c) => {
        const active = activeCategory === c.category;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => onCategoryToggle(c.category)}
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
          </button>
        );
      })}
    </div>
  );
}
