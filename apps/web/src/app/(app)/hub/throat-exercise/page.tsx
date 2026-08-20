"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Play,
  Clock,
  ChevronRight,
  BarChart3,
  Mic,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { startActivitySession } from "@/server/actions/activity";
import { formatDuration } from "@/hooks/use-activity-timer";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTranslation } from "react-i18next";
import {
  THROAT_EXERCISE_PRESET_KEYS,
  THROAT_EXERCISE_PRESETS,
  THROAT_EXERCISES,
} from "@open-health/shared/constants";
import type { ThroatExerciseMetadata } from "@open-health/shared/types";
import Image from "next/image";
import { EXERCISE_IMAGES } from "./exercise-images";

function pickExercises(count: number): string[] {
  // Pick a balanced set from all target groups
  const byTarget = new Map<string, typeof THROAT_EXERCISES>();
  for (const ex of THROAT_EXERCISES) {
    if (!byTarget.has(ex.target)) byTarget.set(ex.target, []);
    byTarget.get(ex.target)!.push(ex);
  }

  const picked: string[] = [];
  const targets = [...byTarget.keys()];
  let idx = 0;

  while (picked.length < count && picked.length < THROAT_EXERCISES.length) {
    const target = targets[idx % targets.length];
    const available = byTarget.get(target)!.filter(
      (ex) => !picked.includes(ex.id)
    );
    if (available.length > 0) {
      // Pick random from available
      const pick = available[Math.floor(Math.random() * available.length)];
      picked.push(pick.id);
    }
    idx++;
  }

  // Sort by original order
  const orderMap = new Map(THROAT_EXERCISES.map((e, i) => [e.id, i]));
  picked.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));

  return picked;
}

export default function ThroatExercisePage() {
  const router = useRouter();
  const { t } = useTranslation(["throat-exercise", "common"]);
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } =
    useAuthGuard();

  const { data: activeSession, isLoading: activeLoading } =
    trpc.activity.getActive.useQuery(
      { type: "throat_exercise" },
      { enabled: isAuthenticated }
    );
  const { data: history } = trpc.activity.getHistory.useQuery(
    { type: "throat_exercise", limit: 10 },
    { enabled: isAuthenticated }
  );
  const { data: stats } = trpc.activity.getStats.useQuery(
    { type: "throat_exercise", period: "week" },
    { enabled: isAuthenticated }
  );

  const [starting, setStarting] = useState(false);
  const [selectedPreset, setSelectedPreset] =
    useState<(typeof THROAT_EXERCISE_PRESET_KEYS)[number]>("standard");

  const handleStart = async () => {
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    setStarting(true);
    try {
      const preset = THROAT_EXERCISE_PRESETS[selectedPreset];
      const exerciseIds = pickExercises(preset.exerciseCount);
      const metadata: ThroatExerciseMetadata = {
        preset: selectedPreset,
        exerciseIds,
        completedCount: 0,
        totalCount: exerciseIds.length,
      };
      await startActivitySession({
        type: "throat_exercise",
        metadata: metadata as unknown as Record<string, unknown>,
      });
      router.push("/hub/throat-exercise/active");
      router.refresh();
    } catch {
      toast.error(t("throat-exercise:startError"));
    } finally {
      setStarting(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isAuthenticated && activeLoading) return <LoadingSpinner />;

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light tracking-wide">
            {t("throat-exercise:title")}
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            {t("throat-exercise:subtitle")}
          </p>
        </div>
        <Mic className="h-5 w-5 text-neutral-400" strokeWidth={1.5} />
      </div>

      {/* Stats summary */}
      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {stats.totalSessions}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("throat-exercise:thisWeek")}
            </p>
          </div>
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {Math.round(stats.totalSeconds / 60)}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("throat-exercise:totalMinutes")}
            </p>
          </div>
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {stats.currentStreak}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("throat-exercise:currentStreak")}
            </p>
          </div>
        </div>
      )}

      {/* Active session banner */}
      {activeSession && (
        <Link
          href="/hub/throat-exercise/active"
          className="block rounded-lg border border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Play className="h-4 w-4 text-primary" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t("throat-exercise:activeSession")}
                </p>
                <p className="text-xs text-neutral-400">
                  {t(
                    `throat-exercise:presets.${
                      (
                        activeSession.metadata as unknown as ThroatExerciseMetadata
                      )?.preset ?? "standard"
                    }`
                  )}
                </p>
              </div>
            </div>
            <ChevronRight
              className="h-5 w-5 text-neutral-400"
              strokeWidth={1.5}
            />
          </div>
        </Link>
      )}

      {/* Preset selector */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("throat-exercise:preset")}
        </p>
        <div className="space-y-2">
          {THROAT_EXERCISE_PRESET_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setSelectedPreset(key)}
              className={`w-full flex items-center justify-between rounded-lg border p-4 transition-all ${
                selectedPreset === key
                  ? "border-primary bg-primary/5"
                  : "border-black/[0.06] dark:border-white/[0.06] hover:border-foreground/20"
              }`}
            >
              <div className="text-left">
                <p
                  className={`text-sm font-medium ${
                    selectedPreset === key
                      ? "text-primary"
                      : "text-foreground"
                  }`}
                >
                  {t(`throat-exercise:presets.${key}`)}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {t(`throat-exercise:presetDesc.${key}`)}
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPreset === key
                    ? "border-primary"
                    : "border-neutral-300 dark:border-neutral-600"
                }`}
              >
                {selectedPreset === key && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Exercise preview carousel */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("throat-exercise:target")}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {THROAT_EXERCISES.map((ex) => (
            <div key={ex.id} className="flex flex-col items-center gap-1.5 shrink-0">
              {EXERCISE_IMAGES[ex.id] ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.06]">
                  <Image
                    src={EXERCISE_IMAGES[ex.id]}
                    alt={t(`throat-exercise:exercises.${ex.id}.name`)}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center text-2xl">
                  {ex.emoji}
                </div>
              )}
              <span className="text-[9px] text-neutral-400 text-center w-16 leading-tight truncate">
                {t(`throat-exercise:exercises.${ex.id}.name`)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Science note */}
      <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4">
        <div className="flex items-start gap-3">
          <BarChart3
            className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0"
            strokeWidth={1.5}
          />
          <div>
            <p className="text-xs font-medium text-neutral-500">
              {t("throat-exercise:scienceTitle")}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {t("throat-exercise:scienceDesc")}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {t("throat-exercise:recommendFreq")}
            </p>
          </div>
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={starting || !!activeSession}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-primary text-white text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        <Play className="h-4 w-4" strokeWidth={2} />
        {starting
          ? t("throat-exercise:starting")
          : t("throat-exercise:startWithPreset", {
              minutes: THROAT_EXERCISE_PRESETS[selectedPreset].durationMin,
            })}
      </button>

      {/* Divider */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />

      {/* History */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("throat-exercise:history")}
        </p>

        {history?.items && history.items.length > 0 ? (
          <div className="space-y-0">
            {history.items.map((s) => {
              const meta =
                s.metadata as unknown as ThroatExerciseMetadata | null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-light">
                        {meta?.preset
                          ? t(`throat-exercise:presets.${meta.preset}`)
                          : t("throat-exercise:title")}
                      </p>
                      {meta && (
                        <span className="text-xs text-neutral-400">
                          {meta.completedCount}/{meta.totalCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-neutral-400">
                        {formatDate(s.startedAt)}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {formatTime(s.startedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-2 flex items-center gap-1">
                    <Clock
                      className="h-3 w-3 text-neutral-400"
                      strokeWidth={1.5}
                    />
                    <span className="text-sm font-light tabular-nums text-primary">
                      {s.durationSec ? formatDuration(s.durationSec) : "-"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-light text-neutral-300 dark:text-neutral-700">
            {t("throat-exercise:noHistory")}
          </p>
        )}
      </div>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}
