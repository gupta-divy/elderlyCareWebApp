alter table public.profiles
add column if not exists country_code text,
add column if not exists timezone text;

alter table public.profiles
drop constraint if exists profiles_country_code_check,
add constraint profiles_country_code_check check (
  country_code is null or country_code ~ '^[A-Z]{2}$'
);

alter table public.profiles
drop constraint if exists profiles_timezone_length_check,
add constraint profiles_timezone_length_check check (
  timezone is null or char_length(trim(timezone)) between 2 and 64
);

update public.profiles
set
  country_code = coalesce(country_code, 'IN'),
  timezone = coalesce(timezone, 'Asia/Kolkata')
where role = 'parent';

update public.profiles
set
  timezone = coalesce(timezone, 'UTC')
where timezone is null;

alter table public.tasks
drop constraint if exists tasks_calendar_event_shape_check;

update public.tasks t
set event_timezone = coalesce(t.event_timezone, p.timezone, 'UTC')
from public.profiles p
where t.assigned_to = p.id
  and t.event_timezone is null;

update public.tasks
set event_timezone = 'UTC'
where event_timezone is null;

alter table public.tasks
add constraint tasks_calendar_event_shape_check check (
  (
    item_type = 'calendar_event'
    and repeat_type = 'once'
    and repeat_days is null
    and task_time is not null
    and requires_alarm = false
    and requires_photo = false
    and miss_notification_threshold = 0
    and event_timezone is not null
  )
  or (
    item_type = 'routine_task'
    and event_timezone is not null
  )
);

create or replace function public.upsert_current_user_profile(
  p_full_name text,
  p_role text,
  p_email text,
  p_whatsapp_number text,
  p_country_code text,
  p_timezone text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_input record;
  v_profile public.profiles;
  v_country_code text := upper(nullif(trim(coalesce(p_country_code, '')), ''));
  v_timezone text := nullif(trim(coalesce(p_timezone, '')), '');
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_COUNTRY_CODE' using errcode = '22023';
  end if;

  if v_timezone is null then
    v_timezone := 'UTC';
  end if;

  select *
  into v_input
  from public.validate_onboarding_input(
    p_full_name,
    p_role,
    p_email,
    p_whatsapp_number
  );

  insert into public.profiles (
    id,
    full_name,
    role,
    email,
    whatsapp_number,
    whatsapp_verified,
    country_code,
    timezone
  )
  values (
    v_user_id,
    v_input.full_name,
    v_input.role,
    v_input.email,
    v_input.whatsapp_number,
    false,
    v_country_code,
    v_timezone
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        email = excluded.email,
        whatsapp_number = excluded.whatsapp_number,
        whatsapp_verified = false,
        country_code = excluded.country_code,
        timezone = excluded.timezone
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.create_family_and_profile(
  p_full_name text,
  p_role text,
  p_email text,
  p_whatsapp_number text,
  p_country_code text,
  p_timezone text
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
    p_whatsapp_number,
    p_country_code,
    p_timezone
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
  p_whatsapp_number text,
  p_country_code text,
  p_timezone text
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
    p_whatsapp_number,
    p_country_code,
    p_timezone
  );

  insert into public.family_members (family_id, user_id, role, status)
  values (v_family_id, v_user_id, v_profile.role, 'active')
  on conflict on constraint family_members_unique_family_user do update
    set role = excluded.role,
        status = 'active';

  return query select v_family_id, v_family_code;
end;
$$;

grant update (full_name, email, whatsapp_number, country_code, timezone)
on public.profiles to authenticated;

grant execute on function public.create_family_and_profile(text, text, text, text, text, text) to authenticated;
grant execute on function public.join_family_and_create_profile(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.upsert_current_user_profile(text, text, text, text, text, text) to authenticated;
