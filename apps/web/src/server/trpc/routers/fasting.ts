import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { fastingConfigs, fastingLogs } from "@/server/db/schema";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";

const MS_PER_HOUR = 3600 * 1000;
const COMPLETION_THRESHOLD = 0.9;

export const fastingRouter = router({
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.query.fastingConfigs.findFirst({
      where: eq(fastingConfigs.userId, ctx.user.id),
    });
    return config ?? null;
  }),

  upsertConfig: protectedProcedure
    .input(
      z.object({
        protocol: z.enum(["16_8", "18_6", "20_4", "omad", "custom"]),
        eatingStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
        eatingEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(fastingConfigs)
        .values({
          userId: ctx.user.id,
          protocol: input.protocol,
          eatingStart: input.eatingStart,
          eatingEnd: input.eatingEnd,
        })
        .onConflictDoUpdate({
          target: fastingConfigs.userId,
          set: {
            protocol: input.protocol,
            eatingStart: input.eatingStart,
            eatingEnd: input.eatingEnd,
          },
        });
      return { success: true };
    }),

  getActiveFast: protectedProcedure.query(async ({ ctx }) => {
    const activeFast = await ctx.db
      .select()
      .from(fastingLogs)
      .where(
        and(
          eq(fastingLogs.userId, ctx.user.id),
          isNull(fastingLogs.endedAt)
        )
      )
      .orderBy(desc(fastingLogs.startedAt))
      .limit(1);

    return activeFast[0] ?? null;
  }),

  startFast: protectedProcedure
    .input(
      z.object({
        plannedHours: z.number().min(1).max(48),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        // End any existing active fast first
        const existing = await tx
          .select({ id: fastingLogs.id })
          .from(fastingLogs)
          .where(
            and(
              eq(fastingLogs.userId, ctx.user.id),
              isNull(fastingLogs.endedAt)
            )
          );

        if (existing.length > 0) {
          const now = new Date();
          for (const log of existing) {
            await tx
              .update(fastingLogs)
              .set({ endedAt: now, completed: false })
              .where(eq(fastingLogs.id, log.id));
          }
        }

        const [newFast] = await tx
          .insert(fastingLogs)
          .values({
            userId: ctx.user.id,
            startedAt: new Date(),
            plannedHours: String(input.plannedHours),
          })
          .returning();

        return newFast;
      });
    }),

  endFast: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.db
        .select()
        .from(fastingLogs)
        .where(
          and(
            eq(fastingLogs.id, input.id),
            eq(fastingLogs.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!log[0]) throw new Error("Fasting record not found");

      const startedAt = new Date(log[0].startedAt);
      const now = new Date();
      const actualHours = (now.getTime() - startedAt.getTime()) / MS_PER_HOUR;
      const plannedHours = Number(log[0].plannedHours);
      const completed = actualHours >= plannedHours * COMPLETION_THRESHOLD;

      await ctx.db
        .update(fastingLogs)
        .set({
          endedAt: now,
          actualHours: String(Math.round(actualHours * 10) / 10),
          completed,
        })
        .where(eq(fastingLogs.id, input.id));

      return { success: true, actualHours: Math.round(actualHours * 10) / 10, completed };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db
        .select()
        .from(fastingLogs)
        .where(
          and(
            eq(fastingLogs.userId, ctx.user.id),
            isNotNull(fastingLogs.endedAt)
          )
        )
        .orderBy(desc(fastingLogs.startedAt))
        .limit(input.limit);

      return logs;
    }),

  deleteFast: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(fastingLogs)
        .where(
          and(
            eq(fastingLogs.id, input.id),
            eq(fastingLogs.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),
});
