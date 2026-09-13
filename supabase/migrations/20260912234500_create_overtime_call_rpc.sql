create or replace function public.create_overtime_call(
  p_work_date date,
  p_location text,
  p_note text,
  p_tasks jsonb,
  p_participants jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_call_id uuid;
  task_item jsonb;
  participant_item jsonb;
  task_index integer := 0;
begin
  if not public.can_edit_overtime() then
    raise exception 'Mesai kaydı oluşturma yetkiniz bulunmuyor.';
  end if;

  if p_work_date is null then
    raise exception 'Mesai tarihi zorunludur.';
  end if;

  if p_tasks is null
    or jsonb_typeof(p_tasks) <> 'array'
    or jsonb_array_length(p_tasks) = 0 then
    raise exception 'En az bir iş açıklaması girilmelidir.';
  end if;

  if p_participants is null
    or jsonb_typeof(p_participants) <> 'array'
    or jsonb_array_length(p_participants) = 0 then
    raise exception 'En az bir personel seçilmelidir.';
  end if;

  insert into public.overtime_calls (
    work_date,
    location,
    note,
    created_by,
    updated_by
  )
  values (
    p_work_date,
    coalesce(trim(p_location), ''),
    coalesce(trim(p_note), ''),
    auth.uid(),
    auth.uid()
  )
  returning id into new_call_id;

  for task_item in
    select value from jsonb_array_elements(p_tasks)
  loop
    if length(trim(coalesce(task_item ->> 'description', ''))) = 0 then
      raise exception 'İş açıklaması boş bırakılamaz.';
    end if;

    insert into public.overtime_tasks (call_id, description, sort_order)
    values (new_call_id, trim(task_item ->> 'description'), task_index);
    task_index := task_index + 1;
  end loop;

  for participant_item in
    select value from jsonb_array_elements(p_participants)
  loop
    insert into public.overtime_participants (
      call_id,
      personnel_id,
      overtime_type,
      starts_at,
      ends_at,
      wage_credit,
      note
    )
    values (
      new_call_id,
      (participant_item ->> 'personnel_id')::uuid,
      (participant_item ->> 'overtime_type')::public.overtime_type,
      (participant_item ->> 'starts_at')::timestamptz,
      (participant_item ->> 'ends_at')::timestamptz,
      (participant_item ->> 'wage_credit')::numeric,
      coalesce(trim(participant_item ->> 'note'), '')
    );
  end loop;

  return new_call_id;
end;
$$;

revoke all on function public.create_overtime_call(
  date,
  text,
  text,
  jsonb,
  jsonb
) from public;

grant execute on function public.create_overtime_call(
  date,
  text,
  text,
  jsonb,
  jsonb
) to authenticated;
