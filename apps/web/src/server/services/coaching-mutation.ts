import { users, coachClients } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { isUniqueViolation } from "@/lib/referral-code";
import type { db as dbType } from "@/server/db";

type Db = typeof dbType;

type CoachResult =
  | { success: true }
  | { success: false; error: string };

export async function connectToCoach(
  db: Db,
  userId: string,
  code: string
): Promise<CoachResult> {
  const normalizedCode = code.toUpperCase();

  // Find coach by referralCode
  const coach = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, normalizedCode))
    .limit(1);

  if (coach.length === 0) {
    return { success: false, error: "Coach code does not exist" };
  }

  if (coach[0].id === userId) {
    return { success: false, error: "You cannot add yourself as your coach" };
  }

  try {
    await db.insert(coachClients).values({
      coachId: coach[0].id,
      clientId: userId,
      startDate: new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "You are already connected to this coach" };
    }
    throw error;
  }

  return { success: true };
}

export async function disconnectFromCoach(
  db: Db,
  userId: string,
  coachId: string
) {
  await db
    .update(coachClients)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(
      and(
        eq(coachClients.coachId, coachId),
        eq(coachClients.clientId, userId),
        eq(coachClients.status, "active")
      )
    );
}
