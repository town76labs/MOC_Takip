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
  for (const control of controls) {
    const key = orderKey(control.orderNo);
    if (!key) continue;
    const current = controlByOrder.get(key);
    if (
      !current ||
      (control.updatedAt?.getTime() ?? control.sourceRow) >=
        (current.updatedAt?.getTime() ?? current.sourceRow)
    ) {
      controlByOrder.set(key, control);
    }
  }

  return rows.map((row) => {
    const control = controlByOrder.get(orderKey(row.orderNo));
    return {
      ...row,
      calibrationStatus:
        row.maintenanceStatus === 'completed'
          ? control?.calibrationStatus ?? 'unknown'
          : 'not_applicable',
      deferralStatus:
        row.maintenanceStatus !== 'shutdown_deferred'
          ? 'not_applicable'
          : control?.deferralStarted
            ? 'started'
            : 'required',
      controlNote: control?.note ?? '',
      controlUpdatedBy: control?.updatedBy ?? '',
      controlUpdatedAt: control?.updatedAt ?? null,
    };
  });
}

export function orderKey(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}
