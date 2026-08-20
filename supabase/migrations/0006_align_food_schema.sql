-- Align food search/creation tables with the current application schema.
-- Safe to run in Supabase SQL editor without dropping existing foods.

create extension if not exists "pgcrypto";

do $$ begin
  create type food_source as enum ('usda', 'openfoodfacts', 'user', 'verified', 'family', 'seven');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type nutrient_category as enum ('macro', 'vitamin', 'mineral', 'other');
exception when duplicate_object then null;
end $$;

alter table public.foods
  add column if not exists barcode varchar(50),
  add column if not exists source_id varchar(100),
  add column if not exists household_serving varchar(100),
  add column if not exists is_verified boolean not null default false,
  add column if not exists metadata jsonb;

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

alter table public.nutrient_definitions
  add column if not exists category nutrient_category not null default 'other',
  add column if not exists display_order integer,
  add column if not exists usda_nutrient_id integer;

alter table public.nutrient_definitions
  alter column name type varchar(100),
  alter column unit type varchar(20),
  alter column daily_value type numeric(10, 3);

alter table public.food_nutrients
  add column if not exists id uuid default gen_random_uuid();

update public.food_nutrients
set id = gen_random_uuid()
where id is null;

alter table public.food_nutrients
  alter column id set not null,
  alter column amount type numeric(10, 3);

do $$ begin
  alter table public.food_nutrients add constraint food_nutrients_id_unique unique (id);
exception when duplicate_object then null;
end $$;

create unique index if not exists food_nutrients_unique_idx
  on public.food_nutrients(food_id, nutrient_id);

create index if not exists food_nutrients_food_idx
  on public.food_nutrients(food_id);

create table if not exists public.food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  label varchar(100) not null,
  grams numeric(8, 2) not null
);

create index if not exists food_servings_food_idx
  on public.food_servings(food_id);

alter table public.diary_entries
  add column if not exists serving_id uuid references public.food_servings(id),
  add column if not exists fiber_g numeric(6, 1);

create table if not exists public.quick_foods (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  use_count integer not null default 1,
  last_used_at timestamptz not null default now()
);

create unique index if not exists quick_foods_user_food_idx
  on public.quick_foods(user_id, food_id);
