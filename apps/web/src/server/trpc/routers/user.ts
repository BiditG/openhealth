import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { updateGoalsSchema, updateProfileSchema } from "@open-health/shared/schemas";
import { protectedProcedure, router } from "../trpc";
import { userProfiles, userGoals, nutrientDefinitions, users, foods, weightLogs, diaryEntries } from "@/server/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { checkAndIncrementAiUsage, getAiUsage } from "@/server/services/plan";
import * as userService from "@/server/services/user-mutation";

const coachGoalSuggestionSchema = z.object({
  calorieTarget: z.number().int().min(900).max(6000),
  proteinG: z.number().min(20).max(400),
  carbsG: z.number().min(20).max(800),
  fatG: z.number().min(15).max(250),
  fiberG: z.number().min(10).max(100),
  reason: z.string().min(1).max(700),
  cautions: z.array(z.string().min(1).max(180)).max(4),
});

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gpt-oss:20b";

function getAge(dateOfBirth: string | Date | null | undefined) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function extractJsonObject(text: string) {
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

function getOllamaApiBaseUrl() {
  const baseUrl = OLLAMA_BASE_URL.replace(/\/$/, "");
  if (baseUrl.endsWith("/api")) return baseUrl;
  if (baseUrl.endsWith("/v1")) return `${baseUrl.slice(0, -3)}/api`;
  return `${baseUrl}/api`;
}

function getOllamaHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  }
  return headers;
}

function buildFallbackGoalSuggestion(context: {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  primaryGoal: string | null;
}) {
  const weightKg = context.weightKg ?? 70;
  const heightCm = context.heightCm ?? 170;
  const age = context.age ?? 30;
  const sexOffset = context.sex === "female" ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const activityMultiplier =
    context.activityLevel === "sedentary"
      ? 1.2
      : context.activityLevel === "lightly_active"
        ? 1.375
        : context.activityLevel === "very_active"
          ? 1.725
          : context.activityLevel === "extremely_active"
            ? 1.9
            : 1.55;
  const maintenance = bmr * activityMultiplier;
  const goal = context.primaryGoal ?? "general_health";
  const calorieTarget =
    goal === "weight_reduction"
      ? maintenance - 350
      : goal === "body_building"
        ? maintenance + 250
        : maintenance;
  const proteinPerKg = goal === "body_building" ? 1.8 : goal === "weight_reduction" ? 1.6 : 1.2;
  const proteinG = roundTo(weightKg * proteinPerKg, 5);
  const calories = Math.max(1200, roundTo(calorieTarget, 50));
  const fatG = roundTo(Math.max(35, (calories * 0.27) / 9), 5);
  const carbsG = roundTo(Math.max(80, (calories - proteinG * 4 - fatG * 9) / 4), 5);

  return {
    calorieTarget: calories,
    proteinG,
    carbsG,
    fatG,
    fiberG: goal === "weight_reduction" ? 32 : 28,
    reason: "Suggested from your profile, current weight, activity level, and primary goal using a standard BMR/TDEE estimate.",
    cautions: [
      "Treat this as a starting point and adjust after 2-3 weeks of weight and energy trends.",
      "Ask a qualified clinician before major diet changes if you have medical conditions.",
    ],
  };
}

function getJsonSafeProfileValue(value: unknown) {
  if (value == null) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;
  return String(value);
}

async function getOllamaCoachSuggestion(prompt: string) {
  const response = await fetch(`${getOllamaApiBaseUrl()}/chat`, {
    method: "POST",
    headers: getOllamaHeaders(),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0.2 },
      messages: [
        {
          role: "system",
          content:
            "You are FitNMove Coach. Return strict JSON only. Suggest safe, realistic daily nutrition goals for a general wellness app.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama coach suggestion failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const content = result.message?.content ?? result.response;
  if (!content) throw new Error("Ollama did not return a coach suggestion.");
  return coachGoalSuggestionSchema.parse(extractJsonObject(content));
}

export const userRouter = router({
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
        isAdmin: users.isAdmin,
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .then((rows) => rows[0]);

    return row ?? null;
  }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, ctx.user.id),
    });
    return profile ?? null;
  }),

  getGoals: protectedProcedure.query(async ({ ctx }) => {
    const goals = await ctx.db.query.userGoals.findFirst({
      where: eq(userGoals.userId, ctx.user.id),
    });
    return goals ?? null;
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      await userService.updateProfile(ctx.db, ctx.user.id, input);
      return { success: true };
    }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        profile: updateProfileSchema,
        goals: updateGoalsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await userService.updateProfile(ctx.db, ctx.user.id, {
        ...input.profile,
        onboardingCompleted: true,
      });
      await userService.updateGoals(ctx.db, ctx.user.id, input.goals);

      if (input.profile.currentWeightKg) {
        const today = new Date().toISOString().slice(0, 10);
        await ctx.db
          .insert(weightLogs)
          .values({
            userId: ctx.user.id,
            date: today,
            weightKg: String(input.profile.currentWeightKg),
            note: "Onboarding",
          })
          .onConflictDoUpdate({
            target: [weightLogs.userId, weightLogs.date],
            set: {
              weightKg: String(input.profile.currentWeightKg),
              note: "Onboarding",
            },
          });
      }

      return { success: true };
    }),

  getPlanInfo: protectedProcedure.query(async ({ ctx }) => {
    const [ocr, estimate, chat] = await Promise.all([
      getAiUsage(ctx.user.id, "ocr", ctx.userPlan),
      getAiUsage(ctx.user.id, "estimate", ctx.userPlan),
      getAiUsage(ctx.user.id, "chat", ctx.userPlan),
    ]);

    return {
      plan: ctx.userPlan,
      aiUsage: { ocr, estimate, chat },
    };
  }),

  updateGoals: protectedProcedure
    .input(updateGoalsSchema)
    .mutation(async ({ ctx, input }) => {
      await userService.updateGoals(ctx.db, ctx.user.id, input);
      return { success: true };
    }),

  getCoachGoalSuggestion: protectedProcedure.mutation(async ({ ctx }) => {
    const [profile, goals, latestWeight, recentDiary] = await Promise.all([
      ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      }),
      ctx.db.query.userGoals.findFirst({
        where: eq(userGoals.userId, ctx.user.id),
      }),
      ctx.db
        .select({
          weightKg: weightLogs.weightKg,
          date: weightLogs.date,
        })
        .from(weightLogs)
        .where(eq(weightLogs.userId, ctx.user.id))
        .orderBy(desc(weightLogs.date))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      ctx.db
        .select({
          avgCalories: sql<number>`coalesce(avg(${diaryEntries.calories}), 0)::float`,
          avgProtein: sql<number>`coalesce(avg(${diaryEntries.proteinG}), 0)::float`,
          avgCarbs: sql<number>`coalesce(avg(${diaryEntries.carbsG}), 0)::float`,
          avgFat: sql<number>`coalesce(avg(${diaryEntries.fatG}), 0)::float`,
          avgFiber: sql<number>`coalesce(avg(${diaryEntries.fiberG}), 0)::float`,
        })
        .from(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, ctx.user.id),
            gte(diaryEntries.date, new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
          )
        )
        .then((rows) => rows[0] ?? null),
    ]);

    const context = {
      age: getAge(profile?.dateOfBirth),
      sex: profile?.sex ?? null,
      heightCm: profile?.heightCm ? Number(profile.heightCm) : null,
      weightKg: latestWeight?.weightKg
        ? Number(latestWeight.weightKg)
        : profile?.currentWeightKg
          ? Number(profile.currentWeightKg)
          : null,
      activityLevel: profile?.activityLevel ?? null,
      primaryGoal: profile?.primaryGoal ?? null,
    };

    const fallbackSuggestion = coachGoalSuggestionSchema.parse(buildFallbackGoalSuggestion(context));
    const usage = await checkAndIncrementAiUsage(ctx.user.id, "chat", ctx.userPlan);
    if (!usage.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Daily AI limit reached (${usage.used}/${usage.limit}).`,
      });
    }

    try {
      const suggestion = await getOllamaCoachSuggestion(
        `Return this exact JSON shape:
{
  "calorieTarget": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "fiberG": number,
  "reason": "short explanation",
  "cautions": ["short caution"]
}

Rules:
- Use calorieTarget, proteinG, carbsG, fatG, and fiberG as daily goals.
- Keep targets realistic, non-extreme, and suitable for a general wellness app.
- Body building means controlled muscle gain or recomposition.
- Weight reduction means a moderate deficit, not crash dieting.
- General health means sustainable maintenance.
- Mention medical caution in cautions if health complications exist.

User context:
${JSON.stringify({
  profile: {
    age: context.age,
    sex: context.sex,
    heightCm: context.heightCm,
    weightKg: context.weightKg,
    activityLevel: context.activityLevel,
    primaryGoal: context.primaryGoal,
    medicalConditions: getJsonSafeProfileValue(profile?.medicalConditions),
    medications: profile?.medications ?? null,
    allergies: profile?.allergies ?? null,
    dietaryPreference: profile?.dietaryPreference ?? null,
  },
  currentGoals: goals
    ? {
        calorieTarget: goals.calorieTarget,
        proteinG: goals.proteinG,
        carbsG: goals.carbsG,
        fatG: goals.fatG,
        fiberG: goals.fiberG,
      }
    : null,
  recentDiaryAveragesPerEntry: recentDiary,
  formulaBaseline: fallbackSuggestion,
})}`
      );
      return {
        source: "ollama" as const,
        suggestion,
        currentGoals: goals ?? null,
      };
    } catch (error) {
      console.warn("Ollama coach goal suggestion failed, using formula fallback:", error);
      return {
        source: "formula" as const,
        suggestion: fallbackSuggestion,
        currentGoals: goals ?? null,
      };
    }
  }),

  getNutrientDefinitions: protectedProcedure.query(async ({ ctx }) => {
    const defs = await ctx.db
      .select({
        id: nutrientDefinitions.id,
        name: nutrientDefinitions.name,
        unit: nutrientDefinitions.unit,
        category: nutrientDefinitions.category,
        dailyValue: nutrientDefinitions.dailyValue,
        displayOrder: nutrientDefinitions.displayOrder,
      })
      .from(nutrientDefinitions)
      .orderBy(nutrientDefinitions.displayOrder, nutrientDefinitions.id);

    return defs;
  }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    // Nullify foods.createdBy (no cascade on this FK)
    await ctx.db
      .update(foods)
      .set({ createdBy: null })
      .where(eq(foods.createdBy, ctx.user.id));

    // Delete user row — cascades to all related tables
    await ctx.db.delete(users).where(eq(users.id, ctx.user.id));

    return { success: true };
  }),

  updateTrackedNutrients: protectedProcedure
    .input(z.object({ nutrientIds: z.array(z.number()).max(20) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userGoals)
        .values({
          userId: ctx.user.id,
          trackedNutrientIds: input.nutrientIds.length > 0 ? input.nutrientIds : null,
        })
        .onConflictDoUpdate({
          target: userGoals.userId,
          set: {
            trackedNutrientIds: input.nutrientIds.length > 0 ? input.nutrientIds : null,
            updatedAt: new Date(),
          },
        });

      return { success: true };
    }),
});
