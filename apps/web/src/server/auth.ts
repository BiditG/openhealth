import { createServerClient } from "@supabase/ssr/dist/main/createServerClient";
import type { User } from "@supabase/supabase-js";
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

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function getNumber(value: unknown, max: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 && numberValue <= max
    ? numberValue
    : null;
}

function getOnboardingProfile(user: User) {
  const rawProfile = user.user_metadata?.onboarding_profile;
  if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
    return null;
  }

  const profile = rawProfile as Record<string, unknown>;
  const sex = getString(profile.sex, 20);
  const activityLevel = getString(profile.activityLevel, 40);
  const safeSex: "male" | "female" | "other" | null =
    sex === "male" || sex === "female" || sex === "other" ? sex : null;
  const safeActivityLevel:
    | "sedentary"
    | "lightly_active"
    | "moderately_active"
    | "very_active"
    | "extremely_active" =
    activityLevel === "sedentary" ||
    activityLevel === "lightly_active" ||
    activityLevel === "moderately_active" ||
    activityLevel === "very_active" ||
    activityLevel === "extremely_active"
      ? activityLevel
      : "moderately_active";
  const medicalConditions = Array.isArray(profile.medicalConditions)
    ? profile.medicalConditions
        .filter((condition): condition is string => typeof condition === "string")
        .map((condition) => condition.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  return {
    sex: safeSex,
    heightCm: getNumber(profile.heightCm, 300),
    currentWeightKg: getNumber(profile.currentWeightKg, 500),
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.dateOfBirth))
      ? String(profile.dateOfBirth)
      : null,
    activityLevel: safeActivityLevel,
    medicalConditions,
    medications: getString(profile.medications, 1000),
    allergies: getString(profile.allergies, 1000),
    dietaryPreference: getString(profile.dietaryPreference, 80),
    primaryGoal: getString(profile.primaryGoal, 80),
    onboardingCompleted: profile.onboardingCompleted === true,
  };
}

async function ensureApplicationUser(user: User) {
  const email = user.email;
  if (!email) return;

  const name = getUserName(user);
  const image = getAvatarUrl(user);
  const isAdminEmail = getAdminEmails().includes(email.toLowerCase());
  const adminActivation = isAdminEmail
    ? {
        isActive: true,
        isAdmin: true,
      }
    : {};

  await db
    .insert(users)
    .values({
      id: user.id,
      email,
      name,
      emailVerified: Boolean(user.email_confirmed_at),
      isActive: isAdminEmail,
      isAdmin: isAdminEmail,
      image,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        name,
        emailVerified: Boolean(user.email_confirmed_at),
        ...adminActivation,
        image,
        updatedAt: new Date(),
      },
    });

  const onboardingProfile = getOnboardingProfile(user);
  const existingProfile = await db
    .select({ onboardingCompleted: userProfiles.onboardingCompleted })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .then((rows) => rows[0]);

  if (onboardingProfile && !existingProfile?.onboardingCompleted) {
    await db
      .insert(userProfiles)
      .values({
        userId: user.id,
        sex: onboardingProfile.sex,
        heightCm: onboardingProfile.heightCm ? String(onboardingProfile.heightCm) : null,
        currentWeightKg: onboardingProfile.currentWeightKg ? String(onboardingProfile.currentWeightKg) : null,
        dateOfBirth: onboardingProfile.dateOfBirth,
        activityLevel: onboardingProfile.activityLevel,
        medicalConditions: onboardingProfile.medicalConditions,
        medications: onboardingProfile.medications,
        allergies: onboardingProfile.allergies,
        dietaryPreference: onboardingProfile.dietaryPreference,
        primaryGoal: onboardingProfile.primaryGoal,
        onboardingCompleted: onboardingProfile.onboardingCompleted,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          sex: onboardingProfile.sex,
          heightCm: onboardingProfile.heightCm ? String(onboardingProfile.heightCm) : null,
          currentWeightKg: onboardingProfile.currentWeightKg ? String(onboardingProfile.currentWeightKg) : null,
          dateOfBirth: onboardingProfile.dateOfBirth,
          activityLevel: onboardingProfile.activityLevel,
          medicalConditions: onboardingProfile.medicalConditions,
          medications: onboardingProfile.medications,
          allergies: onboardingProfile.allergies,
          dietaryPreference: onboardingProfile.dietaryPreference,
          primaryGoal: onboardingProfile.primaryGoal,
          onboardingCompleted: onboardingProfile.onboardingCompleted,
          updatedAt: new Date(),
        },
      });
  } else if (!existingProfile) {
    await db
      .insert(userProfiles)
      .values({ userId: user.id })
      .onConflictDoNothing({ target: userProfiles.userId });
  }

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

function toAppSession(user: User): AppSession {
  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: getUserName(user),
      image: getAvatarUrl(user),
    },
    session: {
      id: user.id,
      userId: user.id,
      expiresAt: null,
    },
  };
}

export async function getSupabaseSession() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  await ensureApplicationUser(user);
  return toAppSession(user);
}

export const auth = {
  api: {
    getSession: async (options?: unknown) => {
      void options;
      return getSupabaseSession();
    },
  },
};
