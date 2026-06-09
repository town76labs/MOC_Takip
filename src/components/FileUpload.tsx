import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import type { ParseError } from '../types';

interface Props {
  title: string;
  subtitle: string;
  hint?: string;
  fileMeta: { name: string; size: number; uploadedAt: Date } | null;
  loading: boolean;
  error: ParseError | null;
  onFile: (file: File) => void;
  onClear: () => void;
  accentColorClass?: string; // ör. 'from-brand-500 to-brand-600'
  surfaceClassName?: string;
}

const VALID_EXT = ['.xlsx', '.xls'];

export function FileUpload({
  title,
  subtitle,
  hint,
  fileMeta,
  loading,
  error,
  onFile,
  onClear,
  accentColorClass = 'from-brand-500 to-brand-600',
  surfaceClassName = '',
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const lower = file.name.toLowerCase();
      if (!VALID_EXT.some((ext) => lower.endsWith(ext))) {
        alert('Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls).');
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  return (
    <div className={`card p-5 ${surfaceClassName}`}>
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${accentColorClass} text-white shadow-sm`}
        >
          <FileSpreadsheet size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {fileMeta ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
          <CheckCircle2 className="text-emerald-600 mt-0.5" size={18} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-emerald-900 truncate">
              {fileMeta.name}
            </div>
            <div className="text-xs text-emerald-700 mt-0.5">
              {(fileMeta.size / 1024).toFixed(1)} KB ·{' '}
              {fileMeta.uploadedAt.toLocaleTimeString('tr-TR')}
            </div>
          </div>
          <button
            onClick={onClear}
            className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="Dosyayı kaldır"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition cursor-pointer p-6 text-center
            ${
              dragOver
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-300 bg-slate-50/70 hover:border-brand-400 hover:bg-brand-50/60'
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {loading ? (
            <Loader2 className="text-brand-600 animate-spin" size={28} />
          ) : (
            <Upload className="text-slate-400" size={28} />
          )}
          <div className="text-sm font-medium text-slate-700">
            {loading ? 'Dosya işleniyor...' : 'Dosyayı sürükleyip bırakın veya seçin'}
          </div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
        </label>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-rose-600 mt-0.5" size={18} />
            <div className="flex-1">
              <div className="text-sm font-medium text-rose-900">{error.message}</div>
              {error.missing && error.missing.length > 0 && (
                <div className="mt-2 text-xs text-rose-800">
                  Eksik sütunlar:{' '}
                  <span className="font-mono">{error.missing.join(', ')}</span>
                </div>
              )}
              {error.foundHeaders && error.foundHeaders.length > 0 && (
                <div className="mt-2 text-xs text-rose-700">
                  Bulunan sütunlar:{' '}
                  <span className="font-mono">{error.foundHeaders.join(', ')}</span>
                </div>
              )}
              {error.details && error.details.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-rose-700">
                  {error.details.map((detail) => (
                    <div key={detail}>{detail}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
