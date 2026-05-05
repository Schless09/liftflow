-- Gym equipment preset for AI workout generation and catalog filtering.

alter table public.training_profiles
  add column if not exists gym_equipment_preset text not null default 'full_gym';

alter table public.training_profiles drop constraint if exists training_profiles_gym_equipment_check;

alter table public.training_profiles
  add constraint training_profiles_gym_equipment_check check (
    gym_equipment_preset in (
      'full_gym',
      'home_gym',
      'bodyweight_only',
      'dumbbells_bands'
    )
  );
