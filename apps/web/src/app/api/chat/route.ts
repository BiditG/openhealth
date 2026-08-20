import { streamText, tool, convertToModelMessages, stepCountIs } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { minimax } from "vercel-minimax-ai-provider";
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  diaryEntries,
  foods,
  foodNutrients,
  userGoals,
  chatSessions,
  chatMessages,
  weightLogs,
  waterLogs,
  waterGoals,
  exerciseLogs,
  exercises,
  workouts,
  workoutExercises,
  workoutSets,
  userProfiles,
} from "@/server/db/schema";
import { and, eq, ilike, desc, sql, gte } from "drizzle-orm";
import { getNepalDate } from "@/lib/date";
import { users } from "@/server/db/schema";
import {
  resolveEffectivePlan,
  checkAndIncrementAiUsage,
} from "@/server/services/plan";
import { estimateNutritionFromText } from "@/server/services/ai";
import { calculateNutrition } from "@/server/services/nutrition";
import { NUTRIENT_IDS } from "@open-health/shared/constants";

function getOllamaOpenAIBaseUrl() {
  const rawBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const baseUrl = rawBaseUrl.replace(/\/$/, "");
  if (baseUrl.endsWith("/v1")) return baseUrl;
  if (baseUrl.endsWith("/api")) return `${baseUrl.slice(0, -4)}/v1`;
  return `${baseUrl}/v1`;
}

const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: getOllamaOpenAIBaseUrl(),
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
});

function getCoachModel() {
  if (process.env.AI_PROVIDER === "minimax") {
    return minimax("MiniMax-M2.7");
  }
  return ollama.chatModel(process.env.OLLAMA_MODEL ?? "gpt-oss:20b");
}

function getAge(dateOfBirth: string | Date | null | undefined) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function inferMealType() {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    hour12: false,
  }).format(new Date()));

  if (hour < 10) return "breakfast" as const;
  if (hour < 15) return "lunch" as const;
  if (hour < 20) return "dinner" as const;
  return "snack" as const;
}

async function getCurrentAiContext(userId: string) {
  const today = getNepalDate();

  const [
    user,
    profile,
    goals,
    diaryRows,
    weight,
    waterRows,
    waterGoal,
    exerciseRows,
  ] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, email: true, timezone: true, unitSystem: true },
    }),
    db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) }),
    db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId) }),
    db
      .select({
        mealType: diaryEntries.mealType,
        foodName: foods.name,
        calories: diaryEntries.calories,
        proteinG: diaryEntries.proteinG,
        carbsG: diaryEntries.carbsG,
        fatG: diaryEntries.fatG,
        fiberG: diaryEntries.fiberG,
      })
      .from(diaryEntries)
      .innerJoin(foods, eq(diaryEntries.foodId, foods.id))
      .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, today)))
      .orderBy(diaryEntries.mealType, diaryEntries.sortOrder),
    db.query.weightLogs.findFirst({
      where: and(eq(weightLogs.userId, userId), eq(weightLogs.date, today)),
    }),
    db
      .select({ amountMl: waterLogs.amountMl })
      .from(waterLogs)
      .where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, today))),
    db.query.waterGoals.findFirst({ where: eq(waterGoals.userId, userId) }),
    db
      .select({
        exerciseName: exercises.name,
        durationMin: exerciseLogs.durationMin,
        caloriesBurned: exerciseLogs.caloriesBurned,
      })
      .from(exerciseLogs)
      .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
      .where(and(eq(exerciseLogs.userId, userId), eq(exerciseLogs.date, today))),
  ]);

  const totals = diaryRows.reduce(
    (acc, row) => ({
      calories: acc.calories + Number(row.calories || 0),
      proteinG: acc.proteinG + Number(row.proteinG || 0),
      carbsG: acc.carbsG + Number(row.carbsG || 0),
      fatG: acc.fatG + Number(row.fatG || 0),
      fiberG: acc.fiberG + Number(row.fiberG || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );
  const waterTotalMl = waterRows.reduce((sum, row) => sum + row.amountMl, 0);
  const exerciseCalories = exerciseRows.reduce((sum, row) => sum + Number(row.caloriesBurned || 0), 0);
  const calorieTarget = goals?.calorieTarget ?? null;
  const netCalories = Math.max(0, Math.round(totals.calories - exerciseCalories));

  return {
    today,
    user: {
      name: user?.name ?? null,
      email: user?.email ?? null,
      timezone: user?.timezone ?? "Asia/Kathmandu",
      unitSystem: user?.unitSystem ?? "metric",
    },
    profile: profile
      ? {
          age: getAge(profile.dateOfBirth),
          sex: profile.sex,
          heightCm: profile.heightCm ? Number(profile.heightCm) : null,
          currentWeightKg: profile.currentWeightKg ? Number(profile.currentWeightKg) : null,
          todayWeightKg: weight?.weightKg ? Number(weight.weightKg) : null,
          activityLevel: profile.activityLevel,
          primaryGoal: profile.primaryGoal,
          dietaryPreference: profile.dietaryPreference,
          medicalConditions: profile.medicalConditions ?? [],
          medications: profile.medications,
          allergies: profile.allergies,
        }
      : null,
    goals: goals
      ? {
          goalType: goals.goalType,
          calorieTarget,
          targetWeightKg: goals.targetWeightKg ? Number(goals.targetWeightKg) : null,
          proteinG: goals.proteinG ? Number(goals.proteinG) : null,
          carbsG: goals.carbsG ? Number(goals.carbsG) : null,
          fatG: goals.fatG ? Number(goals.fatG) : null,
          fiberG: goals.fiberG ? Number(goals.fiberG) : null,
        }
      : null,
    todaySummary: {
      caloriesIn: Math.round(totals.calories),
      exerciseCalories,
      netCalories,
      calorieTarget,
      calorieBalance: calorieTarget == null ? null : netCalories - calorieTarget,
      proteinG: Math.round(totals.proteinG),
      carbsG: Math.round(totals.carbsG),
      fatG: Math.round(totals.fatG),
      fiberG: Math.round(totals.fiberG),
      waterMl: waterTotalMl,
      waterTargetMl: waterGoal?.dailyTargetMl ?? 2500,
      mealCount: diaryRows.length,
      meals: diaryRows.slice(0, 8).map((row) => ({
        mealType: row.mealType,
        foodName: row.foodName,
        calories: Math.round(Number(row.calories || 0)),
      })),
      exercises: exerciseRows.map((row) => ({
        name: row.exerciseName,
        durationMin: row.durationMin,
        caloriesBurned: Number(row.caloriesBurned || 0),
      })),
    },
  };
}

export async function POST(req: Request) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const { messages: uiMessages, sessionId } = await req.json();

  // Resolve user plan
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

  // Daily limit check via ai_usage
  const usage = await checkAndIncrementAiUsage(userId, "chat", plan);
  if (!usage.allowed) {
    return Response.json(
      { error: `Daily message limit reached (${usage.limit} messages)` },
      { status: 429 }
    );
  }

  // Extract last user message for saving
  const lastUserMsg = [...uiMessages]
    .reverse()
    .find((m: { role: string }) => m.role === "user");

  const userMsgText =
    lastUserMsg?.content ||
    lastUserMsg?.parts
      ?.filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("") ||
    "";

  // Get or create session (fallback if client didn't pre-create)
  let chatSessionId: string = sessionId;
  if (!chatSessionId) {
    const title = userMsgText.slice(0, 50) || "New conversation";
    const [newSession] = await db
      .insert(chatSessions)
      .values({ userId, title })
      .returning({ id: chatSessions.id });
    chatSessionId = newSession.id;
  }

  // Save user message to DB
  if (lastUserMsg && userMsgText) {
    await db.insert(chatMessages).values({
      sessionId: chatSessionId,
      userId,
      role: "user",
      content: userMsgText,
      parts: lastUserMsg.parts ?? null,
    });
  }

  const messages = await convertToModelMessages(uiMessages);
  const currentContext = await getCurrentAiContext(userId);

  const result = streamText({
    model: getCoachModel(),
    system: `You are Swastha's educational health and wellness assistant for users in Nepal. Your role is to explain health, food, nutrition, and wellness concepts simply and help users understand their own tracking data when available.

Current user context snapshot:
${JSON.stringify(currentContext, null, 2)}

Rules:
1. Respond in English by default. If the user writes in Nepali Unicode or Romanized Nepali, respond naturally in the same style when appropriate.
2. Be concise, warm, practical, and non-judgmental.
3. This is educational wellness support, not diagnosis, emergency care, prescriptions, or medication-change advice.
4. Never claim certainty about a user's medical condition. Encourage a qualified health professional when appropriate.
5. If the user mentions urgent symptoms such as chest pain, difficulty breathing, stroke symptoms, loss of consciousness, severe bleeding, or self-harm, advise urgent professional help instead of treating it like a normal wellness question.
6. Use the current context snapshot for personalization. If the user asks about today's calories, macros, water, weight, exercise, goals, or current status, use getCurrentHealthContext when the snapshot may be stale.
7. For personalized nutrition, training, allergy, diet preference, or medical-context answers, use the profile context and call getHealthProfile if more detail is needed.
8. Prefer Nepal and South Asian food examples such as dal bhat, tarkari, momo, dhido, gundruk, chiura, sel roti, thukpa, aloo tama, sukuti, and milk tea.
9. Use markdown for readability.
10. Today's date is ${getNepalDate()}, current local time is approximately ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit", hour12: false })}.
11. Act like a professional nutritionist: practical, evidence-aware, portion-focused, culturally relevant, and clear about uncertainty.
12. When a user asks calories/macros for a food or asks to log/add food, use createFood. This returns an estimate card with an Add to diary button in the chat UI. Infer meal type from context or current time unless the user specifies it.
13. When a user asks to log weight, use logWeight.
14. When a user asks to log water, use logWater. Common guesses: one glass 250ml, one bottle 600ml, large glass 500ml.
15. When giving nutrition or health guidance, include a short "Sources:" line with general sources such as WHO, USDA FoodData Central, or national public-health guidance where relevant.
16. Remind users that nutrition values are estimates and may vary by portion size and preparation.`,
    messages,
    tools: {
      getCurrentHealthContext: tool({
        description:
          "Fetch the latest user profile, goals, today's calories/macros, weight, water, exercise burn, net calories, and calorie balance for Hub/Progress personalization.",
        inputSchema: z.object({}),
        execute: async () => {
          try {
            return await getCurrentAiContext(userId);
          } catch {
            return { error: "Could not fetch current health context." };
          }
        },
      }),
      getHealthProfile: tool({
        description:
          "Fetch the user's health profile for personalization, including age inputs, sex, height, weight, medical notes, allergies, activity level, and goals.",
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const profile = await db.query.userProfiles.findFirst({
              where: eq(userProfiles.userId, userId),
            });
            const goals = await db.query.userGoals.findFirst({
              where: eq(userGoals.userId, userId),
            });

            if (!profile && !goals) {
              return { message: "The user has not completed a health profile yet." };
            }

            return {
              profile: profile
                ? {
                    dateOfBirth: profile.dateOfBirth,
                    sex: profile.sex,
                    heightCm: profile.heightCm ? Number(profile.heightCm) : null,
                    currentWeightKg: profile.currentWeightKg ? Number(profile.currentWeightKg) : null,
                    activityLevel: profile.activityLevel,
                    primaryGoal: profile.primaryGoal,
                    dietaryPreference: profile.dietaryPreference,
                    medicalConditions: profile.medicalConditions ?? [],
                    medications: profile.medications,
                    allergies: profile.allergies,
                  }
                : null,
              goals: goals
                ? {
                    goalType: goals.goalType,
                    targetWeightKg: goals.targetWeightKg ? Number(goals.targetWeightKg) : null,
                    weeklyRateKg: goals.weeklyRateKg ? Number(goals.weeklyRateKg) : null,
                    calorieTarget: goals.calorieTarget,
                    proteinG: goals.proteinG ? Number(goals.proteinG) : null,
                    carbsG: goals.carbsG ? Number(goals.carbsG) : null,
                    fatG: goals.fatG ? Number(goals.fatG) : null,
                    fiberG: goals.fiberG ? Number(goals.fiberG) : null,
                  }
                : null,
            };
          } catch {
            return { error: "Could not fetch health profile." };
          }
        },
      }),
      getDailyFood: tool({
        description:
          "Fetch the user's food diary for a specific date, including meals and nutrient totals.",
        inputSchema: z.object({
          date: z
            .string()
            .describe("Date to query in YYYY-MM-DD format, for example 2025-01-15"),
        }),
        execute: async ({ date }) => {
          try {
            const entries = await db
              .select({
                mealType: diaryEntries.mealType,
                calories: diaryEntries.calories,
                proteinG: diaryEntries.proteinG,
                carbsG: diaryEntries.carbsG,
                fatG: diaryEntries.fatG,
                fiberG: diaryEntries.fiberG,
                servingQty: diaryEntries.servingQty,
                foodName: foods.name,
                foodBrand: foods.brand,
              })
              .from(diaryEntries)
              .innerJoin(foods, eq(diaryEntries.foodId, foods.id))
              .where(
                and(
                  eq(diaryEntries.userId, userId),
                  eq(diaryEntries.date, date)
                )
              )
              .orderBy(diaryEntries.mealType, diaryEntries.sortOrder);

            const totals = entries.reduce(
              (acc, e) => ({
                calories: acc.calories + Number(e.calories || 0),
                protein: acc.protein + Number(e.proteinG || 0),
                carbs: acc.carbs + Number(e.carbsG || 0),
                fat: acc.fat + Number(e.fatG || 0),
                fiber: acc.fiber + Number(e.fiberG || 0),
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
            );

            return { date, entries, totals };
          } catch {
            return { error: "Could not fetch food diary. Please try again later." };
          }
        },
      }),
      getUserGoals: tool({
        description: "Fetch the user's nutrition goals, including calories and macro targets.",
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const goals = await db.query.userGoals.findFirst({
              where: eq(userGoals.userId, userId),
            });
            return goals ?? { message: "The user has not set nutrition goals yet." };
          } catch {
            return { error: "Could not fetch nutrition goals. Please try again later." };
          }
        },
      }),
      createFood: tool({
        description:
          "Estimate calories and nutrition from a user's food description, create a draft food record, and return an add-to-diary action card. Use when the user asks calories/macros for a food or asks to log/add food.",
        inputSchema: z.object({
          description: z
            .string()
            .describe(
              "User food description with name and portion, for example: one plate dal bhat tarkari or 2 plates momo"
            ),
          mealType: z
            .enum(["breakfast", "lunch", "dinner", "snack"])
            .optional()
            .describe("Meal type, inferred from conversation context or current time"),
          date: z
            .string()
            .optional()
            .describe("Date in YYYY-MM-DD format. Defaults to today."),
        }),
        execute: async ({ description, mealType: mealTypeInput, date: dateInput }) => {
          const mealType = mealTypeInput ?? inferMealType();
          const date = dateInput ?? getNepalDate();
          try {
            const estimation = await estimateNutritionFromText(description);
            if (!estimation.success) {
              return { error: estimation.error };
            }

            const data = estimation.data;

            // Search for existing food with same name created by this user
            const existingFood = await db.query.foods.findFirst({
              where: and(
                ilike(foods.name, data.foodName),
                eq(foods.source, "user"),
                eq(foods.createdBy, userId),
              ),
            });

            let foodId: string;

            if (existingFood) {
              // Reuse existing food record — return its stored nutrition data
              const nutrition = await calculateNutrition(existingFood.id, 1);
              return {
                foodId: existingFood.id,
                foodName: existingFood.name,
                calories: nutrition.calories,
                proteinG: nutrition.proteinG,
                fatG: nutrition.fatG,
                carbsG: nutrition.carbsG,
                fiberG: nutrition.fiberG,
                servingSize: Number(existingFood.servingSize),
                servingUnit: existingFood.servingUnit,
                mealType,
                date,
              };
            } else {
              // Create new food in DB
              const [food] = await db
                .insert(foods)
                .values({
                  name: data.foodName,
                  brand: data.brand ?? undefined,
                  source: "user",
                  servingSize: String(data.servingSize),
                  servingUnit: data.servingUnit,
                  calories: String(data.calories),
                  description: data.notes ?? undefined,
                  isPublic: true,
                  createdBy: userId,
                })
                .returning();
              foodId = food.id;

              // Insert nutrients only for new foods
              const nutrientValues: { foodId: string; nutrientId: number; amount: string }[] = [];
              const addNutrient = (id: number, val: number | null | undefined) => {
                if (val != null && !isNaN(val)) nutrientValues.push({ foodId, nutrientId: id, amount: String(val) });
              };
              addNutrient(NUTRIENT_IDS.protein, data.proteinG);
              addNutrient(NUTRIENT_IDS.totalFat, data.fatG);
              addNutrient(NUTRIENT_IDS.totalCarbs, data.carbsG);
              addNutrient(NUTRIENT_IDS.fiber, data.fiberG);
              addNutrient(NUTRIENT_IDS.sugar, data.sugarG);
              addNutrient(NUTRIENT_IDS.saturatedFat, data.saturatedFatG);
              addNutrient(NUTRIENT_IDS.transFat, data.transFatG);
              addNutrient(NUTRIENT_IDS.cholesterol, data.cholesterolMg);
              addNutrient(NUTRIENT_IDS.sodium, data.sodiumMg);
              addNutrient(NUTRIENT_IDS.calcium, data.calciumMg);
              addNutrient(NUTRIENT_IDS.iron, data.ironMg);
              addNutrient(NUTRIENT_IDS.potassium, data.potassiumMg);
              addNutrient(NUTRIENT_IDS.vitaminA, data.vitaminAMcg);
              addNutrient(NUTRIENT_IDS.vitaminC, data.vitaminCMg);
              addNutrient(NUTRIENT_IDS.vitaminD, data.vitaminDMcg);

              if (nutrientValues.length > 0) {
                await db.insert(foodNutrients).values(nutrientValues);
              }
            }

            return {
              foodId,
              foodName: data.foodName,
              calories: data.calories,
              proteinG: data.proteinG,
              fatG: data.fatG,
              carbsG: data.carbsG,
              fiberG: data.fiberG ?? 0,
              servingSize: data.servingSize,
              servingUnit: data.servingUnit,
              mealType,
              date,
            };
          } catch (error) {
            console.error("createFood tool error:", error);
            return { error: "Could not create the food record. Please try again later." };
          }
        },
      }),
      // ── Weight tools ──
      getWeightHistory: tool({
        description:
          "Fetch the user's weight history, including recent trend data.",
        inputSchema: z.object({
          days: z
            .number()
            .optional()
            .describe("Number of recent days to query. Defaults to 30 days."),
        }),
        execute: async ({ days = 30 }) => {
          try {
            const since = new Date();
            since.setDate(since.getDate() - days);
            const sinceStr = since.toISOString().split("T")[0];

            const logs = await db
              .select({
                date: weightLogs.date,
                weightKg: weightLogs.weightKg,
                note: weightLogs.note,
              })
              .from(weightLogs)
              .where(
                and(
                  eq(weightLogs.userId, userId),
                  gte(weightLogs.date, sinceStr)
                )
              )
              .orderBy(desc(weightLogs.date));

            if (logs.length === 0) {
              return { message: "The user has no weight logs in this period." };
            }

            const latest = Number(logs[0].weightKg);
            const oldest = Number(logs[logs.length - 1].weightKg);
            const change = latest - oldest;

            return {
              logs: logs.map((l) => ({
                date: l.date,
                weightKg: Number(l.weightKg),
                note: l.note,
              })),
              summary: {
                latest,
                oldest,
                change: Math.round(change * 100) / 100,
                count: logs.length,
              },
            };
          } catch {
            return { error: "Could not fetch weight history." };
          }
        },
      }),
      logWeight: tool({
        description:
          "Log the user's weight. Use when the user mentions a body weight value or asks to record weight.",
        inputSchema: z.object({
          weightKg: z.number().min(20).max(300).describe("Weight in kilograms"),
          date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
          note: z.string().optional().describe("Optional note"),
        }),
        execute: async ({ weightKg, date: dateInput, note }) => {
          const date = dateInput ?? getNepalDate();
          try {
            await db
              .insert(weightLogs)
              .values({
                userId,
                date,
                weightKg: String(weightKg),
                note: note ?? null,
              })
              .onConflictDoUpdate({
                target: [weightLogs.userId, weightLogs.date],
                set: {
                  weightKg: String(weightKg),
                  note: note ?? null,
                },
              });
            return { success: true, weightKg, date, note };
          } catch {
            return { error: "Could not log weight." };
          }
        },
      }),

      // ── Water tools ──
      getWaterIntake: tool({
        description:
          "Fetch the user's water intake and target for a specific date.",
        inputSchema: z.object({
          date: z
            .string()
            .optional()
            .describe("Date to query in YYYY-MM-DD format. Defaults to today."),
        }),
        execute: async ({ date: dateInput } = {}) => {
          const date = dateInput ?? getNepalDate();
          try {
            const logs = await db
              .select({
                amountMl: waterLogs.amountMl,
                loggedAt: waterLogs.loggedAt,
              })
              .from(waterLogs)
              .where(
                and(
                  eq(waterLogs.userId, userId),
                  eq(waterLogs.date, date)
                )
              )
              .orderBy(desc(waterLogs.loggedAt));

            const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);

            const goal = await db.query.waterGoals.findFirst({
              where: eq(waterGoals.userId, userId),
            });
            const targetMl = goal?.dailyTargetMl ?? 2500;

            return {
              date,
              totalMl,
              targetMl,
              percentage: Math.round((totalMl / targetMl) * 100),
              logCount: logs.length,
            };
          } catch {
            return { error: "Could not fetch water intake." };
          }
        },
      }),
      logWater: tool({
        description:
          "Log the user's water intake. Use when the user mentions drinking water or asks to record hydration.",
        inputSchema: z.object({
          amountMl: z.number().min(1).max(5000).describe("Water amount in milliliters"),
          date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
        }),
        execute: async ({ amountMl, date: dateInput }) => {
          const date = dateInput ?? getNepalDate();
          try {
            await db.insert(waterLogs).values({
              userId,
              date,
              amountMl,
            });

            // Return updated total for the day
            const [result] = await db
              .select({
                totalMl: sql<number>`coalesce(sum(${waterLogs.amountMl}), 0)`,
              })
              .from(waterLogs)
              .where(
                and(
                  eq(waterLogs.userId, userId),
                  eq(waterLogs.date, date)
                )
              );

            const goal = await db.query.waterGoals.findFirst({
              where: eq(waterGoals.userId, userId),
            });
            const targetMl = goal?.dailyTargetMl ?? 2500;

            return {
              success: true,
              amountMl,
              date,
              totalMl: Number(result.totalMl),
              targetMl,
            };
          } catch {
            return { error: "Could not log water intake." };
          }
        },
      }),

      // ── Exercise tools ──
      getExerciseLogs: tool({
        description:
          "Fetch the user's cardio exercise logs for a specific date.",
        inputSchema: z.object({
          date: z
            .string()
            .optional()
            .describe("Date to query in YYYY-MM-DD format. Defaults to today."),
        }),
        execute: async ({ date: dateInput } = {}) => {
          const date = dateInput ?? getNepalDate();
          try {
            const logs = await db
              .select({
                exerciseName: exercises.name,
                category: exercises.category,
                durationMin: exerciseLogs.durationMin,
                caloriesBurned: exerciseLogs.caloriesBurned,
                intensity: exerciseLogs.intensity,
                note: exerciseLogs.note,
              })
              .from(exerciseLogs)
              .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
              .where(
                and(
                  eq(exerciseLogs.userId, userId),
                  eq(exerciseLogs.date, date)
                )
              );

            const totalCalories = logs.reduce(
              (sum, l) => sum + Number(l.caloriesBurned || 0),
              0
            );
            const totalMinutes = logs.reduce(
              (sum, l) => sum + Number(l.durationMin || 0),
              0
            );

            return {
              date,
              logs: logs.map((l) => ({
                ...l,
                caloriesBurned: Number(l.caloriesBurned || 0),
              })),
              summary: { totalCalories, totalMinutes, count: logs.length },
            };
          } catch {
            return { error: "Could not fetch exercise logs." };
          }
        },
      }),

      // ── Workout (strength training) tools ──
      getWorkoutHistory: tool({
        description:
          "Fetch the user's recent strength-training history, including exercises, sets, weight, and reps.",
        inputSchema: z.object({
          limit: z
            .number()
            .optional()
            .describe("Number of recent workouts to query. Defaults to 5."),
        }),
        execute: async ({ limit = 5 }) => {
          try {
            const recentWorkouts = await db
              .select({
                id: workouts.id,
                name: workouts.name,
                startedAt: workouts.startedAt,
                completedAt: workouts.completedAt,
                durationSec: workouts.durationSec,
                note: workouts.note,
              })
              .from(workouts)
              .where(
                and(
                  eq(workouts.userId, userId),
                  sql`${workouts.completedAt} IS NOT NULL`
                )
              )
              .orderBy(desc(workouts.startedAt))
              .limit(limit);

            if (recentWorkouts.length === 0) {
              return { message: "The user has no strength-training history." };
            }

            const results = [];
            for (const w of recentWorkouts) {
              const wExercises = await db
                .select({
                  weId: workoutExercises.id,
                  exerciseName: exercises.name,
                })
                .from(workoutExercises)
                .innerJoin(
                  exercises,
                  eq(workoutExercises.exerciseId, exercises.id)
                )
                .where(eq(workoutExercises.workoutId, w.id))
                .orderBy(workoutExercises.sortOrder);

              const exerciseDetails = [];
              for (const we of wExercises) {
                const sets = await db
                  .select({
                    setNumber: workoutSets.setNumber,
                    weightKg: workoutSets.weightKg,
                    reps: workoutSets.reps,
                    isWarmup: workoutSets.isWarmup,
                  })
                  .from(workoutSets)
                  .where(eq(workoutSets.workoutExerciseId, we.weId))
                  .orderBy(workoutSets.setNumber);

                exerciseDetails.push({
                  name: we.exerciseName,
                  sets: sets.map((s) => ({
                    set: s.setNumber,
                    weightKg: s.weightKg ? Number(s.weightKg) : null,
                    reps: s.reps,
                    isWarmup: s.isWarmup,
                  })),
                });
              }

              results.push({
                name: w.name,
                date: w.startedAt?.toISOString().split("T")[0],
                durationMin: w.durationSec
                  ? Math.round(w.durationSec / 60)
                  : null,
                exercises: exerciseDetails,
              });
            }

            return { workouts: results };
          } catch {
            return { error: "Could not fetch strength-training history." };
          }
        },
      }),
    },
    stopWhen: stepCountIs(3),
    onFinish: async ({ response }) => {
      // Save assistant messages to DB (including tool call parts)
      const assistantMessages = response.messages.filter(
        (m) => m.role === "assistant"
      );

      for (const msg of assistantMessages) {
        const contentParts =
          typeof msg.content === "string"
            ? [{ type: "text" as const, text: msg.content }]
            : msg.content;

        const textContent = contentParts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("");

        // Build parts array for persistence (text + tool-call results)
        const uiParts: unknown[] = [];
        if (textContent) {
          uiParts.push({ type: "text", text: textContent });
        }
        for (const p of contentParts) {
          if (p.type === "tool-call") {
            // Find the corresponding tool result in the response
            const resultMsg = response.messages.find(
              (m) =>
                m.role === "tool" &&
                Array.isArray(m.content) &&
                m.content.some(
                  (c) =>
                    c.type === "tool-result" && c.toolCallId === p.toolCallId
                )
            );
            const resultPart = resultMsg
              ? (
                  resultMsg.content as unknown as Array<{
                    type: string;
                    toolCallId: string;
                    result: unknown;
                  }>
                ).find((c) => c.toolCallId === p.toolCallId)
              : undefined;

            uiParts.push({
              type: "dynamic-tool",
              toolName: p.toolName,
              toolCallId: p.toolCallId,
              state: "output-available",
              input: p.input,
              output: resultPart ? resultPart.result : undefined,
            });
          }
        }

        if (uiParts.length === 0) continue;

        await db.insert(chatMessages).values({
          sessionId: chatSessionId,
          userId,
          role: "assistant",
          content: textContent,
          parts: uiParts,
        });
      }

      // Update session updatedAt
      await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, chatSessionId));
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "x-session-id": chatSessionId,
    },
  });
}
