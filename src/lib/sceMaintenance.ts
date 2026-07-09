import type { SCERow } from '../types';
import { normalize } from './normalize';

export type SCEMaintenanceStatus =
  | 'completed'
  | 'deferral_started'
  | 'deferral_not_started'
  | 'deferral_not_required'
  | 'assessment_missing'
  | 'unplanned';

export type SCEShutdownRequirement =
  | 'required'
  | 'not_required'
  | 'force'
  | null;

export function classifySCEMaintenance(row: SCERow): SCEMaintenanceStatus {
  if (!hasSCEValue(row.bakimPlaniNo)) return 'unplanned';

  const hasControlDate = hasSCEValue(row.sonKontrolTarihi);
  const hasMaintenanceDate = hasSCEValue(row.sonBakimTarihi);
  if (row.sonKontrolSutunuVar) {
    if (hasControlDate && hasMaintenanceDate) return 'completed';
    if (hasControlDate && !hasMaintenanceDate) {
      return isSCEDeferralStarted(row.deferralSureci)
        ? 'deferral_started'
        : 'deferral_not_started';
    }
  } else if (hasMaintenanceDate) {
    return 'completed';
  }

  const shutdownRequirement = classifySCEShutdownRequirement(
    row.durusGereklilikYorumu,
  );
  if (shutdownRequirement === 'required') {
    return isSCEDeferralStarted(row.deferralSureci)
      ? 'deferral_started'
      : 'deferral_not_started';
  }
  if (shutdownRequirement === 'force' || shutdownRequirement === 'not_required') {
    return 'deferral_not_required';
  }
  return 'assessment_missing';
}

export function classifySCEShutdownRequirement(
  value: string,
): SCEShutdownRequirement {
  const clean = normalize(value).replace(/[.!。]+$/g, '').trim();
  if (clean === 'durus gereklidir' || clean === 'durus gerekli') {
    return 'required';
  }
  if (
    clean === 'durus gerekli degildir' ||
    clean === 'durus gerekli degil'
  ) {
    return 'not_required';
  }
  if (clean === 'force ile yapilabilir') return 'force';
  return null;
}

export function isSCEDeferralStarted(value: string) {
  const clean = normalize(value);
  return clean.length > 0 && clean !== 'hayir';
}

export function hasSCEValue(value: string) {
  return value.trim().length > 0;
}
