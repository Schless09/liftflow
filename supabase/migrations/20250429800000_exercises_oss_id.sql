alter table public.exercises
  add column if not exists exercisedb_oss_id text;

-- Multiple NULLs allowed; duplicate non-null OSS ids rejected.
create unique index if not exists exercises_exercisedb_oss_id_key
  on public.exercises (exercisedb_oss_id);
