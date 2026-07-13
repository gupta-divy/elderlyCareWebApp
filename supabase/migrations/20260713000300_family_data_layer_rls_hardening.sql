alter table public.family_members
  add column if not exists is_admin boolean not null default false;

alter table public.families
  add column if not exists display_name text;

alter table public.families
  drop constraint if exists families_display_name_length_check;

alter table public.families
  add constraint families_display_name_length_check
  check (display_name is null or char_length(trim(display_name)) between 2 and 80);

update public.family_members fm
set is_admin = true
from public.families f
where f.id = fm.family_id
  and f.created_by = fm.user_id
  and fm.role = 'child'
  and fm.status = 'active';

create or replace function public.is_family_child_admin(p_family_id uuid)
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
      and fm.role = 'child'
      and fm.status = 'active'
      and fm.is_admin = true
  );
$$;

drop policy if exists families_update_child_admin on public.families;
create policy families_update_child_admin
on public.families
for update
to authenticated
using (public.is_family_child_admin(id))
with check (public.is_family_child_admin(id));

drop policy if exists family_members_insert_blocked on public.family_members;
create policy family_members_insert_blocked
on public.family_members
for insert
to authenticated
with check (false);

drop policy if exists family_members_update_blocked on public.family_members;
create policy family_members_update_blocked
on public.family_members
for update
to authenticated
using (false)
with check (false);

drop policy if exists family_members_delete_blocked on public.family_members;
create policy family_members_delete_blocked
on public.family_members
for delete
to authenticated
using (false);

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
    insert into public.family_members (family_id, user_id, role, status, is_admin)
    values (v_family_id, v_user_id, v_profile.role, 'active', v_profile.role = 'child')
    on conflict on constraint family_members_unique_family_user do update
      set role = excluded.role,
          status = 'active',
          is_admin = public.family_members.is_admin or excluded.is_admin;

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

  insert into public.family_members (family_id, user_id, role, status, is_admin)
  values (v_family_id, v_user_id, v_profile.role, 'active', v_profile.role = 'child')
  on conflict on constraint family_members_unique_family_user do update
    set role = excluded.role,
        status = 'active',
        is_admin = public.family_members.is_admin or excluded.is_admin;

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

  insert into public.family_members (family_id, user_id, role, status, is_admin)
  values (v_family_id, v_user_id, v_profile.role, 'active', false)
  on conflict on constraint family_members_unique_family_user do update
    set role = excluded.role,
        status = 'active';

  return query select v_family_id, v_family_code;
end;
$$;

revoke all on function public.is_family_child_admin(uuid) from public;
grant execute on function public.is_family_child_admin(uuid) to authenticated;

grant update (display_name) on public.families to authenticated;
