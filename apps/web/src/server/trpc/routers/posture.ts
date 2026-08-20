import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import {
  postureDefinitions,
  postureSessions,
  postureConfig,
  postureDetectionSessions,
  postureDetectionConfig,
} from "@/server/db/schema";
import { eq, and, desc, isNull, gte, lt } from "drizzle-orm";
import {
  schedulePush,
  cancelPush,
} from "@/server/services/posture-push-scheduler";

const DEFAULT_POSTURES: Record<string, { name: string; emoji: string; maxMinutes: number; suggestedBreak: string; sortOrder: number }[]> = {
  en: [
    { name: "Sitting", emoji: "🪑", maxMinutes: 45, suggestedBreak: "Stand up and walk for 2 min", sortOrder: 0 },
    { name: "Standing", emoji: "🧍", maxMinutes: 60, suggestedBreak: "Sit down or take a short walk", sortOrder: 1 },
    { name: "Walking", emoji: "🚶", maxMinutes: 120, suggestedBreak: "Find a place to sit and rest", sortOrder: 2 },
    { name: "Lying", emoji: "🛌", maxMinutes: 30, suggestedBreak: "Get up and move around", sortOrder: 3 },
    { name: "Reclining", emoji: "🛋️", maxMinutes: 45, suggestedBreak: "Switch posture and stretch", sortOrder: 4 },
  ],
};

export const postureRouter = router({
  getDefinitions: protectedProcedure
    .input(z.object({ lang: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const defs = await ctx.db
      .select()
      .from(postureDefinitions)
      .where(
        and(
          eq(postureDefinitions.userId, ctx.user.id),
          eq(postureDefinitions.isArchived, false)
        )
      )
      .orderBy(postureDefinitions.sortOrder);

    // If user has no definitions, seed defaults
    if (defs.length === 0) {
      const lang = input?.lang ?? "en";
      const postures = DEFAULT_POSTURES[lang] ?? DEFAULT_POSTURES.en;
      const seeded = await ctx.db
        .insert(postureDefinitions)
        .values(
          postures.map((p) => ({
            userId: ctx.user.id,
            ...p,
          }))
        )
        .returning();
      return seeded;
    }

    return defs;
  }),

  upsertDefinition: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(20),
        emoji: z.string().min(1).max(4),
        maxMinutes: z.number().int().min(5).max(480),
        suggestedBreak: z.string().min(1).max(100),
        sortOrder: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        await ctx.db
          .update(postureDefinitions)
          .set({
            name: input.name,
            emoji: input.emoji,
            maxMinutes: input.maxMinutes,
            suggestedBreak: input.suggestedBreak,
            sortOrder: input.sortOrder,
          })
          .where(
            and(
              eq(postureDefinitions.id, input.id),
              eq(postureDefinitions.userId, ctx.user.id)
            )
          );
      } else {
        await ctx.db.insert(postureDefinitions).values({
          userId: ctx.user.id,
          name: input.name,
          emoji: input.emoji,
          maxMinutes: input.maxMinutes,
          suggestedBreak: input.suggestedBreak,
          sortOrder: input.sortOrder,
        });
      }
      return { success: true };
    }),

  deleteDefinition: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Archive instead of hard delete to preserve session history
      await ctx.db
        .update(postureDefinitions)
        .set({ isArchived: true })
        .where(
          and(
            eq(postureDefinitions.id, input.id),
            eq(postureDefinitions.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.query.postureConfig.findFirst({
      where: eq(postureConfig.userId, ctx.user.id),
    });
    return config ?? { reminderEnabled: true, snoozeMinutes: 10 };
  }),

  upsertConfig: protectedProcedure
    .input(
      z.object({
        reminderEnabled: z.boolean(),
        snoozeMinutes: z.number().int().min(1).max(60),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(postureConfig)
        .values({
          userId: ctx.user.id,
          reminderEnabled: input.reminderEnabled,
          snoozeMinutes: input.snoozeMinutes,
        })
        .onConflictDoUpdate({
          target: postureConfig.userId,
          set: {
            reminderEnabled: input.reminderEnabled,
            snoozeMinutes: input.snoozeMinutes,
          },
        });
      return { success: true };
    }),

  getActiveSession: protectedProcedure.query(async ({ ctx }) => {
    const session = await ctx.db
      .select({
        id: postureSessions.id,
        postureId: postureSessions.postureId,
        startedAt: postureSessions.startedAt,
        wasReminded: postureSessions.wasReminded,
        postureName: postureDefinitions.name,
        postureEmoji: postureDefinitions.emoji,
        maxMinutes: postureDefinitions.maxMinutes,
        suggestedBreak: postureDefinitions.suggestedBreak,
      })
      .from(postureSessions)
      .innerJoin(
        postureDefinitions,
        eq(postureSessions.postureId, postureDefinitions.id)
      )
      .where(
        and(
          eq(postureSessions.userId, ctx.user.id),
          isNull(postureSessions.endedAt)
        )
      )
      .orderBy(desc(postureSessions.startedAt))
      .limit(1);

    return session[0] ?? null;
  }),

  switchPosture: protectedProcedure
    .input(z.object({ postureId: z.string().uuid(), lang: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        // End any active session
        const existing = await tx
          .select({ id: postureSessions.id, startedAt: postureSessions.startedAt })
          .from(postureSessions)
          .where(
            and(
              eq(postureSessions.userId, ctx.user.id),
              isNull(postureSessions.endedAt)
            )
          );

        const now = new Date();
        for (const session of existing) {
          cancelPush(session.id);
          const durationMinutes = Math.round(
            (now.getTime() - new Date(session.startedAt).getTime()) / 60000
          );
          await tx
            .update(postureSessions)
            .set({ endedAt: now, durationMinutes })
            .where(eq(postureSessions.id, session.id));
        }

        // Start new session
        const [newSession] = await tx
          .insert(postureSessions)
          .values({
            userId: ctx.user.id,
            postureId: input.postureId,
            startedAt: now,
          })
          .returning();

        // Look up posture definition for push notification
        const postureDef = await tx
          .select()
          .from(postureDefinitions)
          .where(eq(postureDefinitions.id, input.postureId))
          .then((r) => r[0]);

        if (postureDef) {
          const fireAt = new Date(
            now.getTime() + postureDef.maxMinutes * 60000
          );
          schedulePush(ctx.user.id, newSession.id, fireAt, {
            type: "posture-reminder",
            title: `${postureDef.emoji} Time to switch posture!`,
            body: `You've been "${postureDef.name}" for over ${postureDef.maxMinutes} min. ${postureDef.suggestedBreak}`,
            tag: "posture-reminder",
            url: "/hub/posture",
          });
        }

        return newSession;
      });
    }),

  stopSession: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db
      .select({ id: postureSessions.id, startedAt: postureSessions.startedAt })
      .from(postureSessions)
      .where(
        and(
          eq(postureSessions.userId, ctx.user.id),
          isNull(postureSessions.endedAt)
        )
      );

    const now = new Date();
    for (const session of existing) {
      cancelPush(session.id);
      const durationMinutes = Math.round(
        (now.getTime() - new Date(session.startedAt).getTime()) / 60000
      );
      await ctx.db
        .update(postureSessions)
        .set({ endedAt: now, durationMinutes })
        .where(eq(postureSessions.id, session.id));
    }

    return { success: true };
  }),

  markReminded: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(postureSessions)
        .set({ wasReminded: true })
        .where(
          and(
            eq(postureSessions.id, input.id),
            eq(postureSessions.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(postureSessions.userId, ctx.user.id)];

      if (input.date) {
        // Use Nepal timezone (UTC+5:45) for date boundaries.
        const dayStart = new Date(`${input.date}T00:00:00+05:45`);
        const dayEnd = new Date(`${input.date}T00:00:00+05:45`);
        dayEnd.setDate(dayEnd.getDate() + 1);
        conditions.push(gte(postureSessions.startedAt, dayStart));
        conditions.push(lt(postureSessions.startedAt, dayEnd));
      }

      const logs = await ctx.db
        .select({
          id: postureSessions.id,
          startedAt: postureSessions.startedAt,
          endedAt: postureSessions.endedAt,
          durationMinutes: postureSessions.durationMinutes,
          wasReminded: postureSessions.wasReminded,
          postureName: postureDefinitions.name,
          postureEmoji: postureDefinitions.emoji,
        })
        .from(postureSessions)
        .innerJoin(
          postureDefinitions,
          eq(postureSessions.postureId, postureDefinitions.id)
        )
        .where(and(...conditions))
        .orderBy(desc(postureSessions.startedAt))
        .limit(input.limit);

      return logs;
    }),

  // ─── AirPods Posture Detection ─────────────────────────────

  saveDetectionSession: protectedProcedure
    .input(
      z.object({
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        baselinePitch: z.number(),
        thresholdDegrees: z.number(),
        totalDurationMinutes: z.number().int().min(0),
        goodPostureMinutes: z.number().int().min(0),
        badPostureMinutes: z.number().int().min(0),
        averageDeviation: z.number(),
        maxDeviation: z.number(),
        slouchCount: z.number().int().min(0),
        notificationCount: z.number().int().min(0),
        score: z.number().int().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .insert(postureDetectionSessions)
        .values({
          userId: ctx.user.id,
          startedAt: new Date(input.startTime),
          endedAt: new Date(input.endTime),
          baselinePitch: String(input.baselinePitch),
          thresholdDegrees: String(input.thresholdDegrees),
          totalDurationMinutes: input.totalDurationMinutes,
          goodPostureMinutes: input.goodPostureMinutes,
          badPostureMinutes: input.badPostureMinutes,
          averageDeviation: String(input.averageDeviation),
          maxDeviation: String(input.maxDeviation),
          slouchCount: input.slouchCount,
          notificationCount: input.notificationCount,
          score: input.score,
        })
        .returning();
      return session;
    }),

  getDetectionHistory: protectedProcedure
    .input(
      z.object({ limit: z.number().int().min(1).max(50).default(20) })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(postureDetectionSessions)
        .where(eq(postureDetectionSessions.userId, ctx.user.id))
        .orderBy(desc(postureDetectionSessions.startedAt))
        .limit(input.limit);
    }),

  getDetectionConfig: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.query.postureDetectionConfig.findFirst({
      where: eq(postureDetectionConfig.userId, ctx.user.id),
    });
    return config ?? {
      thresholdDegrees: "8.5",
      notificationCooldownSeconds: 120,
      enabled: true,
    };
  }),

  upsertDetectionConfig: protectedProcedure
    .input(
      z.object({
        thresholdDegrees: z.number().min(3).max(30),
        notificationCooldownSeconds: z.number().int().min(30).max(600),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(postureDetectionConfig)
        .values({
          userId: ctx.user.id,
          thresholdDegrees: String(input.thresholdDegrees),
          notificationCooldownSeconds: input.notificationCooldownSeconds,
          enabled: input.enabled,
        })
        .onConflictDoUpdate({
          target: postureDetectionConfig.userId,
          set: {
            thresholdDegrees: String(input.thresholdDegrees),
            notificationCooldownSeconds: input.notificationCooldownSeconds,
            enabled: input.enabled,
          },
        });
      return { success: true };
    }),
});
