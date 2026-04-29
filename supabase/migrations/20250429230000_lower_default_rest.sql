-- Default rest between sets: 75s (new rows; seed updates exercise presets).

alter table public.exercises
  alter column default_rest_seconds set default 75;

alter table public.workout_exercises
  alter column effective_rest_seconds set default 75;

update public.exercises set default_rest_seconds = 75 where default_rest_seconds in (60, 90);

notify pgrst, 'reload schema';
