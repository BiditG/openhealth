import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { chatSessions, chatMessages } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAiUsage } from "@/server/services/plan";

export const chatRouter = router({
  createSession: protectedProcedure
    .input(z.object({ title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .insert(chatSessions)
        .values({
          userId: ctx.user.id,
          title: input.title.slice(0, 50) || "New conversation",
        })
        .returning({ id: chatSessions.id });
      return { id: session.id };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(chatSessions)
        .where(
          and(
            eq(chatSessions.id, input.sessionId),
            eq(chatSessions.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  listSessions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .where(eq(chatSessions.userId, ctx.user.id))
      .orderBy(desc(chatSessions.updatedAt))
      .limit(20);
  }),

  getMessages: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify session belongs to user
      const session = await ctx.db.query.chatSessions.findFirst({
        where: and(
          eq(chatSessions.id, input.sessionId),
          eq(chatSessions.userId, ctx.user.id)
        ),
      });

      if (!session) {
        return [];
      }

      return ctx.db
        .select({
          id: chatMessages.id,
          role: chatMessages.role,
          content: chatMessages.content,
          parts: chatMessages.parts,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, input.sessionId))
        .orderBy(chatMessages.createdAt);
    }),

  getDailyUsage: protectedProcedure.query(async ({ ctx }) => {
    return getAiUsage(ctx.user.id, "chat", ctx.userPlan);
  }),
});
