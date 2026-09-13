import { describe, expect, it } from 'vitest';
import { canAccessDashboard, type AppMode } from './access';
import type { AppAccess, OvertimeRole } from './auth';

const dashboardModes: AppMode[] = [
  'moc',
  'legal',
  'sce',
  'sce-v2',
  'energy',
  'sat',
  'rca',
  'overtime',
];

function user(access: AppAccess, overtimeRole: OvertimeRole = 'none') {
  return { access, overtimeRole };
}

describe('dashboard erişim matrisi', () => {
  it('tam erişimli mesai yöneticisine bütün dashboardları açar', () => {
    dashboardModes.forEach((mode) => {
      expect(canAccessDashboard(user('full', 'admin'), mode)).toBe(true);
    });
  });

  it('mesai rolü olmayan tam erişimli hesabın Mesai Takibini açmasını engeller', () => {
    expect(canAccessDashboard(user('full', 'none'), 'moc')).toBe(true);
    expect(canAccessDashboard(user('full', 'none'), 'overtime')).toBe(false);
  });

  it('şef hesabını yalnızca Mesai Takibi ile sınırlar', () => {
    dashboardModes.forEach((mode) => {
      expect(canAccessDashboard(user('overtime_only', 'operator'), mode)).toBe(
        mode === 'overtime',
      );
    });
  });

  it('SCE hesabını yasal bakım giriş ekranı ve SCE dashboardıyla sınırlar', () => {
    dashboardModes.forEach((mode) => {
      expect(canAccessDashboard(user('sce_only'), mode)).toBe(
        mode === 'legal' || mode === 'sce-v2',
      );
    });
  });

  it('erişimsiz profile dashboard açmaz', () => {
    dashboardModes.forEach((mode) => {
      expect(canAccessDashboard(user('none'), mode)).toBe(false);
    });
  });
});
