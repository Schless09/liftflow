alter table public.training_profiles
  add column if not exists days_per_week int not null default 3;

alter table public.training_profiles drop constraint if exists training_profiles_days_check;

alter table public.training_profiles
  add constraint training_profiles_days_check check (days_per_week >= 1 and days_per_week <= 7);
