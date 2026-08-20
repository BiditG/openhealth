-- Swastha Supabase foundation
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id text primary key,
  email varchar(255) unique not null,
  name varchar(100) not null,
  email_verified boolean not null default false,
  image text,
  timezone varchar(50) default 'UTC',
  unit_system text default 'metric',
  referral_code varchar(12) unique,
  plan text not null default 'free',
  plan_expires_at timestamptz,
  trial_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  sex text,
  height_cm numeric(5, 1),
  activity_level text default 'moderately_active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  metric_type text not null check (metric_type in (
    'weight',
    'blood_pressure',
    'blood_glucose',
    'heart_rate',
    'waist',
    'temperature',
    'spo2',
    'sleep',
    'water',
    'steps'
  )),
  value numeric not null,
  unit text not null,
  secondary_value numeric,
  notes text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_type text not null,
  image_url text,
  description text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  health_score numeric,
  ai_analysis jsonb,
  eaten_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  food_name text not null,
  local_name text,
  quantity numeric,
  unit text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.food_database (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nepali_name text,
  category text not null default 'nepali_food',
  serving_size numeric,
  serving_unit text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  source text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lab_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  report_date date,
  lab_name text,
  extracted_text text,
  ai_summary text,
  analysis_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lab_reports(id) on delete cascade,
  test_name text not null,
  value numeric,
  text_value text,
  unit text,
  reference_min numeric,
  reference_max numeric,
  reference_text text,
  flag text check (flag is null or flag in ('normal', 'low', 'high', 'unknown')),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null,
  content text not null,
  category text not null,
  featured_image text,
  status text not null default 'draft',
  medically_reviewed boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  anonymous_identifier text,
  action text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  insert into public.user_profiles (user_id)
  values (new.id::text)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.health_metrics enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.lab_reports enable row level security;
alter table public.lab_results enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;

alter table public.food_database enable row level security;
alter table public.articles enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "health_metrics own rows" on public.health_metrics;
create policy "health_metrics own rows" on public.health_metrics
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meals own rows" on public.meals;
create policy "meals own rows" on public.meals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_items own meal rows" on public.meal_items;
create policy "meal_items own meal rows" on public.meal_items
for all
using (
  exists (
    select 1 from public.meals
    where public.meals.id = meal_items.meal_id
      and public.meals.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.meals
    where public.meals.id = meal_items.meal_id
      and public.meals.user_id = auth.uid()
  )
);

drop policy if exists "lab_reports own rows" on public.lab_reports;
create policy "lab_reports own rows" on public.lab_reports
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lab_results own report rows" on public.lab_results;
create policy "lab_results own report rows" on public.lab_results
for all
using (
  exists (
    select 1 from public.lab_reports
    where public.lab_reports.id = lab_results.report_id
      and public.lab_reports.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.lab_reports
    where public.lab_reports.id = lab_results.report_id
      and public.lab_reports.user_id = auth.uid()
  )
);

drop policy if exists "ai_conversations own rows" on public.ai_conversations;
create policy "ai_conversations own rows" on public.ai_conversations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_messages own conversation rows" on public.ai_messages;
create policy "ai_messages own conversation rows" on public.ai_messages
for all
using (
  exists (
    select 1 from public.ai_conversations
    where public.ai_conversations.id = ai_messages.conversation_id
      and public.ai_conversations.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.ai_conversations
    where public.ai_conversations.id = ai_messages.conversation_id
      and public.ai_conversations.user_id = auth.uid()
  )
);

drop policy if exists "ai_usage own rows" on public.ai_usage;
create policy "ai_usage own rows" on public.ai_usage
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "food_database public read" on public.food_database;
create policy "food_database public read" on public.food_database
for select using (true);

drop policy if exists "articles published public read" on public.articles;
create policy "articles published public read" on public.articles
for select using (status = 'published');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('food-images', 'food-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('lab-reports', 'lab-reports', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own private food images" on storage.objects;
create policy "own private food images" on storage.objects
for all
using (bucket_id = 'food-images' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'food-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own private lab reports" on storage.objects;
create policy "own private lab reports" on storage.objects
for all
using (bucket_id = 'lab-reports' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'lab-reports' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own avatar writes" on storage.objects;
create policy "own avatar writes" on storage.objects
for all
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

insert into public.food_database (name, nepali_name, category, source, verified)
values
  ('Dal', 'दाल', 'nepali_food', 'seed:name-only', false),
  ('Bhat', 'भात', 'nepali_food', 'seed:name-only', false),
  ('Tarkari', 'तरकारी', 'nepali_food', 'seed:name-only', false),
  ('Momo', 'म:म', 'nepali_food', 'seed:name-only', false),
  ('Dhido', 'ढिंडो', 'nepali_food', 'seed:name-only', false),
  ('Gundruk', 'गुन्द्रुक', 'nepali_food', 'seed:name-only', false),
  ('Chiura', 'चिउरा', 'nepali_food', 'seed:name-only', false),
  ('Sel Roti', 'सेल रोटी', 'nepali_food', 'seed:name-only', false),
  ('Chatpate', 'चटपटे', 'nepali_food', 'seed:name-only', false),
  ('Thukpa', 'थुक्पा', 'nepali_food', 'seed:name-only', false),
  ('Kwati', 'क्वाँटी', 'nepali_food', 'seed:name-only', false),
  ('Yomari', 'योमरी', 'nepali_food', 'seed:name-only', false),
  ('Aloo Tama', 'आलु तामा', 'nepali_food', 'seed:name-only', false),
  ('Chicken curry', null, 'nepali_food', 'seed:name-only', false),
  ('Buff curry', null, 'nepali_food', 'seed:name-only', false),
  ('Sukuti', 'सुकुटी', 'nepali_food', 'seed:name-only', false),
  ('Milk tea', 'दूध चिया', 'nepali_food', 'seed:name-only', false),
  ('Thakali set', 'थकाली सेट', 'nepali_food', 'seed:name-only', false)
on conflict do nothing;
