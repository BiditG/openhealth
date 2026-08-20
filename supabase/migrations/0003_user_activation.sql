-- Admin approval gates for app access.

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

-- After running this migration, activate your own admin account:
-- update users set is_admin = true, is_active = true where email = 'your@email.com';
