export const WAGE_CREDIT_OPTIONS = [2, 3, 4.5, 5.5, 9] as const;

export type WageCredit = (typeof WAGE_CREDIT_OPTIONS)[number];
export type WorkGroup = 'A' | 'B' | 'C' | 'D' | 'L';
export type PersonnelRole = 'foreman' | 'technician';
export type OvertimeType = 'full_day' | 'continuation';
export type ShiftCode =
  | 'shift_00_08'
  | 'shift_08_16'
  | 'shift_16_24'
  | 'day_08_17'
  | 'weekly_rest';

export interface OvertimePersonnel {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  unit: string;
  workGroup: WorkGroup;
  personnelRole: PersonnelRole;
  active: boolean;
  overtimeEligible: boolean;
}

export interface ShiftAssignment {
  id: string;
  workDate: string;
  workGroup: WorkGroup;
  shiftCode: ShiftCode;
  scheduleVersion: string;
}

export interface OvertimeParticipantInput {
  personnelId: string;
  overtimeType: OvertimeType;
  startsAt: string;
  endsAt: string;
  wageCredit: WageCredit;
  note?: string;
}

export interface OvertimeBalance {
  personnelId: string;
  occurrenceCount: number;
  wageCreditTotal: number;
  lastOvertimeDate: string | null;
}

export interface OvertimeBalancePeriod {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string | null;
  createdAt: string;
}

export interface OvertimeBalanceAdjustment {
  id: string;
  personnelId: string;
  effectiveDate: string;
  occurrenceDelta: number;
  wageCreditDelta: number;
  description: string;
}

export interface CreateOvertimeCallInput {
  workDate: string;
  location: string;
  note: string;
  tasks: string[];
  participants: OvertimeParticipantInput[];
}

export interface OvertimeHistoryEntry {
  id: string;
  callId: string;
  workDate: string;
  entryType: 'overtime' | 'adjustment';
  overtimeType: OvertimeType | null;
  startsAt: string | null;
  endsAt: string | null;
  wageCredit: number;
  occurrenceCredit: number;
  location: string;
  callNote: string;
  participantNote: string;
  tasks: string[];
}

export interface OvertimeCallParticipant {
  id: string;
  personnelId: string;
  employeeNo: string;
  fullName: string;
  unit: string;
  personnelRole: PersonnelRole;
  workGroup: WorkGroup;
  overtimeType: OvertimeType;
  startsAt: string;
  endsAt: string;
  wageCredit: number;
  note: string;
}

export interface OvertimeCalendarCall {
  id: string;
  workDate: string;
  location: string;
  note: string;
  createdAt: string;
  sourceType: 'manual' | 'legacy_import';
  tasks: string[];
  participants: OvertimeCallParticipant[];
}

export interface UpdateOvertimeCallInput {
  callId: string;
  location: string;
  note: string;
  tasks: string[];
  participants: Array<{
    id: string;
    wageCredit: number;
    note: string;
  }>;
}

export interface OvertimeAdminProfile {
  id: string;
  username: string;
  displayName: string;
  appAccess: 'full' | 'sce_only' | 'overtime_only' | 'none';
  overtimeRole: 'admin' | 'operator' | 'viewer' | 'none';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OvertimeAuditEntry {
  id: number;
  tableName: string;
  recordId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
}

export interface CancelledOvertimeCall {
  id: string;
  workDate: string;
  location: string;
  note: string;
  cancellationReason: string;
  cancelledAt: string;
  cancelledBy: string | null;
  participantNames: string[];
  tasks: string[];
}

export interface UpdateOvertimeProfileInput {
  profileId: string;
  appAccess: OvertimeAdminProfile['appAccess'];
  overtimeRole: OvertimeAdminProfile['overtimeRole'];
  active: boolean;
}

export interface UpdateOvertimePersonnelInput {
  personnelId: string;
  unit: string;
  workGroup: WorkGroup;
  personnelRole: PersonnelRole;
  active: boolean;
  overtimeEligible: boolean;
}
