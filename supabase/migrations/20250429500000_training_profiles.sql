-- One training profile per Clerk user (user_id matches workouts.user_id and JWT sub).

create table public.training_profiles (
  user_id text primary key,
  body_weight_lbs numeric not null,
  age int not null,
  goal text not null,
  event_note text,
  updated_at timestamptz not null default now(),
  constraint training_profiles_goal_check check (
    goal in ('bulk', 'cut', 'maintain', 'recomp', 'event')
  )
);

create index training_profiles_updated_at on public.training_profiles (updated_at desc);

alter table public.training_profiles enable row level security;

create policy "training_profiles_select_own"
on public.training_profiles for select
to authenticated
using (coalesce(auth.jwt()->>'sub', '') = user_id);

create policy "training_profiles_insert_own"
on public.training_profiles for insert
to authenticated
with check (coalesce(auth.jwt()->>'sub', '') = user_id);

create policy "training_profiles_update_own"
on public.training_profiles for update
to authenticated
using (coalesce(auth.jwt()->>'sub', '') = user_id)
with check (coalesce(auth.jwt()->>'sub', '') = user_id);

create policy "training_profiles_delete_own"
on public.training_profiles for delete
to authenticated
using (coalesce(auth.jwt()->>'sub', '') = user_id);
