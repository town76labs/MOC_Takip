-- Mesai kaydını silmek yerine gerekçeli iptal eder; temel açıklama, işler ve
-- personel yevmiye/not alanlarını tek işlemde günceller.

create or replace function public.update_overtime_call_details(
  p_call_id uuid,
  p_location text,
  p_note text,
  p_tasks jsonb,
  p_participants jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  call_status public.overtime_call_status;
  expected_participant_count integer;
  task_item jsonb;
  participant_item jsonb;
  task_index integer := 0;
  participant_id uuid;
begin
  if not public.can_edit_overtime() then
    raise exception 'Mesai kaydını düzenleme yetkiniz bulunmuyor.';
  end if;

  select status into call_status
  from public.overtime_calls
  where id = p_call_id
  for update;

  if call_status is null then
    raise exception 'Mesai kaydı bulunamadı.';
  end if;

  if call_status <> 'active' then
    raise exception 'İptal edilmiş mesai kaydı düzenlenemez.';
  end if;

  if p_tasks is null
    or jsonb_typeof(p_tasks) <> 'array'
    or jsonb_array_length(p_tasks) = 0 then
    raise exception 'En az bir iş açıklaması girilmelidir.';
  end if;

  if p_participants is null
    or jsonb_typeof(p_participants) <> 'array'
    or jsonb_array_length(p_participants) = 0 then
    raise exception 'En az bir personel bulunmalıdır.';
  end if;

  select count(*) into expected_participant_count
  from public.overtime_participants
  where call_id = p_call_id;

  if jsonb_array_length(p_participants) <> expected_participant_count then
    raise exception 'Personel listesi eksik veya fazla gönderildi.';
  end if;

  if (
    select count(distinct (item ->> 'id')::uuid)
    from jsonb_array_elements(p_participants) item
  ) <> expected_participant_count then
    raise exception 'Personel kayıt kimlikleri eksik veya tekrarlı.';
  end if;

  update public.overtime_calls
  set
    location = coalesce(trim(p_location), ''),
    note = coalesce(trim(p_note), ''),
    updated_by = auth.uid()
  where id = p_call_id;

  delete from public.overtime_tasks where call_id = p_call_id;

  for task_item in select value from jsonb_array_elements(p_tasks)
  loop
    if length(trim(coalesce(task_item ->> 'description', ''))) = 0 then
      raise exception 'İş açıklaması boş bırakılamaz.';
    end if;

    insert into public.overtime_tasks (call_id, description, sort_order)
    values (p_call_id, trim(task_item ->> 'description'), task_index);
    task_index := task_index + 1;
  end loop;

  for participant_item in select value from jsonb_array_elements(p_participants)
  loop
    participant_id = (participant_item ->> 'id')::uuid;

    update public.overtime_participants
    set
      wage_credit = (participant_item ->> 'wage_credit')::numeric,
      note = coalesce(trim(participant_item ->> 'note'), '')
    where id = participant_id
      and call_id = p_call_id;

    if not found then
      raise exception 'Mesai personeli bu kayda ait değil.';
    end if;
  end loop;

  return p_call_id;
end;
$$;

create or replace function public.cancel_overtime_call(
  p_call_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  call_status public.overtime_call_status;
begin
  if not public.can_edit_overtime() then
    raise exception 'Mesai kaydını iptal etme yetkiniz bulunmuyor.';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'İptal gerekçesi zorunludur.';
  end if;

  select status into call_status
  from public.overtime_calls
  where id = p_call_id
  for update;

  if call_status is null then
    raise exception 'Mesai kaydı bulunamadı.';
  end if;

  if call_status = 'cancelled' then
    return p_call_id;
  end if;

  update public.overtime_calls
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = trim(p_reason),
    updated_by = auth.uid()
  where id = p_call_id;

  return p_call_id;
end;
$$;

revoke all on function public.update_overtime_call_details(
  uuid, text, text, jsonb, jsonb
) from public;
revoke all on function public.cancel_overtime_call(uuid, text) from public;

grant execute on function public.update_overtime_call_details(
  uuid, text, text, jsonb, jsonb
) to authenticated;
grant execute on function public.cancel_overtime_call(uuid, text)
  to authenticated;

-- Değişiklikler yalnızca doğrulamalı RPC'lerden geçsin.
revoke update on public.overtime_calls from authenticated;
revoke update on public.overtime_tasks from authenticated;
revoke update on public.overtime_participants from authenticated;
