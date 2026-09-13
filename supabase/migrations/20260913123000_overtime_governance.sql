-- Mesai yönetimi için güvenli kullanıcı/personel güncelleme fonksiyonları ve
-- yönetim tablolarının denetim kayıtları.

create or replace function public.update_overtime_profile_access(
  p_profile_id uuid,
  p_app_access public.app_access,
  p_overtime_role public.overtime_role,
  p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_overtime_admin() then
    raise exception 'Kullanıcı yetkilerini yalnızca mesai yöneticisi değiştirebilir.';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Kullanıcı profili bulunamadı.';
  end if;

  if p_profile_id = auth.uid() and (
    not p_active
    or p_app_access <> 'full'::public.app_access
    or p_overtime_role <> 'admin'::public.overtime_role
  ) then
    raise exception 'Yönetici kendi tam erişimini veya admin rolünü kaldıramaz.';
  end if;

  if p_overtime_role <> 'none'::public.overtime_role
    and p_app_access not in (
      'full'::public.app_access,
      'overtime_only'::public.app_access
    ) then
    raise exception 'Mesai rolü bulunan kullanıcı Mesai Takibi bölümüne erişebilmelidir.';
  end if;

  if p_app_access = 'overtime_only'::public.app_access
    and p_overtime_role = 'none'::public.overtime_role then
    raise exception 'Yalnızca Mesai Takibi erişimi için bir mesai rolü seçilmelidir.';
  end if;

  update public.profiles
  set
    app_access = p_app_access,
    overtime_role = p_overtime_role,
    active = p_active
  where id = p_profile_id;

  return p_profile_id;
end;
$$;

create or replace function public.update_overtime_personnel(
  p_personnel_id uuid,
  p_unit text,
  p_work_group public.work_group,
  p_personnel_role public.personnel_role,
  p_active boolean,
  p_overtime_eligible boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_overtime_admin() then
    raise exception 'Personel bilgilerini yalnızca mesai yöneticisi değiştirebilir.';
  end if;

  if length(trim(coalesce(p_unit, ''))) = 0 then
    raise exception 'Fabrika veya birim bilgisi boş bırakılamaz.';
  end if;

  update public.personnel
  set
    unit = trim(p_unit),
    work_group = p_work_group,
    personnel_role = p_personnel_role,
    active = p_active,
    overtime_eligible = case when p_active then p_overtime_eligible else false end
  where id = p_personnel_id;

  if not found then
    raise exception 'Personel kaydı bulunamadı.';
  end if;

  return p_personnel_id;
end;
$$;

revoke all on function public.update_overtime_profile_access(
  uuid, public.app_access, public.overtime_role, boolean
) from public;
revoke all on function public.update_overtime_personnel(
  uuid, text, public.work_group, public.personnel_role, boolean, boolean
) from public;

grant execute on function public.update_overtime_profile_access(
  uuid, public.app_access, public.overtime_role, boolean
) to authenticated;
grant execute on function public.update_overtime_personnel(
  uuid, text, public.work_group, public.personnel_role, boolean, boolean
) to authenticated;

-- Yetki/personel değişiklikleri yalnızca doğrulamalı fonksiyonlardan geçsin.
revoke update on public.profiles from authenticated;
revoke update on public.personnel from authenticated;

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
after insert or update or delete on public.profiles
for each row execute function public.record_audit_log();

drop trigger if exists personnel_audit on public.personnel;
create trigger personnel_audit
after insert or update or delete on public.personnel
for each row execute function public.record_audit_log();
