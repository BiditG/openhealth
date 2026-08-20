import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { blogPosts } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";

export const blogRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(20),
          offset: z.number().min(0).default(0),
          locale: z.string().default("en"),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const locale = input?.locale ?? "en";

      const posts = await ctx.db
        .select({
          id: blogPosts.id,
          title: blogPosts.title,
          slug: blogPosts.slug,
          summary: blogPosts.summary,
          thumbnailUrl: blogPosts.thumbnailUrl,
          youtubeVideoId: blogPosts.youtubeVideoId,
          tags: blogPosts.tags,
          createdAt: blogPosts.createdAt,
          videoPublishedAt: blogPosts.videoPublishedAt,
        })
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.status, "published"),
            eq(blogPosts.locale, locale)
          )
        )
        .orderBy(desc(blogPosts.createdAt))
        .limit(limit)
        .offset(offset);

      return posts;
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string(), locale: z.string().default("en") }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.db
        .select()
        .from(blogPosts)
        .where(
          and(
            eq(blogPosts.slug, input.slug),
            eq(blogPosts.status, "published"),
            eq(blogPosts.locale, input.locale)
          )
        )
        .limit(1);

      return post[0] ?? null;
    }),
});
