create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null,
  email text not null,
  whatsapp_number text,
  whatsapp_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('parent', 'child')),
  constraint profiles_full_name_length_check check (char_length(trim(full_name)) between 2 and 120),
  constraint profiles_whatsapp_e164_check check (
    whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
  )
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  family_code text unique not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint families_family_code_check check (family_code ~ '^FAM-[A-Z0-9]{6}$')
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint family_members_role_check check (role in ('parent', 'child')),
  constraint family_members_status_check check (status in ('active', 'pending')),
  constraint family_members_unique_family_user unique (family_id, user_id)
);

create index if not exists family_members_user_id_idx on public.family_members(user_id);
create index if not exists family_members_family_id_idx on public.family_members(family_id);
create index if not exists families_family_code_idx on public.families(family_code);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  );
$$;

create or replace function public.is_family_member_of_profile(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members viewer
    join public.family_members subject
      on subject.family_id = viewer.family_id
    where viewer.user_id = auth.uid()
      and viewer.status = 'active'
      and subject.user_id = p_profile_id
      and subject.status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;

drop policy if exists profiles_select_own_or_family on public.profiles;
create policy profiles_select_own_or_family
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_family_member_of_profile(id));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists families_select_member on public.families;
create policy families_select_member
on public.families
for select
to authenticated
using (public.is_family_member(id));

drop policy if exists family_members_select_same_family on public.family_members;
create policy family_members_select_same_family
on public.family_members
for select
to authenticated
using (public.is_family_member(family_id));

create or replace function public.generate_family_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_chars constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text := '';
  i int;
begin
  for i in 1..6 loop
    v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  end loop;

  return 'FAM-' || v_code;
end;
$$;

create or replace function public.validate_onboarding_input(
  p_full_name text,
  p_role text,
  p_email text,
  p_whatsapp_number text
)
returns table(full_name text, role text, email text, whatsapp_number text)
language plpgsql
set search_path = public
as $$
begin
  full_name := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  role := lower(trim(coalesce(p_role, '')));
  email := lower(trim(coalesce(p_email, '')));
  whatsapp_number := nullif(trim(coalesce(p_whatsapp_number, '')), '');

  if char_length(full_name) < 2 or char_length(full_name) > 120 then
    raise exception 'INVALID_FULL_NAME' using errcode = '22023';
  end if;

  if role not in ('parent', 'child') then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;

  if email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;

  if whatsapp_number is not null and whatsapp_number !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'INVALID_WHATSAPP' using errcode = '22023';
  end if;

  return next;
end;
$$;

create or replace function public.upsert_current_user_profile(
  p_full_name text,
  p_role text,
  p_email text,
  p_whatsapp_number text
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
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
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
    whatsapp_verified
  )
  values (
    v_user_id,
    v_input.full_name,
    v_input.role,
    v_input.email,
    v_input.whatsapp_number,
    false
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        email = excluded.email,
        whatsapp_number = excluded.whatsapp_number,
        whatsapp_verified = false
  returning * into v_profile;

  return v_profile;
end;
$$;

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

comment on function public.create_family_and_profile(text, text, text, text)
is 'Security definer is required because this client-only Vite app cannot safely perform multi-table profile, family, and membership inserts with broad browser-side policies.';

comment on function public.join_family_and_create_profile(text, text, text, text, text)
is 'Security definer is required because joining a family must validate the private family code and write profile and membership rows atomically without exposing unrestricted table inserts.';

revoke all on public.profiles from anon, authenticated;
revoke all on public.families from anon, authenticated;
revoke all on public.family_members from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, email, whatsapp_number) on public.profiles to authenticated;
grant select on public.families to authenticated;
grant select on public.family_members to authenticated;

revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.is_family_member_of_profile(uuid) from public;
revoke all on function public.generate_family_code() from public;
revoke all on function public.validate_onboarding_input(text, text, text, text) from public;
revoke all on function public.upsert_current_user_profile(text, text, text, text) from public;
revoke all on function public.create_family_and_profile(text, text, text, text) from public;
revoke all on function public.join_family_and_create_profile(text, text, text, text, text) from public;

grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_member_of_profile(uuid) to authenticated;
grant execute on function public.create_family_and_profile(text, text, text, text) to authenticated;
grant execute on function public.join_family_and_create_profile(text, text, text, text, text) to authenticated;
