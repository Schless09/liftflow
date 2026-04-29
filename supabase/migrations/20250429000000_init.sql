-- LiftFlow initial schema

create extension if not exists "pgcrypto";

create type feeling_enum as enum ('strong', 'meh', 'tired');

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  aliases text[] not null default '{}',
  muscle_group text not null,
  equipment text not null,
  gif_url text,
  default_rest_seconds int not null default 75
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feeling feeling_enum not null,
  name text not null,
  duration_minutes int,
  completed_at timestamptz,
  total_volume numeric
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  unmapped_name text,
  order_index int not null,
  sets int not null,
  rep_range text not null,
  base_weight numeric,
  last_session_reps int,
  effective_rest_seconds int not null default 75,
  constraint workout_exercises_mapped_or_unmapped check (
    (exercise_id is not null) or (unmapped_name is not null)
  )
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number int not null,
  planned_weight numeric,
  planned_reps int,
  actual_weight numeric,
  actual_reps int,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (workout_exercise_id, set_number)
);

create index idx_workout_exercises_workout on public.workout_exercises(workout_id);
create index idx_workout_exercises_exercise on public.workout_exercises(exercise_id);
create index idx_sets_we on public.sets(workout_exercise_id);
create index idx_workouts_created on public.workouts(created_at desc);

alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;

-- Demo: allow anon full access (replace with auth in production)
create policy "exercises_all" on public.exercises for all using (true) with check (true);
create policy "workouts_all" on public.workouts for all using (true) with check (true);
create policy "workout_exercises_all" on public.workout_exercises for all using (true) with check (true);
create policy "sets_all" on public.sets for all using (true) with check (true);
