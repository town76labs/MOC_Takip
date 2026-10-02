import { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { SCEV2Company, SCEV2DashboardRow } from '../../types';
import {
  downloadSCEV2ReportPdf,
  type SCEV2ReportType,
} from '../../lib/sceV2ReportPdf';
import {
  buildSCEV2ExcelData,
  getSCEV2ExcelColumnWidths,
} from '../../lib/sceV2Excel';
import { Modal } from '../common/Modal';

interface SCEV2ReportControlProps {
  rows: SCEV2DashboardRow[];
  excelRows: SCEV2DashboardRow[];
  company: SCEV2Company;
  scopeLabel: string;
  activeFilterLabel: string;
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
  excelRows,
  company,
  scopeLabel,
  activeFilterLabel,
}: SCEV2ReportControlProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [type, setType] = useState<SCEV2ReportType>('executive');
  const [generating, setGenerating] = useState(false);
  const companyLabel = getCompanyLabel(company);
  const reportLabel =
    company === 'ENERGY'
      ? 'Enerji/Çevre Kritik Ekipman Bakımları'
      : `${companyLabel} SCE`;
  const primaryClasses =
    company === 'STAR'
      ? 'bg-gradient-to-r from-red-500 to-rose-700 hover:from-red-400 hover:to-rose-600 focus:ring-red-400/35'
      : company === 'ENERGY'
        ? 'bg-gradient-to-r from-amber-500 to-orange-700 hover:from-amber-400 hover:to-orange-600 focus:ring-amber-400/35'
        : 'bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-400 hover:to-cyan-500 focus:ring-sky-400/35';
  const secondaryClasses =
    company === 'STAR'
      ? 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 focus:ring-red-400/30'
      : company === 'ENERGY'
        ? 'border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 focus:ring-amber-400/30'
        : 'border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 focus:ring-sky-400/30';

  async function createReport() {
    setGenerating(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSCEV2ReportPdf({ rows, company, type, scopeLabel });
      setReportOpen(false);
    } catch (error) {
      console.error(error);
      window.alert(`${reportLabel} PDF raporu oluşturulamadı. Lütfen tekrar deneyin.`);
    } finally {
      setGenerating(false);
    }
  }

  function createExcelList() {
    try {
      downloadFilteredExcel(excelRows, company, scopeLabel, activeFilterLabel);
      setExcelOpen(false);
    } catch (error) {
      console.error(error);
      window.alert(`${reportLabel} Excel listesi oluşturulamadı. Lütfen tekrar deneyin.`);
    }
  }

  return (
    <>
      <div className="flex flex-col items-stretch gap-2">
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          disabled={rows.length === 0}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${primaryClasses}`}
        >
          <FileText size={16} />
          {reportLabel} PDF Raporları
        </button>
        <button
          type="button"
          onClick={() => setExcelOpen(true)}
          disabled={excelRows.length === 0}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${secondaryClasses}`}
        >
          <FileSpreadsheet size={16} />
          {reportLabel} Excel Listesi
        </button>
      </div>

      <Modal
        open={reportOpen}
        onClose={() => !generating && setReportOpen(false)}
        title={`${reportLabel} PDF Raporları`}
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
                        ? 'border-red-400 bg-red-950/70 ring-2 ring-red-400/30'
                        : company === 'ENERGY'
                          ? 'border-amber-400 bg-amber-950/70 ring-2 ring-amber-400/30'
                          : 'border-sky-400 bg-sky-950/70 ring-2 ring-sky-400/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-900">
                    {option.title}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-slate-500">
                    {option.type === 'detailed'
                      ? 'Yönetici özetine ek olarak overdue ve yaklaşan overdue ekipman listeleri.'
                      : option.description}
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
                : company === 'ENERGY'
                  ? 'bg-amber-600 hover:bg-amber-500'
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

      <Modal
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        title={`${reportLabel} Excel Listesi`}
        widthClass="max-w-xl"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              Aktif filtrelerin listesi üretilecek
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {activeFilterLabel}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Yalnızca ekrandaki sayfa değil, filtreye uyan{' '}
              <strong>{excelRows.length.toLocaleString('tr-TR')}</strong>{' '}
              kaydın tamamı Excel tablosuna aktarılır.
            </p>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Listede ekipman ve tag numarası, bakım planı, sipariş, revizyon,
            bakım durumu ve deferral/overdue bilgileri bulunur.
          </p>
          <button
            type="button"
            onClick={createExcelList}
            disabled={excelRows.length === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              company === 'STAR'
                ? 'bg-red-600 hover:bg-red-500'
                : company === 'ENERGY'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-sky-600 hover:bg-sky-500'
            }`}
          >
            <FileSpreadsheet size={17} />
            Excel Listesini Üret
          </button>
        </div>
      </Modal>
    </>
  );
}

function downloadFilteredExcel(
  rows: SCEV2DashboardRow[],
  company: SCEV2Company,
  scopeLabel: string,
  activeFilterLabel: string,
) {
  const companyLabel = getCompanyLabel(company);
  const data = buildSCEV2ExcelData(rows, company);

  const workbook = XLSX.utils.book_new();
  const listSheet = XLSX.utils.json_to_sheet(data);
  listSheet['!autofilter'] = {
    ref:
      listSheet['!ref'] ??
      `A1:${company === 'STAR' ? 'T' : 'AF'}${Math.max(rows.length + 1, 2)}`,
  };
  listSheet['!cols'] = getSCEV2ExcelColumnWidths(company);

  const infoSheet = XLSX.utils.json_to_sheet([
    { Alan: 'Şirket', Değer: companyLabel },
    { Alan: 'Kapsam', Değer: scopeLabel },
    { Alan: 'Aktif Filtre', Değer: activeFilterLabel },
    { Alan: 'Kayıt Sayısı', Değer: rows.length },
    { Alan: 'Üretim Tarihi', Değer: new Date().toLocaleString('tr-TR') },
  ]);
  infoSheet['!cols'] = [{ wch: 18 }, { wch: 90 }];

  XLSX.utils.book_append_sheet(workbook, listSheet, 'Ekipman Listesi');
  XLSX.utils.book_append_sheet(workbook, infoSheet, 'Filtre Bilgisi');
  XLSX.writeFile(
    workbook,
    `${slugify(
      `${company === 'ENERGY' ? 'Enerji-Kritik' : `SCE-${companyLabel}`}-${activeFilterLabel}`,
    )}.xlsx`,
  );
}

function getCompanyLabel(company: SCEV2Company) {
  if (company === 'STAR') return 'Star';
  if (company === 'ENERGY') return 'Enerji Kritik';
  return 'Petkim';
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
