"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Clock, ChevronRight, BarChart3, Music, Timer } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { startActivitySession } from "@/server/actions/activity";
import { formatDuration } from "@/hooks/use-activity-timer";
import { useMeditationAudio } from "@/hooks/use-meditation-audio";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTranslation } from "react-i18next";
import {
  MEDITATION_TYPES,
  MEDITATION_TYPE_LABELS,
  MEDITATION_DURATION_PRESETS,
} from "@open-health/shared/constants";
import type { MeditationMetadata } from "@open-health/shared/types";

function formatPresetLabel(seconds: number, minuteUnit: string): string {
  const m = Math.floor(seconds / 60);
  return `${m} ${minuteUnit}`;
}

export default function MeditationPage() {
  const router = useRouter();
  const { t } = useTranslation(["meditation", "common"]);
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } =
    useAuthGuard();

  const { data: activeSession, isLoading: activeLoading } =
    trpc.activity.getActive.useQuery(
      { type: "meditation" },
      { enabled: isAuthenticated }
    );
  const { data: history } = trpc.activity.getHistory.useQuery(
    { type: "meditation", limit: 10 },
    { enabled: isAuthenticated }
  );
  const { data: stats } = trpc.activity.getStats.useQuery(
    { type: "meditation", period: "week" },
    { enabled: isAuthenticated }
  );

  const { warmupBell } = useMeditationAudio();

  const [starting, setStarting] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("mindfulness");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(600);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const handleStart = async () => {
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    // Pre-warm bell audio during this user gesture (Safari PWA requires it)
    warmupBell();
    setStarting(true);
    try {
      const metadata: Record<string, unknown> = {
        meditationType: selectedType,
        sessionMode: "timer",
        musicEnabled,
      };
      if (selectedDuration) {
        metadata.plannedDurationSec = selectedDuration;
      }
      await startActivitySession({
        type: "meditation",
        metadata,
      });
      router.push("/hub/meditation/active");
      router.refresh();
    } catch {
      toast.error(t("meditation:startError"));
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
        <h1 className="text-xl font-light tracking-wide">
          {t("meditation:title")}
        </h1>
        <BarChart3
          className="h-5 w-5 text-neutral-400"
          strokeWidth={1.5}
        />
      </div>

      {/* Stats summary */}
      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {stats.totalSessions}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("meditation:thisWeek")}
            </p>
          </div>
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {Math.round(stats.totalSeconds / 60)}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("meditation:totalMinutes")}
            </p>
          </div>
          <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-center">
            <p className="text-lg font-light tabular-nums text-primary">
              {stats.currentStreak}
            </p>
            <p className="text-[10px] text-neutral-400">
              {t("meditation:currentStreak")}
            </p>
          </div>
        </div>
      )}

      {/* Active session banner */}
      {activeSession && (
        <Link
          href="/hub/meditation/active"
          className="block rounded-lg border border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Play className="h-4 w-4 text-primary" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t("meditation:activeSession")}
                </p>
                <p className="text-xs text-neutral-400">
                  {MEDITATION_TYPE_LABELS[
                    (activeSession.metadata as unknown as MeditationMetadata)
                      ?.meditationType ?? "mindfulness"
                  ] ?? t("meditation:types.mindfulness")}
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

      {/* Meditation type selector */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("meditation:type")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {MEDITATION_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-lg border p-2.5 text-xs font-light transition-all ${
                selectedType === type
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-black/[0.06] dark:border-white/[0.06] text-neutral-500 hover:border-foreground/20"
              }`}
            >
              {MEDITATION_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Duration presets */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Timer className="h-3 w-3 text-neutral-400" strokeWidth={1.5} />
          <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
            {t("meditation:timerDuration")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MEDITATION_DURATION_PRESETS.map((sec) => (
            <button
              key={sec}
              onClick={() =>
                setSelectedDuration(selectedDuration === sec ? null : sec)
              }
              className={`rounded-lg border px-4 py-2.5 text-sm font-light transition-all ${
                selectedDuration === sec
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-black/[0.06] dark:border-white/[0.06] text-neutral-500 hover:border-foreground/20"
              }`}
            >
              {formatPresetLabel(sec, t("meditation:minuteUnit"))}
            </button>
          ))}
          <button
            onClick={() => setSelectedDuration(null)}
            className={`rounded-lg border px-4 py-2.5 text-sm font-light transition-all ${
              selectedDuration === null
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-black/[0.06] dark:border-white/[0.06] text-neutral-500 hover:border-foreground/20"
            }`}
          >
            {t("meditation:unlimitedDuration")}
          </button>
        </div>
      </div>

      {/* Music toggle */}
      <button
        onClick={() => setMusicEnabled(!musicEnabled)}
        className={`w-full flex items-center gap-3 rounded-lg border p-4 transition-all ${
          musicEnabled
            ? "border-primary/30 bg-primary/5"
            : "border-black/[0.06] dark:border-white/[0.06]"
        }`}
      >
        <Music
          className={`h-5 w-5 ${musicEnabled ? "text-primary" : "text-neutral-400"}`}
          strokeWidth={1.5}
        />
        <div className="flex-1 text-left">
          <p className="text-sm">{t("meditation:backgroundMusic")}</p>
          <p className="text-xs text-neutral-400">{t("meditation:backgroundMusicDesc")}</p>
        </div>
        <div
          className={`w-10 h-6 rounded-full flex items-center transition-colors ${
            musicEnabled ? "bg-primary justify-end" : "bg-neutral-300 dark:bg-neutral-700 justify-start"
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-white mx-0.5" />
        </div>
      </button>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={starting || !!activeSession}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-primary text-white text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        <Play className="h-4 w-4" strokeWidth={2} />
        {starting
          ? t("meditation:starting")
          : selectedDuration
            ? t("meditation:startWithDuration", { minutes: Math.floor(selectedDuration / 60) })
            : t("meditation:startSession")}
      </button>

      {/* Divider */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />

      {/* History */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("meditation:history")}
        </p>

        {history?.items && history.items.length > 0 ? (
          <div className="space-y-0">
            {history.items.map((s) => {
              const meta = s.metadata as unknown as MeditationMetadata | null;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light">
                      {(meta?.meditationType && MEDITATION_TYPE_LABELS[meta.meditationType]) || t("meditation:title")}
                    </p>
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
                  {meta?.moodBefore != null && meta?.moodAfter != null && (
                    <div className="ml-3 text-xs text-neutral-400">
                      {meta.moodBefore} → {meta.moodAfter}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-light text-neutral-300 dark:text-neutral-700">
            {t("meditation:noHistory")}
          </p>
        )}
      </div>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}
