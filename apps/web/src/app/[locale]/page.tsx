import type { Metadata } from "next";
import { SiteNav } from "@/components/layout/site-nav";
import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { LandingContent } from "./landing-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

export const dynamic = "force-dynamic";

const BASE_URL = "https://openhealth.blog";

interface Props {
  params: Promise<{ locale: string }>;
}

const descriptions: Record<Locale, string> = {
  en: "A mobile-first health platform for Nepal: understand food, track wellness, explain reports, and ask educational health questions with AI.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  return {
    title: "Swastha — Personal Health, Food, and Wellness AI for Nepal",
    description: descriptions[lang],
    alternates: {
      canonical: BASE_URL,
      languages: { en: BASE_URL },
    },
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  const lang = (locale as Locale) || defaultLocale;

  const recentPosts = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      summary: blogPosts.summary,
      thumbnailUrl: blogPosts.thumbnailUrl,
      tags: blogPosts.tags,
      videoPublishedAt: blogPosts.videoPublishedAt,
      createdAt: blogPosts.createdAt,
    })
    .from(blogPosts)
    .where(
      and(eq(blogPosts.status, "published"), eq(blogPosts.locale, lang))
    )
    .orderBy(desc(blogPosts.videoPublishedAt))
    .limit(3)
    .catch((error: unknown) => {
      console.error("Landing page recent posts unavailable:", error);
      return [];
    });

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SiteNav />
      <LandingContent posts={recentPosts} />
    </div>
  );
}
