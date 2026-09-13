create extension if not exists pgcrypto;

create type public.app_access as enum (
  'full',
  'sce_only',
  'overtime_only',
  'none'
);

create type public.overtime_role as enum (
  'admin',
  'operator',
  'viewer',
  'none'
);

create type public.work_group as enum ('A', 'B', 'C', 'D', 'L');
create type public.personnel_role as enum ('foreman', 'technician');

create type public.shift_code as enum (
  'shift_00_08',
  'shift_08_16',
  'shift_16_24',
  'day_08_17',
  'weekly_rest'
);

create type public.overtime_type as enum ('full_day', 'continuation');
create type public.overtime_call_status as enum ('active', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  app_access public.app_access not null default 'none',
  overtime_role public.overtime_role not null default 'none',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.personnel (
  id uuid primary key default gen_random_uuid(),
  employee_no text not null unique,
  first_name text not null,
  last_name text not null,
  unit text not null,
  work_group public.work_group not null,
  personnel_role public.personnel_role not null default 'technician',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shift_calendar (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  work_group public.work_group not null,
  shift_code public.shift_code not null,
  schedule_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_date, work_group)
);

create table public.calendar_days (
  work_date date primary key,
  holiday_type text not null check (
    holiday_type in ('general_holiday', 'arefe', 'religious_holiday')
  ),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.balance_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date,
  reset_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create unique index balance_periods_one_active_idx
  on public.balance_periods ((true))
  where ends_on is null;

create table public.overtime_calls (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  location text not null default '',
  note text not null default '',
  status public.overtime_call_status not null default 'active',
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and cancelled_at is null and cancelled_by is null)
    or
    (
      status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by is not null
      and length(trim(cancellation_reason)) > 0
    )
  )
);

create table public.overtime_tasks (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.overtime_calls(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.overtime_participants (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.overtime_calls(id) on delete cascade,
  personnel_id uuid not null references public.personnel(id),
  overtime_type public.overtime_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  wage_credit numeric(4, 1) not null check (
    wage_credit in (2, 3, 4.5, 5.5, 9)
  ),
  scheduled_shift_code public.shift_code not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id, personnel_id),
  check (ends_at > starts_at)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger personnel_set_updated_at
before update on public.personnel
for each row execute function public.set_updated_at();

create trigger shift_calendar_set_updated_at
before update on public.shift_calendar
for each row execute function public.set_updated_at();

create trigger calendar_days_set_updated_at
before update on public.calendar_days
for each row execute function public.set_updated_at();

create trigger overtime_calls_set_updated_at
before update on public.overtime_calls
for each row execute function public.set_updated_at();

create trigger overtime_participants_set_updated_at
before update on public.overtime_participants
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    username,
    display_name,
    app_access,
    overtime_role
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    'none'::public.app_access,
    'none'::public.overtime_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_overtime_role()
returns public.overtime_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select overtime_role
      from public.profiles
      where id = auth.uid() and active
    ),
    'none'::public.overtime_role
  );
$$;

create or replace function public.can_view_overtime()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_overtime_role() in ('admin', 'operator', 'viewer');
$$;

create or replace function public.can_edit_overtime()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_overtime_role() in ('admin', 'operator');
$$;

create or replace function public.is_overtime_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_overtime_role() = 'admin';
$$;

revoke all on function public.current_overtime_role() from public;
revoke all on function public.can_view_overtime() from public;
revoke all on function public.can_edit_overtime() from public;
revoke all on function public.is_overtime_admin() from public;
grant execute on function public.current_overtime_role() to authenticated;
grant execute on function public.can_view_overtime() to authenticated;
grant execute on function public.can_edit_overtime() to authenticated;
grant execute on function public.is_overtime_admin() to authenticated;

create or replace function public.validate_overtime_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  call_date date;
  call_status public.overtime_call_status;
  personnel_group public.work_group;
  planned_shift public.shift_code;
  local_start timestamp;
  local_end timestamp;
begin
  select call.work_date, call.status, person.work_group
  into call_date, call_status, personnel_group
  from public.overtime_calls call
  cross join public.personnel person
  where call.id = new.call_id and person.id = new.personnel_id;

  if call_date is null then
    raise exception 'Mesai çağrısı veya personel bulunamadı.';
  end if;

  if call_status <> 'active' then
    raise exception 'İptal edilmiş mesai çağrısına personel eklenemez.';
  end if;

  select shift.shift_code
  into planned_shift
  from public.shift_calendar shift
  where shift.work_date = call_date and shift.work_group = personnel_group;

  if planned_shift is null then
    raise exception 'Personelin bu tarih için vardiya kaydı bulunamadı.';
  end if;

  if new.overtime_type = 'full_day' and planned_shift <> 'weekly_rest' then
    raise exception 'Tam gün mesaisi yalnızca hafta tatilinde girilebilir.';
  end if;

  if new.overtime_type = 'continuation' and planned_shift = 'weekly_rest' then
    raise exception 'Hafta tatilindeki personel devam mesaisine bırakılamaz.';
  end if;

  if (new.starts_at at time zone 'Europe/Istanbul')::date <> call_date then
    raise exception 'Mesai başlangıç tarihi çağrı tarihiyle aynı olmalıdır.';
  end if;

  local_start = new.starts_at at time zone 'Europe/Istanbul';
  local_end = new.ends_at at time zone 'Europe/Istanbul';

  if new.overtime_type = 'full_day' and not (
    local_start = call_date + time '08:00'
    and local_end in (
      call_date + time '16:00',
      call_date + time '20:00',
      (call_date + 1)::timestamp
    )
  ) then
    raise exception 'Tam gün mesaisi 08-16, 08-20 veya 08-24 olmalıdır.';
  end if;

  if new.overtime_type = 'continuation' then
    if planned_shift = 'shift_08_16' and not (
      local_start = call_date + time '16:00'
      and local_end in (
        call_date + time '20:00',
        (call_date + 1)::timestamp
      )
    ) then
      raise exception '08-16 vardiyası devam mesaisi 16-20 veya 16-24 olmalıdır.';
    elsif planned_shift = 'day_08_17' and not (
      (
        local_start = call_date + time '17:00'
        and local_end = call_date + time '20:00'
      )
      or
      (
        local_start = call_date + time '16:00'
        and local_end = (call_date + 1)::timestamp
      )
    ) then
      raise exception 'L vardiyası devam mesaisi 17-20 veya 16-24 olmalıdır.';
    elsif planned_shift not in ('shift_08_16', 'day_08_17') then
      raise exception 'Bu vardiya için devam mesaisi saatleri henüz tanımlanmadı.';
    end if;
  end if;

  new.scheduled_shift_code = planned_shift;

  if exists (
    select 1
    from public.overtime_participants existing
    join public.overtime_calls existing_call
      on existing_call.id = existing.call_id
    where existing.personnel_id = new.personnel_id
      and existing.id <> new.id
      and existing_call.status = 'active'
      and tstzrange(existing.starts_at, existing.ends_at, '[)')
        && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Personelin bu saat aralığıyla çakışan başka mesaisi var.';
  end if;

  return new;
end;
$$;

create trigger overtime_participants_validate
before insert or update on public.overtime_participants
for each row execute function public.validate_overtime_participant();

create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
  target_id uuid;
begin
  old_row = case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row = case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  target_id = coalesce(new_row ->> 'id', old_row ->> 'id')::uuid;

  insert into public.audit_log (
    table_name,
    record_id,
    operation,
    old_data,
    new_data,
    actor_id
  )
  values (tg_table_name, target_id, tg_op, old_row, new_row, auth.uid());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger overtime_calls_audit
after insert or update or delete on public.overtime_calls
for each row execute function public.record_audit_log();

create trigger overtime_tasks_audit
after insert or update or delete on public.overtime_tasks
for each row execute function public.record_audit_log();

create trigger overtime_participants_audit
after insert or update or delete on public.overtime_participants
for each row execute function public.record_audit_log();

create trigger balance_periods_audit
after insert or update or delete on public.balance_periods
for each row execute function public.record_audit_log();

create or replace function public.start_new_balance_period(
  period_name text,
  start_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  active_start date;
  new_period_id uuid;
begin
  if not public.is_overtime_admin() then
    raise exception 'Denge dönemini yalnızca mesai yöneticisi sıfırlayabilir.';
  end if;

  select starts_on
  into active_start
  from public.balance_periods
  where ends_on is null
  for update;

  if active_start is not null and start_date <= active_start then
    raise exception 'Yeni dönem mevcut dönemden sonra başlamalıdır.';
  end if;

  update public.balance_periods
  set ends_on = start_date - 1, reset_by = auth.uid()
  where ends_on is null;

  insert into public.balance_periods (name, starts_on, reset_by)
  values (trim(period_name), start_date, auth.uid())
  returning id into new_period_id;

  return new_period_id;
end;
$$;

revoke all on function public.start_new_balance_period(text, date) from public;
grant execute on function public.start_new_balance_period(text, date)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.personnel enable row level security;
alter table public.shift_calendar enable row level security;
alter table public.calendar_days enable row level security;
alter table public.balance_periods enable row level security;
alter table public.overtime_calls enable row level security;
alter table public.overtime_tasks enable row level security;
alter table public.overtime_participants enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_read_own_or_admin
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_overtime_admin());

create policy profiles_admin_update
on public.profiles for update
to authenticated
using (public.is_overtime_admin())
with check (public.is_overtime_admin());

create policy personnel_read
on public.personnel for select
to authenticated
using (public.can_view_overtime());

create policy personnel_admin_insert
on public.personnel for insert
to authenticated
with check (public.is_overtime_admin());

create policy personnel_admin_update
on public.personnel for update
to authenticated
using (public.is_overtime_admin())
with check (public.is_overtime_admin());

create policy shift_calendar_read
on public.shift_calendar for select
to authenticated
using (public.can_view_overtime());

create policy shift_calendar_admin_write
on public.shift_calendar for all
to authenticated
using (public.is_overtime_admin())
with check (public.is_overtime_admin());

create policy calendar_days_read
on public.calendar_days for select
to authenticated
using (public.can_view_overtime());

create policy calendar_days_admin_write
on public.calendar_days for all
to authenticated
using (public.is_overtime_admin())
with check (public.is_overtime_admin());

create policy balance_periods_read
on public.balance_periods for select
to authenticated
using (public.can_view_overtime());

create policy overtime_calls_read
on public.overtime_calls for select
to authenticated
using (public.can_view_overtime());

create policy overtime_calls_insert
on public.overtime_calls for insert
to authenticated
with check (public.can_edit_overtime() and created_by = auth.uid());

create policy overtime_calls_update
on public.overtime_calls for update
to authenticated
using (public.can_edit_overtime())
with check (public.can_edit_overtime());

create policy overtime_tasks_read
on public.overtime_tasks for select
to authenticated
using (public.can_view_overtime());

create policy overtime_tasks_insert
on public.overtime_tasks for insert
to authenticated
with check (public.can_edit_overtime());

create policy overtime_tasks_update
on public.overtime_tasks for update
to authenticated
using (public.can_edit_overtime())
with check (public.can_edit_overtime());

create policy overtime_participants_read
on public.overtime_participants for select
to authenticated
using (public.can_view_overtime());

create policy overtime_participants_insert
on public.overtime_participants for insert
to authenticated
with check (public.can_edit_overtime());

create policy overtime_participants_update
on public.overtime_participants for update
to authenticated
using (public.can_edit_overtime())
with check (public.can_edit_overtime());

create policy audit_log_admin_read
on public.audit_log for select
to authenticated
using (public.is_overtime_admin());

revoke all on all tables in schema public from anon;
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;
grant select, insert, update on public.personnel to authenticated;
grant select, insert, update, delete on public.shift_calendar to authenticated;
grant select, insert, update, delete on public.calendar_days to authenticated;
grant select on public.balance_periods to authenticated;
grant select, insert, update on public.overtime_calls to authenticated;
grant select, insert, update on public.overtime_tasks to authenticated;
grant select, insert, update on public.overtime_participants to authenticated;
grant select on public.audit_log to authenticated;
grant usage, select on sequence public.audit_log_id_seq to authenticated;

insert into public.balance_periods (name, starts_on)
values ('Başlangıç Dönemi', current_date);
