"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Loader2, MessageSquare, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";
import { logFood } from "@/server/actions/diary";
import { toast } from "sonner";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

const infiniteOpts = {
  getNextPageParam: (lastPage: unknown[], allPages: unknown[][]) =>
    lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
  initialCursor: 0,
};

function FoodSearchContent() {
  const { t } = useTranslation(["food", "diary", "common"]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const meal = (searchParams.get("meal") || "snack") as "breakfast" | "lunch" | "dinner" | "snack";

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingFoodId, setPendingFoodId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } = useAuthGuard();
  const utils = trpc.useUtils();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const hasSearchInput = query.trim().length >= 1;
  const canSearchServer = hasHydrated && debouncedQuery.length >= 2;

  const searchQuery = trpc.food.search.useInfiniteQuery(
    { query: debouncedQuery, limit: PAGE_SIZE },
    { enabled: canSearchServer, staleTime: 60_000, retry: false, ...infiniteOpts }
  );
  const frequentQuery = trpc.food.getFrequent.useInfiniteQuery(
    { limit: PAGE_SIZE },
    { enabled: hasHydrated && isAuthenticated && !hasSearchInput, staleTime: 5 * 60 * 1000, retry: false, ...infiniteOpts }
  );
  const hasUserFrequent = frequentQuery.data && frequentQuery.data.pages[0]?.length > 0;
  const globalPopularQuery = trpc.food.getGlobalPopular.useInfiniteQuery(
    { limit: PAGE_SIZE },
    {
      enabled: hasHydrated && !hasSearchInput && !frequentQuery.isLoading && !hasUserFrequent && filter === "all",
      staleTime: 10 * 60 * 1000,
      retry: false,
      ...infiniteOpts,
    },
  );
  const myFoodsQuery = trpc.food.getMyFoods.useInfiniteQuery(
    { limit: PAGE_SIZE },
    { enabled: hasHydrated && isAuthenticated && filter === "mine" && !hasSearchInput, staleTime: 5 * 60 * 1000, retry: false, ...infiniteOpts },
  );

  const activeQuery =
    hasSearchInput ? searchQuery : filter === "mine" ? myFoodsQuery : hasUserFrequent ? frequentQuery : globalPopularQuery;

  const displayFoods = activeQuery.data?.pages.flat() ?? [];
  const isLoadingInitial =
    hasSearchInput
      ? canSearchServer && searchQuery.isLoading
      : filter === "mine"
        ? myFoodsQuery.isLoading
        : frequentQuery.isLoading || (!hasUserFrequent && globalPopularQuery.isLoading);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = activeQuery;
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const doLogFood = (foodId: string) => {
    startTransition(async () => {
      try {
        await logFood({ date, mealType: meal, foodId, servingQty: 1 });
        await utils.diary.getDay.invalidate();
        const food = displayFoods.find((f) => f.id === foodId);
        posthog.capture("food_logged", {
          source: "search",
          meal_type: meal,
          calories: food ? Math.round(Number(food.calories)) : undefined,
        });
        toast.success(t("common:toast.addedToDiary"));
        router.push(`/hub/diary?date=${date}`);
        router.refresh();
      } catch (err) {
        console.error("logFood failed:", err);
        toast.error(t("common:toast.addFailed"));
      }
    });
  };

  const handleQuickAdd = (foodId: string) => {
    if (!isAuthenticated) {
      setPendingFoodId(foodId);
      setShowLoginDialog(true);
      return;
    }
    doLogFood(foodId);
  };

  const handleLoginSuccess = () => {
    if (pendingFoodId) {
      doLogFood(pendingFoodId);
      setPendingFoodId(null);
    } else {
      router.refresh();
    }
  };

  const sectionLabel =
    hasSearchInput
      ? t("food:searchResults")
      : filter === "mine"
        ? t("food:myCreatedFoods")
        : hasUserFrequent
          ? t("food:frequentFoods")
          : t("food:mostUsed");

  return (
    <div className="mx-auto max-w-[760px] space-y-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href={`/hub/diary?date=${date}`}>
          <Button variant="ghost" size="icon" aria-label="Back to diary">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <p className="text-sm font-semibold text-primary">{t("food:addToMeal", { meal: t(`diary:${meal}`) })}</p>
          <h1 className="text-3xl font-semibold text-foreground">Find food</h1>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-white p-4 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
          <Input
            placeholder={t("food:searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-14"
            autoFocus
          />
          <Link href={`/hub/food/scan-label?date=${date}&meal=${meal}`} className="absolute right-1 top-1/2 -translate-y-1/2">
            <Button variant="ghost" size="icon" aria-label="Snap food">
              <Camera className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <EntryLink href={`/hub/food/create?date=${date}&meal=${meal}`} icon={Plus} label={t("food:customFood")} />
          <EntryLink href={`/hub/food/scan-label?date=${date}&meal=${meal}`} icon={Camera} label={t("food:scanLabel")} />
          <EntryLink href={`/hub/food/estimate?date=${date}&meal=${meal}`} icon={MessageSquare} label={t("food:aiEstimate")} />
        </div>
      </div>

      {isAuthenticated && (
        <div className="inline-flex rounded-xl border border-border bg-white p-1 dark:bg-card">
          {[
            ["all", t("food:all")],
            ["mine", t("food:myFoods")],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as "all" | "mine")}
              className={cn(
                "min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors",
                filter === value ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{sectionLabel}</h2>
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        {isLoadingInitial ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : displayFoods.length > 0 ? (
          <div className="space-y-2">
            {displayFoods.map((food) => (
              <button
                key={food.id}
                onClick={() => handleQuickAdd(food.id)}
                disabled={isPending}
                className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border border-border bg-white p-4 text-left transition-all duration-200 hover:border-primary/30 hover:bg-secondary/40 disabled:opacity-50 dark:bg-card"
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
                  <p className="text-base font-semibold tabular-nums text-foreground">{Math.round(Number(food.calories))}</p>
                  <p className="text-xs text-muted-foreground">kcal</p>
                </div>
              </button>
            ))}
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          </div>
        ) : hasSearchInput && query.trim().length < 2 ? (
          <EmptyFoodState
            title="Keep typing"
            body="Enter at least two letters for faster food results."
            actionHref={`/hub/food/create?date=${date}&meal=${meal}&name=${query}`}
            actionLabel={t("food:createCustomFood")}
          />
        ) : hasSearchInput ? (
          <EmptyFoodState
            title={t("food:notFoundQuery", { query })}
            body="Create it once and it will be easier to add next time."
            actionHref={`/hub/food/create?date=${date}&meal=${meal}&name=${query}`}
            actionLabel={t("food:createCustomFood")}
          />
        ) : (
          <EmptyFoodState
            title={t("food:noFrequentFoods")}
            body={t("food:noFrequentFoodsHint")}
            actionHref={`/hub/food/estimate?date=${date}&meal=${meal}`}
            actionLabel="Describe a meal"
          />
        )}
      </section>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} onSuccess={handleLoginSuccess} />
    </div>
  );
}

function EntryLink({ href, icon: Icon, label }: { href: string; icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function EmptyFoodState({ title, body, actionHref, actionLabel }: { title: string; body: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-white p-8 text-center dark:bg-card">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Search className="h-7 w-7" />
      </div>
      <p className="mt-4 text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      <Link href={actionHref} className="mt-5 inline-flex">
        <Button>{actionLabel}</Button>
      </Link>
    </div>
  );
}

export default function FoodSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[760px] space-y-4 px-4 py-6">
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="h-36 animate-pulse rounded-3xl bg-muted" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      }
    >
      <FoodSearchContent />
    </Suspense>
  );
}
