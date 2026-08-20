"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Dumbbell, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { LoginDialog } from "@/components/auth/login-dialog";
import { formatDuration } from "@/hooks/use-workout-timer";
import { useTranslation } from "react-i18next";

export default function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useTranslation(["workout", "common", "exercise"]);
  const { id } = use(params);
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } =
    useAuthGuard();

  const { data: workout, isLoading } = trpc.workout.getById.useQuery(
    { id },
    { enabled: isAuthenticated }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-sm text-neutral-400">{t("workout:detailPage.notFound")}</p>
        <Link
          href="/hub/workout/history"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          {t("workout:detailPage.backToHistory")}
        </Link>
      </div>
    );
  }

  const totalVolume = workout.exercises.reduce((sum, ex) => {
    return (
      sum +
      ex.sets
        .filter((s) => !s.isWarmup)
        .reduce(
          (setSum, s) =>
            setSum + (Number(s.weightKg || 0) * (s.reps || 0)),
          0
        )
    );
  }, 0);

  const totalSets = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.length,
    0
  );

  const prCount = workout.exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.filter((s) => s.isPersonalRecord).length,
    0
  );

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/hub/workout/history"
          className="text-neutral-400 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="text-lg font-light">{workout.name}</h1>
          <p className="text-xs text-neutral-400">
            {formatDate(workout.startedAt)} · {formatTime(workout.startedAt)}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
          <Clock
            className="h-4 w-4 text-neutral-400 mx-auto mb-1"
            strokeWidth={1.5}
          />
          <p className="text-lg font-extralight tabular-nums">
            {workout.durationSec ? formatDuration(workout.durationSec) : "-"}
          </p>
          <p className="text-[10px] text-neutral-400">{t("workout:detailPage.duration")}</p>
        </div>
        <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
          <Dumbbell
            className="h-4 w-4 text-neutral-400 mx-auto mb-1"
            strokeWidth={1.5}
          />
          <p className="text-lg font-extralight tabular-nums text-primary">
            {Math.round(totalVolume).toLocaleString()}
          </p>
          <p className="text-[10px] text-neutral-400">{t("workout:detailPage.totalVolume")}</p>
        </div>
        <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
          <Trophy
            className="h-4 w-4 text-neutral-400 mx-auto mb-1"
            strokeWidth={1.5}
          />
          <p className="text-lg font-extralight tabular-nums">
            {workout.exercises.length} · {totalSets}
          </p>
          <p className="text-[10px] text-neutral-400">{t("workout:detailPage.exercisesAndSets")}</p>
        </div>
      </div>

      {prCount > 0 && (
        <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500/10 text-amber-500 text-sm">
          <Trophy className="h-4 w-4" strokeWidth={2} />
          {t("workout:detailPage.personalRecords", { count: prCount })}
        </div>
      )}

      {/* Exercises detail */}
      <div className="space-y-4">
        {workout.exercises.map((ex) => (
          <div
            key={ex.weId}
            className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden"
          >
            <div className="p-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">
                  {ex.exerciseName}
                </span>
                {ex.exerciseCategory && (
                  <span className="text-[10px] text-neutral-400">
                    {t(`exercise:categories.${ex.exerciseCategory}`, { defaultValue: ex.exerciseCategory })}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3">
              {/* Column headers */}
              <div className="grid grid-cols-[40px_1fr_1fr] gap-2 text-[10px] text-neutral-400 mb-1">
                <span>{t("workout:detailPage.set")}</span>
                <span>{t("workout:detailPage.weightKg")}</span>
                <span>{t("workout:detailPage.reps")}</span>
              </div>

              {ex.sets.map((set) => (
                <div
                  key={set.id}
                  className={`grid grid-cols-[40px_1fr_1fr] gap-2 py-1 text-sm font-light ${
                    set.isPersonalRecord ? "text-amber-500" : ""
                  }`}
                >
                  <span
                    className={`text-xs ${
                      set.isWarmup ? "text-amber-400" : "text-neutral-400"
                    }`}
                  >
                    {set.isWarmup ? "W" : set.setNumber}
                  </span>
                  <span className="tabular-nums">
                    {set.weightKg ? Number(set.weightKg) : "-"}
                    {set.isPersonalRecord && (
                      <Trophy
                        className="h-3 w-3 inline ml-1 text-amber-500"
                        strokeWidth={2}
                      />
                    )}
                  </span>
                  <span className="tabular-nums">{set.reps ?? "-"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {workout.note && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-3">
          <p className="text-xs text-neutral-400 mb-1">{t("common:labels.notes")}</p>
          <p className="text-sm font-light">{workout.note}</p>
        </div>
      )}

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}
