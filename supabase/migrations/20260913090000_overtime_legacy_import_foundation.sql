-- FM.xlsx geçmiş verilerini, canlı mesai girişlerinden ayırarak saklar.
-- Yeni manuel kayıt kuralları aynen korunur; eski Excel değerleri yalnızca
-- source_type = 'legacy_import' olan çağrılarda kabul edilir.

alter table public.personnel
  add column if not exists overtime_eligible boolean not null default true;

comment on column public.personnel.overtime_eligible is
  'Yanlış aday önerisini önlemek için vardiyası doğrulanmamış personelde false olur.';

alter table public.overtime_calls
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_ref text;

alter table public.overtime_participants
  add column if not exists source_ref text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'overtime_calls_source_type_check'
      and conrelid = 'public.overtime_calls'::regclass
  ) then
    alter table public.overtime_calls
      add constraint overtime_calls_source_type_check
      check (source_type in ('manual', 'legacy_import'));
  end if;
end
$$;

create unique index if not exists overtime_calls_source_ref_uidx
  on public.overtime_calls (source_ref)
  where source_ref is not null;

create unique index if not exists overtime_participants_source_ref_uidx
  on public.overtime_participants (source_ref)
  where source_ref is not null;

alter table public.overtime_participants
  drop constraint if exists overtime_participants_wage_credit_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'overtime_participants_wage_credit_positive_check'
      and conrelid = 'public.overtime_participants'::regclass
  ) then
    alter table public.overtime_participants
      add constraint overtime_participants_wage_credit_positive_check
      check (wage_credit > 0);
  end if;
end
$$;

create table if not exists public.overtime_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id),
  effective_date date not null,
  occurrence_delta integer not null default 0,
  wage_credit_delta numeric(10, 3) not null default 0,
  description text not null check (length(trim(description)) > 0),
  source_ref text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (occurrence_delta <> 0 or wage_credit_delta <> 0)
);

comment on table public.overtime_balance_adjustments is
  'Ayrıntısı bulunmayan devreden mesai bakiyeleri ve yönetici düzeltmeleri.';

alter table public.overtime_balance_adjustments enable row level security;

create policy overtime_balance_adjustments_read
on public.overtime_balance_adjustments for select
to authenticated
using (public.can_view_overtime());

create policy overtime_balance_adjustments_admin_insert
on public.overtime_balance_adjustments for insert
to authenticated
with check (public.is_overtime_admin() and created_by = auth.uid());

create trigger overtime_balance_adjustments_audit
after insert or update or delete on public.overtime_balance_adjustments
for each row execute function public.record_audit_log();

grant select on public.overtime_balance_adjustments to authenticated;
grant insert on public.overtime_balance_adjustments to authenticated;

-- İlk dönem, Excel'deki 26.12.2025 tarihinden başlayan devreden bakiyeyi kapsar.
update public.balance_periods
set starts_on = date '2025-12-26'
where ends_on is null
  and starts_on > date '2025-12-26';

-- Operatörlerin REST üzerinden import işareti üretmesini engelle.
drop policy if exists overtime_calls_insert on public.overtime_calls;
create policy overtime_calls_insert
on public.overtime_calls for insert
to authenticated
with check (
  public.can_edit_overtime()
  and created_by = auth.uid()
  and source_type = 'manual'
  and source_ref is null
);

drop policy if exists overtime_participants_insert
on public.overtime_participants;
create policy overtime_participants_insert
on public.overtime_participants for insert
to authenticated
with check (
  public.can_edit_overtime()
  and source_ref is null
  and exists (
    select 1
    from public.overtime_calls call
    where call.id = call_id
      and call.source_type = 'manual'
  )
);

create or replace function public.validate_overtime_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  call_date date;
  call_status public.overtime_call_status;
  call_source_type text;
  personnel_group public.work_group;
  planned_shift public.shift_code;
  local_start timestamp;
  local_end timestamp;
begin
  select call.work_date, call.status, call.source_type, person.work_group
  into call_date, call_status, call_source_type, personnel_group
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

  -- Excel geçmişi, güncel giriş seçeneklerinde olmayan eski saat ve yevmiye
  -- değerleri içerebilir. Kaynağı işaretli bu kayıtlar geçmiş olarak korunur.
  if call_source_type = 'legacy_import' then
    new.scheduled_shift_code = planned_shift;
    return new;
  end if;

  if new.source_ref is not null then
    raise exception 'Manuel mesai kaydına import referansı eklenemez.';
  end if;

  if new.wage_credit not in (2, 3, 4.5, 5.5, 9) then
    raise exception 'Yevmiye 2, 3, 4.5, 5.5 veya 9 olmalıdır.';
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
