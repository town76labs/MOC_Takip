-- Canlı doğrulamada tespit edilen anonim ayrıcalıkları kapatır ve aynı
-- personel için eşzamanlı mesai girişlerini işlem seviyesinde sıraya alır.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- SQL Editor'da bu migrasyonu uygulayan rolün gelecekte oluşturacağı nesneler
-- anonim kullanıcıya otomatik ayrıcalık vermesin.
alter default privileges in schema public
  revoke all on tables from anon;
alter default privileges in schema public
  revoke all on sequences from anon;

create or replace function public.serialize_overtime_participant_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Aynı personel için paralel gelen iki işlem, çakışma kontrolünden aynı anda
  -- geçemesin. Kilit transaction tamamlandığında otomatik olarak bırakılır.
  perform pg_advisory_xact_lock(
    hashtextextended(new.personnel_id::text, 0)
  );
  return new;
end;
$$;

revoke all on function public.serialize_overtime_participant_write()
from public;

drop trigger if exists overtime_participants_00_serialize
on public.overtime_participants;

create trigger overtime_participants_00_serialize
before insert or update on public.overtime_participants
for each row execute function public.serialize_overtime_participant_write();
