import { eq, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users, aiUsage } from "@/server/db/schema";
import { PLAN_LIMITS } from "@open-health/shared/constants";
import type { Plan, AiFeature } from "@open-health/shared/types";
import { getNepalDate } from "@/lib/date";
import { nanoid } from "nanoid";

type UserPlanRow = {
  plan: string;
  planExpiresAt: Date | null;
  trialExpiresAt: Date | null;
};

export function resolveEffectivePlan(user: UserPlanRow): Plan {
  const now = new Date();

  // Check if paid plan is still active
  if (user.plan === "pro") {
    if (!user.planExpiresAt || user.planExpiresAt > now) {
      return "pro";
    }
    // Plan expired, fall through
  }

  // Check if trial is still active
  if (user.trialExpiresAt && user.trialExpiresAt > now) {
    return "pro";
  }

  return "free";
}

export function getAiLimit(plan: Plan, feature: AiFeature): number {
  return PLAN_LIMITS[plan].ai[feature];
}

export async function checkAndIncrementAiUsage(
  userId: string,
  feature: AiFeature,
  plan: Plan
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = getAiLimit(plan, feature);
  const today = getNepalDate();

  // Unlimited
  if (!isFinite(limit)) {
    return { allowed: true, used: 0, limit };
  }

  // Upsert and get current count atomically
  const result = await db
    .insert(aiUsage)
    .values({
      id: nanoid(),
      userId,
      feature,
      date: today,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.feature, aiUsage.date],
      set: { count: sql`${aiUsage.count} + 1` },
    })
    .returning({ count: aiUsage.count });

  const used = result[0]?.count ?? 1;

  if (used > limit) {
    // Rollback the increment
    await db
      .update(aiUsage)
      .set({ count: sql`${aiUsage.count} - 1` })
      .where(
        and(
          eq(aiUsage.userId, userId),
          eq(aiUsage.feature, feature),
          eq(aiUsage.date, today)
        )
      );
    return { allowed: false, used: used - 1, limit };
  }

  return { allowed: true, used, limit };
}

export async function getAiUsage(
  userId: string,
  feature: AiFeature,
  plan: Plan
): Promise<{ used: number; limit: number }> {
  const limit = getAiLimit(plan, feature);
  const today = getNepalDate();

  const result = await db
    .select({ count: aiUsage.count })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.feature, feature),
        eq(aiUsage.date, today)
      )
    );

  return { used: result[0]?.count ?? 0, limit };
}

export function canAccessFeature(
  plan: Plan,
  feature: keyof (typeof PLAN_LIMITS)["free"]
): boolean {
  return !!PLAN_LIMITS[plan][feature];
}

/**
 * Throws a structured error when the user's plan doesn't have access.
 * For tRPC routers: wrap with TRPCError at call site.
 * For server actions: throw directly.
 * Mobile tRPC client detects `cause.type === "PRO_REQUIRED"` for unified paywall UI.
 */
export function requireFeature(
  plan: Plan,
  feature: keyof (typeof PLAN_LIMITS)["free"]
): void {
  if (!canAccessFeature(plan, feature)) {
    throw new ProRequiredError(feature);
  }
}

export class ProRequiredError extends Error {
  public readonly feature: string;
  constructor(feature: string) {
    super("This feature requires the Pro plan");
    this.name = "ProRequiredError";
    this.feature = feature;
  }
}

export async function getSessionWithPlan(
  getSessionFn: () => Promise<{ user: { id: string } } | null>
): Promise<{ user: { id: string }; plan: Plan }> {
  const session = await getSessionFn();
  if (!session?.user) throw new Error("Unauthorized");

  const userRow = await db
    .select({
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      trialExpiresAt: users.trialExpiresAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .then((r) => r[0]);

  const plan = userRow ? resolveEffectivePlan(userRow) : "free";
  return { user: session.user, plan };
}
