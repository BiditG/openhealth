import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import {
  dailyGuidanceNotifications,
  healthTaskCompletions,
  pushSubscriptions,
  pushTokens,
  users,
} from "@/server/db/schema";
import { sendPushToUser } from "@/server/services/push";

async function assertAdmin(ctx: { db: typeof import("@/server/db").db; user: { id: string } }) {
  const row = await ctx.db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .then((result) => result[0]);

  if (!row?.isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  }
}

const userUpdateSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  plan: z.enum(["free", "pro"]),
  isActive: z.boolean(),
  isAdmin: z.boolean(),
});

const activationDurationSchema = z.enum(["none", "1m", "6m", "1y"]).default("none");

function getPlanExpiry(duration: z.infer<typeof activationDurationSchema>) {
  if (duration === "none") return null;
  const expiresAt = new Date();
  if (duration === "1m") expiresAt.setMonth(expiresAt.getMonth() + 1);
  if (duration === "6m") expiresAt.setMonth(expiresAt.getMonth() + 6);
  if (duration === "1y") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  return expiresAt;
}

export const adminRouter = router({
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);

    const [totalUsers, activeUsers, pendingUsers, admins, completions, pushTokenCount] = await Promise.all([
      ctx.db.select({ value: count() }).from(users).then((rows) => rows[0]?.value ?? 0),
      ctx.db.select({ value: count() }).from(users).where(eq(users.isActive, true)).then((rows) => rows[0]?.value ?? 0),
      ctx.db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.isActive, false), eq(users.isAdmin, false)))
        .then((rows) => rows[0]?.value ?? 0),
      ctx.db.select({ value: count() }).from(users).where(eq(users.isAdmin, true)).then((rows) => rows[0]?.value ?? 0),
      ctx.db
        .select({
          total: count(),
          points: sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`,
        })
        .from(healthTaskCompletions)
        .then((rows) => rows[0]),
      ctx.db.select({ value: count() }).from(pushTokens).then((rows) => rows[0]?.value ?? 0),
    ]);

    return {
      totalUsers,
      activeUsers,
      pendingUsers,
      admins,
      completions: completions?.total ?? 0,
      pointsAwarded: Number(completions?.points ?? 0),
      pushTokenCount,
    };
  }),

  listUsers: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        status: z.enum(["all", "active", "pending", "admin"]).default("all"),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);

      const filters = [];
      const query = input.query?.trim();
      if (query) {
        filters.push(or(ilike(users.email, `%${query}%`), ilike(users.name, `%${query}%`)));
      }
      if (input.status === "active") filters.push(eq(users.isActive, true));
      if (input.status === "pending") filters.push(and(eq(users.isActive, false), eq(users.isAdmin, false)));
      if (input.status === "admin") filters.push(eq(users.isAdmin, true));

      const where = filters.length ? and(...filters) : undefined;
      const rows = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          plan: users.plan,
          isActive: users.isActive,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(input.limit);

      const completionRows = rows.length
        ? await ctx.db
            .select({
              userId: healthTaskCompletions.userId,
              taskCompletions: count(),
              points: sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`,
            })
            .from(healthTaskCompletions)
            .where(inArray(healthTaskCompletions.userId, rows.map((row) => row.id)))
            .groupBy(healthTaskCompletions.userId)
            .catch((error) => {
              console.warn("Admin completion stats unavailable; showing zeroes.", error);
              return [];
            })
        : [];
      const completionsByUser = new Map(
        completionRows.map((row) => [
          row.userId,
          {
            taskCompletions: Number(row.taskCompletions ?? 0),
            points: Number(row.points ?? 0),
          },
        ])
      );

      const tokenRows = await ctx.db
        .select({
          userId: pushTokens.userId,
          value: count(),
        })
        .from(pushTokens)
        .groupBy(pushTokens.userId)
        .catch((error) => {
          console.warn("Admin push token stats unavailable; showing zeroes.", error);
          return [];
        });
      const tokensByUser = new Map(tokenRows.map((row) => [row.userId, row.value]));

      return rows.map((row) => ({
        ...row,
        planExpiresAt: null,
        points: completionsByUser.get(row.id)?.points ?? 0,
        taskCompletions: completionsByUser.get(row.id)?.taskCompletions ?? 0,
        pushTokens: Number(tokensByUser.get(row.id) ?? 0),
      }));
    }),

  createUser: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email().max(255),
        isActive: z.boolean().default(true),
        isAdmin: z.boolean().default(false),
        plan: z.enum(["free", "pro"]).default("free"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const id = `admin_${crypto.randomUUID()}`;
      await ctx.db.insert(users).values({
        id,
        name: input.name,
        email: input.email,
        isActive: input.isActive,
        isAdmin: input.isAdmin,
        plan: input.plan,
        emailVerified: true,
      });
      return { success: true, id };
    }),

  updateUser: protectedProcedure.input(userUpdateSchema).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    if (input.userId === ctx.user.id && !input.isAdmin) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove your own admin access." });
    }
    await ctx.db
      .update(users)
      .set({
        name: input.name,
        email: input.email,
        plan: input.plan,
        isActive: input.isActive,
        isAdmin: input.isAdmin,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId));
    return { success: true };
  }),

  setActive: protectedProcedure
    .input(z.object({ userId: z.string().min(1), isActive: z.boolean(), duration: activationDurationSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const planExpiresAt = input.isActive ? getPlanExpiry(input.duration ?? "1m") : null;
      await ctx.db
        .update(users)
        .set({
          isActive: input.isActive,
          plan: input.isActive ? "pro" : "free",
          planExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  deleteUser: protectedProcedure.input(z.object({ userId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    if (input.userId === ctx.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account." });
    }
    const target = await ctx.db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, input.userId))
      .then((rows) => rows[0]);
    if (target?.isAdmin) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Admin users cannot be deleted from this panel." });
    }
    await ctx.db.delete(users).where(eq(users.id, input.userId));
    return { success: true };
  }),

  sendNotification: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(160),
        body: z.string().min(1).max(500),
        target: z.enum(["all", "active", "selected"]).default("active"),
        userIds: z.array(z.string()).default([]),
        url: z.string().default("/hub/notifications"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const today = new Date().toISOString().slice(0, 10);
      let targetUsers: Array<{ id: string }> = [];

      if (input.target === "selected") {
        if (!input.userIds.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Select at least one user." });
        }
        targetUsers = await ctx.db.select({ id: users.id }).from(users).where(inArray(users.id, input.userIds));
      } else {
        targetUsers = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(input.target === "active" ? eq(users.isActive, true) : undefined);
      }

      if (targetUsers.length) {
        await ctx.db
          .insert(dailyGuidanceNotifications)
          .values(
            targetUsers.map((user) => ({
              userId: user.id,
              notificationDate: today,
              title: input.title,
              body: input.body,
              tone: "admin",
            }))
          )
          .onConflictDoUpdate({
            target: [
              dailyGuidanceNotifications.userId,
              dailyGuidanceNotifications.notificationDate,
              dailyGuidanceNotifications.title,
            ],
            set: {
              body: input.body,
              tone: "admin",
              readAt: null,
            },
          });
      }

      let pushAttempts = 0;
      await Promise.all(
        targetUsers.map(async (user) => {
          pushAttempts += 1;
          await sendPushToUser(user.id, {
            type: "admin",
            title: input.title,
            body: input.body,
            url: input.url || "/hub/notifications",
            tag: "admin-broadcast",
          });
        })
      );

      return { success: true, recipients: targetUsers.length, pushAttempts };
    }),

  getNotificationReadiness: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const [tokens, subscriptions] = await Promise.all([
      ctx.db.select({ value: count() }).from(pushTokens).then((rows) => rows[0]?.value ?? 0),
      ctx.db.select({ value: count() }).from(pushSubscriptions).then((rows) => rows[0]?.value ?? 0),
    ]);
    return { tokens, subscriptions };
  }),
});
