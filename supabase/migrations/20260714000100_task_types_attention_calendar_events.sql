alter table public.tasks
add column if not exists item_type text not null default 'routine_task',
add column if not exists miss_notification_threshold smallint not null default 3,
add column if not exists consecutive_miss_count integer not null default 0,
add column if not exists attention_active boolean not null default false,
add column if not exists attention_raised_at timestamptz,
add column if not exists last_missed_occurrence_at timestamptz,
add column if not exists event_timezone text,
add column if not exists event_reminder_one_day_sent_at timestamptz,
add column if not exists event_reminder_two_hours_sent_at timestamptz;

alter table public.tasks
drop constraint if exists tasks_item_type_check,
add constraint tasks_item_type_check check (item_type in ('routine_task', 'calendar_event'));

alter table public.tasks
drop constraint if exists tasks_miss_notification_threshold_check,
add constraint tasks_miss_notification_threshold_check check (
  miss_notification_threshold in (0, 2, 3, 4, 5)
);

alter table public.tasks
drop constraint if exists tasks_calendar_event_shape_check,
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
    and event_timezone is null
  )
);

create table if not exists public.task_event_notifications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  reminder_kind text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_event_notifications_kind_check check (
    reminder_kind in ('one_day_before', 'two_hours_before')
  ),
  constraint task_event_notifications_unique unique (task_id, recipient_id, reminder_kind)
);

create index if not exists tasks_item_type_idx on public.tasks(item_type);
create index if not exists tasks_attention_active_idx on public.tasks(attention_active);
create index if not exists task_event_notifications_task_id_idx on public.task_event_notifications(task_id);
create index if not exists task_event_notifications_scheduled_for_idx on public.task_event_notifications(scheduled_for);

create or replace function public.update_routine_task_attention_from_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_next_count integer;
begin
  select * into v_task
  from public.tasks
  where id = new.task_id
  for update;

  if not found or v_task.item_type <> 'routine_task' then
    return new;
  end if;

  if new.status = 'completed' then
    update public.tasks
    set
      consecutive_miss_count = 0,
      attention_active = false,
      attention_raised_at = null,
      last_missed_occurrence_at = null
    where id = new.task_id;
    return new;
  end if;

  if new.status = 'missed' then
    v_next_count := v_task.consecutive_miss_count + 1;

    update public.tasks
    set
      consecutive_miss_count = v_next_count,
      attention_active = (
        miss_notification_threshold > 0
        and v_next_count >= miss_notification_threshold
      ),
      attention_raised_at = case
        when
          miss_notification_threshold > 0
          and v_next_count >= miss_notification_threshold
          and attention_active = false
        then now()
        else attention_raised_at
      end,
      last_missed_occurrence_at = new.scheduled_for
    where id = new.task_id;
  end if;

  return new;
end;
$$;

drop trigger if exists task_completions_update_routine_attention on public.task_completions;
create trigger task_completions_update_routine_attention
after insert on public.task_completions
for each row
execute function public.update_routine_task_attention_from_completion();

create or replace function public.sync_calendar_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_at timestamptz;
begin
  if new.item_type <> 'calendar_event' then
    delete from public.task_event_notifications where task_id = new.id;
    return new;
  end if;

  v_event_at := (new.start_date::text || ' ' || new.task_time::text || ' ' || new.event_timezone)::timestamptz;

  insert into public.task_event_notifications (
    task_id,
    family_id,
    recipient_id,
    reminder_kind,
    scheduled_for
  )
  values
    (new.id, new.family_id, new.assigned_to, 'one_day_before', v_event_at - interval '1 day'),
    (new.id, new.family_id, new.assigned_to, 'two_hours_before', v_event_at - interval '2 hours'),
    (new.id, new.family_id, new.created_by, 'one_day_before', v_event_at - interval '1 day'),
    (new.id, new.family_id, new.created_by, 'two_hours_before', v_event_at - interval '2 hours')
  on conflict (task_id, recipient_id, reminder_kind)
  do update set
    scheduled_for = excluded.scheduled_for,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists tasks_sync_calendar_event_notifications on public.tasks;
create trigger tasks_sync_calendar_event_notifications
after insert or update of item_type, assigned_to, created_by, start_date, task_time, event_timezone, is_active
on public.tasks
for each row
execute function public.sync_calendar_event_notifications();

drop trigger if exists task_event_notifications_set_updated_at on public.task_event_notifications;
create trigger task_event_notifications_set_updated_at
before update on public.task_event_notifications
for each row
execute function public.set_updated_at();

alter table public.task_event_notifications enable row level security;

create or replace function public.can_read_task_event_notification(p_notification public.task_event_notifications)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_notification.task_id
      and t.family_id = p_notification.family_id
      and (
        p_notification.recipient_id = auth.uid()
        or public.is_family_child(t.family_id)
      )
  );
$$;

drop policy if exists task_event_notifications_select_authorized on public.task_event_notifications;
create policy task_event_notifications_select_authorized
on public.task_event_notifications
for select
to authenticated
using (public.can_read_task_event_notification(task_event_notifications));

revoke all on public.task_event_notifications from anon, authenticated;
grant select on public.task_event_notifications to authenticated;

grant update (
  assigned_to,
  item_type,
  title,
  task_time,
  start_date,
  repeat_type,
  repeat_days,
  requires_alarm,
  requires_photo,
  miss_notification_threshold,
  event_timezone,
  is_active
) on public.tasks to authenticated;

revoke all on function public.sync_calendar_event_notifications() from public;
revoke all on function public.can_read_task_event_notification(public.task_event_notifications) from public;
revoke all on function public.update_routine_task_attention_from_completion() from public;

grant execute on function public.sync_calendar_event_notifications() to authenticated;
grant execute on function public.can_read_task_event_notification(public.task_event_notifications) to authenticated;
grant execute on function public.update_routine_task_attention_from_completion() to authenticated;
