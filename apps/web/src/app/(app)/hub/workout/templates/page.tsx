"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createWorkoutTemplate,
  deleteWorkoutTemplate,
} from "@/server/actions/workout";
import {
  EXERCISE_CATEGORIES,
} from "@open-health/shared/constants";
import { useTranslation } from "react-i18next";

export default function WorkoutTemplatesPage() {
  const { t } = useTranslation(["workout", "common", "exercise"]);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } =
    useAuthGuard();

  const { data: templates, isLoading } = trpc.workout.getTemplates.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const [showCreate, setShowCreate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<
    Array<{
      exerciseId: string;
      name: string;
      defaultSets: number;
      defaultReps?: number;
    }>
  >([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    { enabled: showExercisePicker && searchQuery.trim().length < 1, staleTime: 60_000, retry: false }
  );
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const { data: searchResults } = trpc.exercise.searchExercises.useQuery(
    { query: debouncedSearchQuery },
    { enabled: showExercisePicker && debouncedSearchQuery.length >= 2, staleTime: 60_000, retry: false }
  );

  const exerciseList = searchQuery.trim().length >= 1 ? searchResults : presets;

  const handleAddExercise = (ex: { id: string; name: string }) => {
    setSelectedExercises((prev) => [
      ...prev,
      { exerciseId: ex.id, name: ex.name, defaultSets: 3 },
    ]);
    setShowExercisePicker(false);
    setSearchQuery("");
  };

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!templateName.trim() || selectedExercises.length === 0) return;
    setSaving(true);
    try {
      await createWorkoutTemplate({
        name: templateName.trim(),
        exercises: selectedExercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          defaultSets: ex.defaultSets,
          defaultReps: ex.defaultReps,
        })),
      });
      toast.success(t("templatePage.templateCreated"));
      setShowCreate(false);
      setTemplateName("");
      setSelectedExercises([]);
      utils.workout.getTemplates.invalidate();
      router.refresh();
    } catch {
      toast.error(t("templatePage.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      await deleteWorkoutTemplate({ templateId });
      toast.success(t("templateDeleted"));
      setDeleteConfirm(null);
      utils.workout.getTemplates.invalidate();
      router.refresh();
    } catch {
      toast.error(t("deleteFailed"));
    }
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
        <h1 className="text-xl font-light tracking-wide">{t("templatePage.title")}</h1>
      </div>

      {/* Create button */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-sm font-light text-neutral-400 hover:text-foreground hover:border-foreground/20 transition-all"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        {t("templatePage.createNew")}
      </button>

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="space-y-2">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-light">{tmpl.name}</p>
                  <p className="text-xs text-neutral-400 mt-0.5 truncate">
                    {tmpl.exerciseNames.join("、") || t("noActions")}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirm(tmpl.id)}
                  className="p-1.5 text-neutral-300 dark:text-neutral-700 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-light text-neutral-300 dark:text-neutral-700 text-center py-10">
          {t("noTemplates")}
        </p>
      )}

      {/* Create template dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogHeader>
          <DialogTitle>{t("templatePage.createTemplate")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-sm font-light text-neutral-500">
              {t("templatePage.templateName")}
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t("templatePage.templateNamePlaceholder")}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-light focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Selected exercises */}
          <div className="space-y-2">
            <label className="text-sm font-light text-neutral-500">
              {t("templatePage.exercises", { count: selectedExercises.length })}
            </label>
            {selectedExercises.map((ex, i) => (
              <div
                key={`${ex.exerciseId}-${i}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">{i + 1}.</span>
                  <span className="text-sm font-light">{ex.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={ex.defaultSets}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0)
                        setSelectedExercises((prev) =>
                          prev.map((p, idx) =>
                            idx === i ? { ...p, defaultSets: val } : p
                          )
                        );
                    }}
                    className="w-12 text-center rounded border border-black/10 dark:border-white/10 bg-transparent px-1 py-0.5 text-xs"
                    min={1}
                    max={20}
                  />
                  <span className="text-[10px] text-neutral-400">{t("detailPage.set")}</span>
                  <button
                    onClick={() => handleRemoveExercise(i)}
                    className="text-neutral-300 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => {
                setShowExercisePicker(true);
                setSearchQuery("");
                setSelectedCategory(undefined);
              }}
              className="w-full py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-neutral-400 hover:text-foreground transition-all"
            >
              {t("templatePage.addExercise")}
            </button>
          </div>

          <button
            onClick={handleCreate}
            disabled={
              saving || !templateName.trim() || selectedExercises.length === 0
            }
            className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? t("templatePage.creating") : t("templatePage.create")}
          </button>
        </div>
      </Dialog>

      {/* Exercise picker dialog */}
      <Dialog
        open={showExercisePicker}
        onOpenChange={setShowExercisePicker}
      >
        <DialogHeader>
          <DialogTitle>{t("templatePage.selectExercise")}</DialogTitle>
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
              placeholder={t("templatePage.searchExercise")}
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
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
                }`}
              >
                {t("templatePage.all")}
              </button>
              {EXERCISE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
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

          <div className="space-y-0 max-h-60 overflow-y-auto">
            {exerciseList && exerciseList.length > 0 ? (
              exerciseList.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() =>
                    handleAddExercise({ id: ex.id, name: ex.name })
                  }
                  className="w-full flex items-center justify-between py-2.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-left"
                >
                  <span className="text-sm font-light">{ex.name}</span>
                  {ex.category && (
                    <span className="text-[10px] text-neutral-400">
                      {t(`exercise:categories.${ex.category}`, { defaultValue: ex.category })}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <p className="text-sm font-light text-neutral-400 text-center py-4">
                {searchQuery ? t("templatePage.noMatch") : t("templatePage.noExercises")}
              </p>
            )}
          </div>
        </div>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogHeader>
          <DialogTitle>{t("confirmDeleteTemplate")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-neutral-500">{t("deleteIrreversible")}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-light"
            >
              {t("common:buttons.cancel")}
            </button>
            <button
              onClick={() =>
                deleteConfirm && handleDelete(deleteConfirm)
              }
              className="flex-1 py-2 rounded-lg bg-destructive text-white text-sm font-medium"
            >
              {t("common:buttons.delete")}
            </button>
          </div>
        </div>
      </Dialog>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}
