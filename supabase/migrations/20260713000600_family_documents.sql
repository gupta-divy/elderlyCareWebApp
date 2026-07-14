create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  category text not null,
  display_name text not null,
  bucket text not null default 'family-documents',
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null,
  original_file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_category_check check (category in ('medical', 'bills', 'policies', 'other')),
  constraint documents_display_name_length_check check (char_length(trim(display_name)) between 1 and 180),
  constraint documents_bucket_check check (bucket = 'family-documents'),
  constraint documents_file_size_check check (file_size > 0 and file_size <= 10485760),
  constraint documents_original_file_size_check check (original_file_size is null or original_file_size >= file_size),
  constraint documents_kind_size_check check (
    (mime_type like 'image/%' and coalesce(original_file_size, file_size) <= 10485760)
    or (mime_type = 'application/pdf' and file_size <= 10485760)
  ),
  constraint documents_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  constraint documents_storage_path_unique unique (bucket, storage_path)
);

create index if not exists documents_family_id_idx on public.documents(family_id);
create index if not exists documents_uploaded_by_idx on public.documents(uploaded_by);
create index if not exists documents_category_idx on public.documents(category);
create index if not exists documents_created_at_idx on public.documents(created_at);

create or replace function public.enforce_family_document_storage_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := coalesce(new.family_id, old.family_id);
  v_existing_bytes bigint;
  v_next_bytes bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_family_id::text, 0));

  select coalesce(sum(file_size), 0)
  into v_existing_bytes
  from public.documents
  where family_id = v_family_id
    and id <> coalesce(new.id, old.id);

  v_next_bytes := case
    when tg_op = 'DELETE' then 0
    else new.file_size
  end;

  if v_existing_bytes + v_next_bytes > 52428800 then
    raise exception 'FAMILY_DOCUMENT_STORAGE_LIMIT' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists documents_enforce_family_storage_limit on public.documents;
create trigger documents_enforce_family_storage_limit
before insert or update of family_id, file_size on public.documents
for each row
execute function public.enforce_family_document_storage_limit();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-documents',
  'family-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

create or replace function public.can_read_document(p_document public.documents)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_family_member(p_document.family_id);
$$;

create or replace function public.can_manage_document(p_document public.documents)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_family_child(p_document.family_id)
    and public.is_family_member(p_document.family_id);
$$;

create or replace function public.is_valid_document_storage_path(
  p_family_id uuid,
  p_category text,
  p_document_id uuid,
  p_storage_path text
)
returns boolean
language sql
immutable
as $$
  select p_storage_path like p_family_id::text || '/' || p_category || '/' || p_document_id::text || '/%';
$$;

alter table public.documents enable row level security;

drop policy if exists documents_select_family_members on public.documents;
create policy documents_select_family_members
on public.documents
for select
to authenticated
using (public.can_read_document(documents));

drop policy if exists documents_insert_family_child on public.documents;
create policy documents_insert_family_child
on public.documents
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_manage_document(documents)
  and public.is_valid_document_storage_path(family_id, category, id, storage_path)
);

drop policy if exists documents_update_family_child on public.documents;
create policy documents_update_family_child
on public.documents
for update
to authenticated
using (public.can_manage_document(documents))
with check (
  public.can_manage_document(documents)
  and public.is_valid_document_storage_path(family_id, category, id, storage_path)
);

drop policy if exists documents_delete_family_child on public.documents;
create policy documents_delete_family_child
on public.documents
for delete
to authenticated
using (public.can_manage_document(documents));

drop policy if exists family_documents_insert_family_child on storage.objects;
create policy family_documents_insert_family_child
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'family-documents'
  and (storage.foldername(name))[2] in ('medical', 'bills', 'policies', 'other')
  and public.is_family_child(((storage.foldername(name))[1])::uuid)
);

drop policy if exists family_documents_select_family_members on storage.objects;
create policy family_documents_select_family_members
on storage.objects
for select
to authenticated
using (
  bucket_id = 'family-documents'
  and exists (
    select 1
    from public.documents d
    where d.bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and public.can_read_document(d)
  )
);

drop policy if exists family_documents_update_family_child on storage.objects;
create policy family_documents_update_family_child
on storage.objects
for update
to authenticated
using (
  bucket_id = 'family-documents'
  and exists (
    select 1
    from public.documents d
    where d.bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and public.can_manage_document(d)
  )
)
with check (
  bucket_id = 'family-documents'
  and exists (
    select 1
    from public.documents d
    where d.bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and public.can_manage_document(d)
  )
);

drop policy if exists family_documents_delete_family_child on storage.objects;
create policy family_documents_delete_family_child
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'family-documents'
  and exists (
    select 1
    from public.documents d
    where d.bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and public.can_manage_document(d)
  )
);

revoke all on public.documents from anon, authenticated;
grant select, insert, delete on public.documents to authenticated;
grant update (display_name) on public.documents to authenticated;

revoke all on function public.can_read_document(public.documents) from public;
revoke all on function public.can_manage_document(public.documents) from public;
revoke all on function public.is_valid_document_storage_path(uuid, text, uuid, text) from public;
revoke all on function public.enforce_family_document_storage_limit() from public;

grant execute on function public.can_read_document(public.documents) to authenticated;
grant execute on function public.can_manage_document(public.documents) to authenticated;
grant execute on function public.is_valid_document_storage_path(uuid, text, uuid, text) to authenticated;
