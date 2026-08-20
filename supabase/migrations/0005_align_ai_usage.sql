-- Align AI usage tracking with the current application schema.
-- Safe to run in Supabase SQL editor. Existing usage rows are reset because
-- this table only stores daily rate-limit counters.

drop table if exists public.ai_usage;

create table public.ai_usage (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  feature text not null,
  date date not null,
  count integer not null default 0
);

create unique index ai_usage_user_feature_date_idx
  on public.ai_usage(user_id, feature, date);
