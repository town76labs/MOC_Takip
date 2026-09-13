import type { AppAccess, OvertimeRole } from './auth';

export type AppMode =
  | 'select'
  | 'moc'
  | 'legal'
  | 'sce'
  | 'sce-v2'
  | 'energy'
  | 'sat'
  | 'rca'
  | 'overtime';

export interface DashboardAccessIdentity {
  access: AppAccess;
  overtimeRole: OvertimeRole;
}

export function canAccessDashboard(
  user: DashboardAccessIdentity,
  mode: AppMode,
) {
  if (mode === 'select') return true;
  if (mode === 'overtime' && user.overtimeRole === 'none') return false;
  if (user.access === 'full') return true;
  if (user.access === 'overtime_only') return mode === 'overtime';
  if (user.access === 'sce_only') {
    return mode === 'legal' || mode === 'sce-v2';
  }
  return false;
}
