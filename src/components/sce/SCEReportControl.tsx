import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { SCERow } from '../../types';
import {
  downloadSCEReportPdf,
  type SCEReportView,
} from '../../lib/sceReportPdf';
import { Modal } from '../common/Modal';

interface SCEReportControlProps {
  allRows: SCERow[];
  filteredRows: SCERow[];
  filterLabel: string;
  view: SCEReportView;
}

export function SCEReportControl({
  allRows,
  filteredRows,
  filterLabel,
  view,
}: SCEReportControlProps) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [generating, setGenerating] = useState(false);
  const reportRows = scope === 'filtered' ? filteredRows : allRows;
  const reportName =
    view === 'overview' ? 'SCE Genel Bakış Raporu' : 'SCE Takip Detay Raporu';

  async function createReport() {
    const scopeLabel = scope === 'all' ? 'Tüm SCE Verileri' : filterLabel;
    setGenerating(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSCEReportPdf({
        rows: reportRows,
        view,
        scopeLabel,
      });
      setOpen(false);
    } catch (error) {
      console.error(error);
      window.alert('SCE PDF raporu oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={allRows.length === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-400 hover:to-cyan-500 focus:outline-none focus:ring-2 focus:ring-sky-400/35 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileText size={17} />
        PDF Raporu
      </button>

      <Modal
        open={open}
        onClose={() => !generating && setOpen(false)}
        title={reportName}
        widthClass="max-w-2xl"
      >
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold text-slate-800">Rapor kapsamı</div>
            <p className="mt-1 text-xs text-slate-500">
              PDF metinleri seçilebilir ve aranabilir olarak oluşturulur.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ScopeButton
                active={scope === 'filtered'}
                title="Mevcut Filtreler"
                helper={`${filteredRows.length} ekipman · ekran görünümü`}
                disabled={generating}
                onClick={() => setScope('filtered')}
              />
              <ScopeButton
                active={scope === 'all'}
                title="Tüm Veriler"
                helper={`${allRows.length} ekipman · filtrelerden bağımsız`}
                disabled={generating}
                onClick={() => setScope('all')}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">{reportName}</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {view === 'overview'
                ? 'KPI, bakım durumu, şirket/fabrika dağılımı ve kritik ekipman listesi.'
                : 'Bakım ve duruş dağılımlarıyla birlikte ayrıntılı SCE ekipman dökümü.'}
            </p>
          </div>

          <button
            type="button"
            onClick={createReport}
            disabled={generating || reportRows.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-wait disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <FileText size={17} />
            )}
            {generating ? 'PDF hazırlanıyor...' : 'PDF Raporunu Oluştur'}
          </button>
        </div>
      </Modal>
    </>
  );
}

function ScopeButton({
  active,
  title,
  helper,
  disabled,
  onClick,
}: {
  active: boolean;
  title: string;
  helper: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-lg border p-3 text-left transition ${
        active
          ? 'border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/25'
          : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50'
      }`}
    >
      <span className="block text-sm font-semibold text-slate-900">{title}</span>
      <span className="mt-1 block text-xs text-slate-500">{helper}</span>
    </button>
  );
}
