"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Settings2,
  Plus,
  Square,
  Bell,
  BellOff,
  Trash2,
  Pencil,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DateNavigator } from "@/components/diary/date-navigator";
import { NotificationPermissionGuard } from "@/components/notification-permission-guard";
import { useTranslation } from "react-i18next";
import {
  getTimerState,
  computeSnoozeUntil,
  formatDuration,
  MS_PER_MINUTE,
} from "@open-health/shared/posture";

const CIRCLE_CIRCUMFERENCE = 540;
const MIN_MAX_MINUTES = 5;
const MAX_MAX_MINUTES = 480;

/** Parse tRPC/Zod error into a user-friendly message */
function friendlyError(err: { message: string }, t: (key: string, opts?: Record<string, unknown>) => string): string {
  try {
    const parsed = JSON.parse(err.message);
    if (Array.isArray(parsed) && parsed[0]?.message) {
      const zodErr = parsed[0];
      const field = zodErr.path?.join(".") ?? "";
      if (field === "maxMinutes") {
        if (zodErr.code === "too_small") return t("posture:errorMinTooSmall", { min: zodErr.minimum });
        if (zodErr.code === "too_big") return t("posture:errorMaxTooBig", { max: zodErr.maximum });
      }
      if (field === "name") return t("posture:errorPostureName");
      if (field === "emoji") return t("posture:errorEmoji");
      if (field === "suggestedBreak") return t("posture:errorSuggestedBreak");
      if (field === "snoozeMinutes") return t("posture:errorSnoozeMinutes");
      return zodErr.message;
    }
  } catch {
    // not JSON, use as-is
  }
  return err.message || t("common:toast.errorRetry");
}

function formatTime(date: Date | string, locale = "en-US") {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}


export default function PosturePage() {
  const utils = trpc.useUtils();

  const [now, setNow] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { t } = useTranslation(["posture", "common"]);
  const [editingPosture, setEditingPosture] = useState<{
    id?: string;
    name: string;
    emoji: string;
    maxMinutes: number;
    suggestedBreak: string;
    sortOrder: number;
  } | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const [hasStartedAlarm, setHasStartedAlarm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { i18n } = useTranslation();
  const { data: definitions, isLoading: defsLoading } =
    trpc.posture.getDefinitions.useQuery({ lang: i18n.language });
  const { data: activeSession, isLoading: sessionLoading } =
    trpc.posture.getActiveSession.useQuery();
  const { data: config } = trpc.posture.getConfig.useQuery();
  const { data: history } = trpc.posture.getHistory.useQuery({ limit: 50, date: dateStr });

  const switchPosture = trpc.posture.switchPosture.useMutation({
    onSuccess: () => {
      utils.posture.getActiveSession.invalidate();
      utils.posture.getHistory.invalidate();
      setSnoozedUntil(null);
      setHasStartedAlarm(false);
    },
    onError: (err) => toast.error(friendlyError(err, t)),
  });

  const stopSession = trpc.posture.stopSession.useMutation({
    onSuccess: () => {
      utils.posture.getActiveSession.invalidate();
      utils.posture.getHistory.invalidate();
      setSnoozedUntil(null);
      setHasStartedAlarm(false);
      toast.success(t("posture:stopped"));
    },
    onError: (err) => toast.error(friendlyError(err, t)),
  });

  const upsertDefinition = trpc.posture.upsertDefinition.useMutation({
    onSuccess: () => {
      utils.posture.getDefinitions.invalidate();
      setEditDialogOpen(false);
      setEditingPosture(null);
      toast.success(t("posture:saved"));
    },
    onError: (err) => toast.error(friendlyError(err, t)),
  });

  const deleteDefinition = trpc.posture.deleteDefinition.useMutation({
    onSuccess: () => {
      utils.posture.getDefinitions.invalidate();
      toast.success(t("posture:deleted"));
    },
    onError: (err) => toast.error(friendlyError(err, t)),
  });

  const upsertConfig = trpc.posture.upsertConfig.useMutation({
    onSuccess: () => {
      utils.posture.getConfig.invalidate();
      toast.success(t("posture:settingsSaved"));
    },
    onError: (err) => toast.error(friendlyError(err, t)),
  });

  const markReminded = trpc.posture.markReminded.useMutation();

  // Timer tick
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Reminder logic — shared with mobile
  const timerState = activeSession
    ? getTimerState(activeSession, config, snoozedUntil, now)
    : null;
  const elapsedMs = timerState?.elapsedMs ?? 0;
  const maxMs = timerState?.maxMs ?? 0;
  const isOvertime = timerState?.isOvertime ?? false;
  const progressPercent = timerState?.progressPercent ?? 0;
  const elapsed = formatDuration(elapsedMs);
  const remaining = formatDuration(Math.max(0, maxMs - elapsedMs));
  const shouldRemind = timerState?.shouldAlarm ?? false;

  const alarmRef = useRef<HTMLAudioElement | null>(null);

  // Start persistent alarm when overtime (plays until user dismisses)
  useEffect(() => {
    if (shouldRemind && activeSession && !hasStartedAlarm) {
      markReminded.mutate({ id: activeSession.id });
      setHasStartedAlarm(true);

      // Play alarm sound on loop — no auto-stop, plays until dismissed
      const audio = alarmRef.current ?? new Audio("/alarm.m4a");
      audio.loop = true;
      audio.currentTime = 0;
      audio.volume = 1;
      audio.play().catch(() => {});
      alarmRef.current = audio;
    }
  }, [shouldRemind, activeSession, hasStartedAlarm, markReminded]);

  // Recurring browser notification every 5 minutes while alarm is active
  useEffect(() => {
    if (!shouldRemind || !activeSession) return;
    const REPEAT_INTERVAL = 5 * MS_PER_MINUTE;

    // Send initial notification
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Posture overtime reminder", {
        body: activeSession.suggestedBreak ?? t("posture:overtimeAlert"),
        tag: "posture-overtime",
      });
    }

    const interval = setInterval(() => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Posture overtime reminder", {
          body: activeSession.suggestedBreak ?? t("posture:overtimeAlert"),
          tag: "posture-overtime",
        });
      }
    }, REPEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [shouldRemind, activeSession, t]);

  // Stop alarm when user snoozes or switches posture
  useEffect(() => {
    if (!shouldRemind && alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current = null;
    }
  }, [shouldRemind]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (alarmRef.current) {
        alarmRef.current.pause();
        alarmRef.current = null;
      }
    };
  }, []);

  const handleSnooze = useCallback(() => {
    setSnoozedUntil(computeSnoozeUntil(config));
    toast(t("posture:snoozeMinutes", { minutes: config?.snoozeMinutes ?? 10 }));
  }, [config, t]);

  const handleSwitchPosture = (postureId: string) => {
    // Unlock audio autoplay policy on user gesture — preload alarm sound
    if (!alarmRef.current) {
      const audio = new Audio("/alarm.m4a");
      audio.volume = 0;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
      }).catch(() => {});
      alarmRef.current = audio;
    }
    switchPosture.mutate({ postureId, lang: i18n.language });
  };

  const handleEditPosture = (posture?: NonNullable<typeof definitions>[number]) => {
    if (posture) {
      setEditingPosture({
        id: posture.id,
        name: posture.name,
        emoji: posture.emoji,
        maxMinutes: posture.maxMinutes,
        suggestedBreak: posture.suggestedBreak,
        sortOrder: posture.sortOrder,
      });
    } else {
      setEditingPosture({
        name: "",
        emoji: "🧘",
        maxMinutes: 30,
        suggestedBreak: t("posture:suggestedBreakPlaceholder"),
        sortOrder: definitions?.length ?? 0,
      });
    }
    setEditDialogOpen(true);
  };

  const handleSavePosture = () => {
    if (!editingPosture) return;
    if (!editingPosture.name.trim()) {
      toast.error(t("posture:errorPostureName"));
      return;
    }
    if (!editingPosture.emoji.trim()) {
      toast.error(t("posture:errorEmoji"));
      return;
    }
    if (editingPosture.maxMinutes < MIN_MAX_MINUTES) {
      toast.error(t("posture:errorMinTooSmall", { min: MIN_MAX_MINUTES }));
      return;
    }
    if (editingPosture.maxMinutes > MAX_MAX_MINUTES) {
      toast.error(t("posture:errorMaxTooBig", { max: MAX_MAX_MINUTES }));
      return;
    }
    if (!editingPosture.suggestedBreak.trim()) {
      toast.error(t("posture:errorSuggestedBreak"));
      return;
    }
    upsertDefinition.mutate(editingPosture);
  };

  const isLoading = defsLoading || sessionLoading;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-light tracking-wide">{t("posture:title")}</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-neutral-400 hover:text-foreground transition-colors"
        >
          <Settings2 className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Active session info */}
      {activeSession && (
        <div className="text-center">
          <p className="text-sm font-light text-neutral-400">
            {activeSession.postureEmoji} {activeSession.postureName}
            <span className="mx-2">·</span>
            {t("posture:limitMinutes", { minutes: activeSession.maxMinutes })}
          </p>
        </div>
      )}

      {/* Timer Circle */}
      <div className="flex flex-col items-center py-4">
        <div className="relative flex h-48 w-48 items-center justify-center">
          <svg className="h-48 w-48 -rotate-90" viewBox="0 0 192 192">
            <circle
              cx="96"
              cy="96"
              r="86"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-neutral-200 dark:text-neutral-800"
            />
            <circle
              cx="96"
              cy="96"
              r="86"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={`${(progressPercent / 100) * CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE - (progressPercent / 100) * CIRCLE_CIRCUMFERENCE}`}
              strokeLinecap="round"
              className={`transition-all duration-1000 ${
                isOvertime
                  ? "text-red-500"
                  : progressPercent > 80
                    ? "text-amber-500"
                    : activeSession
                      ? "text-green-500"
                      : "text-neutral-300 dark:text-neutral-700"
              }`}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            {activeSession ? (
              <>
                <span className="text-2xl mb-1">{activeSession.postureEmoji}</span>
                <span className="text-3xl font-extralight tabular-nums tracking-wider">
                  {elapsed.minutes}:{elapsed.seconds}
                </span>
                <p className="text-xs font-light text-neutral-400 mt-1">
                  {isOvertime
                    ? t("posture:overtimeAlert")
                    : t("posture:remainingTime", { time: `${remaining.minutes}:${remaining.seconds}` })}
                </p>
              </>
            ) : (
              <>
                <span className="text-3xl mb-2">🧘</span>
                <span className="text-sm font-light text-neutral-400">
                  {t("posture:selectToStart")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overtime alert banner */}
      {shouldRemind && activeSession && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center space-y-2">
          <p className="text-sm font-light text-red-600 dark:text-red-400">
            {activeSession.suggestedBreak}
          </p>
          <button
            onClick={handleSnooze}
            className="text-xs font-light text-neutral-500 hover:text-foreground transition-colors underline underline-offset-2"
          >
            {t("posture:snoozeMinutes", { minutes: config?.snoozeMinutes ?? 10 })}
          </button>
        </div>
      )}

      {/* Notification permission guard — auto-detects & guides user */}
      <NotificationPermissionGuard />

      {/* Posture quick-switch buttons */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("posture:switchPosture")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {definitions?.map((def) => {
            const isActive = activeSession?.postureId === def.id;
            return (
              <button
                key={def.id}
                onClick={() => handleSwitchPosture(def.id)}
                disabled={switchPosture.isPending}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-sm font-light transition-all disabled:opacity-50 ${
                  isActive
                    ? "border-green-500/40 bg-green-500/5 text-green-600 dark:text-green-400"
                    : "border-black/[0.06] dark:border-white/[0.06] text-neutral-500 hover:border-foreground/20"
                }`}
              >
                <span className="text-lg">{def.emoji}</span>
                <span className="text-[11px]">{def.name}</span>
                <span className="text-[9px] text-neutral-400">
                  {t("posture:durationMinutes", { minutes: def.maxMinutes })}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => handleEditPosture()}
            className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg border border-dashed border-black/[0.06] dark:border-white/[0.06] text-neutral-400 hover:border-foreground/20 transition-all"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-[11px]">{t("posture:addNew")}</span>
          </button>
        </div>
      </div>

      {/* Stop button */}
      {activeSession && (
        <div className="flex justify-center">
          <button
            onClick={() => stopSession.mutate()}
            disabled={stopSession.isPending}
            className="flex items-center gap-2 px-6 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-500 text-sm font-light transition-all hover:border-foreground/30 disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" strokeWidth={1.5} />
            {stopSession.isPending ? t("posture:stopping") : t("posture:stopTracking")}
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />

      {/* Date Navigator */}
      <DateNavigator date={selectedDate} onDateChange={setSelectedDate} />

      {/* History */}
      <div className="space-y-3">
        {history && history.length > 0 ? (
          <div className="space-y-0">
            {history.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{log.postureEmoji}</span>
                  <div>
                    <p className="text-sm font-light">
                      {log.postureName}
                      {log.durationMinutes != null && (
                        <span className="text-neutral-400 ml-2">
                          {t("posture:durationMinutes", { minutes: log.durationMinutes })}
                        </span>
                      )}
                      {!log.endedAt && (
                        <span className="text-green-500 ml-2 text-xs">{t("posture:inProgress")}</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-400 tabular-nums">
                      {formatTime(log.startedAt, i18n.language === "en" ? "en-US" : "en-US")}
                      {log.endedAt && ` — ${formatTime(log.endedAt, i18n.language === "en" ? "en-US" : "en-US")}`}
                    </p>
                  </div>
                </div>
                {log.wasReminded && (
                  <Bell className="h-3 w-3 text-amber-500" strokeWidth={1.5} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-light text-neutral-300 dark:text-neutral-700">
            {t("posture:noRecords")}
          </p>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogHeader>
          <DialogTitle>{t("posture:settingsDialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-5">
          {/* Reminder toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {config?.reminderEnabled !== false ? (
                <Bell className="h-4 w-4 text-green-500" strokeWidth={1.5} />
              ) : (
                <BellOff className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
              )}
              <span className="text-sm font-light">{t("posture:overtimeReminder")}</span>
            </div>
            <button
              onClick={() =>
                upsertConfig.mutate({
                  reminderEnabled: config?.reminderEnabled === false,
                  snoozeMinutes: config?.snoozeMinutes ?? 10,
                })
              }
              className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                config?.reminderEnabled !== false
                  ? "bg-green-500"
                  : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  config?.reminderEnabled !== false
                    ? "translate-x-5"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Snooze duration */}
          <div className="space-y-2">
            <label className="text-sm font-light text-neutral-500">
              {t("posture:snoozeTimeLabel")}
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((mins) => (
                <button
                  key={mins}
                  onClick={() =>
                    upsertConfig.mutate({
                      reminderEnabled: config?.reminderEnabled !== false,
                      snoozeMinutes: mins,
                    })
                  }
                  className={`flex-1 py-2 rounded-lg border text-sm font-light transition-all ${
                    (config?.snoozeMinutes ?? 10) === mins
                      ? "border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/5"
                      : "border-black/[0.06] dark:border-white/[0.06] text-neutral-500 hover:border-foreground/20"
                  }`}
                >
                  {mins}
                </button>
              ))}
            </div>
          </div>

          {/* Manage postures */}
          <div className="space-y-2">
            <label className="text-sm font-light text-neutral-500">
              {t("posture:managePostureTypes")}
            </label>
            <div className="space-y-0">
              {definitions?.map((def) => (
                <div
                  key={def.id}
                  className="flex items-center justify-between py-2.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span>{def.emoji}</span>
                    <span className="text-sm font-light">{def.name}</span>
                    <span className="text-xs text-neutral-400">
                      {t("posture:durationMinutes", { minutes: def.maxMinutes })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditPosture(def)}
                      className="text-neutral-400 hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => deleteDefinition.mutate({ id: def.id })}
                      disabled={deleteDefinition.isPending}
                      className="text-neutral-300 dark:text-neutral-700 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setSettingsOpen(false);
                handleEditPosture();
              }}
              className="w-full mt-2 py-2 text-sm font-light text-neutral-500 border border-dashed border-black/[0.06] dark:border-white/[0.06] rounded-lg hover:border-foreground/20 transition-all"
            >
              {t("posture:addPostureButton")}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Edit Posture Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogHeader>
          <DialogTitle>
            {editingPosture?.id ? t("posture:editPosture") : t("posture:addPosture")}
          </DialogTitle>
        </DialogHeader>
        {editingPosture && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400">{t("posture:emojiLabel")}</label>
                <input
                  type="text"
                  value={editingPosture.emoji}
                  onChange={(e) =>
                    setEditingPosture({ ...editingPosture, emoji: e.target.value })
                  }
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-center text-lg focus:outline-none focus:ring-1 focus:ring-green-500"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-400">{t("posture:nameLabel")}</label>
                <input
                  type="text"
                  value={editingPosture.name}
                  onChange={(e) =>
                    setEditingPosture({ ...editingPosture, name: e.target.value })
                  }
                  placeholder={t("posture:namePlaceholder")}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-green-500"
                  maxLength={20}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-neutral-400">
                {t("posture:maxMinutes")}
              </label>
              <input
                type="number"
                value={editingPosture.maxMinutes}
                onChange={(e) =>
                  setEditingPosture({
                    ...editingPosture,
                    maxMinutes: parseInt(e.target.value) || 30,
                  })
                }
                min={5}
                max={480}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-neutral-400">
                {t("posture:suggestedBreak")}
              </label>
              <input
                type="text"
                value={editingPosture.suggestedBreak}
                onChange={(e) =>
                  setEditingPosture({
                    ...editingPosture,
                    suggestedBreak: e.target.value,
                  })
                }
                placeholder={t("posture:suggestedBreakPlaceholder")}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-green-500"
                maxLength={100}
              />
            </div>

            <button
              onClick={handleSavePosture}
              disabled={
                upsertDefinition.isPending ||
                !editingPosture.name ||
                !editingPosture.emoji
              }
              className="w-full rounded-lg bg-green-500 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            >
              {upsertDefinition.isPending ? t("posture:saving") : t("common:buttons.save")}
            </button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
