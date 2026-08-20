"use server";

import { z } from "zod";
import { getSession } from "@/server/lib/get-session";
import { db } from "@/server/db";
import {
  workouts,
  workoutExercises,
  workoutSets,
  workoutTemplates,
  workoutTemplateExercises,
  personalRecords,
  users,
} from "@/server/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { resolveEffectivePlan, requireFeature } from "@/server/services/plan";
import {
  startWorkoutSchema,
  addExerciseToWorkoutSchema,
  logSetSchema,
  removeSetSchema,
  finishWorkoutSchema,
  discardWorkoutSchema,
  removeExerciseFromWorkoutSchema,
  createWorkoutTemplateSchema,
  saveWorkoutAsTemplateSchema,
  deleteWorkoutTemplateSchema,
} from "@open-health/shared/schemas";

async function assertProAccess(userId: string) {
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

export async function startWorkout(
  input: z.infer<typeof startWorkoutSchema>
) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = startWorkoutSchema.parse(input);

  // Check if there's already an active workout
  const active = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(
      and(eq(workouts.userId, user.id), isNull(workouts.completedAt))
    )
    .limit(1);

  if (active.length > 0) {
    return { workoutId: active[0].id, alreadyActive: true };
  }

  const name = validated.name || "Workout";

  const [workout] = await db
    .insert(workouts)
    .values({
      userId: user.id,
      name,
      templateId: validated.templateId,
    })
    .returning({ id: workouts.id });

  // If starting from template, pre-populate exercises and sets
  if (validated.templateId) {
    const templateExercises = await db
      .select()
      .from(workoutTemplateExercises)
      .where(eq(workoutTemplateExercises.templateId, validated.templateId))
      .orderBy(workoutTemplateExercises.sortOrder);

    for (const te of templateExercises) {
      const [we] = await db
        .insert(workoutExercises)
        .values({
          workoutId: workout.id,
          exerciseId: te.exerciseId,
          sortOrder: te.sortOrder,
        })
        .returning({ id: workoutExercises.id });

      // Create empty sets based on template defaults
      const setCount = te.defaultSets || 3;
      for (let i = 1; i <= setCount; i++) {
        await db.insert(workoutSets).values({
          workoutExerciseId: we.id,
          setNumber: i,
          weightKg: te.defaultWeightKg,
          reps: te.defaultReps,
        });
      }
    }
  }

  revalidatePath("/hub/workout");
  return { workoutId: workout.id, alreadyActive: false };
}

export async function addExerciseToWorkout(
  input: z.infer<typeof addExerciseToWorkoutSchema>
) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = addExerciseToWorkoutSchema.parse(input);

  // Verify workout belongs to user
  const workout = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(
      and(eq(workouts.id, validated.workoutId), eq(workouts.userId, user.id))
    )
    .then((r) => r[0]);

  if (!workout) throw new Error("Workout not found");

  // Get max sort order
  const maxOrder = await db
    .select({ max: sql<number>`coalesce(max(${workoutExercises.sortOrder}), -1)` })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, validated.workoutId))
    .then((r) => r[0]?.max ?? -1);

  const [we] = await db
    .insert(workoutExercises)
    .values({
      workoutId: validated.workoutId,
      exerciseId: validated.exerciseId,
      sortOrder: validated.sortOrder ?? maxOrder + 1,
    })
    .returning({ id: workoutExercises.id });

  // Create one empty set by default
  await db.insert(workoutSets).values({
    workoutExerciseId: we.id,
    setNumber: 1,
  });

  revalidatePath("/hub/workout");
  return { workoutExerciseId: we.id };
}

export async function removeExerciseFromWorkout(
  input: z.infer<typeof removeExerciseFromWorkoutSchema>
) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = removeExerciseFromWorkoutSchema.parse(input);

  // Verify ownership via join
  const we = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(
      and(
        eq(workoutExercises.id, validated.workoutExerciseId),
        eq(workouts.userId, user.id)
      )
    )
    .then((r) => r[0]);

  if (!we) throw new Error("Exercise not found");

  await db
    .delete(workoutExercises)
    .where(eq(workoutExercises.id, validated.workoutExerciseId));

  revalidatePath("/hub/workout");
  return { success: true };
}

export async function logSet(input: z.infer<typeof logSetSchema>) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = logSetSchema.parse(input);

  // Verify ownership
  const we = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(
      and(
        eq(workoutExercises.id, validated.workoutExerciseId),
        eq(workouts.userId, user.id)
      )
    )
    .then((r) => r[0]);

  if (!we) throw new Error("Exercise not found");

  // Upsert: update if same set number exists, insert otherwise
  const existing = await db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.workoutExerciseId, validated.workoutExerciseId),
        eq(workoutSets.setNumber, validated.setNumber)
      )
    )
    .then((r) => r[0]);

  if (existing) {
    await db
      .update(workoutSets)
      .set({
        weightKg: validated.weightKg != null ? String(validated.weightKg) : null,
        reps: validated.reps,
        durationSec: validated.durationSec,
        rpe: validated.rpe != null ? String(validated.rpe) : null,
        isWarmup: validated.isWarmup ?? false,
        isDropset: validated.isDropset ?? false,
        completedAt: new Date(),
      })
      .where(eq(workoutSets.id, existing.id));
  } else {
    await db.insert(workoutSets).values({
      workoutExerciseId: validated.workoutExerciseId,
      setNumber: validated.setNumber,
      weightKg: validated.weightKg != null ? String(validated.weightKg) : null,
      reps: validated.reps,
      durationSec: validated.durationSec,
      rpe: validated.rpe != null ? String(validated.rpe) : null,
      isWarmup: validated.isWarmup ?? false,
      isDropset: validated.isDropset ?? false,
      completedAt: new Date(),
    });
  }

  revalidatePath("/hub/workout");
  return { success: true };
}

export async function removeSet(input: z.infer<typeof removeSetSchema>) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = removeSetSchema.parse(input);

  // Verify ownership
  const set = await db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .innerJoin(
      workoutExercises,
      eq(workoutSets.workoutExerciseId, workoutExercises.id)
    )
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(
      and(eq(workoutSets.id, validated.setId), eq(workouts.userId, user.id))
    )
    .then((r) => r[0]);

  if (!set) throw new Error("Set not found");

  await db.delete(workoutSets).where(eq(workoutSets.id, validated.setId));

  revalidatePath("/hub/workout");
  return { success: true };
}

export async function finishWorkout(
  input: z.infer<typeof finishWorkoutSchema>
) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = finishWorkoutSchema.parse(input);

  const workout = await db
    .select({ id: workouts.id, startedAt: workouts.startedAt })
    .from(workouts)
    .where(
      and(eq(workouts.id, validated.workoutId), eq(workouts.userId, user.id))
    )
    .then((r) => r[0]);

  if (!workout) throw new Error("Workout not found");

  const now = new Date();
  const durationSec = Math.floor(
    (now.getTime() - workout.startedAt.getTime()) / 1000
  );

  await db
    .update(workouts)
    .set({ completedAt: now, durationSec })
    .where(eq(workouts.id, validated.workoutId));

  // PR detection
  await detectPersonalRecords(user.id, validated.workoutId);

  revalidatePath("/hub/workout");
  return { success: true, durationSec };
}

export async function discardWorkout(
  input: z.infer<typeof discardWorkoutSchema>
) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = discardWorkoutSchema.parse(input);

  await db
    .delete(workouts)
    .where(
      and(eq(workouts.id, validated.workoutId), eq(workouts.userId, user.id))
    );

  revalidatePath("/hub/workout");
  return { success: true };
}

// Template actions
export async function createWorkoutTemplate(
  input: z.infer<typeof createWorkoutTemplateSchema>
) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = createWorkoutTemplateSchema.parse(input);

  const [template] = await db
    .insert(workoutTemplates)
    .values({
      userId: user.id,
      name: validated.name,
      description: validated.description,
    })
    .returning({ id: workoutTemplates.id });

  for (let i = 0; i < validated.exercises.length; i++) {
    const ex = validated.exercises[i];
    await db.insert(workoutTemplateExercises).values({
      templateId: template.id,
      exerciseId: ex.exerciseId,
      sortOrder: i,
      defaultSets: ex.defaultSets ?? 3,
      defaultReps: ex.defaultReps,
      defaultWeightKg: ex.defaultWeightKg != null ? String(ex.defaultWeightKg) : null,
    });
  }

  revalidatePath("/hub/workout");
  return { templateId: template.id };
}

export async function saveWorkoutAsTemplate(
  input: z.infer<typeof saveWorkoutAsTemplateSchema>
) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = saveWorkoutAsTemplateSchema.parse(input);

  // Get workout exercises with their sets
  const wExercises = await db
    .select({
      exerciseId: workoutExercises.exerciseId,
      sortOrder: workoutExercises.sortOrder,
      weId: workoutExercises.id,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(
      and(
        eq(workoutExercises.workoutId, validated.workoutId),
        eq(workouts.userId, user.id)
      )
    )
    .orderBy(workoutExercises.sortOrder);

  const [template] = await db
    .insert(workoutTemplates)
    .values({
      userId: user.id,
      name: validated.name,
    })
    .returning({ id: workoutTemplates.id });

  for (const we of wExercises) {
    // Get the sets for this exercise to use as defaults
    const sets = await db
      .select({ weightKg: workoutSets.weightKg, reps: workoutSets.reps })
      .from(workoutSets)
      .where(eq(workoutSets.workoutExerciseId, we.weId));

    const setCount = sets.length || 3;
    // Use the last set's weight/reps as defaults
    const lastSet = sets[sets.length - 1];

    await db.insert(workoutTemplateExercises).values({
      templateId: template.id,
      exerciseId: we.exerciseId,
      sortOrder: we.sortOrder,
      defaultSets: setCount,
      defaultReps: lastSet?.reps,
      defaultWeightKg: lastSet?.weightKg,
    });
  }

  revalidatePath("/hub/workout");
  return { templateId: template.id };
}

export async function deleteWorkoutTemplate(
  input: z.infer<typeof deleteWorkoutTemplateSchema>
) {
  const user = await getSession();
  await assertProAccess(user.id);
  const validated = deleteWorkoutTemplateSchema.parse(input);

  await db
    .delete(workoutTemplates)
    .where(
      and(
        eq(workoutTemplates.id, validated.templateId),
        eq(workoutTemplates.userId, user.id)
      )
    );

  revalidatePath("/hub/workout");
  return { success: true };
}

// PR detection helper
async function detectPersonalRecords(userId: string, workoutId: string) {
  // Get all exercises with their completed sets for this workout
  const exerciseSets = await db
    .select({
      exerciseId: workoutExercises.exerciseId,
      setId: workoutSets.id,
      weightKg: workoutSets.weightKg,
      reps: workoutSets.reps,
      isWarmup: workoutSets.isWarmup,
    })
    .from(workoutSets)
    .innerJoin(
      workoutExercises,
      eq(workoutSets.workoutExerciseId, workoutExercises.id)
    )
    .where(eq(workoutExercises.workoutId, workoutId));

  // Group by exercise
  const byExercise = new Map<
    string,
    Array<{ setId: string; weightKg: number; reps: number }>
  >();

  for (const s of exerciseSets) {
    if (s.isWarmup) continue;
    if (!s.weightKg || !s.reps) continue;

    const key = s.exerciseId;
    if (!byExercise.has(key)) byExercise.set(key, []);
    byExercise.get(key)!.push({
      setId: s.setId,
      weightKg: Number(s.weightKg),
      reps: s.reps,
    });
  }

  for (const [exerciseId, sets] of byExercise) {
    // Max weight
    const maxWeightSet = sets.reduce((best, s) =>
      s.weightKg > best.weightKg ? s : best
    );

    // Estimated 1RM (Epley formula)
    let best1rm = { value: 0, setId: "" };
    for (const s of sets) {
      const e1rm = s.reps === 1 ? s.weightKg : s.weightKg * (1 + s.reps / 30);
      if (e1rm > best1rm.value) {
        best1rm = { value: e1rm, setId: s.setId };
      }
    }

    // Total volume
    const totalVolume = sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);

    // Max reps at any weight
    const maxRepsSet = sets.reduce((best, s) =>
      s.reps > best.reps ? s : best
    );

    // Check and upsert PRs
    const prChecks = [
      { type: "weight", value: maxWeightSet.weightKg, setId: maxWeightSet.setId },
      { type: "1rm", value: best1rm.value, setId: best1rm.setId },
      { type: "volume", value: totalVolume, setId: maxWeightSet.setId },
      { type: "reps", value: maxRepsSet.reps, setId: maxRepsSet.setId },
    ];

    for (const pr of prChecks) {
      if (pr.value <= 0) continue;

      const existing = await db
        .select({ value: personalRecords.value })
        .from(personalRecords)
        .where(
          and(
            eq(personalRecords.userId, userId),
            eq(personalRecords.exerciseId, exerciseId),
            eq(personalRecords.type, pr.type)
          )
        )
        .then((r) => r[0]);

      if (!existing || Number(existing.value) < pr.value) {
        await db
          .insert(personalRecords)
          .values({
            userId,
            exerciseId,
            type: pr.type,
            value: String(pr.value),
            workoutSetId: pr.setId,
            achievedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              personalRecords.userId,
              personalRecords.exerciseId,
              personalRecords.type,
            ],
            set: {
              value: String(pr.value),
              workoutSetId: pr.setId,
              achievedAt: new Date(),
            },
          });

        // Mark the set as PR
        await db
          .update(workoutSets)
          .set({ isPersonalRecord: true })
          .where(eq(workoutSets.id, pr.setId));
      }
    }
  }
}
