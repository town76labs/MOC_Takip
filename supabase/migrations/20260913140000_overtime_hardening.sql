-- Canlı kullanımda UI filtrelerinin aşılması halinde de pasif veya mesaiye
-- uygun olmayan personelin manuel mesai kaydına eklenmesini engeller.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_overtime_access_consistency_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_overtime_access_consistency_check
      check (
        overtime_role = 'none'::public.overtime_role
        or app_access in (
          'full'::public.app_access,
          'overtime_only'::public.app_access
        )
      );
  end if;
end
$$;

create or replace function public.validate_overtime_personnel_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  call_source_type text;
  person_active boolean;
  person_overtime_eligible boolean;
begin
  select
    call.source_type,
    person.active,
    person.overtime_eligible
  into
    call_source_type,
    person_active,
    person_overtime_eligible
  from public.overtime_calls call
  cross join public.personnel person
  where call.id = new.call_id
    and person.id = new.personnel_id;

  if not found then
    raise exception 'Mesai çağrısı veya personel bulunamadı.';
  end if;

  if call_source_type = 'manual' and not person_active then
    raise exception 'Pasif personel manuel mesai kaydına eklenemez.';
  end if;

  if call_source_type = 'manual' and not person_overtime_eligible then
    raise exception 'Mesai listesine dahil olmayan personel kayda eklenemez.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_overtime_personnel_state() from public;

drop trigger if exists overtime_participants_personnel_state_validate
on public.overtime_participants;

create trigger overtime_participants_personnel_state_validate
before insert or update on public.overtime_participants
for each row execute function public.validate_overtime_personnel_state();
