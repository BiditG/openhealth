import { z } from "zod";
import { updateProfileSchema, updateGoalsSchema } from "@open-health/shared/schemas";
import { users, userProfiles, userGoals } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { db as dbType } from "@/server/db";

type Db = typeof dbType;

export async function updateProfile(
  db: Db,
  userId: string,
  input: z.infer<typeof updateProfileSchema>
) {
  // Update user name
  await db
    .update(users)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Upsert user profile
  await db
    .insert(userProfiles)
    .values({
      userId,
      sex: input.sex,
      heightCm: input.heightCm ? String(input.heightCm) : null,
      currentWeightKg: input.currentWeightKg ? String(input.currentWeightKg) : null,
      dateOfBirth: input.dateOfBirth,
      activityLevel: input.activityLevel,
      medicalConditions: input.medicalConditions ?? [],
      medications: input.medications ?? null,
      allergies: input.allergies ?? null,
      dietaryPreference: input.dietaryPreference ?? null,
      primaryGoal: input.primaryGoal ?? null,
      onboardingCompleted: input.onboardingCompleted ?? false,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        sex: input.sex,
        heightCm: input.heightCm ? String(input.heightCm) : null,
        currentWeightKg: input.currentWeightKg ? String(input.currentWeightKg) : null,
        dateOfBirth: input.dateOfBirth,
        activityLevel: input.activityLevel,
        medicalConditions: input.medicalConditions ?? [],
        medications: input.medications ?? null,
        allergies: input.allergies ?? null,
        dietaryPreference: input.dietaryPreference ?? null,
        primaryGoal: input.primaryGoal ?? null,
        onboardingCompleted: input.onboardingCompleted ?? false,
        updatedAt: new Date(),
      },
    });
}

export async function updateGoals(
  db: Db,
  userId: string,
  input: z.infer<typeof updateGoalsSchema>
) {
  const optionalGoalValues = {
    ...(input.goalType !== undefined ? { goalType: input.goalType } : {}),
    ...(input.targetWeightKg !== undefined
      ? { targetWeightKg: input.targetWeightKg != null ? String(input.targetWeightKg) : null }
      : {}),
    ...(input.weeklyRateKg !== undefined
      ? { weeklyRateKg: input.weeklyRateKg != null ? String(input.weeklyRateKg) : null }
      : {}),
  };

  await db
    .insert(userGoals)
    .values({
      userId,
      ...optionalGoalValues,
      calorieTarget: input.calorieTarget,
      proteinG: input.proteinG != null ? String(input.proteinG) : null,
      carbsG: input.carbsG != null ? String(input.carbsG) : null,
      fatG: input.fatG != null ? String(input.fatG) : null,
      fiberG: input.fiberG != null ? String(input.fiberG) : null,
    })
    .onConflictDoUpdate({
      target: userGoals.userId,
      set: {
        ...optionalGoalValues,
        calorieTarget: input.calorieTarget,
        proteinG: input.proteinG != null ? String(input.proteinG) : null,
        carbsG: input.carbsG != null ? String(input.carbsG) : null,
        fatG: input.fatG != null ? String(input.fatG) : null,
        fiberG: input.fiberG != null ? String(input.fiberG) : null,
        updatedAt: new Date(),
      },
    });
}
