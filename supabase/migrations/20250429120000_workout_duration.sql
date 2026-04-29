alter table public.workouts
  add column if not exists duration_minutes int;

-- Refresh PostgREST so the Data API sees the new column (avoids "schema cache" errors)
notify pgrst, 'reload schema';

