"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, TrendingUp, Search } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { LoginDialog } from "@/components/auth/login-dialog";
import {
  EXERCISE_CATEGORIES,
} from "@open-health/shared/constants";
import { useTranslation } from "react-i18next";

const PERIOD_VALUES = ["1m", "3m", "6m", "1y", "all"] as const;

const PR_TYPE_KEYS: Record<string, string> = {
  weight: "workout:statsPage.maxWeight",
  "1rm": "workout:statsPage.estimated1rm",
  volume: "workout:statsPage.maxVolume",
  reps: "workout:statsPage.maxReps",
};

export default function WorkoutStatsPage() {
  const { t } = useTranslation(["workout", "common", "exercise"]);
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } =
    useAuthGuard();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );
  const [period, setPeriod] = useState<"1m" | "3m" | "6m" | "1y" | "all">(
    "3m"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();

  // Get all exercises to pick from
  const { data: presets } = trpc.exercise.getPresets.useQuery(
    selectedCategory
      ? {
          category: selectedCategory as
            | "cardio"
            | "strength"
            | "flexibility"
            | "sport"
            | "other",
        }
      : {},
    { enabled: isAuthenticated && searchQuery.trim().length < 1, staleTime: 60_000, retry: false }
  );
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const { data: searchResults } = trpc.exercise.searchExercises.useQuery(
    { query: debouncedSearchQuery },
    { enabled: isAuthenticated && debouncedSearchQuery.length >= 2, staleTime: 60_000, retry: false }
  );

  const exerciseList = searchQuery.trim().length >= 1 ? searchResults : presets;
  const selectedExercise = exerciseList?.find(
    (e) => e.id === selectedExerciseId
  );

  // Stats for selected exercise
  const { data: stats } = trpc.workout.getStats.useQuery(
    { exerciseId: selectedExerciseId!, period },
    { enabled: !!selectedExerciseId }
  );

  // PRs for selected exercise
  const { data: prs } = trpc.workout.getPersonalRecords.useQuery(
    { exerciseId: selectedExerciseId! },
    { enabled: !!selectedExerciseId }
  );

  // All PRs
  const { data: allPrs } = trpc.workout.getPersonalRecords.useQuery(
    undefined,
    { enabled: isAuthenticated && !selectedExerciseId }
  );

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/hub/workout"
          className="text-neutral-400 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </Link>
        <h1 className="text-xl font-light tracking-wide">{t("workout:statsPage.title")}</h1>
      </div>

      {/* Exercise selector */}
      <div className="space-y-2">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("workout:statsPage.searchPlaceholder")}
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent pl-9 pr-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {!searchQuery && (
          <div className="flex gap-1.5 flex-wrap">
            {EXERCISE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === cat ? undefined : cat
                  )
                }
                className={`px-2.5 py-1 rounded-full text-xs font-light transition-all ${
                  selectedCategory === cat
                    ? "bg-primary text-white"
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
                }`}
              >
                {t(`exercise:categories.${cat}`)}
              </button>
            ))}
          </div>
        )}

        {/* Quick exercise picker */}
        {(searchQuery || selectedCategory) && !selectedExerciseId && (
          <div className="max-h-40 overflow-y-auto space-y-0 rounded-lg border border-black/[0.06] dark:border-white/[0.06]">
            {exerciseList && exerciseList.length > 0 ? (
              exerciseList.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => {
                    setSelectedExerciseId(ex.id);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center justify-between py-2 px-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-left border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
                >
                  <span className="text-sm font-light">{ex.name}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-neutral-400 text-center py-3">
                {t("workout:statsPage.noMatch")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Selected exercise stats */}
      {selectedExerciseId && selectedExercise && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp
                className="h-4 w-4 text-primary"
                strokeWidth={1.5}
              />
              <span className="text-sm font-medium">
                {selectedExercise.name}
              </span>
            </div>
            <button
              onClick={() => setSelectedExerciseId(null)}
              className="text-xs text-neutral-400 hover:text-foreground"
            >
              {t("workout:statsPage.clear")}
            </button>
          </div>

          {/* Period selector */}
          <div className="flex gap-1.5">
            {PERIOD_VALUES.map((v) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={`flex-1 py-1.5 rounded-md text-xs font-light transition-all ${
                  period === v
                    ? "bg-primary text-white"
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
                }`}
              >
                {t(`workout:statsPage.ranges.${v}`)}
              </button>
            ))}
          </div>

          {/* Simple text-based chart (weight over time) */}
          {stats && stats.length > 0 ? (
            <div className="space-y-4">
              {/* Weight trend */}
              <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3">
                <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-3">
                  {t("workout:statsPage.maxWeightTrend")}
                </p>
                <div className="space-y-1">
                  {stats.map((s, i) => {
                    const maxWeight = Math.max(
                      ...stats.map((d) => d.maxWeight)
                    );
                    const pct =
                      maxWeight > 0
                        ? (s.maxWeight / maxWeight) * 100
                        : 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 w-12 shrink-0">
                          {formatDate(s.date)}
                        </span>
                        <div className="flex-1 h-4 bg-neutral-100 dark:bg-neutral-900 rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-sm transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-14 text-right">
                          {s.maxWeight} kg
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Volume trend */}
              <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3">
                <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-3">
                  {t("workout:statsPage.volumeTrend")}
                </p>
                <div className="space-y-1">
                  {stats.map((s, i) => {
                    const maxVol = Math.max(
                      ...stats.map((d) => d.totalVolume)
                    );
                    const pct =
                      maxVol > 0
                        ? (s.totalVolume / maxVol) * 100
                        : 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 w-12 shrink-0">
                          {formatDate(s.date)}
                        </span>
                        <div className="flex-1 h-4 bg-neutral-100 dark:bg-neutral-900 rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-blue-500/60 rounded-sm transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-16 text-right">
                          {Math.round(s.totalVolume).toLocaleString()} kg
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 1RM trend */}
              <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3">
                <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-3">
                  {t("workout:statsPage.estimated1rmTrend")}
                </p>
                <div className="space-y-1">
                  {stats.map((s, i) => {
                    const max1rm = Math.max(
                      ...stats.map((d) => d.estimated1rm)
                    );
                    const pct =
                      max1rm > 0
                        ? (s.estimated1rm / max1rm) * 100
                        : 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 w-12 shrink-0">
                          {formatDate(s.date)}
                        </span>
                        <div className="flex-1 h-4 bg-neutral-100 dark:bg-neutral-900 rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-amber-500/60 rounded-sm transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-14 text-right">
                          {s.estimated1rm} kg
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm font-light text-neutral-300 dark:text-neutral-700 text-center py-6">
              {t("workout:statsPage.noData")}
            </p>
          )}

          {/* PRs for this exercise */}
          {prs && prs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400">
                {t("workout:statsPage.personalRecords")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {prs.map((pr) => (
                  <div
                    key={pr.id}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center"
                  >
                    <Trophy
                      className="h-4 w-4 text-amber-500 mx-auto mb-1"
                      strokeWidth={1.5}
                    />
                    <p className="text-lg font-extralight tabular-nums">
                      {pr.type === "volume"
                        ? Math.round(Number(pr.value)).toLocaleString()
                        : Number(pr.value)}
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      {PR_TYPE_KEYS[pr.type] ? t(PR_TYPE_KEYS[pr.type]) : pr.type}
                      {pr.type !== "reps" && " kg"}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {formatDate(pr.achievedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* All PRs overview when no exercise selected */}
      {!selectedExerciseId && allPrs && allPrs.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400">
            {t("workout:statsPage.allPersonalRecords")}
          </p>
          <div className="space-y-0">
            {allPrs
              .filter((pr) => pr.type === "weight")
              .map((pr) => (
                <button
                  key={pr.id}
                  onClick={() => setSelectedExerciseId(pr.exerciseId)}
                  className="w-full flex items-center justify-between py-2.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Trophy
                      className="h-3.5 w-3.5 text-amber-500"
                      strokeWidth={2}
                    />
                    <span className="text-sm font-light">
                      {pr.exerciseName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-light tabular-nums text-primary">
                      {Number(pr.value)} kg
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {formatDate(pr.achievedAt)}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {!selectedExerciseId &&
        (!allPrs || allPrs.length === 0) && (
          <p className="text-sm font-light text-neutral-300 dark:text-neutral-700 text-center py-10">
            {t("workout:statsPage.selectExerciseHint")}
          </p>
        )}

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}
