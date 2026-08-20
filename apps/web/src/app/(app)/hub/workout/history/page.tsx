"use client";

import Link from "next/link";
import { Clock, Dumbbell, Trophy, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { LoginDialog } from "@/components/auth/login-dialog";
import { formatDuration } from "@/hooks/use-workout-timer";
import { useTranslation } from "react-i18next";

export default function WorkoutHistoryPage() {
  const { t } = useTranslation(["workout", "common"]);
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } =
    useAuthGuard();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.workout.getHistory.useInfiniteQuery(
      { limit: 20 },
      {
        enabled: isAuthenticated,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/hub/workout"
          className="text-neutral-400 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </Link>
        <h1 className="text-xl font-light tracking-wide">{t("workout:history")}</h1>
      </div>

      {allItems.length > 0 ? (
        <div className="space-y-0">
          {allItems.map((w) => (
            <Link
              key={w.id}
              href={`/hub/workout/history/${w.id}`}
              className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors -mx-1 px-1 rounded"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-light truncate">{w.name}</span>
                  {w.prCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                      <Trophy className="h-3 w-3" strokeWidth={2} />
                      {w.prCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-neutral-400">
                    {formatDate(w.startedAt)}
                  </span>
                  <span className="text-xs text-neutral-400 tabular-nums">
                    <Clock
                      className="h-3 w-3 inline mr-0.5"
                      strokeWidth={1.5}
                    />
                    {w.durationSec ? formatDuration(w.durationSec) : "-"}
                  </span>
                  <span className="text-xs text-neutral-400 tabular-nums">
                    <Dumbbell
                      className="h-3 w-3 inline mr-0.5"
                      strokeWidth={1.5}
                    />
                    {t("workout:exerciseAndSets", { exercises: w.exerciseCount, sets: w.totalSets })}
                  </span>
                </div>
              </div>
              <div className="text-right ml-2">
                <span className="text-sm font-light tabular-nums text-primary">
                  {Math.round(w.totalVolume).toLocaleString()} kg
                </span>
              </div>
            </Link>
          ))}

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full py-3 text-sm text-neutral-400 hover:text-foreground transition-colors"
            >
              {isFetchingNextPage ? t("common:buttons.loading") : t("workout:loadMore")}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm font-light text-neutral-300 dark:text-neutral-700 text-center py-10">
          {t("workout:noHistory")}
        </p>
      )}

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}
