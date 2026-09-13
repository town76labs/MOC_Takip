-- Salt okunur canlıya geçiş kontrolü. Beklenen sonuç: bütün satırlar BASARILI.

with checks as (
  select
    '2026 vardiya satır sayısı'::text as kontrol,
    1825::bigint as beklenen,
    count(*)::bigint as gerceklesen
  from public.shift_calendar
  where work_date between date '2026-01-01' and date '2026-12-31'

  union all

  select
    '12-13 Eylül referans vardiyaları',
    0,
    count(*)
  from public.shift_calendar
  where work_date in (date '2026-09-12', date '2026-09-13')
    and not (
      (work_group = 'A' and shift_code = 'shift_00_08')
      or (work_group = 'B' and shift_code = 'shift_08_16')
      or (work_group = 'C' and shift_code = 'shift_16_24')
      or (work_group = 'D' and shift_code = 'weekly_rest')
      or (work_group = 'L' and shift_code = 'weekly_rest')
    )

  union all

  select
    'Aktif denge dönemi',
    1,
    count(*)
  from public.balance_periods
  where ends_on is null

  union all

  select
    'Tutarsız kullanıcı/mesai yetkisi',
    0,
    count(*)
  from public.profiles
  where overtime_role <> 'none'
    and app_access not in ('full', 'overtime_only')

  union all

  select
    'Ekipten ayrılan Celil Akyol kaydı',
    0,
    count(*)
  from public.personnel
  where upper(first_name) = 'CELİL'
    and upper(last_name) = 'AKYOL'

  union all

  select
    'Pasif/uygunsuz personelli manuel mesai',
    0,
    count(*)
  from public.overtime_participants participant
  join public.overtime_calls call on call.id = participant.call_id
  join public.personnel person on person.id = participant.personnel_id
  where call.source_type = 'manual'
    and (not person.active or not person.overtime_eligible)

  union all

  select
    'Vardiyasıyla uyumsuz tam gün mesaisi',
    0,
    count(*)
  from public.overtime_participants participant
  join public.overtime_calls call on call.id = participant.call_id
  join public.personnel person on person.id = participant.personnel_id
  join public.shift_calendar shift
    on shift.work_date = call.work_date
    and shift.work_group = person.work_group
  where call.source_type = 'manual'
    and participant.overtime_type = 'full_day'
    and shift.shift_code <> 'weekly_rest'

  union all

  select
    'Vardiyasıyla uyumsuz devam mesaisi',
    0,
    count(*)
  from public.overtime_participants participant
  join public.overtime_calls call on call.id = participant.call_id
  join public.personnel person on person.id = participant.personnel_id
  join public.shift_calendar shift
    on shift.work_date = call.work_date
    and shift.work_group = person.work_group
  where call.source_type = 'manual'
    and participant.overtime_type = 'continuation'
    and shift.shift_code not in ('shift_08_16', 'day_08_17')

  union all

  select
    'Geçersiz manuel yevmiye',
    0,
    count(*)
  from public.overtime_participants participant
  join public.overtime_calls call on call.id = participant.call_id
  where call.source_type = 'manual'
    and participant.wage_credit not in (2, 3, 4.5, 5.5, 9)

  union all

  select
    'Çakışan aktif personel mesaisi',
    0,
    count(*)
  from public.overtime_participants left_participant
  join public.overtime_calls left_call
    on left_call.id = left_participant.call_id
    and left_call.status = 'active'
    and left_call.source_type = 'manual'
  join public.overtime_participants right_participant
    on right_participant.personnel_id = left_participant.personnel_id
    and right_participant.id > left_participant.id
    and tstzrange(
      left_participant.starts_at,
      left_participant.ends_at,
      '[)'
    ) && tstzrange(
      right_participant.starts_at,
      right_participant.ends_at,
      '[)'
    )
  join public.overtime_calls right_call
    on right_call.id = right_participant.call_id
    and right_call.status = 'active'
    and right_call.source_type = 'manual'

  union all

  select
    'Eksik iptal bilgisi',
    0,
    count(*)
  from public.overtime_calls
  where status = 'cancelled'
    and (
      cancelled_at is null
      or cancelled_by is null
      or length(trim(cancellation_reason)) = 0
    )

  union all

  select
    'RLS kapalı mesai tablosu',
    0,
    count(*)
  from pg_class table_info
  join pg_namespace schema_info on schema_info.oid = table_info.relnamespace
  where schema_info.nspname = 'public'
    and table_info.relname in (
      'profiles',
      'personnel',
      'shift_calendar',
      'calendar_days',
      'balance_periods',
      'overtime_calls',
      'overtime_tasks',
      'overtime_participants',
      'overtime_balance_adjustments',
      'audit_log'
    )
    and not table_info.relrowsecurity

  union all

  select
    'Anon tablo yetkisi',
    0,
    count(*)
  from information_schema.role_table_grants
  where grantee = 'anon'
    and table_schema = 'public'
    and table_name in (
      'profiles',
      'personnel',
      'shift_calendar',
      'calendar_days',
      'balance_periods',
      'overtime_calls',
      'overtime_tasks',
      'overtime_participants',
      'overtime_balance_adjustments',
      'audit_log'
    )

  union all

  select
    'Doğrudan UPDATE yetkisi',
    0,
    count(*)
  from information_schema.role_table_grants
  where grantee = 'authenticated'
    and table_schema = 'public'
    and privilege_type = 'UPDATE'
    and table_name in (
      'profiles',
      'personnel',
      'overtime_calls',
      'overtime_tasks',
      'overtime_participants'
    )
)
select
  kontrol,
  beklenen,
  gerceklesen,
  case
    when gerceklesen = beklenen then 'BASARILI'
    else 'KONTROL GEREKIYOR'
  end as durum
from checks
order by durum desc, kontrol;
