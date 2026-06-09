import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Boş seçim "tümü" anlamına gelir. */
  allLabel?: string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Seçim yapın',
  allLabel = 'Tümü',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = options.filter((o) =>
    o.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')),
  );

  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 cursor-pointer text-left"
      >
        <span className="truncate">
          {selected.length === 0
            ? <span className="text-slate-400">{allLabel} ({options.length})</span>
            : <span className="text-slate-800">{selected.length} seçili</span>}
        </span>
        <span className="flex items-center gap-1">
          {selected.length > 0 && (
            <span
              onClick={clearAll}
              className="rounded p-0.5 hover:bg-slate-200"
              aria-label="Temizle"
              role="button"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className="text-slate-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 flex max-h-72 w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-elevated">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="input"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                Eşleşen sonuç yok.
              </div>
            ) : (
              filtered.map((o) => {
                const checked = selected.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggle(o)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50/50 ${
                      checked ? 'text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        checked
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {checked && <Check size={12} />}
                    </span>
                    <span className="truncate">{o}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
