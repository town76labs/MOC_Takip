import type { SCERow } from '../types';
import { normalize } from './normalize';

export type SCEMaintenanceStatus =
  | 'completed'
  | 'deferral_started'
  | 'deferral_not_started'
  | 'deferral_not_required'
  | 'assessment_missing'
  | 'unplanned';

export function classifySCEMaintenance(row: SCERow): SCEMaintenanceStatus {
  if (!hasSCEValue(row.bakimPlaniNo)) return 'unplanned';
  if (hasSCEValue(row.sonBakimTarihi)) return 'completed';

  const shutdownRequirement = normalize(row.durusGereklilikYorumu);
  if (shutdownRequirement === 'durus gereklidir') {
    return isSCEDeferralStarted(row.deferralSureci)
      ? 'deferral_started'
      : 'deferral_not_started';
  }
  if (
    shutdownRequirement === 'force ile yapilabilir' ||
    shutdownRequirement === 'durus gerekli degildir'
  ) {
    return 'deferral_not_required';
  }
  return 'assessment_missing';
}

export function isSCEDeferralStarted(value: string) {
  const clean = normalize(value);
  return clean.length > 0 && clean !== 'hayir';
}

export function hasSCEValue(value: string) {
  return value.trim().length > 0;
}
