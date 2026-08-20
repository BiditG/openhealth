"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search, X, Flame } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { todayString } from "@open-health/shared/utils";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  EXERCISE_CATEGORIES,
  DEFAULT_EXERCISE_CALORIE_GOAL,
} from "@open-health/shared/constants";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function ExercisePage() {
  const { t } = useTranslation("exercise");
  const today = todayString();
  const utils = trpc.useUtils();
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } = useAuthGuard();

  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedExercise, setSelectedExercise] = useState<{
    id: string;
    name: string;
    metValue: string | null;
    category: string | null;
  } | null>(null);
  const [durationMin, setDurationMin] = useState("");
  const [intensity, setIntensity] = useState<"low" | "moderate" | "high" | undefined>(undefined);
  const [caloriesOverride, setCaloriesOverride] = useState("");
  const [note, setNote] = useState("");

  // Custom exercise form
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<string>("other");
  const [customMet, setCustomMet] = useState("");

  const { data: dayData, isLoading } = trpc.exercise.getDay.useQuery(
    { date: today },
    { enabled: isAuthenticated }
  );
  const { data: presets } = trpc.exercise.getPresets.useQuery(
    selectedCategory ? { category: selectedCategory as "cardio" | "strength" | "flexibility" | "sport" | "other" } : {},
    { enabled: logDialogOpen && searchQuery.trim().length < 1, staleTime: 60_000, retry: false }
  );
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const { data: searchResults } = trpc.exercise.searchExercises.useQuery(
    { query: debouncedSearchQuery },
    { enabled: logDialogOpen && debouncedSearchQuery.length >= 2, staleTime: 60_000, retry: false }
  );

  const logExercise = trpc.exercise.logExercise.useMutation({
    onSuccess: (_data, variables) => {
      utils.exercise.getDay.invalidate({ date: today });
      posthog.capture("exercise_logged", {
        exercise_name: selectedExercise?.name,
        duration_min: variables.durationMin,
        calories_burned: _data.caloriesBurned,
        category: selectedExercise?.category,
        intensity: variables.intensity,
      });
      resetLogForm();
      setLogDialogOpen(false);
      toast.success(t("logged"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const removeLog = trpc.exercise.removeLog.useMutation({
    onSuccess: () => {
      utils.exercise.getDay.invalidate({ date: today });
      posthog.capture("exercise_deleted");
    },
  });

  const createCustomExercise = trpc.exercise.createCustomExercise.useMutation({
    onSuccess: (data) => {
      utils.exercise.getPresets.invalidate();
      posthog.capture("custom_exercise_created", { name: customName });
      setCustomDialogOpen(false);
      setSelectedExercise({
        id: data.id,
        name: customName,
        metValue: customMet || null,
        category: customCategory,
      });
      setCustomName("");
      setCustomCategory("other");
      setCustomMet("");
      toast.success(t("customCreated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resetLogForm = () => {
    setSelectedExercise(null);
    setDurationMin("");
    setIntensity(undefined);
    setCaloriesOverride("");
    setNote("");
    setSearchQuery("");
    setSelectedCategory(undefined);
  };

  const handleLogSubmit = () => {
    if (!selectedExercise || !durationMin) return;
    const duration = parseInt(durationMin, 10);
    if (isNaN(duration) || duration < 1) return;

    logExercise.mutate({
      date: today,
      exerciseId: selectedExercise.id,
      durationMin: duration,
      caloriesBurned: caloriesOverride ? Number(caloriesOverride) : undefined,
      intensity,
      note: note || undefined,
    });
  };

  const handleCreateCustom = () => {
    if (!customName.trim()) return;
    createCustomExercise.mutate({
      name: customName.trim(),
      category: customCategory as "cardio" | "strength" | "flexibility" | "sport" | "other",
      metValue: customMet ? Number(customMet) : undefined,
    });
  };

  const exerciseList = searchQuery.trim().length >= 1 ? searchResults : presets;
  const totalCalories = dayData?.totalCalories ?? 0;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-light tracking-wide">{t("title")}</h1>

      {/* Circular progress */}
      <div className="flex flex-col items-center py-6">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <svg className="h-40 w-40 -rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-neutral-200 dark:text-neutral-800"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray={`${Math.min((totalCalories / DEFAULT_EXERCISE_CALORIE_GOAL) * 100, 100) * 4.4} ${440 - Math.min((totalCalories / DEFAULT_EXERCISE_CALORIE_GOAL) * 100, 100) * 4.4}`}
              strokeLinecap="round"
              className="text-orange-500 transition-all duration-500"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <Flame className="h-5 w-5 text-orange-500 mb-1" strokeWidth={1.5} />
            <span className="text-3xl font-extralight tabular-nums">{Math.round(totalCalories)}</span>
            <span className="text-xs font-light text-neutral-400 dark:text-neutral-600">
              {t("kcalBurned")}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />

      {/* Add Exercise Button */}
      <button
        onClick={() => {
          if (!isAuthenticated) { setShowLoginDialog(true); return; }
          resetLogForm(); setLogDialogOpen(true);
        }}
        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-sm font-light text-neutral-400 hover:text-foreground hover:border-foreground/20 transition-all"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        {t("addExercise")}
      </button>

      {/* Divider */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]" />

      {/* Log History */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("todayLog")}
        </p>
        {dayData?.logs && dayData.logs.length > 0 ? (
          <div className="space-y-0">
            {dayData.logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-light truncate">{log.exerciseName}</span>
                    {log.exerciseCategory && (
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
                        {t(`categories.${log.exerciseCategory}`, { defaultValue: log.exerciseCategory })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-neutral-400 tabular-nums">
                      {log.durationMin} {t("minutes")}
                    </span>
                    {log.intensity && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-500">
                        {t(`intensity.${log.intensity}`)}{t("intensitySuffix")}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400 tabular-nums">
                      {formatTime(log.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-sm font-light tabular-nums text-orange-500">
                    {Math.round(Number(log.caloriesBurned || 0))} kcal
                  </span>
                  <button
                    onClick={() => removeLog.mutate({ logId: log.id })}
                    disabled={removeLog.isPending}
                    className="p-1 text-neutral-300 dark:text-neutral-700 transition-all duration-300 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-light text-neutral-300 dark:text-neutral-700">
            {t("noTodayLog")}
          </p>
        )}
      </div>

      {/* Log Exercise Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={(open) => { setLogDialogOpen(open); if (!open) resetLogForm(); }}>
        <DialogHeader>
          <DialogTitle>{selectedExercise ? t("logExercise") : t("selectExercise")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {!selectedExercise ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={1.5} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchExercise")}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent pl-9 pr-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {/* Category filters */}
              {!searchQuery && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setSelectedCategory(undefined)}
                    className={`px-2.5 py-1 rounded-full text-xs font-light transition-all ${
                      !selectedCategory
                        ? "bg-orange-500 text-white"
                        : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"
                    }`}
                  >
                    {t("allCategories")}
                  </button>
                  {EXERCISE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-light transition-all ${
                        selectedCategory === cat
                          ? "bg-orange-500 text-white"
                          : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"
                      }`}
                    >
                      {t(`categories.${cat}`)}
                    </button>
                  ))}
                </div>
              )}

              {/* Exercise list */}
              <div className="space-y-0 max-h-60 overflow-y-auto">
                {exerciseList && exerciseList.length > 0 ? (
                  exerciseList.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => setSelectedExercise(ex)}
                      className="w-full flex items-center justify-between py-2.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-left"
                    >
                      <div>
                        <span className="text-sm font-light">{ex.name}</span>
                        {ex.category && (
                          <span className="ml-2 text-[10px] text-neutral-400">
                            {t(`categories.${ex.category}`, { defaultValue: ex.category })}
                          </span>
                        )}
                      </div>
                      {ex.isCustom && (
                        <span className="text-[10px] text-orange-400">{t("custom")}</span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-sm font-light text-neutral-400 text-center py-4">
                    {searchQuery ? t("noMatchExercise") : t("noExerciseItems")}
                  </p>
                )}
              </div>

              {/* Create custom */}
              <button
                onClick={() => setCustomDialogOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-sm font-light text-neutral-400 hover:text-foreground hover:border-foreground/20 transition-all"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t("createCustomExercise")}
              </button>
            </>
          ) : (
            <>
              {/* Selected exercise */}
              <div className="flex items-center justify-between py-2 px-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                <div>
                  <span className="text-sm font-light">{selectedExercise.name}</span>
                  {selectedExercise.category && (
                    <span className="ml-2 text-[10px] text-neutral-400">
                      {t(`categories.${selectedExercise.category}`, { defaultValue: selectedExercise.category })}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedExercise(null)}
                  className="text-neutral-400 hover:text-foreground"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              {/* Duration */}
              <div>
                <label className="text-sm font-light text-neutral-500">{t("durationMinutes")}</label>
                <input
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  min={1}
                  max={1440}
                  placeholder={t("durationPlaceholder")}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Intensity */}
              <div>
                <label className="text-sm font-light text-neutral-500">{t("intensityOptional")}</label>
                <div className="mt-1 flex gap-2">
                  {(["low", "moderate", "high"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setIntensity(intensity === level ? undefined : level)}
                      className={`flex-1 py-2 rounded-lg text-sm font-light transition-all border ${
                        intensity === level
                          ? "border-orange-500 text-orange-500"
                          : "border-black/[0.06] dark:border-white/[0.06] text-neutral-400 hover:text-foreground"
                      }`}
                    >
                      {t(`intensity.${level}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calories override */}
              <div>
                <label className="text-sm font-light text-neutral-500">{t("caloriesOptional")}</label>
                <input
                  type="number"
                  value={caloriesOverride}
                  onChange={(e) => setCaloriesOverride(e.target.value)}
                  min={0}
                  max={99999}
                  placeholder={t("autoCalculate")}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-sm font-light text-neutral-500">{t("noteOptional")}</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder={t("notePlaceholder")}
                  className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleLogSubmit}
                disabled={logExercise.isPending || !durationMin}
                className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                {logExercise.isPending ? t("logging") : t("logExercise")}
              </button>
            </>
          )}
        </div>
      </Dialog>

      {/* Custom Exercise Dialog */}
      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogHeader>
          <DialogTitle>{t("createCustomExercise")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-light text-neutral-500">{t("name")}</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              maxLength={200}
              placeholder={t("namePlaceholder")}
              className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="text-sm font-light text-neutral-500">{t("category")}</label>
            <div className="mt-1 flex gap-1.5 flex-wrap">
              {EXERCISE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCustomCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-light transition-all ${
                    customCategory === cat
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"
                  }`}
                >
                  {t(`categories.${cat}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-light text-neutral-500">{t("metValue")}</label>
            <input
              type="number"
              value={customMet}
              onChange={(e) => setCustomMet(e.target.value)}
              min={0}
              max={30}
              step={0.1}
              placeholder={t("metPlaceholder")}
              className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <p className="mt-1 text-xs text-neutral-400">{t("metHint")}</p>
          </div>
          <button
            onClick={handleCreateCustom}
            disabled={createCustomExercise.isPending || !customName.trim()}
            className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {createCustomExercise.isPending ? t("creating") : t("create")}
          </button>
        </div>
      </Dialog>

      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
      />
    </div>
  );
}
