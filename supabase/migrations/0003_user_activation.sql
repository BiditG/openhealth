-- Admin approval gates for app access.

do $$ begin
  create type goal_type as enum ('lose', 'maintain', 'gain');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type target_mode as enum ('grams', 'percentage');
exception when duplicate_object then null;
end $$;

alter table users
  add column if not exists is_active boolean not null default false;

alter table users
  add column if not exists is_admin boolean not null default false;

alter table users
  add column if not exists referral_code varchar(12);

create unique index if not exists users_referral_code_idx on users(referral_code);
create index if not exists users_is_active_idx on users(is_active);
create index if not exists users_is_admin_idx on users(is_admin);

alter table user_profiles
  add column if not exists current_weight_kg numeric(5,1),
  add column if not exists medical_conditions jsonb,
  add column if not exists medications text,
  add column if not exists allergies text,
  add column if not exists dietary_preference varchar(80),
  add column if not exists primary_goal varchar(80),
  add column if not exists onboarding_completed boolean not null default false;

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
  protein_pct numeric(4,1),
  carbs_pct numeric(4,1),
  fat_pct numeric(4,1),
  target_mode target_mode default 'percentage',
  tracked_nutrient_ids jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_goals_user_id_idx on user_goals(user_id);

alter table user_goals
  add column if not exists protein_pct numeric(4,1),
  add column if not exists carbs_pct numeric(4,1),
  add column if not exists fat_pct numeric(4,1),
  add column if not exists target_mode target_mode default 'percentage',
  add column if not exists tracked_nutrient_ids jsonb;

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists weight_logs_user_date_idx on weight_logs(user_id, date);

-- After running this migration, activate your own admin account:
-- update users set is_admin = true, is_active = true where email = 'your@email.com';
