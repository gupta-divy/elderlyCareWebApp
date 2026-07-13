create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  task_time time not null,
  start_date date not null default current_date,
  repeat_type text not null,
  repeat_days smallint[],
  requires_alarm boolean not null default false,
  requires_photo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_length_check check (char_length(trim(title)) between 1 and 160),
  constraint tasks_repeat_type_check check (
    repeat_type in ('once', 'daily', 'weekly', 'monthly', 'yearly', 'set_days')
  ),
  constraint tasks_repeat_days_check check (
    (repeat_type = 'set_days' and repeat_days is not null and cardinality(repeat_days) > 0)
    or (repeat_type <> 'set_days' and repeat_days is null)
  ),
  constraint tasks_repeat_days_values_check check (
    repeat_days is null
    or repeat_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  )
);

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  completed_by uuid not null references public.profiles(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null,
  completed_at timestamptz,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_completions_status_check check (status in ('completed', 'missed', 'skipped')),
  constraint task_completions_completed_at_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed')
  ),
  constraint task_completions_task_occurrence_unique unique (task_id, scheduled_for)
);

create index if not exists tasks_family_id_idx on public.tasks(family_id);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists task_completions_family_id_idx on public.task_completions(family_id);
create index if not exists task_completions_task_id_idx on public.task_completions(task_id);
create index if not exists task_completions_completed_by_idx on public.task_completions(completed_by);
create index if not exists task_completions_scheduled_for_idx on public.task_completions(scheduled_for);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists task_completions_set_updated_at on public.task_completions;
create trigger task_completions_set_updated_at
before update on public.task_completions
for each row
execute function public.set_updated_at();

create or replace function public.is_family_child(p_family_id uuid)
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
  );
$$;

create or replace function public.is_active_family_parent(p_family_id uuid, p_user_id uuid)
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
      and fm.user_id = p_user_id
      and fm.role = 'parent'
      and fm.status = 'active'
  );
$$;

create or replace function public.can_read_task(p_task public.tasks)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_family_child(p_task.family_id)
    or (
      p_task.assigned_to = auth.uid()
      and public.is_active_family_parent(p_task.family_id, auth.uid())
    );
$$;

create or replace function public.can_write_task_definition(p_task public.tasks)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_family_child(p_task.family_id)
    and public.is_family_member(p_task.family_id)
    and public.is_active_family_parent(p_task.family_id, p_task.assigned_to);
$$;

create or replace function public.can_read_task_completion(p_completion public.task_completions)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_completion.task_id
      and t.family_id = p_completion.family_id
      and (
        public.is_family_child(t.family_id)
        or (
          t.assigned_to = auth.uid()
          and public.is_active_family_parent(t.family_id, auth.uid())
        )
      )
  );
$$;

create or replace function public.can_insert_task_completion(p_completion public.task_completions)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_completion.task_id
      and t.family_id = p_completion.family_id
      and t.is_active = true
      and t.assigned_to = auth.uid()
      and p_completion.completed_by = auth.uid()
      and public.is_active_family_parent(t.family_id, auth.uid())
  );
$$;

create or replace function public.validate_task_completion_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id
  from public.tasks
  where id = new.task_id;

  if v_family_id is null then
    raise exception 'TASK_NOT_FOUND' using errcode = '23503';
  end if;

  if new.family_id <> v_family_id then
    raise exception 'TASK_COMPLETION_FAMILY_MISMATCH' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists task_completions_validate_family on public.task_completions;
create trigger task_completions_validate_family
before insert or update on public.task_completions
for each row
execute function public.validate_task_completion_family();

alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;

drop policy if exists tasks_select_family_child_or_assigned_parent on public.tasks;
create policy tasks_select_family_child_or_assigned_parent
on public.tasks
for select
to authenticated
using (public.can_read_task(tasks));

drop policy if exists tasks_insert_family_child on public.tasks;
create policy tasks_insert_family_child
on public.tasks
for insert
to authenticated
with check (public.can_write_task_definition(tasks) and created_by = auth.uid());

drop policy if exists tasks_update_family_child on public.tasks;
create policy tasks_update_family_child
on public.tasks
for update
to authenticated
using (public.can_write_task_definition(tasks))
with check (public.can_write_task_definition(tasks));

drop policy if exists task_completions_select_authorized on public.task_completions;
create policy task_completions_select_authorized
on public.task_completions
for select
to authenticated
using (public.can_read_task_completion(task_completions));

drop policy if exists task_completions_insert_assigned_parent on public.task_completions;
create policy task_completions_insert_assigned_parent
on public.task_completions
for insert
to authenticated
with check (public.can_insert_task_completion(task_completions));

drop policy if exists task_completions_update_blocked on public.task_completions;
create policy task_completions_update_blocked
on public.task_completions
for update
to authenticated
using (false)
with check (false);

drop policy if exists task_completions_delete_blocked on public.task_completions;
create policy task_completions_delete_blocked
on public.task_completions
for delete
to authenticated
using (false);

revoke all on public.tasks from anon, authenticated;
revoke all on public.task_completions from anon, authenticated;

grant select, insert on public.tasks to authenticated;
grant update (
  assigned_to,
  title,
  task_time,
  start_date,
  repeat_type,
  repeat_days,
  requires_alarm,
  requires_photo,
  is_active
) on public.tasks to authenticated;
grant select, insert on public.task_completions to authenticated;

revoke all on function public.is_family_child(uuid) from public;
revoke all on function public.is_active_family_parent(uuid, uuid) from public;
revoke all on function public.can_read_task(public.tasks) from public;
revoke all on function public.can_write_task_definition(public.tasks) from public;
revoke all on function public.can_read_task_completion(public.task_completions) from public;
revoke all on function public.can_insert_task_completion(public.task_completions) from public;
revoke all on function public.validate_task_completion_family() from public;

grant execute on function public.is_family_child(uuid) to authenticated;
grant execute on function public.is_active_family_parent(uuid, uuid) to authenticated;
grant execute on function public.can_read_task(public.tasks) to authenticated;
grant execute on function public.can_write_task_definition(public.tasks) to authenticated;
grant execute on function public.can_read_task_completion(public.task_completions) to authenticated;
grant execute on function public.can_insert_task_completion(public.task_completions) to authenticated;
