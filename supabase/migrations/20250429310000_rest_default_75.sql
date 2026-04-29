-- If an older revision of 20250429230000 set 60s, bump defaults and rows to 75s.
-- Safe to apply after 20250429230000 (idempotent).

alter table public.exercises
  alter column default_rest_seconds set default 75;

alter table public.workout_exercises
  alter column effective_rest_seconds set default 75;

update public.exercises set default_rest_seconds = 75 where default_rest_seconds = 60;

notify pgrst, 'reload schema';
