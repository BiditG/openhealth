-- OpenHealth / Swastha complete production schema alignment.
-- Run this in the Supabase SQL editor for the production project used by Vercel.
-- Replace YOUR_ACTUAL_EMAIL at the bottom with your login email.

create extension if not exists "pgcrypto";

do $$ begin create type unit_system as enum ('metric', 'imperial'); exception when duplicate_object then null; end $$;
do $$ begin create type sex as enum ('male', 'female', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type activity_level as enum ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'); exception when duplicate_object then null; end $$;
do $$ begin create type goal_type as enum ('lose', 'maintain', 'gain'); exception when duplicate_object then null; end $$;
do $$ begin create type target_mode as enum ('grams', 'percentage'); exception when duplicate_object then null; end $$;
do $$ begin create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack'); exception when duplicate_object then null; end $$;
do $$ begin create type food_source as enum ('usda', 'openfoodfacts', 'user', 'verified', 'family', 'seven'); exception when duplicate_object then null; end $$;
do $$ begin create type nutrient_category as enum ('macro', 'vitamin', 'mineral', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type exercise_category as enum ('cardio', 'strength', 'flexibility', 'sport', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type intensity as enum ('low', 'moderate', 'high'); exception when duplicate_object then null; end $$;
do $$ begin create type photo_category as enum ('front', 'side', 'back'); exception when duplicate_object then null; end $$;
do $$ begin create type blog_status as enum ('draft', 'published', 'archived'); exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id text primary key,
  email varchar(255) unique not null,
  name varchar(100) not null,
  email_verified boolean not null default false,
  is_active boolean not null default false,
  is_admin boolean not null default false,
  image text,
  timezone varchar(50) default 'UTC',
  unit_system unit_system default 'metric',
  referral_code varchar(12) unique,
  plan text not null default 'free',
  plan_expires_at timestamptz,
  trial_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists email_verified boolean not null default false,
  add column if not exists is_active boolean not null default false,
  add column if not exists is_admin boolean not null default false,
  add column if not exists image text,
  add column if not exists timezone varchar(50) default 'UTC',
  add column if not exists unit_system unit_system default 'metric',
  add column if not exists referral_code varchar(12),
  add column if not exists plan text not null default 'free',
  add column if not exists plan_expires_at timestamptz,
  add column if not exists trial_expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists users_email_idx on public.users(email);
create unique index if not exists users_referral_code_idx on public.users(referral_code);
create index if not exists users_is_active_idx on public.users(is_active);
create index if not exists users_is_admin_idx on public.users(is_admin);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  display_name text,
  date_of_birth date,
  sex text check (sex is null or sex in ('male', 'female', 'other')),
  height_cm numeric,
  weight_kg numeric,
  preferred_language text not null default 'en',
  role text not null default 'user' check (role in ('user', 'admin', 'medical_reviewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null references public.users(id) on delete cascade,
  date_of_birth date,
  sex sex,
  height_cm numeric(5, 1),
  current_weight_kg numeric(5, 1),
  medical_conditions jsonb,
  medications text,
  allergies text,
  dietary_preference varchar(80),
  primary_goal varchar(80),
  onboarding_completed boolean not null default false,
  activity_level activity_level default 'moderately_active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists date_of_birth date,
  add column if not exists sex sex,
  add column if not exists height_cm numeric(5, 1),
  add column if not exists current_weight_kg numeric(5, 1),
  add column if not exists medical_conditions jsonb,
  add column if not exists medications text,
  add column if not exists allergies text,
  add column if not exists dietary_preference varchar(80),
  add column if not exists primary_goal varchar(80),
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists activity_level activity_level default 'moderately_active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

alter table public.user_goals
  add column if not exists goal_type goal_type default 'maintain',
  add column if not exists target_weight_kg numeric(5, 1),
  add column if not exists weekly_rate_kg numeric(3, 2),
  add column if not exists calorie_target integer,
  add column if not exists protein_g numeric(5, 1),
  add column if not exists carbs_g numeric(5, 1),
  add column if not exists fat_g numeric(5, 1),
  add column if not exists fiber_g numeric(5, 1),
  add column if not exists protein_pct numeric(4, 1),
  add column if not exists carbs_pct numeric(4, 1),
  add column if not exists fat_pct numeric(4, 1),
  add column if not exists target_mode target_mode default 'percentage',
  add column if not exists tracked_nutrient_ids jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists user_goals_user_id_idx on public.user_goals(user_id);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name varchar(500) not null,
  brand varchar(255),
  barcode varchar(50),
  source varchar(40) not null default 'user',
  source_id varchar(100),
  serving_size numeric(8, 2) not null default 100,
  serving_unit varchar(50) not null default 'g',
  household_serving varchar(100),
  description text,
  calories numeric(7, 1) not null default 0,
  is_verified boolean not null default false,
  is_public boolean not null default false,
  metadata jsonb,
  created_by text references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.foods
  add column if not exists barcode varchar(50),
  add column if not exists source_id varchar(100),
  add column if not exists household_serving varchar(100),
  add column if not exists description text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_public boolean not null default false,
  add column if not exists metadata jsonb,
  add column if not exists created_by text references public.users(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.foods
  alter column name type varchar(500),
  alter column brand type varchar(255),
  alter column serving_unit type varchar(50),
  alter column serving_size type numeric(8, 2),
  alter column calories type numeric(7, 1);

create index if not exists foods_barcode_idx on public.foods(barcode);
create index if not exists foods_source_idx on public.foods(source);
drop index if exists foods_name_search_idx;
create index foods_name_search_idx
  on public.foods using gin (to_tsvector('simple', name || ' ' || coalesce(brand, '')));

create table if not exists public.nutrient_definitions (
  id serial primary key,
  name varchar(100) not null unique,
  unit varchar(20) not null,
  category nutrient_category not null default 'other',
  display_order integer,
  daily_value numeric(10, 3),
  usda_nutrient_id integer
);

alter table public.nutrient_definitions
  add column if not exists category nutrient_category not null default 'other',
  add column if not exists display_order integer,
  add column if not exists daily_value numeric(10, 3),
  add column if not exists usda_nutrient_id integer;

create table if not exists public.food_nutrients (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  nutrient_id integer not null references public.nutrient_definitions(id),
  amount numeric(10, 3) not null
);

alter table public.food_nutrients
  add column if not exists id uuid default gen_random_uuid();

update public.food_nutrients set id = gen_random_uuid() where id is null;

alter table public.food_nutrients
  alter column id set not null,
  alter column amount type numeric(10, 3);

create unique index if not exists food_nutrients_unique_idx on public.food_nutrients(food_id, nutrient_id);
create index if not exists food_nutrients_food_idx on public.food_nutrients(food_id);

create table if not exists public.food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  label varchar(100) not null,
  grams numeric(8, 2) not null
);

create index if not exists food_servings_food_idx on public.food_servings(food_id);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  meal_type meal_type not null,
  food_id uuid not null references public.foods(id),
  serving_qty numeric(6, 2) not null default 1,
  serving_id uuid references public.food_servings(id),
  calories numeric(7, 1),
  protein_g numeric(6, 1),
  carbs_g numeric(6, 1),
  fat_g numeric(6, 1),
  fiber_g numeric(6, 1),
  sort_order integer default 0,
  logged_at timestamptz not null default now()
);

alter table public.diary_entries
  add column if not exists serving_id uuid references public.food_servings(id),
  add column if not exists fiber_g numeric(6, 1);

create index if not exists diary_user_date_idx on public.diary_entries(user_id, date);
create index if not exists diary_user_date_meal_idx on public.diary_entries(user_id, date, meal_type);
create unique index if not exists diary_user_date_meal_food_idx on public.diary_entries(user_id, date, meal_type, food_id);

create table if not exists public.quick_foods (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  use_count integer not null default 1,
  last_used_at timestamptz not null default now()
);

create unique index if not exists quick_foods_user_food_idx on public.quick_foods(user_id, food_id);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 2) not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists weight_logs_user_date_idx on public.weight_logs(user_id, date);

create table if not exists public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  steps numeric(7, 0) not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists step_logs_user_date_idx on public.step_logs(user_id, date);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  waist_cm numeric(5, 1),
  hip_cm numeric(5, 1),
  chest_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  neck_cm numeric(5, 1),
  body_fat_pct numeric(4, 1),
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists body_measurements_user_date_idx on public.body_measurements(user_id, date);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  image_url text not null,
  category photo_category default 'front',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists progress_photos_user_date_idx on public.progress_photos(user_id, date);

create table if not exists public.tdee_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  estimated_tdee numeric(7, 1) not null,
  weight_trend numeric(5, 2),
  avg_calories_in numeric(7, 1),
  confidence numeric(3, 2),
  created_at timestamptz not null default now()
);

create unique index if not exists tdee_user_date_idx on public.tdee_calculations(user_id, date);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  amount_ml integer not null,
  logged_at timestamptz not null default now()
);

create index if not exists water_logs_user_date_idx on public.water_logs(user_id, date);

create table if not exists public.water_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null references public.users(id) on delete cascade,
  daily_target_ml integer not null default 2500
);

create table if not exists public.water_containers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  amount_ml integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name varchar(200) not null,
  category exercise_category,
  met_value numeric(4, 1),
  is_custom boolean not null default false,
  is_public boolean not null default false,
  created_by text references public.users(id)
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  exercise_id uuid not null references public.exercises(id),
  duration_min integer,
  calories_burned numeric(6, 1),
  intensity intensity,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists exercise_logs_user_date_idx on public.exercise_logs(user_id, date);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_updated_idx on public.chat_sessions(user_id, updated_at);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  role text not null,
  content text not null,
  parts jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_created_idx on public.chat_messages(session_id, created_at);
create index if not exists chat_messages_user_role_created_idx on public.chat_messages(user_id, role, created_at);

drop table if exists public.ai_usage;
create table public.ai_usage (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  feature text not null,
  date date not null,
  count integer not null default 0
);

create unique index ai_usage_user_feature_date_idx on public.ai_usage(user_id, feature, date);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title varchar(500) not null,
  slug varchar(500) not null,
  summary text not null,
  content text not null,
  thumbnail_url text,
  youtube_video_id varchar(20),
  youtube_channel varchar(255),
  video_published_at timestamptz,
  tags jsonb default '[]'::jsonb,
  locale varchar(10) not null default 'en',
  status blog_status not null default 'draft',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts
  add column if not exists locale varchar(10) not null default 'en',
  add column if not exists metadata jsonb;

create unique index if not exists blog_posts_slug_locale_idx on public.blog_posts(slug, locale);
create unique index if not exists blog_posts_youtube_video_locale_idx on public.blog_posts(youtube_video_id, locale);
create index if not exists blog_posts_status_created_idx on public.blog_posts(status, created_at);
create index if not exists blog_posts_locale_idx on public.blog_posts(locale);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id text not null references public.users(id) on delete cascade,
  referee_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists referrals_referee_unique_idx on public.referrals(referee_id);

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
    nullif(onboarding ->> 'sex', '')::sex,
    nullif(onboarding ->> 'heightCm', '')::numeric(5, 1),
    nullif(onboarding ->> 'currentWeightKg', '')::numeric(5, 1),
    coalesce(nullif(onboarding ->> 'activityLevel', '')::activity_level, 'moderately_active'::activity_level),
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

insert into public.nutrient_definitions (id, name, unit, category, display_order, daily_value, usda_nutrient_id)
values
  (1, 'Protein', 'g', 'macro', 1, 50, 1003),
  (2, 'Total Fat', 'g', 'macro', 2, 78, 1004),
  (3, 'Total Carbohydrate', 'g', 'macro', 3, 275, 1005),
  (4, 'Dietary Fiber', 'g', 'macro', 4, 28, 1079),
  (5, 'Total Sugars', 'g', 'macro', 5, null, 2000),
  (6, 'Added Sugars', 'g', 'macro', 6, 50, 1235),
  (7, 'Saturated Fat', 'g', 'macro', 7, 20, 1258),
  (8, 'Trans Fat', 'g', 'macro', 8, null, 1257),
  (9, 'Monounsaturated Fat', 'g', 'macro', 9, null, 1292),
  (10, 'Polyunsaturated Fat', 'g', 'macro', 10, null, 1293),
  (11, 'Cholesterol', 'mg', 'macro', 11, 300, 1253),
  (12, 'Vitamin A', 'mcg', 'vitamin', 20, 900, 1106),
  (13, 'Vitamin C', 'mg', 'vitamin', 21, 90, 1162),
  (14, 'Vitamin D', 'mcg', 'vitamin', 22, 20, 1114),
  (15, 'Vitamin E', 'mg', 'vitamin', 23, 15, 1109),
  (16, 'Vitamin K', 'mcg', 'vitamin', 24, 120, 1185),
  (17, 'Thiamin (B1)', 'mg', 'vitamin', 25, 1.2, 1165),
  (18, 'Riboflavin (B2)', 'mg', 'vitamin', 26, 1.3, 1166),
  (19, 'Niacin (B3)', 'mg', 'vitamin', 27, 16, 1167),
  (20, 'Pantothenic Acid (B5)', 'mg', 'vitamin', 28, 5, 1170),
  (21, 'Vitamin B6', 'mg', 'vitamin', 29, 1.7, 1175),
  (22, 'Biotin (B7)', 'mcg', 'vitamin', 30, 30, 1176),
  (23, 'Folate (B9)', 'mcg', 'vitamin', 31, 400, 1177),
  (24, 'Vitamin B12', 'mcg', 'vitamin', 32, 2.4, 1178),
  (25, 'Choline', 'mg', 'vitamin', 33, 550, 1180),
  (26, 'Calcium', 'mg', 'mineral', 40, 1300, 1087),
  (27, 'Iron', 'mg', 'mineral', 41, 18, 1089),
  (28, 'Magnesium', 'mg', 'mineral', 42, 420, 1090),
  (29, 'Phosphorus', 'mg', 'mineral', 43, 1250, 1091),
  (30, 'Potassium', 'mg', 'mineral', 44, 4700, 1092),
  (31, 'Sodium', 'mg', 'mineral', 45, 2300, 1093),
  (32, 'Zinc', 'mg', 'mineral', 46, 11, 1095),
  (33, 'Copper', 'mg', 'mineral', 47, 0.9, 1098),
  (34, 'Manganese', 'mg', 'mineral', 48, 2.3, 1101),
  (35, 'Selenium', 'mcg', 'mineral', 49, 55, 1103),
  (36, 'Chromium', 'mcg', 'mineral', 50, 35, 1096),
  (37, 'Molybdenum', 'mcg', 'mineral', 51, 45, 1102),
  (38, 'Iodine', 'mcg', 'mineral', 52, 150, 1100),
  (39, 'Water', 'g', 'other', 60, null, 1051)
on conflict (id) do update
set
  name = excluded.name,
  unit = excluded.unit,
  category = excluded.category,
  display_order = excluded.display_order,
  daily_value = excluded.daily_value,
  usda_nutrient_id = excluded.usda_nutrient_id;

insert into public.foods (name, source, serving_size, serving_unit, calories, is_public)
values
  ('Dal', 'verified', 100, 'g', 120, true),
  ('Bhat', 'verified', 100, 'g', 130, true),
  ('Tarkari', 'verified', 100, 'g', 80, true),
  ('Momo', 'verified', 100, 'g', 230, true),
  ('Dhido', 'verified', 100, 'g', 110, true),
  ('Gundruk', 'verified', 100, 'g', 45, true),
  ('Chiura', 'verified', 100, 'g', 350, true),
  ('Sel Roti', 'verified', 100, 'g', 320, true),
  ('Thukpa', 'verified', 100, 'g', 95, true),
  ('Milk tea', 'verified', 250, 'ml', 120, true)
on conflict do nothing;

update public.users
set is_admin = true,
    is_active = true,
    updated_at = now()
where lower(email) = lower('YOUR_ACTUAL_EMAIL');
