import type {
  SCEV2ControlRow,
  SCEV2DashboardRow,
  SCEV2Row,
} from '../types';
import { normalize } from './normalize';

export function buildSCEV2DashboardRows(
  rows: SCEV2Row[],
  controls: SCEV2ControlRow[],
): SCEV2DashboardRow[] {
  const controlByOrder = new Map<string, SCEV2ControlRow>();
  const controlByEquipment = new Map<string, SCEV2ControlRow>();
  const controlByTag = new Map<string, SCEV2ControlRow>();
  for (const control of controls) {
    setLatestControl(controlByOrder, orderKey(control.orderNo), control);
    setLatestControl(
      controlByEquipment,
      identityKey(control.equipmentNo),
      control,
    );
    setLatestControl(controlByTag, identityKey(control.tagNo), control);
  }

  return rows.map((row) => {
    const orderControl = controlByOrder.get(orderKey(row.orderNo));
    const equipmentControl = controlByEquipment.get(identityKey(row.equipmentNo));
    const tagControl = controlByTag.get(identityKey(row.tagNo));
    const calibrationControl =
      row.company === 'STAR'
        ? equipmentControl ?? tagControl ?? orderControl
        : orderControl ?? equipmentControl ?? tagControl;
    const deferralControl = orderControl ?? equipmentControl ?? tagControl;
    const control = calibrationControl ?? deferralControl;
    return {
      ...row,
      calibrationStatus:
        row.maintenanceStatus === 'completed'
          ? calibrationControl?.calibrationStatus ?? 'unknown'
          : 'not_applicable',
      deferralStatus:
        row.maintenanceStatus !== 'shutdown_deferred'
          ? 'not_applicable'
          : deferralControl?.deferralStarted
            ? 'started'
            : 'required',
      controlNote: control?.note ?? '',
      controlUpdatedBy: control?.updatedBy ?? '',
      controlUpdatedAt: control?.updatedAt ?? null,
      calibrationPdfCount: calibrationControl?.pdfCount ?? 0,
      calibrationDocumentCount: calibrationControl?.documentCount ?? 0,
      calibrationReportFolder: calibrationControl?.reportFolder ?? '',
      calibrationReportFile: calibrationControl?.reportFile ?? '',
    };
  });
}

function setLatestControl(
  map: Map<string, SCEV2ControlRow>,
  key: string,
  control: SCEV2ControlRow,
) {
  if (!key) return;
  const current = map.get(key);
  if (
    !current ||
    (control.updatedAt?.getTime() ?? control.sourceRow) >=
      (current.updatedAt?.getTime() ?? current.sourceRow)
  ) {
    map.set(key, control);
  }
}

export function orderKey(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function identityKey(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}
