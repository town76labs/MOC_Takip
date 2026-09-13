import { supabase } from '../supabase';
import type {
  CreateOvertimeCallInput,
  CancelledOvertimeCall,
  OvertimeAdminProfile,
  OvertimeAuditEntry,
  OvertimeBalance,
  OvertimeBalanceAdjustment,
  OvertimeBalancePeriod,
  OvertimeCalendarCall,
  OvertimeHistoryEntry,
  OvertimePersonnel,
  OvertimeType,
  PersonnelRole,
  ShiftAssignment,
  ShiftCode,
  UpdateOvertimeCallInput,
  UpdateOvertimePersonnelInput,
  UpdateOvertimeProfileInput,
  WorkGroup,
} from './types';

interface PersonnelRecord {
  id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  unit: string;
  work_group: WorkGroup;
  personnel_role: PersonnelRole;
  active: boolean;
  overtime_eligible: boolean;
}

interface ShiftRecord {
  id: string;
  work_date: string;
  work_group: WorkGroup;
  shift_code: ShiftCode;
  schedule_version: string;
}

interface BalancePeriodRecord {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string | null;
  created_at: string;
}

interface BalanceParticipantRecord {
  personnel_id: string;
  wage_credit: number | string;
  overtime_calls:
    | { work_date: string; status: 'active' | 'cancelled' }
    | Array<{ work_date: string; status: 'active' | 'cancelled' }>;
}

interface BalanceAdjustmentRecord {
  id: string;
  personnel_id: string;
  effective_date: string;
  occurrence_delta: number | string;
  wage_credit_delta: number | string;
  description: string;
}

interface OvertimeTaskRecord {
  description: string;
  sort_order: number;
}

interface HistoryParticipantRecord {
  id: string;
  overtime_type: OvertimeType;
  starts_at: string;
  ends_at: string;
  wage_credit: number | string;
  note: string;
  overtime_calls:
    | {
        id: string;
        work_date: string;
        location: string;
        note: string;
        status: 'active' | 'cancelled';
        overtime_tasks: OvertimeTaskRecord[];
      }
    | Array<{
        id: string;
        work_date: string;
        location: string;
        note: string;
        status: 'active' | 'cancelled';
        overtime_tasks: OvertimeTaskRecord[];
      }>;
}

interface CalendarPersonnelRecord {
  id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  unit: string;
  work_group: WorkGroup;
  personnel_role: PersonnelRole;
}

interface CalendarParticipantRecord {
  id: string;
  personnel_id: string;
  overtime_type: OvertimeType;
  starts_at: string;
  ends_at: string;
  wage_credit: number | string;
  note: string;
  personnel: CalendarPersonnelRecord | CalendarPersonnelRecord[];
}

interface CalendarCallRecord {
  id: string;
  work_date: string;
  location: string;
  note: string;
  created_at: string;
  source_type: 'manual' | 'legacy_import';
  overtime_tasks: OvertimeTaskRecord[];
  overtime_participants: CalendarParticipantRecord[];
}

interface AdminProfileRecord {
  id: string;
  username: string;
  display_name: string;
  app_access: OvertimeAdminProfile['appAccess'];
  overtime_role: OvertimeAdminProfile['overtimeRole'];
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuditRecord {
  id: number;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

interface CancelledParticipantRecord {
  personnel:
    | Pick<CalendarPersonnelRecord, 'first_name' | 'last_name'>
    | Array<Pick<CalendarPersonnelRecord, 'first_name' | 'last_name'>>;
}

interface CancelledCallRecord {
  id: string;
  work_date: string;
  location: string;
  note: string;
  cancellation_reason: string;
  cancelled_at: string;
  cancelled_by: string | null;
  overtime_tasks: OvertimeTaskRecord[];
  overtime_participants: CancelledParticipantRecord[];
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase bağlantısı yapılandırılmadı. VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY değerlerini ekleyin.',
    );
  }
  return supabase;
}

export async function listActivePersonnel(): Promise<OvertimePersonnel[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('personnel')
    .select(
      'id, employee_no, first_name, last_name, unit, work_group, personnel_role, active, overtime_eligible',
    )
    .eq('active', true)
    .order('first_name')
    .order('last_name');

  if (error) throw error;

  return ((data ?? []) as PersonnelRecord[]).map((row) => ({
    id: row.id,
    employeeNo: row.employee_no,
    firstName: row.first_name,
    lastName: row.last_name,
    unit: row.unit,
    workGroup: row.work_group,
    personnelRole: row.personnel_role,
    active: row.active,
    overtimeEligible: row.overtime_eligible,
  }));
}

export async function listAllPersonnel(): Promise<OvertimePersonnel[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('personnel')
    .select(
      'id, employee_no, first_name, last_name, unit, work_group, personnel_role, active, overtime_eligible',
    )
    .order('active', { ascending: false })
    .order('first_name')
    .order('last_name');

  if (error) throw error;

  return ((data ?? []) as PersonnelRecord[]).map((row) => ({
    id: row.id,
    employeeNo: row.employee_no,
    firstName: row.first_name,
    lastName: row.last_name,
    unit: row.unit,
    workGroup: row.work_group,
    personnelRole: row.personnel_role,
    active: row.active,
    overtimeEligible: row.overtime_eligible,
  }));
}

export async function listOvertimeAdminProfiles(): Promise<
  OvertimeAdminProfile[]
> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select(
      'id, username, display_name, app_access, overtime_role, active, created_at, updated_at',
    )
    .order('username');

  if (error) throw error;

  return ((data ?? []) as AdminProfileRecord[]).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    appAccess: row.app_access,
    overtimeRole: row.overtime_role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function updateOvertimeProfileAccess(
  input: UpdateOvertimeProfileInput,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_overtime_profile_access', {
    p_profile_id: input.profileId,
    p_app_access: input.appAccess,
    p_overtime_role: input.overtimeRole,
    p_active: input.active,
  });

  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('Kullanıcı güncellendi ancak profil kimliği alınamadı.');
  }
  return data;
}

export async function updateOvertimePersonnel(
  input: UpdateOvertimePersonnelInput,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_overtime_personnel', {
    p_personnel_id: input.personnelId,
    p_unit: input.unit,
    p_work_group: input.workGroup,
    p_personnel_role: input.personnelRole,
    p_active: input.active,
    p_overtime_eligible: input.overtimeEligible,
  });

  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('Personel güncellendi ancak kayıt kimliği alınamadı.');
  }
  return data;
}

export async function listOvertimeAuditEntries(
  limit = 250,
): Promise<OvertimeAuditEntry[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('audit_log')
    .select(
      'id, table_name, record_id, operation, old_data, new_data, actor_id, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as AuditRecord[]).map((row) => ({
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    operation: row.operation,
    oldData: row.old_data,
    newData: row.new_data,
    actorId: row.actor_id,
    createdAt: row.created_at,
  }));
}

export async function listCancelledOvertimeCalls(): Promise<
  CancelledOvertimeCall[]
> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('overtime_calls')
    .select(
      `id, work_date, location, note, cancellation_reason, cancelled_at, cancelled_by,
       overtime_tasks(description, sort_order),
       overtime_participants(personnel(first_name, last_name))`,
    )
    .eq('status', 'cancelled')
    .order('cancelled_at', { ascending: false })
    .limit(150);

  if (error) throw error;

  return ((data ?? []) as unknown as CancelledCallRecord[]).map((call) => ({
    id: call.id,
    workDate: call.work_date,
    location: call.location,
    note: call.note,
    cancellationReason: call.cancellation_reason,
    cancelledAt: call.cancelled_at,
    cancelledBy: call.cancelled_by,
    participantNames: (call.overtime_participants ?? []).map((participant) => {
      const person = Array.isArray(participant.personnel)
        ? participant.personnel[0]
        : participant.personnel;
      return person
        ? `${person.first_name} ${person.last_name}`
        : 'Bilinmeyen Personel';
    }),
    tasks: [...(call.overtime_tasks ?? [])]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((task) => task.description),
  }));
}

export async function listShiftAssignments(
  workDate: string,
): Promise<ShiftAssignment[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('shift_calendar')
    .select('id, work_date, work_group, shift_code, schedule_version')
    .eq('work_date', workDate)
    .order('work_group');

  if (error) throw error;

  return ((data ?? []) as ShiftRecord[]).map((row) => ({
    id: row.id,
    workDate: row.work_date,
    workGroup: row.work_group,
    shiftCode: row.shift_code,
    scheduleVersion: row.schedule_version,
  }));
}

export async function listOvertimeBalances(): Promise<OvertimeBalance[]> {
  const client = requireSupabase();
  const { data: periodData, error: periodError } = await client
    .from('balance_periods')
    .select('starts_on')
    .is('ends_on', null)
    .maybeSingle();

  if (periodError) throw periodError;

  const period = periodData as BalancePeriodRecord | null;
  if (!period) return [];

  const [participantResult, adjustmentResult] = await Promise.all([
    client
      .from('overtime_participants')
      .select(
        'personnel_id, wage_credit, overtime_calls!inner(work_date, status)',
      )
      .eq('overtime_calls.status', 'active')
      .gte('overtime_calls.work_date', period.starts_on),
    client
      .from('overtime_balance_adjustments')
      .select(
        'id, personnel_id, effective_date, occurrence_delta, wage_credit_delta, description',
      )
      .gte('effective_date', period.starts_on),
  ]);

  if (participantResult.error) throw participantResult.error;
  if (adjustmentResult.error) throw adjustmentResult.error;

  const balances = new Map<string, OvertimeBalance>();
  (
    (participantResult.data ?? []) as unknown as BalanceParticipantRecord[]
  ).forEach((row) => {
    const call = Array.isArray(row.overtime_calls)
      ? row.overtime_calls[0]
      : row.overtime_calls;
    if (!call) return;

    const current = balances.get(row.personnel_id) ?? {
      personnelId: row.personnel_id,
      occurrenceCount: 0,
      wageCreditTotal: 0,
      lastOvertimeDate: null,
    };
    current.occurrenceCount += 1;
    current.wageCreditTotal += Number(row.wage_credit);
    if (
      current.lastOvertimeDate === null ||
      call.work_date > current.lastOvertimeDate
    ) {
      current.lastOvertimeDate = call.work_date;
    }
    balances.set(row.personnel_id, current);
  });

  ((adjustmentResult.data ?? []) as BalanceAdjustmentRecord[]).forEach((row) => {
    const current = balances.get(row.personnel_id) ?? {
      personnelId: row.personnel_id,
      occurrenceCount: 0,
      wageCreditTotal: 0,
      lastOvertimeDate: null,
    };
    current.occurrenceCount += Number(row.occurrence_delta);
    current.wageCreditTotal += Number(row.wage_credit_delta);
    balances.set(row.personnel_id, current);
  });

  return [...balances.values()];
}

export async function listOvertimeBalancePeriods(): Promise<
  OvertimeBalancePeriod[]
> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('balance_periods')
    .select('id, name, starts_on, ends_on, created_at')
    .order('starts_on', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as BalancePeriodRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    createdAt: row.created_at,
  }));
}

export async function startNewOvertimeBalancePeriod(
  name: string,
  startsOn: string,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('start_new_balance_period', {
    period_name: name,
    start_date: startsOn,
  });

  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('Yeni dönem oluşturuldu ancak dönem kimliği alınamadı.');
  }
  return data;
}

export async function createOvertimeCall(
  input: CreateOvertimeCallInput,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_overtime_call', {
    p_work_date: input.workDate,
    p_location: input.location,
    p_note: input.note,
    p_tasks: input.tasks.map((description) => ({ description })),
    p_participants: input.participants.map((participant) => ({
      personnel_id: participant.personnelId,
      overtime_type: participant.overtimeType,
      starts_at: participant.startsAt,
      ends_at: participant.endsAt,
      wage_credit: participant.wageCredit,
      note: participant.note ?? '',
    })),
  });

  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('Mesai kaydı oluşturuldu ancak kayıt kimliği alınamadı.');
  }
  return data;
}

export async function listPersonnelOvertimeHistory(
  personnelId: string,
  year: number,
): Promise<OvertimeHistoryEntry[]> {
  const client = requireSupabase();
  const [participantResult, adjustmentResult] = await Promise.all([
    client
      .from('overtime_participants')
      .select(
        `id, overtime_type, starts_at, ends_at, wage_credit, note,
         overtime_calls!inner(
           id, work_date, location, note, status,
           overtime_tasks(description, sort_order)
         )`,
      )
      .eq('personnel_id', personnelId)
      .eq('overtime_calls.status', 'active')
      .gte('overtime_calls.work_date', `${year}-01-01`)
      .lte('overtime_calls.work_date', `${year}-12-31`)
      .order('starts_at', { ascending: false }),
    client
      .from('overtime_balance_adjustments')
      .select(
        'id, personnel_id, effective_date, occurrence_delta, wage_credit_delta, description',
      )
      .eq('personnel_id', personnelId)
      .gte('effective_date', `${year}-01-01`)
      .lte('effective_date', `${year}-12-31`),
  ]);

  if (participantResult.error) throw participantResult.error;
  if (adjustmentResult.error) throw adjustmentResult.error;

  const overtimeEntries = (
    (participantResult.data ?? []) as unknown as HistoryParticipantRecord[]
  ).flatMap((row) => {
      const call = Array.isArray(row.overtime_calls)
        ? row.overtime_calls[0]
        : row.overtime_calls;
      if (!call) return [];
      const tasks = [...(call.overtime_tasks ?? [])]
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((task) => task.description);
      return [
        {
          id: row.id,
          callId: call.id,
          workDate: call.work_date,
          entryType: 'overtime' as const,
          overtimeType: row.overtime_type,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          wageCredit: Number(row.wage_credit),
          occurrenceCredit: 1,
          location: call.location,
          callNote: call.note,
          participantNote: row.note,
          tasks,
        },
      ];
  });

  const adjustmentEntries = (
    (adjustmentResult.data ?? []) as BalanceAdjustmentRecord[]
  ).map((row) => ({
    id: `adjustment-${row.id}`,
    callId: '',
    workDate: row.effective_date,
    entryType: 'adjustment' as const,
    overtimeType: null,
    startsAt: null,
    endsAt: null,
    wageCredit: Number(row.wage_credit_delta),
    occurrenceCredit: Number(row.occurrence_delta),
    location: '',
    callNote: '',
    participantNote: '',
    tasks: [row.description],
  }));

  return [...overtimeEntries, ...adjustmentEntries].sort(
    (left, right) =>
      right.workDate.localeCompare(left.workDate) ||
      Number(right.entryType === 'overtime') -
        Number(left.entryType === 'overtime'),
  );
}

export async function listOvertimeCallsForRange(
  startsOn: string,
  endsOn: string,
): Promise<OvertimeCalendarCall[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('overtime_calls')
    .select(
      `id, work_date, location, note, created_at, source_type,
       overtime_tasks(description, sort_order),
       overtime_participants(
         id, personnel_id, overtime_type, starts_at, ends_at, wage_credit, note,
         personnel(id, employee_no, first_name, last_name, unit, work_group, personnel_role)
       )`,
    )
    .eq('status', 'active')
    .gte('work_date', startsOn)
    .lte('work_date', endsOn)
    .order('work_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as CalendarCallRecord[]).map((call) => ({
    id: call.id,
    workDate: call.work_date,
    location: call.location,
    note: call.note,
    createdAt: call.created_at,
    sourceType: call.source_type,
    tasks: [...(call.overtime_tasks ?? [])]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((task) => task.description),
    participants: (call.overtime_participants ?? []).map((participant) => {
      const person = Array.isArray(participant.personnel)
        ? participant.personnel[0]
        : participant.personnel;
      return {
        id: participant.id,
        personnelId: participant.personnel_id,
        employeeNo: person?.employee_no ?? '',
        fullName: person
          ? `${person.first_name} ${person.last_name}`
          : 'Bilinmeyen Personel',
        unit: person?.unit ?? '',
        personnelRole: person?.personnel_role ?? 'technician',
        workGroup: person?.work_group ?? 'L',
        overtimeType: participant.overtime_type,
        startsAt: participant.starts_at,
        endsAt: participant.ends_at,
        wageCredit: Number(participant.wage_credit),
        note: participant.note,
      };
    }),
  }));
}

export async function listOvertimeBalanceAdjustmentsForRange(
  startsOn: string,
  endsOn: string,
): Promise<OvertimeBalanceAdjustment[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('overtime_balance_adjustments')
    .select(
      'id, personnel_id, effective_date, occurrence_delta, wage_credit_delta, description',
    )
    .gte('effective_date', startsOn)
    .lte('effective_date', endsOn)
    .order('effective_date', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as BalanceAdjustmentRecord[]).map((row) => ({
    id: row.id,
    personnelId: row.personnel_id,
    effectiveDate: row.effective_date,
    occurrenceDelta: Number(row.occurrence_delta),
    wageCreditDelta: Number(row.wage_credit_delta),
    description: row.description,
  }));
}

export async function updateOvertimeCallDetails(
  input: UpdateOvertimeCallInput,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('update_overtime_call_details', {
    p_call_id: input.callId,
    p_location: input.location,
    p_note: input.note,
    p_tasks: input.tasks.map((description) => ({ description })),
    p_participants: input.participants.map((participant) => ({
      id: participant.id,
      wage_credit: participant.wageCredit,
      note: participant.note,
    })),
  });

  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('Mesai kaydı güncellendi ancak kayıt kimliği alınamadı.');
  }
  return data;
}

export async function cancelOvertimeCall(
  callId: string,
  reason: string,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('cancel_overtime_call', {
    p_call_id: callId,
    p_reason: reason,
  });

  if (error) throw error;
  if (typeof data !== 'string') {
    throw new Error('Mesai kaydı iptal edildi ancak kayıt kimliği alınamadı.');
  }
  return data;
}
