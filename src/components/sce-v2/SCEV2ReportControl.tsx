import { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { SCEV2DashboardRow } from '../../types';
import {
  downloadSCEV2ReportPdf,
  type SCEV2ReportType,
} from '../../lib/sceV2ReportPdf';
import { formatDate } from '../../lib/normalize';
import { Modal } from '../common/Modal';

interface SCEV2ReportControlProps {
  rows: SCEV2DashboardRow[];
  excelRows: SCEV2DashboardRow[];
  company: 'PETKIM' | 'STAR';
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
  const companyLabel = company === 'STAR' ? 'Star' : 'Petkim';

  async function createReport() {
    setGenerating(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      await downloadSCEV2ReportPdf({ rows, company, type, scopeLabel });
      setReportOpen(false);
    } catch (error) {
      console.error(error);
      window.alert('SCE PDF raporu oluşturulamadı. Lütfen tekrar deneyin.');
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
      window.alert('SCE Excel listesi oluşturulamadı. Lütfen tekrar deneyin.');
    }
  }

  return (
    <>
      <div className="flex flex-col items-stretch gap-2">
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          disabled={rows.length === 0}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${
            company === 'STAR'
              ? 'bg-gradient-to-r from-red-500 to-rose-700 hover:from-red-400 hover:to-rose-600 focus:ring-red-400/35'
              : 'bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-400 hover:to-cyan-500 focus:ring-sky-400/35'
          }`}
        >
          <FileText size={16} />
          {companyLabel} PDF Raporları
        </button>
        <button
          type="button"
          onClick={() => setExcelOpen(true)}
          disabled={excelRows.length === 0}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${
            company === 'STAR'
              ? 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 focus:ring-red-400/30'
              : 'border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 focus:ring-sky-400/30'
          }`}
        >
          <FileSpreadsheet size={16} />
          {companyLabel} Excel Listesi
        </button>
      </div>

      <Modal
        open={reportOpen}
        onClose={() => !generating && setReportOpen(false)}
        title={`${companyLabel} SCE PDF Raporları`}
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
                        : 'border-sky-400 bg-sky-950/70 ring-2 ring-sky-400/30'
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

      <Modal
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        title={`${companyLabel} SCE Excel Listesi`}
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
            Listede ekipman ve tag numarası, bakım planı, sipariş, bakım durumu,
            Petkim revizyon ve duruş bilgisi, deferral/overdue ve kalibrasyon
            raporu bilgileri bulunur.
          </p>
          <button
            type="button"
            onClick={createExcelList}
            disabled={excelRows.length === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              company === 'STAR'
                ? 'bg-red-600 hover:bg-red-500'
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
  company: 'PETKIM' | 'STAR',
  scopeLabel: string,
  activeFilterLabel: string,
) {
  const companyLabel = company === 'STAR' ? 'Star' : 'Petkim';
  const data = rows.map((row) => ({
    Şirket: companyLabel,
    'Fabrika / Ünite': company === 'STAR' ? row.unit : factoryLabel(row.factory),
    Konsol: company === 'STAR' ? row.consoleName : '',
    'Ekipman No': row.equipmentNo,
    'Tag No / Teknik Birim': row.tagNo,
    'Ekipman Tanımı': row.equipmentDescription,
    'Ekipman Tipi': row.equipmentType,
    'Kategori Tipi': row.categoryType,
    'Sipariş No': row.orderNo,
    'Bildirim No': row.notificationNo,
    'Bakım Plan No': row.maintenancePlanNo,
    'Bakım Kalemi': row.maintenanceItemNo,
    'Bakım Periyodu': row.maintenancePeriod,
    ...(company === 'PETKIM'
      ? {
          Revizyon: row.revision,
          'Duruş Gereklilik / Yapılabilirlik': row.shutdownRequirement,
          'Duruş Açıklaması': row.shutdownExplanation,
        }
      : {}),
    'SAP Kullanıcı Durumu': row.userStatus,
    'Bakım Durumu': maintenanceLabel(row),
    'Deferral Durumu': deferralLabel(row),
    Overdue: row.deferralIsOverdue ? 'Evet' : 'Hayır',
    'Overdue Tarihi': formatDate(row.deferralOverdueDate),
    'Kalibrasyon Raporu': calibrationLabel(row),
    'Kalibrasyon PDF Sayısı': row.calibrationPdfCount,
    'Toplam Doküman': row.calibrationDocumentCount,
    'Rapor Dosyası': row.calibrationReportFile,
    'Rapor Klasörü': row.calibrationReportFolder,
    'Bakım Başlangıç Tarihi': formatDate(row.maintenanceStartDate),
    'Bakım Bitiş Tarihi': formatDate(row.maintenanceEndDate),
    'Planlanan Tamamlanma Tarihi': formatDate(row.plannedCompletionDate),
    'Kontrol Notu': row.controlNote,
    'Kontrol Eden': row.controlUpdatedBy,
    'Kontrol Tarihi': formatDate(row.controlUpdatedAt),
  }));

  const workbook = XLSX.utils.book_new();
  const listSheet = XLSX.utils.json_to_sheet(data);
  listSheet['!autofilter'] = {
    ref: listSheet['!ref'] ?? `A1:AF${Math.max(rows.length + 1, 2)}`,
  };
  listSheet['!cols'] = [
    { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 24 },
    { wch: 38 }, { wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 22 },
    ...(company === 'PETKIM'
      ? [{ wch: 16 }, { wch: 34 }, { wch: 70 }]
      : []),
    { wch: 28 }, { wch: 10 }, { wch: 16 }, { wch: 22 }, { wch: 18 },
    { wch: 16 }, { wch: 34 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
    { wch: 24 }, { wch: 32 }, { wch: 18 }, { wch: 18 },
  ];

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
    `${slugify(`SCE-${companyLabel}-${activeFilterLabel}`)}.xlsx`,
  );
}

function maintenanceLabel(row: SCEV2DashboardRow) {
  if (row.maintenanceStatus === 'completed') return 'Tamamlandı';
  if (row.maintenanceStatus === 'shutdown_deferred') return 'Duruşa Ertelendi';
  if (row.maintenanceStatus === 'order_not_found') return 'Sipariş Kaydı Yok';
  return 'Bakımı Yapılmadı';
}

function deferralLabel(row: SCEV2DashboardRow) {
  if (row.deferralStatus === 'started') return 'Deferral Başlatıldı';
  if (row.deferralStatus === 'required') return 'Deferral Başlatılmalı';
  return 'Deferral Gerekmiyor';
}

function calibrationLabel(row: SCEV2DashboardRow) {
  if (row.calibrationStatus === 'shared') return 'Paylaşıldı';
  if (row.calibrationStatus === 'not_shared') return 'Paylaşılmadı';
  if (row.calibrationStatus === 'not_applicable') return 'Uygulanmaz';
  return 'Bilgi Bekleniyor';
}

function factoryLabel(value: string) {
  const labels: Record<string, string> = {
    ISKELE: 'İskele',
    ETILEN: 'Etilen',
    AROMATIKLER: 'Aromatikler',
    DIGER: 'Diğer',
  };
  return labels[value] ?? value;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
