import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { exercises, exerciseLogs, weightLogs } from "@/server/db/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { requireFeature } from "@/server/services/plan";
import { DEFAULT_WEIGHT_KG } from "@open-health/shared/constants";
import { logExerciseSchema, createCustomExerciseSchema } from "@open-health/shared/schemas";

export const exerciseRouter = router({
  getDay: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db
        .select({
          id: exerciseLogs.id,
          date: exerciseLogs.date,
          durationMin: exerciseLogs.durationMin,
          caloriesBurned: exerciseLogs.caloriesBurned,
          intensity: exerciseLogs.intensity,
          note: exerciseLogs.note,
          createdAt: exerciseLogs.createdAt,
          exerciseId: exerciseLogs.exerciseId,
          exerciseName: exercises.name,
          exerciseCategory: exercises.category,
        })
        .from(exerciseLogs)
        .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
        .where(
          and(
            eq(exerciseLogs.userId, ctx.user.id),
            eq(exerciseLogs.date, input.date)
          )
        )
        .orderBy(desc(exerciseLogs.createdAt));

      const totalCalories = logs.reduce(
        (sum, log) => sum + Number(log.caloriesBurned || 0),
        0
      );

      return { logs, totalCalories };
    }),

  getPresets: protectedProcedure
    .input(
      z
        .object({
          category: z
            .enum(["cardio", "strength", "flexibility", "sport", "other"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        or(
          eq(exercises.isCustom, false),
          eq(exercises.createdBy, ctx.user.id),
          eq(exercises.isPublic, true)
        ),
      ];

      if (input?.category) {
        conditions.push(eq(exercises.category, input.category));
      }

      return ctx.db
        .select({
          id: exercises.id,
          name: exercises.name,
          category: exercises.category,
          metValue: exercises.metValue,
          isCustom: exercises.isCustom,
          isPublic: exercises.isPublic,
          createdBy: exercises.createdBy,
        })
        .from(exercises)
        .where(and(...conditions))
        .orderBy(exercises.category, exercises.name);
    }),

  searchExercises: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: exercises.id,
          name: exercises.name,
          category: exercises.category,
          metValue: exercises.metValue,
          isCustom: exercises.isCustom,
          isPublic: exercises.isPublic,
          createdBy: exercises.createdBy,
        })
        .from(exercises)
        .where(
          and(
            ilike(exercises.name, `%${input.query}%`),
            or(
              eq(exercises.isCustom, false),
              eq(exercises.createdBy, ctx.user.id),
              eq(exercises.isPublic, true)
            )
          )
        )
        .orderBy(exercises.name)
        .limit(20);
    }),

  logExercise: protectedProcedure
    .input(logExerciseSchema)
    .mutation(async ({ ctx, input }) => {
      let caloriesBurned = input.caloriesBurned;

      if (caloriesBurned === undefined) {
        const exercise = await ctx.db
          .select({ metValue: exercises.metValue })
          .from(exercises)
          .where(eq(exercises.id, input.exerciseId))
          .then((r) => r[0]);

        const latestWeight = await ctx.db
          .select({ weightKg: weightLogs.weightKg })
          .from(weightLogs)
          .where(eq(weightLogs.userId, ctx.user.id))
          .orderBy(desc(weightLogs.date))
          .limit(1)
          .then((r) => r[0]);

        const met = Number(exercise?.metValue || 3);
        const weightKg = Number(latestWeight?.weightKg || DEFAULT_WEIGHT_KG);
        caloriesBurned = Math.round(met * weightKg * (input.durationMin / 60));
      }

      await ctx.db.insert(exerciseLogs).values({
        userId: ctx.user.id,
        date: input.date,
        exerciseId: input.exerciseId,
        durationMin: input.durationMin,
        caloriesBurned: String(caloriesBurned),
        intensity: input.intensity,
        note: input.note,
      });

      return { success: true, caloriesBurned };
    }),

  removeLog: protectedProcedure
    .input(z.object({ logId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(exerciseLogs)
        .where(
          and(
            eq(exerciseLogs.id, input.logId),
            eq(exerciseLogs.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  toggleExercisePublic: protectedProcedure
    .input(z.object({ exerciseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const exercise = await ctx.db
        .select({ isCustom: exercises.isCustom, createdBy: exercises.createdBy, isPublic: exercises.isPublic })
        .from(exercises)
        .where(eq(exercises.id, input.exerciseId))
        .then((r) => r[0]);

      if (!exercise || !exercise.isCustom || exercise.createdBy !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only custom exercises you created can be made public",
        });
      }

      await ctx.db
        .update(exercises)
        .set({ isPublic: !exercise.isPublic })
        .where(eq(exercises.id, input.exerciseId));

      return { isPublic: !exercise.isPublic };
    }),

  createCustomExercise: protectedProcedure
    .input(createCustomExerciseSchema)
    .mutation(async ({ ctx, input }) => {
      requireFeature(ctx.userPlan, "exercise");

      const [created] = await ctx.db
        .insert(exercises)
        .values({
          name: input.name,
          category: input.category ?? "other",
          metValue: input.metValue ? String(input.metValue) : null,
          isCustom: true,
          createdBy: ctx.user.id,
        })
        .returning({ id: exercises.id });

      return { id: created.id };
    }),
});
