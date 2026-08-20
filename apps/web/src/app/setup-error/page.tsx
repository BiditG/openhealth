import Link from "next/link";
import { AlertTriangle, Database } from "lucide-react";

export default function SetupErrorPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-center">
        <div className="rounded-2xl border border-[#E6DDD0] bg-[#FFFBF5] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#9A5B00]">
              <Database className="h-5 w-5" />
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF1DA] text-[#9A5B00]">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A5B00]">
              Setup needed
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Database setup is not complete
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              The app could not load protected pages because the production database is missing configuration or the latest migration.
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-[#E6DDD0] bg-white p-4">
            <p className="text-sm font-semibold text-foreground">Run this in Supabase SQL editor:</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-[#111827] p-3 text-xs leading-5 text-white">
{`alter table users
  add column if not exists is_active boolean not null default false;

alter table users
  add column if not exists is_admin boolean not null default false;

alter table users
  add column if not exists referral_code varchar(12);

create unique index if not exists users_referral_code_idx
  on users(referral_code);

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

update users
set is_admin = true, is_active = true
where email = 'your@email.com';`}
            </pre>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#125745]"
          >
            Back to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
