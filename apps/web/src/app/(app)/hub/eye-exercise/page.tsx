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
  Eye,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { startActivitySession } from "@/server/actions/activity";
import { formatDuration } from "@/hooks/use-activity-timer";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTranslation } from "react-i18next";
import {
  EYE_EXERCISE_PRESET_KEYS,
  EYE_EXERCISE_PRESETS,
  EYE_EXERCISES,
} from "@open-health/shared/constants";
import type { EyeExerciseMetadata } from "@open-health/shared/types";

function pickExercises(count: number): string[] {
  const byTarget = new Map<string, typeof EYE_EXERCISES>();
  for (const ex of EYE_EXERCISES) {
    if (!byTarget.has(ex.target)) byTarget.set(ex.target, []);
    byTarget.get(ex.target)!.push(ex);
  }

  const picked: string[] = [];
  const targets = [...byTarget.keys()];
  let idx = 0;

  while (picked.length < count && picked.length < EYE_EXERCISES.length) {
    const target = targets[idx % targets.length];
    const available = byTarget.get(target)!.filter(
      (ex) => !picked.includes(ex.id)
    );
    if (available.length > 0) {
      const pick = available[Math.floor(Math.random() * available.length)];
      picked.push(pick.id);
    }
    idx++;
  }

  const orderMap = new Map(EYE_EXERCISES.map((e, i) => [e.id, i]));
  picked.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));

  return picked;
}

export default function EyeExercisePage() {
  const router = useRouter();
  const { t } = useTranslation(["eye-exercise", "common"]);
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } =
    useAuthGuard();

  const { data: activeSession, isLoading: activeLoading } =
    trpc.activity.getActive.useQuery(
      { type: "eye_exercise" },
      { enabled: isAuthenticated }
    );
  const { data: history } = trpc.activity.getHistory.useQuery(
    { type: "eye_exercise", limit: 10 },
    { enabled: isAuthenticated }
  );
  const { data: stats } = trpc.activity.getStats.useQuery(
    { type: "eye_exercise", period: "week" },
    { enabled: isAuthenticated }
  );

  const [starting, setStarting] = useState(false);
  const [selectedPreset, setSelectedPreset] =
    useState<(typeof EYE_EXERCISE_PRESET_KEYS)[number]>("standard");

  const handleStart = async () => {
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    setStarting(true);
    try {
      const preset = EYE_EXERCISE_PRESETS[selectedPreset];
      const exerciseIds = pickExercises(preset.exerciseCount);
      const metadata: EyeExerciseMetadata = {
        preset: selectedPreset,
        exerciseIds,
        completedCount: 0,
        totalCount: exerciseIds.length,
      };
      await startActivitySession({
        type: "eye_exercise",
        metadata: metadata as unknown as Record<string, unknown>,
      });
      router.push("/hub/eye-exercise/active");
      router.refresh();
    } catch {
      toast.error(t("eye-exercise:startError"));
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
            {t("eye-exercise:title")}
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            {t("eye-exercise:subtitle")}
          </p>
        </div>
        <Eye className="h-5 w-5 text-neutral-400" strokeWidth={1.5} />
      </div>

      {/* Stats summary */}
      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {stats.totalSessions}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("eye-exercise:thisWeek")}
            </p>
          </div>
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {Math.round(stats.totalSeconds / 60)}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("eye-exercise:totalMinutes")}
            </p>
          </div>
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {stats.currentStreak}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("eye-exercise:currentStreak")}
            </p>
          </div>
        </div>
      )}

      {/* Active session banner */}
      {activeSession && (
        <Link
          href="/hub/eye-exercise/active"
          className="block rounded-lg border border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Play className="h-4 w-4 text-primary" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t("eye-exercise:activeSession")}
                </p>
                <p className="text-xs text-neutral-400">
                  {t(
                    `eye-exercise:presets.${
                      (
                        activeSession.metadata as unknown as EyeExerciseMetadata
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
          {t("eye-exercise:preset")}
        </p>
        <div className="space-y-2">
          {EYE_EXERCISE_PRESET_KEYS.map((key) => (
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
                  {t(`eye-exercise:presets.${key}`)}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {t(`eye-exercise:presetDesc.${key}`)}
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
          {t("eye-exercise:target")}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {EYE_EXERCISES.map((ex) => (
            <div key={ex.id} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-16 h-16 rounded-xl border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center text-2xl">
                {ex.emoji}
              </div>
              <span className="text-[9px] text-neutral-400 text-center w-16 leading-tight truncate">
                {t(`eye-exercise:exercises.${ex.id}.name`)}
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
              {t("eye-exercise:scienceTitle")}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {t("eye-exercise:scienceDesc")}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {t("eye-exercise:recommendFreq")}
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
          ? t("eye-exercise:starting")
          : t("eye-exercise:startWithPreset", {
              minutes: EYE_EXERCISE_PRESETS[selectedPreset].durationMin,
            })}
      </button>

      {/* Divider */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />

      {/* History */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("eye-exercise:history")}
        </p>

        {history?.items && history.items.length > 0 ? (
          <div className="space-y-0">
            {history.items.map((s) => {
              const meta =
                s.metadata as unknown as EyeExerciseMetadata | null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-light">
                        {meta?.preset
                          ? t(`eye-exercise:presets.${meta.preset}`)
                          : t("eye-exercise:title")}
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
            {t("eye-exercise:noHistory")}
          </p>
        )}
      </div>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}
