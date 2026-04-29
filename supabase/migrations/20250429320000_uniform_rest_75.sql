-- Force 75s rest everywhere (exercise library + all workout blocks).

update public.exercises
set default_rest_seconds = 75
where default_rest_seconds is distinct from 75;

update public.workout_exercises
set effective_rest_seconds = 75
where effective_rest_seconds is distinct from 75;

notify pgrst, 'reload schema';
