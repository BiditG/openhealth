-- Admin approval gates for app access.

alter table users
  add column if not exists is_active boolean not null default false;

alter table users
  add column if not exists is_admin boolean not null default false;

create index if not exists users_is_active_idx on users(is_active);
create index if not exists users_is_admin_idx on users(is_admin);

-- After running this migration, activate your own admin account:
-- update users set is_admin = true, is_active = true where email = 'your@email.com';
