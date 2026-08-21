"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Activity, Camera, Leaf, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import Link from "next/link";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

const infiniteOpts = {
  getNextPageParam: (lastPage: unknown[], allPages: unknown[][]) =>
    lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
  initialCursor: 0,
};

export default function FoodBrowsePage() {
  const { t } = useTranslation("food");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const hasSearchInput = query.trim().length >= 1;
  const canSearchServer = debouncedQuery.length >= 2;

  const searchQuery = trpc.food.search.useInfiniteQuery(
    { query: debouncedQuery, limit: PAGE_SIZE },
    { enabled: canSearchServer, staleTime: 60_000, retry: false, ...infiniteOpts }
  );

  const globalPopularQuery = trpc.food.getGlobalPopular.useInfiniteQuery(
    { limit: PAGE_SIZE },
    { enabled: !hasSearchInput, staleTime: 10 * 60 * 1000, retry: false, ...infiniteOpts }
  );

  const activeQuery = hasSearchInput ? searchQuery : globalPopularQuery;
  const displayFoods = activeQuery.data?.pages.flat() ?? [];
  const isLoadingInitial = hasSearchInput ? canSearchServer && searchQuery.isLoading : activeQuery.isLoading;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = activeQuery;
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const sectionLabel = hasSearchInput ? t("searchResults") : t("popularFoods");

  return (
    <div className="mx-auto max-w-[760px] space-y-5 px-4 py-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-primary">Food</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Search foods, compare calories, or scan your next meal.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link href="/hub/food/scan-label">
            <Button>
              <Camera className="h-4 w-4" />
              Snap Food
            </Button>
          </Link>
          <Link href="/hub/food/scan-label?mode=workout">
            <Button variant="outline">
              <Activity className="h-4 w-4" />
              Workout Analyzer
            </Button>
          </Link>
          <Link href="/hub/food/scan-label?mode=meditation">
            <Button variant="outline">
              <Leaf className="h-4 w-4" />
              Meditation
            </Button>
          </Link>
        </div>
      </section>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
        <Input
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12"
          autoFocus
        />
      </div>

      <h2 className="text-lg font-semibold text-foreground">{sectionLabel}</h2>

      {isLoadingInitial ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : displayFoods.length > 0 ? (
        <div className="space-y-2">
          {displayFoods.map((food) => (
            <Link
              key={food.id}
              href={`/hub/food/${food.id}`}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:border-primary/30 hover:bg-secondary/40 dark:bg-card"
            >
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-base font-semibold text-foreground">{food.name}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {food.servingSize}
                  {food.servingUnit}
                  {food.brand ? ` · ${food.brand}` : ""}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-background px-3 py-2 text-right">
                <p className="text-base font-semibold tabular-nums text-foreground">
                  {Math.round(Number(food.calories))}
                </p>
                <p className="text-xs text-muted-foreground">kcal</p>
              </div>
            </Link>
          ))}

          <div ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingNextPage && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" strokeWidth={1.8} />
            )}
          </div>
        </div>
      ) : hasSearchInput && query.trim().length < 2 ? (
        <div className="rounded-3xl border border-dashed border-border bg-white p-8 text-center dark:bg-card">
          <Search className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Enter at least two letters to search.</p>
        </div>
      ) : hasSearchInput ? (
        <div className="rounded-3xl border border-dashed border-border bg-white p-8 text-center dark:bg-card">
          <Search className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">{t("notFoundQuery", { query })}</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-white p-8 text-center dark:bg-card">
          <Search className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">{t("noFoodData")}</p>
        </div>
      )}
    </div>
  );
}
