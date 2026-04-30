-- Per-tenant isolation: Clerk user id (e.g. user_xxx) on workouts, RLS via JWT sub.

alter table public.workouts add column if not exists user_id text;

update public.workouts
set user_id = '__legacy_unassigned__'
where user_id is null;

alter table public.workouts alter column user_id set not null;

create index if not exists idx_workouts_user_created on public.workouts (user_id, created_at desc);

-- Replace wide-open demo policies
drop policy if exists "exercises_all" on public.exercises;
drop policy if exists "workouts_all" on public.workouts;
drop policy if exists "workout_exercises_all" on public.workout_exercises;
drop policy if exists "sets_all" on public.sets;

-- Shared exercise catalog: world-readable; writes remain via service role / SQL
create policy "exercises_read_all"
on public.exercises for select
using (true);

-- Clerk JWT: subject must match workouts.user_id (configure Third‑Party Auth in Supabase)
create policy "workouts_select_own"
on public.workouts for select
to authenticated
using (coalesce(auth.jwt()->>'sub', '') = user_id);

create policy "workouts_insert_own"
on public.workouts for insert
to authenticated
with check (coalesce(auth.jwt()->>'sub', '') = user_id);

create policy "workouts_update_own"
on public.workouts for update
to authenticated
using (coalesce(auth.jwt()->>'sub', '') = user_id)
with check (coalesce(auth.jwt()->>'sub', '') = user_id);

create policy "workouts_delete_own"
on public.workouts for delete
to authenticated
using (coalesce(auth.jwt()->>'sub', '') = user_id);

create policy "workout_exercises_rw_own"
on public.workout_exercises for all
to authenticated
using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = coalesce(auth.jwt()->>'sub', '')
  )
)
with check (
  exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = coalesce(auth.jwt()->>'sub', '')
  )
);

create policy "sets_rw_own"
on public.sets for all
to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id
      and w.user_id = coalesce(auth.jwt()->>'sub', '')
  )
)
with check (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = sets.workout_exercise_id
      and w.user_id = coalesce(auth.jwt()->>'sub', '')
  )
);
