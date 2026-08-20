import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { waterLogs, waterGoals, waterContainers } from "@/server/db/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";

const DEFAULT_DAILY_WATER_ML = 2500;

export const waterRouter = router({
  getToday: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          totalMl: sql<number>`coalesce(sum(${waterLogs.amountMl}), 0)::int`,
        })
        .from(waterLogs)
        .where(
          and(
            eq(waterLogs.userId, ctx.user.id),
            eq(waterLogs.date, input.date)
          )
        );

      const goal = await ctx.db.query.waterGoals.findFirst({
        where: eq(waterGoals.userId, ctx.user.id),
      });

      return {
        totalMl: result[0]?.totalMl ?? 0,
        goalMl: goal?.dailyTargetMl ?? DEFAULT_DAILY_WATER_ML,
      };
    }),

  logWater: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amountMl: z.number().int().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(waterLogs).values({
        userId: ctx.user.id,
        date: input.date,
        amountMl: input.amountMl,
      });
      return { success: true };
    }),

  undoLastLog: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const lastLog = await ctx.db
        .select({ id: waterLogs.id })
        .from(waterLogs)
        .where(
          and(
            eq(waterLogs.userId, ctx.user.id),
            eq(waterLogs.date, input.date)
          )
        )
        .orderBy(desc(waterLogs.loggedAt))
        .limit(1);

      if (lastLog.length === 0) {
        return { success: false, error: "No water log to undo" };
      }

      await ctx.db.delete(waterLogs).where(eq(waterLogs.id, lastLog[0].id));
      return { success: true };
    }),

  getGoal: protectedProcedure.query(async ({ ctx }) => {
    const goal = await ctx.db.query.waterGoals.findFirst({
      where: eq(waterGoals.userId, ctx.user.id),
    });
    return { dailyTargetMl: goal?.dailyTargetMl ?? DEFAULT_DAILY_WATER_ML };
  }),

  getLogs: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db
        .select({
          id: waterLogs.id,
          amountMl: waterLogs.amountMl,
          loggedAt: waterLogs.loggedAt,
        })
        .from(waterLogs)
        .where(
          and(
            eq(waterLogs.userId, ctx.user.id),
            eq(waterLogs.date, input.date)
          )
        )
        .orderBy(desc(waterLogs.loggedAt));

      return logs;
    }),

  setGoal: protectedProcedure
    .input(z.object({ dailyTargetMl: z.number().int().min(500).max(10000) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(waterGoals)
        .values({
          userId: ctx.user.id,
          dailyTargetMl: input.dailyTargetMl,
        })
        .onConflictDoUpdate({
          target: waterGoals.userId,
          set: { dailyTargetMl: input.dailyTargetMl },
        });

      return { success: true };
    }),

  // --- Custom Containers ---

  getContainers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: waterContainers.id,
        name: waterContainers.name,
        amountMl: waterContainers.amountMl,
        sortOrder: waterContainers.sortOrder,
      })
      .from(waterContainers)
      .where(eq(waterContainers.userId, ctx.user.id))
      .orderBy(asc(waterContainers.sortOrder));
  }),

  upsertContainer: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(20),
        amountMl: z.number().int().min(1).max(5000),
        sortOrder: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        // Update existing
        await ctx.db
          .update(waterContainers)
          .set({ name: input.name, amountMl: input.amountMl, sortOrder: input.sortOrder })
          .where(
            and(
              eq(waterContainers.id, input.id),
              eq(waterContainers.userId, ctx.user.id)
            )
          );
      } else {
        // Check max 4
        const existing = await ctx.db
          .select({ id: waterContainers.id })
          .from(waterContainers)
          .where(eq(waterContainers.userId, ctx.user.id));

        if (existing.length >= 4) {
          throw new Error("You can create up to 4 custom containers");
        }

        await ctx.db.insert(waterContainers).values({
          userId: ctx.user.id,
          name: input.name,
          amountMl: input.amountMl,
          sortOrder: input.sortOrder,
        });
      }

      return { success: true };
    }),

  deleteContainer: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(waterContainers)
        .where(
          and(
            eq(waterContainers.id, input.id),
            eq(waterContainers.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),
});
