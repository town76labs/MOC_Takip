import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { SCEV2DashboardRow } from '../../types';
import {
  downloadSCEV2ReportPdf,
  type SCEV2ReportType,
} from '../../lib/sceV2ReportPdf';
import { Modal } from '../common/Modal';

interface SCEV2ReportControlProps {
  rows: SCEV2DashboardRow[];
  company: 'PETKIM' | 'STAR';
  scopeLabel: string;
}

const REPORT_OPTIONS: Array<{
  type: SCEV2ReportType;
  title: string;
  description: string;
}> = [
  {
    type: 'executive',
    title: 'Yönetici Özeti',
    description:
      'Ana KPI’lar, genel bakım durumu ve konsol/fabrika bazlı tamamlanma oranları.',
  },
  {
    type: 'detailed',
    title: 'Detaylı Rapor',
    description:
      'Yönetici özetine ek olarak ekipman tipi bar grafiği ve aksiyon gerektiren ekipman listesi.',
  },
];

export function SCEV2ReportControl({
  rows,
  company,
  scopeLabel,
}: SCEV2ReportControlProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SCEV2ReportType>('executive');
  const [generating, setGenerating] = useState(false);
  const companyLabel = company === 'STAR' ? 'Star' : 'Petkim';

  async function createReport() {
    setGenerating(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSCEV2ReportPdf({ rows, company, type, scopeLabel });
      setOpen(false);
    } catch (error) {
      console.error(error);
      window.alert('SCE V2 PDF raporu oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={rows.length === 0}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${
          company === 'STAR'
            ? 'bg-gradient-to-r from-red-500 to-rose-700 hover:from-red-400 hover:to-rose-600 focus:ring-red-400/35'
            : 'bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-400 hover:to-cyan-500 focus:ring-sky-400/35'
        }`}
      >
        <FileText size={16} />
        {companyLabel} PDF Raporları
      </button>

      <Modal
        open={open}
        onClose={() => !generating && setOpen(false)}
        title={`${companyLabel} SCE V2 PDF Raporları`}
        widthClass="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Rapor kapsamı
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {scopeLabel} · {rows.length.toLocaleString('tr-TR')} ekipman
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              PDF içindeki metinler seçilebilir ve aranabilir olarak oluşturulur.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REPORT_OPTIONS.map((option) => {
              const active = type === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  disabled={generating}
                  aria-pressed={active}
                  onClick={() => setType(option.type)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? company === 'STAR'
                        ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                        : 'border-sky-400 bg-sky-50 ring-2 ring-sky-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-900">
                    {option.title}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-slate-500">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={createReport}
            disabled={generating || rows.length === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-50 ${
              company === 'STAR'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-sky-600 hover:bg-sky-500'
            }`}
          >
            {generating ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <FileText size={17} />
            )}
            {generating ? 'PDF hazırlanıyor...' : 'PDF Raporunu İndir'}
          </button>
        </div>
      </Modal>
    </>
  );
}
