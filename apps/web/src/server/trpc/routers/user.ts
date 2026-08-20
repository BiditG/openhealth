import { z } from "zod";
import { updateGoalsSchema, updateProfileSchema } from "@open-health/shared/schemas";
import { protectedProcedure, router } from "../trpc";
import { userProfiles, userGoals, nutrientDefinitions, users, foods, weightLogs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getAiUsage } from "@/server/services/plan";
import * as userService from "@/server/services/user-mutation";

export const userRouter = router({
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
