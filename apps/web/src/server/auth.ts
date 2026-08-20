import { createServerClient } from "@supabase/ssr/dist/main/createServerClient";
import type { Session, User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { generateReferralCode, isUniqueViolation, REFERRAL_CODE_MAX_RETRIES } from "@/lib/referral-code";
import { db } from "@/server/db";
import { users, userProfiles } from "@/server/db/schema";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date | null;
  };
};

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

async function createSupabaseServerClient() {
  const env = getSupabaseEnv();
  if (!env) return null;

  const { supabaseUrl, supabaseAnonKey } = env;
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies; route handlers can.
        }
      },
    },
  });
}

function getUserName(user: User) {
  return (
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    user.email?.split("@")[0] ||
    "User"
  );
}

function getAvatarUrl(user: User) {
  return typeof user.user_metadata?.avatar_url === "string"
    ? user.user_metadata.avatar_url
    : null;
}

async function ensureApplicationUser(user: User) {
  const email = user.email;
  if (!email) return;

  const name = getUserName(user);
  const image = getAvatarUrl(user);

  await db
    .insert(users)
    .values({
      id: user.id,
      email,
      name,
      emailVerified: Boolean(user.email_confirmed_at),
      image,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        name,
        emailVerified: Boolean(user.email_confirmed_at),
        image,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(userProfiles)
    .values({ userId: user.id })
    .onConflictDoNothing({ target: userProfiles.userId });

  const existing = await db
    .select({ referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, user.id))
    .then((rows) => rows[0]);

  if (existing?.referralCode) return;

  for (let i = 0; i < REFERRAL_CODE_MAX_RETRIES; i++) {
    const code = generateReferralCode();
    try {
      await db.update(users).set({ referralCode: code }).where(eq(users.id, user.id));
      return;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
}

function toAppSession(session: Session): AppSession {
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name: getUserName(session.user),
      image: getAvatarUrl(session.user),
    },
    session: {
      id: session.access_token,
      userId: session.user.id,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    },
  };
}

export async function getSupabaseSession() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) return null;

  await ensureApplicationUser(session.user);
  return toAppSession(session);
}

export const auth = {
  api: {
    getSession: async (options?: unknown) => {
      void options;
      return getSupabaseSession();
    },
  },
};
