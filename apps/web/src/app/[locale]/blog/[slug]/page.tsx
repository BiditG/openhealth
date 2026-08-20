import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { SiteNav } from "@/components/layout/site-nav";
import { BlogPostContent } from "./blog-post-content";
import { defaultLocale, type Locale } from "@/lib/i18n-config";

export const dynamic = "force-dynamic";

const BASE_URL = "https://openhealth.blog";

const notFoundTitles: Record<Locale, string> = {
  en: "Not Found — Swastha",
};

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

async function getPost(slug: string, locale: string) {
  const result = await db
    .select()
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.slug, slug),
        eq(blogPosts.status, "published"),
        eq(blogPosts.locale, locale)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const lang = (locale as Locale) || defaultLocale;
  const post = await getPost(slug, lang);
  if (!post) return { title: notFoundTitles[lang] };

  return {
    title: `${post.title} — Swastha`,
    description: post.summary?.slice(0, 160) ?? "",
    openGraph: {
      title: post.title,
      description: post.summary?.slice(0, 160) ?? "",
      type: "article",
      images: post.thumbnailUrl ? [{ url: post.thumbnailUrl }] : [],
    },
    alternates: {
      canonical: `${BASE_URL}/blog/${slug}`,
      languages: { en: `${BASE_URL}/blog/${slug}` },
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const lang = (locale as Locale) || defaultLocale;
  const post = await getPost(slug, lang);
  if (!post) notFound();

  return (
    <div className="bg-white dark:bg-black text-black dark:text-white min-h-screen selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      <SiteNav />
      <BlogPostContent post={post} />
    </div>
  );
}
