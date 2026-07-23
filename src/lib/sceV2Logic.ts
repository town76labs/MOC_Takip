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
  const controlByEquipment = new Map<string, SCEV2ControlRow>();
  for (const control of controls) {
    const key = equipmentKey(control.equipmentNo);
    if (!key) continue;
    const current = controlByEquipment.get(key);
    if (
      !current ||
      (control.updatedAt?.getTime() ?? control.sourceRow) >=
        (current.updatedAt?.getTime() ?? current.sourceRow)
    ) {
      controlByEquipment.set(key, control);
    }
  }

  return rows.map((row) => {
    const control = controlByEquipment.get(equipmentKey(row.equipmentNo));
    return {
      ...row,
      calibrationStatus: control?.calibrationStatus ?? 'unknown',
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

export function equipmentKey(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}
