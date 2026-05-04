-- Private progress photos per Clerk user (path: {user_id}/{uuid}.{ext})

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "progress_photos_storage_select" on storage.objects;
drop policy if exists "progress_photos_storage_insert" on storage.objects;
drop policy if exists "progress_photos_storage_update" on storage.objects;
drop policy if exists "progress_photos_storage_delete" on storage.objects;

create policy "progress_photos_storage_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'progress-photos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'sub', '')
);

create policy "progress_photos_storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'progress-photos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'sub', '')
);

create policy "progress_photos_storage_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'progress-photos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'sub', '')
)
with check (
  bucket_id = 'progress-photos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'sub', '')
);

create policy "progress_photos_storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'progress-photos'
  and split_part(name, '/', 1) = coalesce(auth.jwt() ->> 'sub', '')
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  storage_path text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_progress_photos_user_created
  on public.progress_photos (user_id, created_at desc);

alter table public.progress_photos enable row level security;

drop policy if exists "progress_photos_select_own" on public.progress_photos;
drop policy if exists "progress_photos_insert_own" on public.progress_photos;
drop policy if exists "progress_photos_delete_own" on public.progress_photos;

create policy "progress_photos_select_own"
on public.progress_photos for select
to authenticated
using (user_id = coalesce(auth.jwt() ->> 'sub', ''));

create policy "progress_photos_insert_own"
on public.progress_photos for insert
to authenticated
with check (user_id = coalesce(auth.jwt() ->> 'sub', ''));

create policy "progress_photos_delete_own"
on public.progress_photos for delete
to authenticated
using (user_id = coalesce(auth.jwt() ->> 'sub', ''));
