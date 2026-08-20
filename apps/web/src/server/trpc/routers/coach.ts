import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  updateCoachNotesSchema,
  connectToCoachSchema,
  sendCoachMessageSchema,
  markCoachMessagesReadSchema,
} from "@open-health/shared/schemas";
import { protectedProcedure, router } from "../trpc";
import {
  coachClients,
  coachMessages,
  users,
  userProfiles,
  userGoals,
  weightLogs,
  stepLogs,
  diaryEntries,
} from "@/server/db/schema";
import { eq, and, sql, desc, inArray, isNull } from "drizzle-orm";
import { calculateBMR, calculateTDEE, getAge } from "@/server/services/bmr";
import { sendPushToUser } from "@/server/services/push";
import * as coachingService from "@/server/services/coaching-mutation";

export const coachRouter = router({
  getClients: protectedProcedure.query(async ({ ctx }) => {
    // Single query with lateral join to avoid N+1
    const latestWeightSq = ctx.db
      .select({
        userId: weightLogs.userId,
        weightKg: weightLogs.weightKg,
        date: weightLogs.date,
        rn: sql<number>`row_number() over (partition by ${weightLogs.userId} order by ${weightLogs.date} desc)`.as("rn"),
      })
      .from(weightLogs)
      .as("lw");

    const clients = await ctx.db
      .select({
        id: coachClients.id,
        clientId: coachClients.clientId,
        startDate: coachClients.startDate,
        coachNotes: coachClients.coachNotes,
        calorieTarget: coachClients.calorieTarget,
        status: coachClients.status,
        clientName: users.name,
        clientEmail: users.email,
        clientImage: users.image,
        latestWeightKg: latestWeightSq.weightKg,
        latestWeightDate: latestWeightSq.date,
      })
      .from(coachClients)
      .innerJoin(users, eq(coachClients.clientId, users.id))
      .leftJoin(
        latestWeightSq,
        and(
          eq(latestWeightSq.userId, coachClients.clientId),
          eq(latestWeightSq.rn, 1)
        )
      )
      .where(
        and(
          eq(coachClients.coachId, ctx.user.id),
          eq(coachClients.status, "active")
        )
      )
      .orderBy(desc(coachClients.createdAt));

    return clients.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      startDate: c.startDate,
      coachNotes: c.coachNotes,
      calorieTarget: c.calorieTarget,
      status: c.status,
      clientName: c.clientName,
      clientEmail: c.clientEmail,
      clientImage: c.clientImage,
      latestWeight: c.latestWeightKg
        ? { weightKg: c.latestWeightKg, date: c.latestWeightDate! }
        : null,
    }));
  }),

  getClientDetail: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify coach-client relationship
      const relation = await ctx.db
        .select()
        .from(coachClients)
        .where(
          and(
            eq(coachClients.coachId, ctx.user.id),
            eq(coachClients.clientId, input.clientId),
            eq(coachClients.status, "active")
          )
        )
        .then((r) => r[0]);

      if (!relation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      const [clientUser, profile, goals, latestWeight] = await Promise.all([
        ctx.db
          .select({
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, input.clientId))
          .then((r) => r[0]!),
        ctx.db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.userId, input.clientId))
          .then((r) => r[0] ?? null),
        ctx.db
          .select()
          .from(userGoals)
          .where(eq(userGoals.userId, input.clientId))
          .then((r) => r[0] ?? null),
        ctx.db
          .select({ weightKg: weightLogs.weightKg, date: weightLogs.date })
          .from(weightLogs)
          .where(eq(weightLogs.userId, input.clientId))
          .orderBy(desc(weightLogs.date))
          .limit(1)
          .then((r) => r[0] ?? null),
      ]);

      // Calculate BMR/TDEE if we have enough data
      let bmr: number | null = null;
      let tdee: number | null = null;
      if (
        profile?.dateOfBirth &&
        profile?.heightCm &&
        latestWeight?.weightKg
      ) {
        const age = getAge(profile.dateOfBirth);
        bmr = calculateBMR({
          sex: profile.sex as "male" | "female" | "other" | null,
          weightKg: Number(latestWeight.weightKg),
          heightCm: Number(profile.heightCm),
          age,
        });
        tdee = calculateTDEE(bmr, profile.activityLevel);
      }

      return {
        client: clientUser,
        profile,
        goals,
        latestWeight,
        coaching: {
          startDate: relation.startDate,
          coachNotes: relation.coachNotes,
          calorieTarget: relation.calorieTarget,
          proteinPct: relation.proteinPct,
          carbsPct: relation.carbsPct,
          fatPct: relation.fatPct,
        },
        bmr,
        tdee,
      };
    }),

  getClientWeeklyData: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify coach-client relationship
      const relation = await ctx.db
        .select({ id: coachClients.id })
        .from(coachClients)
        .where(
          and(
            eq(coachClients.coachId, ctx.user.id),
            eq(coachClients.clientId, input.clientId),
            eq(coachClients.status, "active")
          )
        )
        .then((r) => r[0]);

      if (!relation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const weekEnd = getWeekEnd(input.weekStart);

      const [weights, steps, dailyNutrition] = await Promise.all([
        ctx.db
          .select({ date: weightLogs.date, weightKg: weightLogs.weightKg })
          .from(weightLogs)
          .where(
            and(
              eq(weightLogs.userId, input.clientId),
              sql`${weightLogs.date} >= ${input.weekStart}`,
              sql`${weightLogs.date} <= ${weekEnd}`
            )
          )
          .orderBy(weightLogs.date),
        ctx.db
          .select({ date: stepLogs.date, steps: stepLogs.steps })
          .from(stepLogs)
          .where(
            and(
              eq(stepLogs.userId, input.clientId),
              sql`${stepLogs.date} >= ${input.weekStart}`,
              sql`${stepLogs.date} <= ${weekEnd}`
            )
          )
          .orderBy(stepLogs.date),
        ctx.db
          .select({
            date: diaryEntries.date,
            totalCalories: sql<number>`sum(${diaryEntries.calories})::numeric`,
            totalProtein: sql<number>`sum(${diaryEntries.proteinG})::numeric`,
            totalCarbs: sql<number>`sum(${diaryEntries.carbsG})::numeric`,
            totalFat: sql<number>`sum(${diaryEntries.fatG})::numeric`,
          })
          .from(diaryEntries)
          .where(
            and(
              eq(diaryEntries.userId, input.clientId),
              sql`${diaryEntries.date} >= ${input.weekStart}`,
              sql`${diaryEntries.date} <= ${weekEnd}`
            )
          )
          .groupBy(diaryEntries.date)
          .orderBy(diaryEntries.date),
      ]);

      // Build 7-day array
      const days = [];
      const start = new Date(input.weekStart);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);

        const weight = weights.find((w) => w.date === dateStr);
        const step = steps.find((s) => s.date === dateStr);
        const nutrition = dailyNutrition.find((n) => n.date === dateStr);

        days.push({
          date: dateStr,
          weightKg: weight ? Number(weight.weightKg) : null,
          steps: step ? Number(step.steps) : null,
          calories: nutrition ? Number(nutrition.totalCalories) : null,
          proteinG: nutrition ? Number(nutrition.totalProtein) : null,
          carbsG: nutrition ? Number(nutrition.totalCarbs) : null,
          fatG: nutrition ? Number(nutrition.totalFat) : null,
        });
      }

      // Weekly averages (only count days with data)
      const withCalories = days.filter((d) => d.calories !== null);
      const withWeight = days.filter((d) => d.weightKg !== null);
      const withSteps = days.filter((d) => d.steps !== null);

      const averages = {
        calories: withCalories.length
          ? Math.round(
              withCalories.reduce((s, d) => s + d.calories!, 0) /
                withCalories.length
            )
          : null,
        proteinG: withCalories.length
          ? Math.round(
              withCalories.reduce((s, d) => s + d.proteinG!, 0) /
                withCalories.length
            )
          : null,
        carbsG: withCalories.length
          ? Math.round(
              withCalories.reduce((s, d) => s + d.carbsG!, 0) /
                withCalories.length
            )
          : null,
        fatG: withCalories.length
          ? Math.round(
              withCalories.reduce((s, d) => s + d.fatG!, 0) /
                withCalories.length
            )
          : null,
        weightKg: withWeight.length
          ? Number(
              (
                withWeight.reduce((s, d) => s + d.weightKg!, 0) /
                withWeight.length
              ).toFixed(1)
            )
          : null,
        steps: withSteps.length
          ? Math.round(
              withSteps.reduce((s, d) => s + d.steps!, 0) / withSteps.length
            )
          : null,
      };

      return { days, averages };
    }),

  getMyCoaches: protectedProcedure.query(async ({ ctx }) => {
    const coaches = await ctx.db
      .select({
        id: coachClients.id,
        coachId: coachClients.coachId,
        startDate: coachClients.startDate,
        status: coachClients.status,
        coachName: users.name,
        coachEmail: users.email,
        coachImage: users.image,
      })
      .from(coachClients)
      .innerJoin(users, eq(coachClients.coachId, users.id))
      .where(
        and(
          eq(coachClients.clientId, ctx.user.id),
          eq(coachClients.status, "active")
        )
      )
      .orderBy(desc(coachClients.createdAt));

    return coaches;
  }),

  connectToCoach: protectedProcedure
    .input(connectToCoachSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await coachingService.connectToCoach(ctx.db, ctx.user.id, input.code);
      if (!result.success) {
        throw new TRPCError({
          code: result.error === "Coach code does not exist" ? "NOT_FOUND"
            : result.error === "You cannot add yourself as your coach" ? "BAD_REQUEST"
            : result.error === "You are already connected to this coach" ? "CONFLICT"
            : "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }
      return { success: true };
    }),

  disconnectFromCoach: protectedProcedure
    .input(z.object({ coachId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await coachingService.disconnectFromCoach(ctx.db, ctx.user.id, input.coachId);
      return { success: true };
    }),

  updateClientNotes: protectedProcedure
    .input(updateCoachNotesSchema)
    .mutation(async ({ ctx, input }) => {
      const relation = await ctx.db
        .select({ id: coachClients.id })
        .from(coachClients)
        .where(
          and(
            eq(coachClients.coachId, ctx.user.id),
            eq(coachClients.clientId, input.clientId),
            eq(coachClients.status, "active")
          )
        )
        .then((r) => r[0]);

      if (!relation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      await ctx.db
        .update(coachClients)
        .set({
          coachNotes: input.coachNotes,
          calorieTarget: input.calorieTarget,
          proteinPct: input.proteinPct != null ? String(input.proteinPct) : null,
          carbsPct: input.carbsPct != null ? String(input.carbsPct) : null,
          fatPct: input.fatPct != null ? String(input.fatPct) : null,
          updatedAt: new Date(),
        })
        .where(eq(coachClients.id, relation.id));

      return { success: true };
    }),

  // ─── Coach Messages ───

  sendMessage: protectedProcedure
    .input(sendCoachMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const relation = await ctx.db
        .select({
          id: coachClients.id,
          clientId: coachClients.clientId,
        })
        .from(coachClients)
        .where(
          and(
            eq(coachClients.coachId, ctx.user.id),
            eq(coachClients.clientId, input.clientId),
            eq(coachClients.status, "active")
          )
        )
        .then((r) => r[0]);

      if (!relation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const [message] = await ctx.db
        .insert(coachMessages)
        .values({
          coachClientId: relation.id,
          coachId: ctx.user.id,
          clientId: input.clientId,
          content: input.content,
        })
        .returning();

      // Send push notification (fire-and-forget)
      const coachName = ctx.user.name ?? "Coach";
      sendPushToUser(relation.clientId, {
        type: "coach_message",
        title: `${coachName} sent a message`,
        body:
          input.content.length > 100
            ? input.content.slice(0, 100) + "…"
            : input.content,
        url: "/settings/coaching",
      }).catch((err) => console.error("[coach-message] push failed:", err));

      return message;
    }),

  getClientMessages: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify coach-client relationship
      const relation = await ctx.db
        .select({ id: coachClients.id })
        .from(coachClients)
        .where(
          and(
            eq(coachClients.coachId, ctx.user.id),
            eq(coachClients.clientId, input.clientId),
            eq(coachClients.status, "active")
          )
        )
        .then((r) => r[0]);

      if (!relation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const conditions = [eq(coachMessages.coachClientId, relation.id)];
      if (input.cursor) {
        const cursorMsg = await ctx.db
          .select({ createdAt: coachMessages.createdAt })
          .from(coachMessages)
          .where(eq(coachMessages.id, input.cursor))
          .then((r) => r[0]);
        if (cursorMsg) {
          conditions.push(
            sql`${coachMessages.createdAt} < ${cursorMsg.createdAt}`
          );
        }
      }

      const messages = await ctx.db
        .select()
        .from(coachMessages)
        .where(and(...conditions))
        .orderBy(desc(coachMessages.createdAt))
        .limit(input.limit + 1);

      const hasMore = messages.length > input.limit;
      if (hasMore) messages.pop();

      return {
        messages,
        nextCursor: hasMore ? messages[messages.length - 1]?.id : undefined,
      };
    }),

  getMyMessages: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(coachMessages.clientId, ctx.user.id)];
      if (input.cursor) {
        const cursorMsg = await ctx.db
          .select({ createdAt: coachMessages.createdAt })
          .from(coachMessages)
          .where(eq(coachMessages.id, input.cursor))
          .then((r) => r[0]);
        if (cursorMsg) {
          conditions.push(
            sql`${coachMessages.createdAt} < ${cursorMsg.createdAt}`
          );
        }
      }

      const messages = await ctx.db
        .select({
          id: coachMessages.id,
          content: coachMessages.content,
          readAt: coachMessages.readAt,
          createdAt: coachMessages.createdAt,
          coachId: coachMessages.coachId,
          coachName: users.name,
        })
        .from(coachMessages)
        .innerJoin(users, eq(coachMessages.coachId, users.id))
        .where(and(...conditions))
        .orderBy(desc(coachMessages.createdAt))
        .limit(input.limit + 1);

      const hasMore = messages.length > input.limit;
      if (hasMore) messages.pop();

      return {
        messages,
        nextCursor: hasMore ? messages[messages.length - 1]?.id : undefined,
      };
    }),

  getUnreadMessageCount: protectedProcedure.query(async ({ ctx }) => {
    const [result] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(coachMessages)
      .where(
        and(
          eq(coachMessages.clientId, ctx.user.id),
          isNull(coachMessages.readAt)
        )
      );
    return { count: result?.count ?? 0 };
  }),

  markMessagesRead: protectedProcedure
    .input(markCoachMessagesReadSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(coachMessages)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(coachMessages.clientId, ctx.user.id),
            inArray(coachMessages.id, input.messageIds),
            isNull(coachMessages.readAt)
          )
        );
      return { success: true };
    }),
});

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}
