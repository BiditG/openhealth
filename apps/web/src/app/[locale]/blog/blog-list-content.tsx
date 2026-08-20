"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useLocalePath } from "@/hooks/use-locale-path";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  thumbnailUrl: string | null;
  tags: string[] | null;
  createdAt: Date;
  videoPublishedAt: Date | null;
}

export function BlogListContent({ posts }: { posts: BlogPost[] }) {
  const { t, i18n } = useTranslation("blog");
  const lp = useLocalePath();
  const dateLocale = i18n.language === "en" ? "en-US" : "en-US";

  return (
    <main className="max-w-4xl mx-auto px-6 pt-28 pb-16 md:pt-32 md:pb-24">
      <p className="text-[10px] tracking-[0.4em] text-neutral-400 dark:text-neutral-600 uppercase mb-4">
        Journal
      </p>
      <h1 className="text-4xl md:text-5xl font-extralight mb-8">{t("title")}</h1>
      <p className="text-neutral-500 font-light mb-20 max-w-xl text-sm">
        {t("subtitle")}
      </p>

      {posts.length === 0 ? (
        <div className="border border-black/[0.06] dark:border-white/[0.06] py-24 md:py-32 flex flex-col items-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 120 120"
            fill="none"
            aria-hidden="true"
            className="mb-10 opacity-10"
          >
            <circle
              cx="60"
              cy="60"
              r="50"
              className="stroke-black dark:stroke-white"
              strokeWidth="1.5"
              strokeDasharray="314"
              strokeDashoffset="30"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-neutral-400 dark:text-neutral-600 font-light text-sm">{t("comingSoon")}</p>
          <p className="text-neutral-300 dark:text-neutral-800 font-light text-xs mt-3">
            {t("writingFirst")}
          </p>
        </div>
      ) : (
        <div className="space-y-px">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={lp(`/blog/${post.slug}`)}
              className="group block border border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12] transition-colors duration-300"
            >
              <div className="flex flex-col md:flex-row">
                {post.thumbnailUrl && (
                  <div className="md:w-72 md:flex-shrink-0 aspect-video md:aspect-auto relative overflow-hidden">
                    <Image
                      src={post.thumbnailUrl}
                      alt={post.title}
                      fill
                      className="object-cover opacity-90 group-hover:opacity-100 dark:opacity-90 dark:group-hover:opacity-100 transition-opacity duration-300"
                      sizes="(max-width: 768px) 100vw, 288px"
                    />
                  </div>
                )}
                <div className="p-6 md:p-8 flex flex-col justify-center min-w-0">
                  <time className="text-[10px] tracking-[0.3em] text-neutral-400 dark:text-neutral-600 uppercase mb-3">
                    {new Date(post.videoPublishedAt ?? post.createdAt).toLocaleDateString(dateLocale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  <h2 className="text-lg md:text-xl font-light mb-3 group-hover:text-black/80 dark:group-hover:text-white/90 transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-sm text-neutral-500 font-light line-clamp-2 mb-4">
                    {post.summary?.slice(0, 150)}
                    {(post.summary?.length ?? 0) > 150 ? "…" : ""}
                  </p>
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {post.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] tracking-wider text-neutral-400 dark:text-neutral-600 border border-black/[0.06] dark:border-white/[0.06] px-2 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-16 border-t border-black/[0.06] dark:border-white/[0.06] pt-8">
        <Link
          href={lp("/")}
          className="text-xs text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white transition-colors duration-300 tracking-wider"
        >
          {t("backToHome")}
        </Link>
      </div>
    </main>
  );
}
