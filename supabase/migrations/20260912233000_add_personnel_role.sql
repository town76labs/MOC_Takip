do $$
begin
  create type public.personnel_role as enum ('foreman', 'technician');
exception
  when duplicate_object then null;
end
$$;

alter table public.personnel
  add column if not exists personnel_role public.personnel_role
  not null default 'technician';

comment on column public.personnel.personnel_role is
  'Personelin formen veya teknisyen sınıflandırması.';
