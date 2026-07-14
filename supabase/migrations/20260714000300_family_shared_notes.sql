create table if not exists public.family_notes (
  family_id uuid primary key references public.families(id) on delete cascade,
  content text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_notes_content_length_check check (char_length(content) <= 5000)
);

create index if not exists family_notes_updated_by_idx on public.family_notes(updated_by);

drop trigger if exists family_notes_set_updated_at on public.family_notes;
create trigger family_notes_set_updated_at
before update on public.family_notes
for each row
execute function public.set_updated_at();

alter table public.family_notes enable row level security;

drop policy if exists family_notes_select_family_members on public.family_notes;
create policy family_notes_select_family_members
on public.family_notes
for select
to authenticated
using (public.is_family_member(family_id));

drop policy if exists family_notes_insert_family_members on public.family_notes;
create policy family_notes_insert_family_members
on public.family_notes
for insert
to authenticated
with check (
  public.is_family_member(family_id)
  and updated_by = auth.uid()
);

drop policy if exists family_notes_update_family_members on public.family_notes;
create policy family_notes_update_family_members
on public.family_notes
for update
to authenticated
using (public.is_family_member(family_id))
with check (
  public.is_family_member(family_id)
  and updated_by = auth.uid()
);

drop policy if exists family_notes_delete_blocked on public.family_notes;
create policy family_notes_delete_blocked
on public.family_notes
for delete
to authenticated
using (false);

revoke all on public.family_notes from anon, authenticated;
grant select, insert on public.family_notes to authenticated;
grant update (content, updated_by) on public.family_notes to authenticated;
