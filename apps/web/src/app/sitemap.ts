import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

const BASE_URL = "https://openhealth.blog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/docs`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/hub/food/scan`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/hub/chat`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/hub/documents`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];

  const posts = await db
    .select({
      slug: blogPosts.slug,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.videoPublishedAt))
    .limit(200)
    .catch((error: unknown) => {
      console.error("Sitemap blog posts unavailable:", error);
      return [];
    });

  for (const post of posts) {
    entries.push({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt ?? new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}
