-- Replace the provisional 20-day inference with the 40-column pattern printed
-- on the Petrol-İş Aliağa 2026 three-shift schedule card.

with calendar_dates as (
  select day_value::date as work_date
  from generate_series(
    date '2026-01-01',
    date '2026-12-31',
    interval '1 day'
  ) as day_value
),
shift_patterns as (
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
all_assignments as (
  select
    calendar.work_date,
    pattern.work_group,
    pattern.shifts[
      mod(calendar.work_date - date '2026-01-01', 40) + 1
    ] as shift_code
  from calendar_dates as calendar
  cross join shift_patterns as pattern

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
  'PETROL-IS-ALIAGA-2026-V4-CARD-40D'
from all_assignments as assignment
on conflict (work_date, work_group) do update
set
  shift_code = excluded.shift_code,
  schedule_version = excluded.schedule_version,
  updated_at = now();
