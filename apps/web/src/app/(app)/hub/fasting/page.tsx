"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Timer, Play, Square, Settings2, Trash2, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import posthog from "posthog-js";
import { FASTING_PROTOCOLS, type FastingProtocol } from "@open-health/shared/constants";
import { useTranslation } from "react-i18next";

const MS_PER_HOUR = 3600 * 1000;
// SVG circle circumference: 2 * PI * r(86) ≈ 540
const CIRCLE_CIRCUMFERENCE = 540;

function getProtocolHours(protocol: string): number {
  return FASTING_PROTOCOLS.find((p) => p.value === protocol)?.fasting ?? 16;
}

function formatDuration(ms: number): { hours: string; minutes: string; seconds: string } {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function FastingPage() {
  const { t } = useTranslation(["fasting", "exercise"]);
  const utils = trpc.useUtils();

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<string>("16_8");
  const [customEatingStart, setCustomEatingStart] = useState("12:00");
  const [customEatingEnd, setCustomEatingEnd] = useState("20:00");
  const [now, setNow] = useState(() => Date.now());

  const { data: config, isLoading: configLoading } = trpc.fasting.getConfig.useQuery();
  const { data: activeFast, isLoading: fastLoading } = trpc.fasting.getActiveFast.useQuery();
  const { data: history } = trpc.fasting.getHistory.useQuery({ limit: 10 });

  const upsertConfig = trpc.fasting.upsertConfig.useMutation({
    onSuccess: () => {
      utils.fasting.getConfig.invalidate();
      setConfigDialogOpen(false);
      toast.success(t("fasting:configSaved"));
      posthog.capture("fasting_config_saved", { protocol: selectedProtocol });
    },
    onError: (err) => toast.error(err.message),
  });

  const startFast = trpc.fasting.startFast.useMutation({
    onSuccess: () => {
      utils.fasting.getActiveFast.invalidate();
      utils.fasting.getHistory.invalidate();
      toast.success(t("fasting:fastingStarted"));
      posthog.capture("fasting_started");
    },
    onError: (err) => toast.error(err.message),
  });

  const endFast = trpc.fasting.endFast.useMutation({
    onSuccess: (data) => {
      utils.fasting.getActiveFast.invalidate();
      utils.fasting.getHistory.invalidate();
      if (data.completed) {
        toast.success(t("fasting:fastingCompleted", { hours: data.actualHours }));
      } else {
        toast(t("fasting:fastingEnded", { hours: data.actualHours }));
      }
      posthog.capture("fasting_ended", { actual_hours: data.actualHours, completed: data.completed });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteFast = trpc.fasting.deleteFast.useMutation({
    onSuccess: () => {
      utils.fasting.getHistory.invalidate();
      toast.success(t("fasting:recordDeleted"));
    },
    onError: (err) => toast.error(err.message),
  });

  // Timer tick
  useEffect(() => {
    if (!activeFast) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeFast]);

  const handleOpenConfig = useCallback(() => {
    if (config) {
      setSelectedProtocol(config.protocol);
      setCustomEatingStart(config.eatingStart.slice(0, 5));
      setCustomEatingEnd(config.eatingEnd.slice(0, 5));
    }
    setConfigDialogOpen(true);
  }, [config]);

  const handleProtocolSelect = (protocol: typeof FASTING_PROTOCOLS[number]) => {
    setSelectedProtocol(protocol.value);
    const start = customEatingStart || "12:00";
    const startHour = parseInt(start.split(":")[0], 10);
    const endHour = (startHour + protocol.eating) % 24;
    setCustomEatingEnd(`${String(endHour).padStart(2, "0")}:${start.split(":")[1]}`);
  };

  const handleEatingStartChange = (value: string) => {
    setCustomEatingStart(value);
    const proto = FASTING_PROTOCOLS.find((p) => p.value === selectedProtocol);
    if (proto) {
      const startHour = parseInt(value.split(":")[0], 10);
      const startMin = value.split(":")[1];
      const endHour = (startHour + proto.eating) % 24;
      setCustomEatingEnd(`${String(endHour).padStart(2, "0")}:${startMin}`);
    }
  };

  const handleSaveConfig = () => {
    upsertConfig.mutate({
      protocol: selectedProtocol as FastingProtocol | "custom",
      eatingStart: customEatingStart,
      eatingEnd: customEatingEnd,
    });
  };

  const handleStartFast = () => {
    const plannedHours = config ? getProtocolHours(config.protocol) : 16;
    startFast.mutate({ plannedHours });
  };

  const handleEndFast = () => {
    if (!activeFast) return;
    endFast.mutate({ id: activeFast.id });
  };

  // Calculate timer values
  const elapsedMs = activeFast ? now - new Date(activeFast.startedAt).getTime() : 0;
  const plannedMs = activeFast ? Number(activeFast.plannedHours) * MS_PER_HOUR : 0;
  const progressPercent = plannedMs > 0 ? Math.min((elapsedMs / plannedMs) * 100, 100) : 0;
  const elapsed = formatDuration(elapsedMs);
  const remaining = formatDuration(Math.max(0, plannedMs - elapsedMs));
  const isOvertime = elapsedMs > plannedMs;

  const isLoading = configLoading || fastLoading;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-light tracking-wide">{t("fasting:title")}</h1>
        <button
          onClick={handleOpenConfig}
          className="text-neutral-400 hover:text-foreground transition-colors"
        >
          <Settings2 className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Protocol info */}
      {config && (
        <div className="text-center">
          <p className="text-sm font-light text-neutral-400">
            {FASTING_PROTOCOLS.find((p) => p.value === config.protocol)?.label ?? t("exercise:custom")} {t("fasting:mode")}
            <span className="mx-2">·</span>
            {t("fasting:eatingTime")} {config.eatingStart.slice(0, 5)} - {config.eatingEnd.slice(0, 5)}
          </p>
        </div>
      )}

      {/* Timer Circle */}
      <div className="flex flex-col items-center py-6">
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
                  ? "text-amber-500"
                  : activeFast
                    ? "text-green-500"
                    : "text-neutral-300 dark:text-neutral-700"
              }`}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            {activeFast ? (
              <>
                <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-1">
                  {isOvertime ? t("fasting:overtime") : t("fasting:elapsed")}
                </p>
                <span className="text-3xl font-extralight tabular-nums tracking-wider">
                  {elapsed.hours}:{elapsed.minutes}:{elapsed.seconds}
                </span>
                <p className="text-xs font-light text-neutral-400 mt-1">
                  {isOvertime ? t("fasting:goalReached") : t("fasting:remainingTime", { time: `${remaining.hours}:${remaining.minutes}` })}
                </p>
              </>
            ) : (
              <>
                <Timer className="h-6 w-6 text-green-500 mb-2" strokeWidth={1.5} />
                <span className="text-sm font-light text-neutral-400">{t("fasting:notStarted")}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Start / End Button */}
      <div className="flex justify-center">
        {activeFast ? (
          <button
            onClick={handleEndFast}
            disabled={endFast.isPending}
            className="flex items-center gap-2 px-8 py-3 rounded-full border border-red-500/30 text-red-500 text-sm font-light transition-all hover:bg-red-500/10 disabled:opacity-50"
          >
            <Square className="h-4 w-4" strokeWidth={1.5} />
            {endFast.isPending ? t("fasting:ending") : t("fasting:endFasting")}
          </button>
        ) : (
          <button
            onClick={handleStartFast}
            disabled={startFast.isPending || !config}
            className="flex items-center gap-2 px-8 py-3 rounded-full border border-green-500/30 text-green-500 text-sm font-light transition-all hover:bg-green-500/10 disabled:opacity-50"
          >
            <Play className="h-4 w-4" strokeWidth={1.5} />
            {startFast.isPending ? t("fasting:starting") : t("fasting:startFasting")}
          </button>
        )}
      </div>

      {!config && (
        <p className="text-center text-sm font-light text-neutral-400">
          {t("fasting:setupFirst")}
        </p>
      )}

      {/* Divider */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />

      {/* History */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("fasting:history")}
        </p>
        {history && history.length > 0 ? (
          <div className="space-y-0">
            {history.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      log.completed
                        ? "bg-green-500/10 text-green-500"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {log.completed ? (
                      <Check className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <X className="h-3 w-3" strokeWidth={2} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-light">
                      {Number(log.actualHours).toFixed(1)} / {Number(log.plannedHours).toFixed(0)} {t("fasting:hoursCount")}
                    </p>
                    <p className="text-xs text-neutral-400 tabular-nums">
                      {formatDateTime(log.startedAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteFast.mutate({ id: log.id })}
                  disabled={deleteFast.isPending}
                  className="text-neutral-300 dark:text-neutral-700 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-light text-neutral-300 dark:text-neutral-700">
            {t("fasting:noHistory")}
          </p>
        )}
      </div>

      {/* Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogHeader>
          <DialogTitle>{t("fasting:configTitle")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {/* Protocol Selection */}
          <div className="space-y-2">
            <label className="text-sm font-light text-neutral-500">{t("fasting:fastingMode")}</label>
            <div className="grid grid-cols-2 gap-2">
              {FASTING_PROTOCOLS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handleProtocolSelect(p)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-sm font-light transition-all ${
                    selectedProtocol === p.value
                      ? "border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/5"
                      : "border-black/[0.06] dark:border-white/[0.06] text-neutral-500 hover:border-foreground/20"
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="text-[10px] text-neutral-400">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Eating Window */}
          <div className="space-y-2">
            <label className="text-sm font-light text-neutral-500">{t("fasting:eatingWindow")}</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-neutral-400">{t("fasting:startLabel")}</label>
                <input
                  type="time"
                  value={customEatingStart}
                  onChange={(e) => handleEatingStartChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <span className="text-neutral-400 mt-5">-</span>
              <div className="flex-1">
                <label className="text-xs text-neutral-400">{t("fasting:endLabel")}</label>
                <input
                  type="time"
                  value={customEatingEnd}
                  onChange={(e) => setCustomEatingEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={upsertConfig.isPending}
            className="w-full rounded-lg bg-green-500 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
          >
            {upsertConfig.isPending ? t("fasting:configSaving") : t("fasting:save")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
