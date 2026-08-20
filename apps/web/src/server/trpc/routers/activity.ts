import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { activitySessions } from "@/server/db/schema";
import { eq, and, desc, isNull, gte, sql, isNotNull } from "drizzle-orm";
import { requireFeature } from "@/server/services/plan";
import {
  startActivitySessionSchema,
  completeActivitySessionSchema,
  discardActivitySessionSchema,
} from "@open-health/shared/schemas";

export const activityRouter = router({
  getActive: protectedProcedure
    .input(z.object({ type: z.enum(["exercise", "meditation", "throat_exercise", "eye_exercise"]) }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db
        .select()
        .from(activitySessions)
        .where(
          and(
            eq(activitySessions.userId, ctx.user.id),
            eq(activitySessions.type, input.type),
            isNull(activitySessions.completedAt)
          )
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      return session;
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        type: z.enum(["exercise", "meditation", "throat_exercise", "eye_exercise"]),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;

      const conditions = [
        eq(activitySessions.userId, ctx.user.id),
        eq(activitySessions.type, input.type),
        isNotNull(activitySessions.completedAt),
      ];

      if (input.cursor) {
        const cursorSession = await ctx.db
          .select({ startedAt: activitySessions.startedAt })
          .from(activitySessions)
          .where(eq(activitySessions.id, input.cursor))
          .then((r) => r[0]);

        if (cursorSession) {
          conditions.push(
            sql`${activitySessions.startedAt} < ${cursorSession.startedAt}`
          );
        }
      }

      const sessions = await ctx.db
        .select()
        .from(activitySessions)
        .where(and(...conditions))
        .orderBy(desc(activitySessions.startedAt))
        .limit(limit + 1);

      const hasMore = sessions.length > limit;
      const items = hasMore ? sessions.slice(0, limit) : sessions;
      const nextCursor = hasMore ? items[items.length - 1].id : undefined;

      return { items, nextCursor };
    }),

  getStats: protectedProcedure
    .input(
      z.object({
        type: z.enum(["exercise", "meditation", "throat_exercise", "eye_exercise"]),
        period: z.enum(["week", "month", "all"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const period = input.period ?? "all";

      const conditions = [
        eq(activitySessions.userId, ctx.user.id),
        eq(activitySessions.type, input.type),
        isNotNull(activitySessions.completedAt),
      ];

      if (period === "week") {
        conditions.push(
          gte(
            activitySessions.startedAt,
            sql`now() - interval '7 days'`
          )
        );
      } else if (period === "month") {
        conditions.push(
          gte(
            activitySessions.startedAt,
            sql`now() - interval '30 days'`
          )
        );
      }

      const stats = await ctx.db
        .select({
          totalSessions: sql<number>`count(*)::int`,
          totalSeconds: sql<number>`coalesce(sum(${activitySessions.durationSec}), 0)::int`,
          avgSeconds: sql<number>`coalesce(avg(${activitySessions.durationSec}), 0)::int`,
        })
        .from(activitySessions)
        .where(and(...conditions))
        .then((r) => r[0]);

      // Calculate current streak: consecutive days counting back from today or yesterday
      // If today has a session, count back from today; else count back from yesterday
      const streakResult = await ctx.db.execute<{ streak: number }>(sql`
        WITH daily AS (
          SELECT DISTINCT date(started_at AT TIME ZONE 'UTC') AS d
          FROM activity_sessions
          WHERE user_id = ${ctx.user.id}
            AND type = ${input.type}
            AND completed_at IS NOT NULL
        ),
        recent AS (
          SELECT d FROM daily WHERE d >= current_date - 1 ORDER BY d DESC LIMIT 1
        ),
        consecutive AS (
          SELECT d,
                 ROW_NUMBER() OVER (ORDER BY d DESC) AS rn
          FROM daily
          WHERE d <= (SELECT d FROM recent)
        )
        SELECT count(*)::int AS streak
        FROM consecutive
        WHERE d = (SELECT d FROM recent) - (rn - 1)::int
      `);

      const currentStreak = streakResult[0]?.streak ?? 0;

      return {
        totalSessions: stats?.totalSessions ?? 0,
        totalSeconds: stats?.totalSeconds ?? 0,
        avgSeconds: stats?.avgSeconds ?? 0,
        currentStreak,
      };
    }),

  getDay: protectedProcedure
    .input(
      z.object({
        type: z.enum(["exercise", "meditation", "throat_exercise", "eye_exercise"]),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.db
        .select()
        .from(activitySessions)
        .where(
          and(
            eq(activitySessions.userId, ctx.user.id),
            eq(activitySessions.type, input.type),
            isNotNull(activitySessions.completedAt),
            sql`date(${activitySessions.startedAt} AT TIME ZONE 'UTC') = ${input.date}`
          )
        )
        .orderBy(desc(activitySessions.startedAt));

      const totalSeconds = sessions.reduce(
        (sum, s) => sum + (s.durationSec ?? 0),
        0
      );

      return { sessions, totalSeconds };
    }),

  // --- Mutations (used by mobile, web uses server actions) ---

  startSession: protectedProcedure
    .input(startActivitySessionSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.type !== "meditation" && input.type !== "throat_exercise" && input.type !== "eye_exercise") {
        requireFeature(ctx.userPlan, "exercise");
      }

      // Check for existing active session of same type
      const active = await ctx.db
        .select({ id: activitySessions.id })
        .from(activitySessions)
        .where(
          and(
            eq(activitySessions.userId, ctx.user.id),
            eq(activitySessions.type, input.type),
            isNull(activitySessions.completedAt)
          )
        )
        .limit(1);

      if (active.length > 0) {
        return { sessionId: active[0].id, alreadyActive: true };
      }

      const [session] = await ctx.db
        .insert(activitySessions)
        .values({
          userId: ctx.user.id,
          type: input.type,
          metadata: input.metadata ?? {},
        })
        .returning({ id: activitySessions.id });

      return { sessionId: session.id, alreadyActive: false };
    }),

  completeSession: protectedProcedure
    .input(completeActivitySessionSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db
        .select({
          id: activitySessions.id,
          startedAt: activitySessions.startedAt,
          metadata: activitySessions.metadata,
        })
        .from(activitySessions)
        .where(
          and(
            eq(activitySessions.id, input.sessionId),
            eq(activitySessions.userId, ctx.user.id)
          )
        )
        .then((r) => r[0]);

      if (!session) throw new Error("Activity not found");

      const now = new Date();
      const durationSec = Math.floor(
        (now.getTime() - session.startedAt.getTime()) / 1000
      );

      const mergedMetadata = {
        ...(session.metadata as Record<string, unknown>),
        ...(input.metadata ?? {}),
        completed: true,
      };

      await ctx.db
        .update(activitySessions)
        .set({
          completedAt: now,
          durationSec,
          note: input.note,
          metadata: mergedMetadata,
        })
        .where(eq(activitySessions.id, input.sessionId));

      return { success: true, durationSec };
    }),

  discardSession: protectedProcedure
    .input(discardActivitySessionSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(activitySessions)
        .where(
          and(
            eq(activitySessions.id, input.sessionId),
            eq(activitySessions.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
