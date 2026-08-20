-- Interactive registration onboarding fields.
-- Run this in Supabase SQL editor after the foundation migrations.

create extension if not exists "pgcrypto";

do $$ begin
  create type goal_type as enum ('lose', 'maintain', 'gain');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type target_mode as enum ('grams', 'percentage');
exception when duplicate_object then null;
end $$;

alter table public.user_profiles
  add column if not exists current_weight_kg numeric(5, 1),
  add column if not exists medical_conditions jsonb,
  add column if not exists medications text,
  add column if not exists allergies text,
  add column if not exists dietary_preference varchar(80),
  add column if not exists primary_goal varchar(80),
  add column if not exists onboarding_completed boolean not null default false;

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null references public.users(id) on delete cascade,
  goal_type goal_type default 'maintain',
  target_weight_kg numeric(5, 1),
  weekly_rate_kg numeric(3, 2),
  calorie_target integer,
  protein_g numeric(5, 1),
  carbs_g numeric(5, 1),
  fat_g numeric(5, 1),
  fiber_g numeric(5, 1),
  protein_pct numeric(4, 1),
  carbs_pct numeric(4, 1),
  fat_pct numeric(4, 1),
  target_mode target_mode default 'percentage',
  tracked_nutrient_ids jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_goals_user_id_idx on public.user_goals(user_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  onboarding jsonb := coalesce(new.raw_user_meta_data -> 'onboarding_profile', '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    updated_at = now();

  insert into public.users (id, email, name, email_verified, image)
  values (
    new.id::text,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email_confirmed_at is not null,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    email_verified = excluded.email_verified,
    image = excluded.image,
    updated_at = now();

  insert into public.user_profiles (
    user_id,
    date_of_birth,
    sex,
    height_cm,
    current_weight_kg,
    activity_level,
    medical_conditions,
    medications,
    allergies,
    dietary_preference,
    primary_goal,
    onboarding_completed
  )
  values (
    new.id::text,
    nullif(onboarding ->> 'dateOfBirth', '')::date,
    nullif(onboarding ->> 'sex', ''),
    nullif(onboarding ->> 'heightCm', '')::numeric(5, 1),
    nullif(onboarding ->> 'currentWeightKg', '')::numeric(5, 1),
    coalesce(nullif(onboarding ->> 'activityLevel', ''), 'moderately_active'),
    coalesce(onboarding -> 'medicalConditions', '[]'::jsonb),
    nullif(onboarding ->> 'medications', ''),
    nullif(onboarding ->> 'allergies', ''),
    nullif(onboarding ->> 'dietaryPreference', ''),
    nullif(onboarding ->> 'primaryGoal', ''),
    coalesce((onboarding ->> 'onboardingCompleted')::boolean, false)
  )
  on conflict (user_id) do update
  set
    date_of_birth = coalesce(excluded.date_of_birth, public.user_profiles.date_of_birth),
    sex = coalesce(excluded.sex, public.user_profiles.sex),
    height_cm = coalesce(excluded.height_cm, public.user_profiles.height_cm),
    current_weight_kg = coalesce(excluded.current_weight_kg, public.user_profiles.current_weight_kg),
    activity_level = coalesce(excluded.activity_level, public.user_profiles.activity_level),
    medical_conditions = coalesce(excluded.medical_conditions, public.user_profiles.medical_conditions),
    medications = coalesce(excluded.medications, public.user_profiles.medications),
    allergies = coalesce(excluded.allergies, public.user_profiles.allergies),
    dietary_preference = coalesce(excluded.dietary_preference, public.user_profiles.dietary_preference),
    primary_goal = coalesce(excluded.primary_goal, public.user_profiles.primary_goal),
    onboarding_completed = public.user_profiles.onboarding_completed or excluded.onboarding_completed,
    updated_at = now()
  where public.user_profiles.onboarding_completed = false;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_new_auth_user();
