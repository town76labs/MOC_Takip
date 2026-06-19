import { Gauge, ListChecks, ShieldCheck } from 'lucide-react';

export type TabKey = 'overview' | 'technical' | 'actions';

interface Props {
  active: TabKey;
  onChange: (k: TabKey) => void;
}

export function DashboardTabs({ active, onChange }: Props) {
  const items: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Genel Bakış', icon: <Gauge size={16} /> },
    { key: 'technical', label: 'Teknik Görüş', icon: <ShieldCheck size={16} /> },
    { key: 'actions', label: 'Aksiyonlar', icon: <ListChecks size={16} /> },
  ];

  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/10 p-1 shadow-sm">
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-[#db2f32] text-white shadow-sm ring-1 ring-red-300/30'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
