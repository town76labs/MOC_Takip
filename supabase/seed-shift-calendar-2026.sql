-- Petrol-İş Aliağa 2026 üçlü vardiya çizelgesi.
-- Görsel doğrulama referansı: 12 ve 13.09.2026 tarihlerinde A 00-08,
-- B 08-16, C 16-24 ve D hafta tatilindedir. Döngü 20 günde tekrar eder.

with calendar_dates as (
  select day_value::date as work_date
  from generate_series(
    date '2026-01-01',
    date '2026-12-31',
    interval '1 day'
  ) as day_value
),
shift_groups as (
  select *
  from (
    values
      ('A'::public.work_group, 4),
      ('B'::public.work_group, 14),
      ('C'::public.work_group, 9),
      ('D'::public.work_group, 19)
  ) as group_definition(work_group, phase_offset)
),
rotating_schedule as (
  select
    calendar.work_date,
    group_definition.work_group,
    mod(
      (calendar.work_date - date '2026-01-01')
        + group_definition.phase_offset,
      20
    ) + 1 as cycle_day
  from calendar_dates as calendar
  cross join shift_groups as group_definition
),
all_assignments as (
  select
    rotating.work_date,
    rotating.work_group,
    case
      when rotating.cycle_day in (1, 2, 8, 14, 15)
        then 'weekly_rest'::public.shift_code
      when rotating.cycle_day between 3 and 7
        then 'shift_16_24'::public.shift_code
      when rotating.cycle_day between 9 and 13
        then 'shift_08_16'::public.shift_code
      else 'shift_00_08'::public.shift_code
    end as shift_code
  from rotating_schedule as rotating

  union all

  select
    calendar.work_date,
    'L'::public.work_group,
    case
      when extract(isodow from calendar.work_date) in (6, 7)
        then 'weekly_rest'::public.shift_code
      else 'day_08_17'::public.shift_code
    end as shift_code
  from calendar_dates as calendar
)
insert into public.shift_calendar (
  work_date,
  work_group,
  shift_code,
  schedule_version
)
select
  assignment.work_date,
  assignment.work_group,
  assignment.shift_code,
  'PETROL-IS-ALIAGA-2026-V3'
from all_assignments as assignment
on conflict (work_date, work_group) do update
set
  shift_code = excluded.shift_code,
  schedule_version = excluded.schedule_version,
  updated_at = now();

select
  work_date,
  work_group,
  shift_code,
  schedule_version
from public.shift_calendar
where work_date in (date '2026-09-12', date '2026-09-13')
order by work_date, work_group;
