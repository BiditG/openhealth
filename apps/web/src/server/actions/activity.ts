"use server";

import { z } from "zod";
import { getSession } from "@/server/lib/get-session";
import { db } from "@/server/db";
import { activitySessions, users } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { resolveEffectivePlan, requireFeature } from "@/server/services/plan";
import {
  startActivitySessionSchema,
  completeActivitySessionSchema,
  discardActivitySessionSchema,
  logActivitySessionSchema,
} from "@open-health/shared/schemas";

async function assertProAccess(userId: string, activityType?: string) {
  if (activityType === "meditation" || activityType === "throat_exercise" || activityType === "eye_exercise") return;

  const userRow = await db
    .select({
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      trialExpiresAt: users.trialExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0]);

  const plan = userRow ? resolveEffectivePlan(userRow) : "free";
  requireFeature(plan, "exercise");
}

export async function startActivitySession(
  input: z.infer<typeof startActivitySessionSchema>
) {
  const user = await getSession();
  const validated = startActivitySessionSchema.parse(input);
  await assertProAccess(user.id, validated.type);

  // Check if there's already an active session of the same type
  const active = await db
    .select({ id: activitySessions.id })
    .from(activitySessions)
    .where(
      and(
        eq(activitySessions.userId, user.id),
        eq(activitySessions.type, validated.type),
        isNull(activitySessions.completedAt)
      )
    )
    .limit(1);

  if (active.length > 0) {
    return { sessionId: active[0].id, alreadyActive: true };
  }

  const [session] = await db
    .insert(activitySessions)
    .values({
      userId: user.id,
      type: validated.type,
      metadata: validated.metadata ?? {},
    })
    .returning({ id: activitySessions.id });

  revalidatePath("/hub/meditation");
  revalidatePath("/hub/throat-exercise");
  revalidatePath("/hub/eye-exercise");
  return { sessionId: session.id, alreadyActive: false };
}

export async function completeActivitySession(
  input: z.infer<typeof completeActivitySessionSchema>
) {
  const user = await getSession();
  const validated = completeActivitySessionSchema.parse(input);

  const session = await db
    .select({
      id: activitySessions.id,
      startedAt: activitySessions.startedAt,
      metadata: activitySessions.metadata,
    })
    .from(activitySessions)
    .where(
      and(
        eq(activitySessions.id, validated.sessionId),
        eq(activitySessions.userId, user.id)
      )
    )
    .then((r) => r[0]);

  if (!session) throw new Error("Activity not found");

  const now = new Date();
  const durationSec = Math.floor(
    (now.getTime() - session.startedAt.getTime()) / 1000
  );

  // Merge metadata
  const mergedMetadata = {
    ...(session.metadata as Record<string, unknown>),
    ...(validated.metadata ?? {}),
    completed: true,
  };

  await db
    .update(activitySessions)
    .set({
      completedAt: now,
      durationSec,
      note: validated.note,
      metadata: mergedMetadata,
    })
    .where(eq(activitySessions.id, validated.sessionId));

  revalidatePath("/hub/meditation");
  revalidatePath("/hub/throat-exercise");
  revalidatePath("/hub/eye-exercise");
  return { success: true, durationSec };
}

export async function discardActivitySession(
  input: z.infer<typeof discardActivitySessionSchema>
) {
  const user = await getSession();
  const validated = discardActivitySessionSchema.parse(input);

  await db
    .delete(activitySessions)
    .where(
      and(
        eq(activitySessions.id, validated.sessionId),
        eq(activitySessions.userId, user.id)
      )
    );

  revalidatePath("/hub/meditation");
  revalidatePath("/hub/throat-exercise");
  revalidatePath("/hub/eye-exercise");
  return { success: true };
}

export async function logActivitySession(
  input: z.infer<typeof logActivitySessionSchema>
) {
  const user = await getSession();
  const validated = logActivitySessionSchema.parse(input);
  await assertProAccess(user.id, validated.type);

  const [session] = await db
    .insert(activitySessions)
    .values({
      userId: user.id,
      type: validated.type,
      startedAt: new Date(validated.startedAt),
      completedAt: new Date(validated.completedAt),
      durationSec: validated.durationSec,
      note: validated.note,
      metadata: { ...(validated.metadata ?? {}), completed: true },
    })
    .returning({ id: activitySessions.id });

  revalidatePath("/hub/meditation");
  revalidatePath("/hub/throat-exercise");
  revalidatePath("/hub/eye-exercise");
  return { sessionId: session.id };
}

export async function deleteActivitySession(sessionId: string) {
  const user = await getSession();

  await db
    .delete(activitySessions)
    .where(
      and(
        eq(activitySessions.id, sessionId),
        eq(activitySessions.userId, user.id)
      )
    );

  revalidatePath("/hub/meditation");
  revalidatePath("/hub/throat-exercise");
  revalidatePath("/hub/eye-exercise");
  return { success: true };
}
