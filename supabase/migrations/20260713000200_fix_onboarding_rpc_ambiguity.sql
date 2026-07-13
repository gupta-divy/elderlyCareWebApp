create or replace function public.create_family_and_profile(
  p_full_name text,
  p_role text,
  p_email text,
  p_whatsapp_number text
)
returns table(family_id uuid, family_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_family_id uuid;
  v_family_code text;
  v_attempt int;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select f.id, f.family_code
  into v_family_id, v_family_code
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  where fm.user_id = v_user_id
    and fm.status = 'active'
  order by fm.created_at
  limit 1;

  v_profile := public.upsert_current_user_profile(
    p_full_name,
    p_role,
    p_email,
    p_whatsapp_number
  );

  if v_family_id is not null then
    insert into public.family_members (family_id, user_id, role, status)
    values (v_family_id, v_user_id, v_profile.role, 'active')
    on conflict on constraint family_members_unique_family_user do update
      set role = excluded.role,
          status = 'active';

    return query select v_family_id, v_family_code;
    return;
  end if;

  for v_attempt in 1..12 loop
    v_family_code := public.generate_family_code();
    begin
      insert into public.families (family_code, created_by)
      values (v_family_code, v_user_id)
      returning id into v_family_id;
      exit;
    exception when unique_violation then
      v_family_id := null;
    end;
  end loop;

  if v_family_id is null then
    raise exception 'FAMILY_CREATION_FAILED' using errcode = '23505';
  end if;

  insert into public.family_members (family_id, user_id, role, status)
  values (v_family_id, v_user_id, v_profile.role, 'active')
  on conflict on constraint family_members_unique_family_user do update
    set role = excluded.role,
        status = 'active';

  return query select v_family_id, v_family_code;
end;
$$;

create or replace function public.join_family_and_create_profile(
  p_family_code text,
  p_full_name text,
  p_role text,
  p_email text,
  p_whatsapp_number text
)
returns table(family_id uuid, family_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_family_id uuid;
  v_family_code text := upper(regexp_replace(trim(coalesce(p_family_code, '')), '\s+', '', 'g'));
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_family_code !~ '^FAM-[A-Z0-9]{6}$' then
    raise exception 'INVALID_FAMILY_CODE' using errcode = '22023';
  end if;

  select f.id
  into v_family_id
  from public.families f
  where f.family_code = v_family_code;

  if v_family_id is null then
    raise exception 'FAMILY_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_profile := public.upsert_current_user_profile(
    p_full_name,
    p_role,
    p_email,
    p_whatsapp_number
  );

  insert into public.family_members (family_id, user_id, role, status)
  values (v_family_id, v_user_id, v_profile.role, 'active')
  on conflict on constraint family_members_unique_family_user do update
    set role = excluded.role,
        status = 'active';

  return query select v_family_id, v_family_code;
end;
$$;

revoke all on function public.create_family_and_profile(text, text, text, text) from public;
revoke all on function public.join_family_and_create_profile(text, text, text, text, text) from public;

grant execute on function public.create_family_and_profile(text, text, text, text) to authenticated;
grant execute on function public.join_family_and_create_profile(text, text, text, text, text) to authenticated;

