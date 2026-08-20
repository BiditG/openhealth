-- Hub, Progress, and AI nutrition context tables.
-- Run this only if your Supabase database has not already been migrated by Drizzle.

create extension if not exists pgcrypto;

do $$ begin
  create type unit_system as enum ('metric', 'imperial');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sex as enum ('male', 'female', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type activity_level as enum ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type goal_type as enum ('lose', 'maintain', 'gain');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type exercise_category as enum ('cardio', 'strength', 'flexibility', 'sport', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type intensity as enum ('low', 'moderate', 'high');
exception when duplicate_object then null;
end $$;

create table if not exists users (
  id text primary key,
  email varchar(255) unique not null,
  name varchar(100) not null,
  email_verified boolean not null default false,
  is_active boolean not null default false,
  is_admin boolean not null default false,
  image text,
  timezone varchar(50) default 'UTC',
  unit_system unit_system default 'metric',
  plan text not null default 'free',
  plan_expires_at timestamptz,
  trial_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null references users(id) on delete cascade,
  date_of_birth date,
  sex sex,
  height_cm numeric(5,1),
  current_weight_kg numeric(5,1),
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

create table if not exists user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null references users(id) on delete cascade,
  goal_type goal_type default 'maintain',
  target_weight_kg numeric(5,1),
  weekly_rate_kg numeric(3,2),
  calorie_target integer,
  protein_g numeric(5,1),
  carbs_g numeric(5,1),
  fat_g numeric(5,1),
  fiber_g numeric(5,1),
  tracked_nutrient_ids jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  name varchar(200) not null,
  brand varchar(120),
  source varchar(40) not null default 'user',
  serving_size numeric(8,2) not null default 100,
  serving_unit varchar(30) not null default 'g',
  calories numeric(8,2) not null default 0,
  description text,
  is_public boolean not null default false,
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists foods_name_idx on foods using gin (to_tsvector('simple', name));

create table if not exists nutrient_definitions (
  id integer primary key,
  name varchar(120) not null,
  unit varchar(20) not null,
  daily_value numeric(10,2)
);

create table if not exists food_nutrients (
  food_id uuid not null references foods(id) on delete cascade,
  nutrient_id integer not null references nutrient_definitions(id),
  amount numeric(12,4) not null,
  primary key (food_id, nutrient_id)
);

create table if not exists diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  date date not null,
  meal_type meal_type not null,
  food_id uuid not null references foods(id),
  serving_qty numeric(6,2) not null default 1,
  calories numeric(7,1),
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  fiber_g numeric(6,1),
  sort_order integer default 0,
  logged_at timestamptz not null default now()
);

create index if not exists diary_user_date_idx on diary_entries(user_id, date);
create index if not exists diary_user_date_meal_idx on diary_entries(user_id, date, meal_type);
create unique index if not exists diary_user_date_meal_food_idx on diary_entries(user_id, date, meal_type, food_id);

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists weight_logs_user_date_idx on weight_logs(user_id, date);

create table if not exists step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  date date not null,
  steps numeric(7,0) not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists step_logs_user_date_idx on step_logs(user_id, date);

create table if not exists water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  date date not null,
  amount_ml integer not null,
  logged_at timestamptz not null default now()
);

create index if not exists water_logs_user_date_idx on water_logs(user_id, date);

create table if not exists water_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null references users(id) on delete cascade,
  daily_target_ml integer not null default 2500
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  name varchar(200) not null,
  category exercise_category,
  met_value numeric(4,1),
  is_custom boolean not null default false,
  is_public boolean not null default false,
  created_by text references users(id)
);

create table if not exists exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  date date not null,
  exercise_id uuid not null references exercises(id),
  duration_min integer,
  calories_burned numeric(6,1),
  intensity intensity,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists exercise_logs_user_date_idx on exercise_logs(user_id, date);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  title varchar(200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_idx on chat_sessions(user_id, updated_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role varchar(20) not null,
  content text not null,
  parts jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx on chat_messages(session_id, created_at);
