"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Check,
  Trash2,
  Search,
  Timer,
  ChevronDown,
  ChevronUp,
  Save,
  Clock,
  Globe,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { LoginDialog } from "@/components/auth/login-dialog";
import {
  useWorkoutTimerStore,
  useWorkoutTimerTick,
  formatDuration,
} from "@/hooks/use-workout-timer";
import {
  addExerciseToWorkout,
  removeExerciseFromWorkout,
  logSet,
  removeSet,
  finishWorkout,
  discardWorkout,
  saveWorkoutAsTemplate,
} from "@/server/actions/workout";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EXERCISE_CATEGORIES,
  REST_TIMER_OPTIONS,
} from "@open-health/shared/constants";
import { useTranslation } from "react-i18next";

export default function ActiveWorkoutPage() {
  const { t } = useTranslation(["workout", "common", "exercise"]);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { isAuthenticated, showLoginDialog, setShowLoginDialog, user } =
    useAuthGuard();

  const { data: workout, isLoading } = trpc.workout.getActive.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: false }
  );

  const timerStore = useWorkoutTimerStore();
  useWorkoutTimerTick();

  // Sync timer with workout
  const startWorkoutTimer = timerStore.startWorkout;
  const isTimerRunning = timerStore.isRunning;
  useEffect(() => {
    if (workout && !isTimerRunning) {
      startWorkoutTimer(workout.id, new Date(workout.startedAt));
    }
  }, [workout?.id, workout?.startedAt, isTimerRunning, startWorkoutTimer]);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<string>("strength");

  const togglePublic = trpc.exercise.toggleExercisePublic.useMutation({
    onSuccess: (data) => {
      utils.exercise.getPresets.invalidate();
      utils.exercise.searchExercises.invalidate();
      toast.success(data.isPublic ? t("workout:activePage.setPublicSuccess") : t("workout:activePage.setPrivateSuccess"));
    },
    onError: (err) => toast.error(err.message),
  });

  const createCustomExercise = trpc.exercise.createCustomExercise.useMutation({
    onSuccess: (data) => {
      utils.exercise.getPresets.invalidate();
      toast.success(t("workout:activePage.customExerciseCreated"));
      setShowCreateCustom(false);
      setCustomName("");
      setCustomCategory("strength");
      // Automatically add to workout
      handleAddExercise(data.id);
    },
    onError: (err) => toast.error(err.message),
  });

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
    { enabled: showAddExercise && searchQuery.trim().length < 1, staleTime: 60_000, retry: false }
  );
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const { data: searchResults } = trpc.exercise.searchExercises.useQuery(
    { query: debouncedSearchQuery },
    { enabled: showAddExercise && debouncedSearchQuery.length >= 2, staleTime: 60_000, retry: false }
  );

  const exerciseList = searchQuery.trim().length >= 1 ? searchResults : presets;

  const handleAddExercise = async (exerciseId: string) => {
    if (!workout) return;
    try {
      await addExerciseToWorkout({ workoutId: workout.id, exerciseId });
      setShowAddExercise(false);
      setSearchQuery("");
      utils.workout.getActive.invalidate();
    } catch {
      toast.error(t("workout:activePage.addExerciseFailed"));
    }
  };

  const handleRemoveExercise = async (workoutExerciseId: string) => {
    try {
      await removeExerciseFromWorkout({ workoutExerciseId });
      utils.workout.getActive.invalidate();
    } catch {
      toast.error(t("workout:activePage.removeExerciseFailed"));
    }
  };

  const handleLogSet = async (
    workoutExerciseId: string,
    setNumber: number,
    weightKg: number | undefined,
    reps: number | undefined
  ) => {
    try {
      await logSet({ workoutExerciseId, setNumber, weightKg, reps });
      utils.workout.getActive.invalidate();
    } catch {
      toast.error(t("workout:activePage.logSetFailed"));
    }
  };

  const handleRemoveSet = async (setId: string) => {
    try {
      await removeSet({ setId });
      utils.workout.getActive.invalidate();
    } catch {
      toast.error(t("workout:activePage.deleteSetFailed"));
    }
  };

  const handleAddSet = async (workoutExerciseId: string, nextSetNumber: number) => {
    try {
      await logSet({ workoutExerciseId, setNumber: nextSetNumber });
      utils.workout.getActive.invalidate();
    } catch {
      toast.error(t("workout:activePage.addSetFailed"));
    }
  };

  const handleFinish = async () => {
    if (!workout) return;
    setSaving(true);
    try {
      await finishWorkout({ workoutId: workout.id });
      timerStore.stopWorkout();
      toast.success(t("workout:activePage.workoutCompleted"));
      router.push("/hub/workout");
      router.refresh();
    } catch {
      toast.error(t("workout:activePage.completeFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!workout) return;
    try {
      await discardWorkout({ workoutId: workout.id });
      timerStore.stopWorkout();
      toast.success(t("workout:activePage.workoutCancelled"));
      router.push("/hub/workout");
      router.refresh();
    } catch {
      toast.error(t("workout:activePage.cancelFailed"));
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!workout || !templateName.trim()) return;
    try {
      await saveWorkoutAsTemplate({
        workoutId: workout.id,
        name: templateName.trim(),
      });
      toast.success(t("workout:activePage.savedAsTemplate"));
      setShowSaveTemplate(false);
      setTemplateName("");
    } catch {
      toast.error(t("workout:activePage.saveTemplateFailed"));
    }
  };

  const handleStartRest = (seconds: number) => {
    timerStore.startRestTimer(seconds);
  };

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
        <p className="text-sm text-neutral-400">{t("workout:activePage.noActiveWorkout")}</p>
        <button
          onClick={() => router.push("/hub/workout")}
          className="mt-4 text-sm text-primary hover:underline"
        >
          {t("workout:activePage.backToWorkout")}
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header with timer */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-light">{workout.name}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
            <span className="text-sm font-light text-primary tabular-nums">
              {formatDuration(timerStore.elapsedSeconds)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSaveTemplate(true)}
            className="p-2 text-neutral-400 hover:text-foreground transition-colors"
            title={t("workout:activePage.saveAsTemplate")}
          >
            <Save className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t("workout:activePage.finish")}
          </button>
        </div>
      </div>

      {/* Rest timer overlay */}
      {timerStore.restTimer && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-blue-500" strokeWidth={2} />
              <span className="text-sm font-medium text-blue-500">
                {t("workout:activePage.resting")}
              </span>
            </div>
            <button
              onClick={() => timerStore.cancelRestTimer()}
              className="text-xs text-neutral-400 hover:text-foreground"
            >
              {t("workout:activePage.skip")}
            </button>
          </div>
          <div className="mt-2 text-center">
            <span className="text-4xl font-extralight tabular-nums text-blue-500">
              {formatDuration(timerStore.restTimer.remaining)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1 rounded-full bg-blue-500/20 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-1000 ease-linear rounded-full"
              style={{
                width: `${(timerStore.restTimer.remaining / timerStore.restTimer.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Rest timer quick buttons */}
      {!timerStore.restTimer && (
        <div className="flex gap-1.5">
          {REST_TIMER_OPTIONS.map((sec) => (
            <button
              key={sec}
              onClick={() => handleStartRest(sec)}
              className="flex-1 py-1.5 rounded-md border border-black/[0.06] dark:border-white/[0.06] text-xs font-light text-neutral-400 hover:text-foreground hover:border-foreground/20 transition-all"
            >
              {sec >= 60 ? `${sec / 60}${t("workout:activePage.minLabel")}` : `${sec}${t("workout:activePage.secLabel")}`}
            </button>
          ))}
        </div>
      )}

      {/* Exercises */}
      <div className="space-y-3">
        {workout.exercises.map((we) => (
          <ExerciseCard
            key={we.weId}
            exercise={we}
            isExpanded={expandedExercise === we.weId}
            onToggle={() =>
              setExpandedExercise(
                expandedExercise === we.weId ? null : we.weId
              )
            }
            onLogSet={handleLogSet}
            onRemoveSet={handleRemoveSet}
            onAddSet={handleAddSet}
            onRemoveExercise={handleRemoveExercise}
          />
        ))}
      </div>

      {/* Add exercise button */}
      <button
        onClick={() => {
          setShowAddExercise(true);
          setSearchQuery("");
          setSelectedCategory(undefined);
        }}
        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-sm font-light text-neutral-400 hover:text-foreground hover:border-foreground/20 transition-all"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        {t("workout:activePage.addExercise")}
      </button>

      {/* Discard button */}
      <button
        onClick={() => setShowDiscardConfirm(true)}
        className="w-full py-2 text-xs text-neutral-300 dark:text-neutral-700 hover:text-destructive transition-colors"
      >
        {t("workout:activePage.cancelWorkout")}
      </button>

      {/* Add exercise dialog */}
      <Dialog
        open={showAddExercise}
        onOpenChange={setShowAddExercise}
      >
        <DialogHeader>
          <DialogTitle>{t("workout:activePage.addExercise")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("workout:activePage.searchExercise")}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent pl-9 pr-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {!searchQuery && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedCategory(undefined)}
                className={`px-2.5 py-1 rounded-full text-xs font-light transition-all ${
                  !selectedCategory
                    ? "bg-primary text-white"
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"
                }`}
              >
                {t("workout:activePage.all")}
              </button>
              {EXERCISE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-light transition-all ${
                    selectedCategory === cat
                      ? "bg-primary text-white"
                      : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"
                  }`}
                >
                  {t(`exercise:categories.${cat}`)}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-0 max-h-60 overflow-y-auto">
            {exerciseList && exerciseList.length > 0 ? (
              exerciseList.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between py-2.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                >
                  <button
                    onClick={() => handleAddExercise(ex.id)}
                    className="flex-1 text-left"
                  >
                    <span className="text-sm font-light">{ex.name}</span>
                    {ex.category && (
                      <span className="ml-2 text-[10px] text-neutral-400">
                        {t(`exercise:categories.${ex.category}`, { defaultValue: ex.category })}
                      </span>
                    )}
                    {ex.isCustom && (
                      <span className="ml-1.5 text-[10px] text-orange-400">{t("workout:activePage.custom")}</span>
                    )}
                    {ex.isPublic && (
                      <span className="ml-1.5 text-[10px] text-blue-400">{t("workout:activePage.public")}</span>
                    )}
                  </button>
                  {ex.isCustom && ex.createdBy === user?.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePublic.mutate({ exerciseId: ex.id });
                      }}
                      title={ex.isPublic ? t("workout:activePage.setPrivate") : t("workout:activePage.setPublic")}
                      className={`ml-2 p-1.5 rounded transition-colors ${
                        ex.isPublic
                          ? "text-blue-400 hover:text-blue-500"
                          : "text-neutral-300 hover:text-neutral-500"
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm font-light text-neutral-400 text-center py-4">
                {searchQuery ? t("workout:activePage.noMatch") : t("workout:activePage.noExercises")}
              </p>
            )}
          </div>

          {/* Create custom exercise */}
          {!showCreateCustom ? (
            <button
              onClick={() => setShowCreateCustom(true)}
              className="w-full py-2.5 text-sm font-light text-primary hover:text-primary/80 transition-colors border-t border-black/[0.06] dark:border-white/[0.06]"
            >
              {t("workout:activePage.createCustomExercise")}
            </button>
          ) : (
            <div className="border-t border-black/[0.06] dark:border-white/[0.06] pt-3 space-y-3">
              <p className="text-xs font-medium text-neutral-500">{t("workout:activePage.createCustomTitle")}</p>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t("workout:activePage.exerciseName")}
                maxLength={200}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-1.5 flex-wrap">
                {EXERCISE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCustomCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-light transition-all ${
                      customCategory === cat
                        ? "bg-primary text-white"
                        : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"
                    }`}
                  >
                    {t(`exercise:categories.${cat}`)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCreateCustom(false);
                    setCustomName("");
                  }}
                  className="flex-1 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-light"
                >
                  {t("common:buttons.cancel")}
                </button>
                <button
                  onClick={() => {
                    if (!customName.trim()) return;
                    createCustomExercise.mutate({
                      name: customName.trim(),
                      category: customCategory as "cardio" | "strength" | "flexibility" | "sport" | "other",
                    });
                  }}
                  disabled={!customName.trim() || createCustomExercise.isPending}
                  className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
                >
                  {createCustomExercise.isPending ? t("workout:activePage.creating") : t("workout:activePage.createAndAdd")}
                </button>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Finish confirm */}
      <Dialog
        open={showFinishConfirm}
        onOpenChange={setShowFinishConfirm}
      >
        <DialogHeader>
          <DialogTitle>{t("workout:activePage.finishTitle")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-neutral-500">
            {t("workout:activePage.workoutDuration", { duration: formatDuration(timerStore.elapsedSeconds) })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFinishConfirm(false)}
              className="flex-1 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-light"
            >
              {t("workout:activePage.continueWorkout")}
            </button>
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? t("common:buttons.saving") : t("workout:activePage.finish")}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Discard confirm */}
      <Dialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
      >
        <DialogHeader>
          <DialogTitle>{t("workout:activePage.cancelTitle")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-neutral-500">
            {t("workout:activePage.cancelWarning")}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDiscardConfirm(false)}
              className="flex-1 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-light"
            >
              {t("workout:activePage.back")}
            </button>
            <button
              onClick={handleDiscard}
              className="flex-1 py-2 rounded-lg bg-destructive text-white text-sm font-medium"
            >
              {t("workout:activePage.cancelWorkout")}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Save as template */}
      <Dialog
        open={showSaveTemplate}
        onOpenChange={setShowSaveTemplate}
      >
        <DialogHeader>
          <DialogTitle>{t("workout:activePage.saveAsTemplate")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-light text-neutral-500">
              {t("workout:activePage.templateName")}
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t("workout:activePage.templateNamePlaceholder")}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSaveAsTemplate}
            disabled={!templateName.trim()}
            className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {t("common:buttons.save")}
          </button>
        </div>
      </Dialog>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}

// Exercise card component
function ExerciseCard({
  exercise,
  isExpanded,
  onToggle,
  onLogSet,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
}: {
  exercise: {
    weId: string;
    exerciseId: string;
    exerciseName: string;
    exerciseCategory: string | null;
    sets: Array<{
      id: string;
      setNumber: number;
      weightKg: string | null;
      reps: number | null;
      isWarmup: boolean;
      isDropset: boolean;
      isPersonalRecord: boolean;
      completedAt: string | Date | null;
    }>;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onLogSet: (
    weId: string,
    setNumber: number,
    weightKg: number | undefined,
    reps: number | undefined
  ) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: (weId: string, nextSetNumber: number) => void;
  onRemoveExercise: (weId: string) => void;
}) {
  const { t } = useTranslation(["workout", "common", "exercise"]);
  // Previous performance hints
  const { data: prevHistory } = trpc.workout.getExerciseHistory.useQuery(
    { exerciseId: exercise.exerciseId, limit: 1 },
    { enabled: true }
  );

  const lastPerformance = prevHistory?.[0];

  return (
    <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] overflow-hidden">
      {/* Exercise header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary">
            {exercise.exerciseName}
          </span>
          {exercise.exerciseCategory && (
            <span className="text-[10px] text-neutral-400">
              {t(`exercise:categories.${exercise.exerciseCategory}`, { defaultValue: exercise.exerciseCategory })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">
            {exercise.sets.filter((s) => s.completedAt).length}/
            {t("workout:setCount", { count: exercise.sets.length })}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
          ) : (
            <ChevronDown
              className="h-4 w-4 text-neutral-400"
              strokeWidth={1.5}
            />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Previous performance hint */}
          {lastPerformance && lastPerformance.sets.length > 0 && (
            <div className="text-[10px] text-neutral-400 bg-neutral-50 dark:bg-neutral-900 rounded px-2 py-1">
              {t("workout:activePage.lastTime")}
              {lastPerformance.sets
                .filter((s) => !s.isWarmup)
                .map(
                  (s) =>
                    `${s.weightKg ? Number(s.weightKg) : 0}kg×${s.reps ?? 0}`
                )
                .join("、")}
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-[40px_1fr_1fr_32px_32px] gap-1 text-[10px] text-neutral-400 px-1">
            <span>{t("workout:activePage.sets")}</span>
            <span>{t("workout:activePage.weightKg")}</span>
            <span>{t("workout:activePage.reps")}</span>
            <span />
            <span />
          </div>

          {/* Sets */}
          {exercise.sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              weId={exercise.weId}
              onLogSet={onLogSet}
              onRemoveSet={onRemoveSet}
            />
          ))}

          {/* Add set */}
          <button
            onClick={() =>
              onAddSet(
                exercise.weId,
                (exercise.sets[exercise.sets.length - 1]?.setNumber ?? 0) + 1
              )
            }
            className="w-full py-1.5 text-xs text-neutral-400 hover:text-foreground transition-colors"
          >
            {t("workout:activePage.addSet")}
          </button>

          {/* Remove exercise */}
          <button
            onClick={() => onRemoveExercise(exercise.weId)}
            className="w-full py-1 text-[10px] text-neutral-300 dark:text-neutral-700 hover:text-destructive transition-colors"
          >
            {t("workout:activePage.removeExercise")}
          </button>
        </div>
      )}
    </div>
  );
}

// Set row component
function SetRow({
  set,
  weId,
  onLogSet,
  onRemoveSet,
}: {
  set: {
    id: string;
    setNumber: number;
    weightKg: string | null;
    reps: number | null;
    isWarmup: boolean;
    isDropset: boolean;
    isPersonalRecord: boolean;
    completedAt: string | Date | null;
  };
  weId: string;
  onLogSet: (
    weId: string,
    setNumber: number,
    weightKg: number | undefined,
    reps: number | undefined
  ) => void;
  onRemoveSet: (setId: string) => void;
}) {
  const [weight, setWeight] = useState(
    set.weightKg ? String(Number(set.weightKg)) : ""
  );
  const [reps, setReps] = useState(set.reps ? String(set.reps) : "");

  // Sync from props when data changes
  useEffect(() => {
    setWeight(set.weightKg ? String(Number(set.weightKg)) : "");
    setReps(set.reps ? String(set.reps) : "");
  }, [set.weightKg, set.reps]);

  const handleComplete = () => {
    onLogSet(
      weId,
      set.setNumber,
      weight ? Number(weight) : undefined,
      reps ? Number(reps) : undefined
    );
  };

  const isCompleted = !!set.completedAt;

  return (
    <div
      className={`grid grid-cols-[40px_1fr_1fr_32px_32px] gap-1 items-center ${
        isCompleted ? "opacity-60" : ""
      }`}
    >
      <span
        className={`text-xs font-light text-center ${
          set.isWarmup
            ? "text-amber-500"
            : set.isPersonalRecord
              ? "text-primary font-medium"
              : "text-neutral-400"
        }`}
      >
        {set.isWarmup ? "W" : set.setNumber}
      </span>
      <input
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="-"
        className="w-full rounded border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-2 py-1.5 text-sm font-light text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        type="number"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        placeholder="-"
        className="w-full rounded border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-2 py-1.5 text-sm font-light text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        onClick={handleComplete}
        className={`flex items-center justify-center h-7 w-7 rounded transition-all ${
          isCompleted
            ? "bg-primary/20 text-primary"
            : "border border-black/[0.06] dark:border-white/[0.06] text-neutral-300 hover:text-primary hover:border-primary/30"
        }`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <button
        onClick={() => onRemoveSet(set.id)}
        className="flex items-center justify-center h-7 w-7 text-neutral-200 dark:text-neutral-800 hover:text-destructive transition-colors"
      >
        <Trash2 className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </div>
  );
}
