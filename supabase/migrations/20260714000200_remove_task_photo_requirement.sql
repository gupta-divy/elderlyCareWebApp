update public.tasks
set requires_photo = false
where requires_photo = true;

alter table public.tasks
drop constraint if exists tasks_requires_photo_disabled_check,
add constraint tasks_requires_photo_disabled_check check (requires_photo = false);
