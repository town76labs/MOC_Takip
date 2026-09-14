-- Salt okunur canlıya geçiş kontrolü. Beklenen sonuç: bütün satırlar BASARILI.

with shift_patterns as (
  select *
  from (
    values
      (
        'A'::public.work_group,
        array[
          'weekly_rest',
          'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24',
          'weekly_rest',
          'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16',
          'weekly_rest', 'weekly_rest',
          'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08',
          'weekly_rest', 'weekly_rest',
          'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24',
          'weekly_rest',
          'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16',
          'weekly_rest', 'weekly_rest',
          'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08',
          'weekly_rest'
        ]::public.shift_code[]
      ),
      (
        'B'::public.work_group,
        array[
          'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08',
          'weekly_rest', 'weekly_rest',
          'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24',
          'weekly_rest',
          'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16',
          'weekly_rest', 'weekly_rest',
          'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08',
          'weekly_rest', 'weekly_rest',
          'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24',
          'weekly_rest',
          'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16',
          'weekly_rest', 'weekly_rest',
          'shift_00_08'
        ]::public.shift_code[]
      ),
      (
        'C'::public.work_group,
        array[
          'shift_08_16', 'shift_08_16',
          'weekly_rest', 'weekly_rest',
          'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08',
          'weekly_rest', 'weekly_rest',
          'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24',
          'weekly_rest',
          'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16',
          'weekly_rest', 'weekly_rest',
          'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08',
          'weekly_rest', 'weekly_rest',
          'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24',
          'weekly_rest',
          'shift_08_16', 'shift_08_16', 'shift_08_16'
        ]::public.shift_code[]
      ),
      (
        'D'::public.work_group,
        array[
          'shift_16_24',
          'weekly_rest',
          'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16',
          'weekly_rest', 'weekly_rest',
          'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08',
          'weekly_rest', 'weekly_rest',
          'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24',
          'weekly_rest',
          'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16', 'shift_08_16',
          'weekly_rest', 'weekly_rest',
          'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08', 'shift_00_08',
          'weekly_rest', 'weekly_rest',
          'shift_16_24', 'shift_16_24', 'shift_16_24', 'shift_16_24'
        ]::public.shift_code[]
      )
  ) as pattern_definition(work_group, shifts)
),
expected_shift_calendar as (
  select
    day_value::date as work_date,
    pattern.work_group,
    pattern.shifts[
      mod(day_value::date - date '2026-01-01', 40) + 1
    ] as shift_code
  from generate_series(
    date '2026-01-01',
    date '2026-12-31',
    interval '1 day'
  ) as day_value
  cross join shift_patterns as pattern

  union all

  select
    day_value::date as work_date,
    'L'::public.work_group,
    case
      when extract(isodow from day_value::date) in (6, 7)
        then 'weekly_rest'::public.shift_code
      else 'day_08_17'::public.shift_code
    end as shift_code
  from generate_series(
    date '2026-01-01',
    date '2026-12-31',
    interval '1 day'
  ) as day_value
),
checks as (
  select
    '2026 vardiya satır sayısı'::text as kontrol,
    1825::bigint as beklenen,
    count(*)::bigint as gerceklesen
  from public.shift_calendar
  where work_date between date '2026-01-01' and date '2026-12-31'

  union all

  select
    '2026 kart ile vardiya eşleşmesi',
    0,
    count(*)
  from expected_shift_calendar expected
  full join (
    select *
    from public.shift_calendar
    where work_date between date '2026-01-01' and date '2026-12-31'
  ) actual
    on actual.work_date = expected.work_date
    and actual.work_group = expected.work_group
  where actual.work_date is null
    or expected.work_date is null
    or actual.shift_code <> expected.shift_code
    or actual.schedule_version <> 'PETROL-IS-ALIAGA-2026-V4-CARD-40D'

  union all

  select
    '12-14 Eylül referans vardiyaları',
    0,
    count(*)
  from public.shift_calendar
  where work_date between date '2026-09-12' and date '2026-09-14'
    and shift_code <> case
      when work_group = 'A' then 'shift_00_08'::public.shift_code
      when work_group = 'B' then 'shift_08_16'::public.shift_code
      when work_group = 'C' and work_date = date '2026-09-14'
        then 'weekly_rest'::public.shift_code
      when work_group = 'C' then 'shift_16_24'::public.shift_code
      when work_group = 'D' and work_date = date '2026-09-14'
        then 'shift_16_24'::public.shift_code
      when work_group = 'D' then 'weekly_rest'::public.shift_code
      when work_group = 'L' and work_date = date '2026-09-14'
        then 'day_08_17'::public.shift_code
      else 'weekly_rest'::public.shift_code
    end

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
