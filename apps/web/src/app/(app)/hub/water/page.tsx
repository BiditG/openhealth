"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format, parseISO, isValid } from "date-fns";
import { toast } from "sonner";
import { Droplets, Pencil, Plus, Settings2, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateNavigator } from "@/components/diary/date-navigator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { trpc } from "@/lib/trpc-client";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

const DEFAULT_QUICK_AMOUNTS = [150, 250, 350, 500];

function parseDateParam(param: string | null): Date {
  if (param) {
    const parsed = parseISO(param);
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function isValidGoal(value: string) {
  const n = parseInt(value, 10);
  return !isNaN(n) && n >= 500 && n <= 10000;
}

function WaterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = parseDateParam(searchParams.get("date"));
  const dateStr = format(date, "yyyy-MM-dd");
  const { t } = useTranslation(["water", "common"]);

  const handleDateChange = useCallback(
    (newDate: Date) => {
      const newDateStr = format(newDate, "yyyy-MM-dd");
      const todayStr = format(new Date(), "yyyy-MM-dd");
      router.replace(newDateStr === todayStr ? "/hub/water" : `/hub/water?date=${newDateStr}`);
    },
    [router],
  );

  const utils = trpc.useUtils();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [containerDialogOpen, setContainerDialogOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<{
    id?: string;
    name: string;
    amountMl: string;
    sortOrder: number;
  } | null>(null);

  const { data: todayData, isLoading } = trpc.water.getToday.useQuery({ date: dateStr });
  const { data: logs } = trpc.water.getLogs.useQuery({ date: dateStr });
  const { data: containers } = trpc.water.getContainers.useQuery();

  const logWater = trpc.water.logWater.useMutation({
    onSuccess: (_data, variables) => {
      utils.water.getToday.invalidate({ date: dateStr });
      utils.water.getLogs.invalidate({ date: dateStr });
      posthog.capture("water_logged", { amount_ml: variables.amountMl });
    },
  });

  const undoLastLog = trpc.water.undoLastLog.useMutation({
    onSuccess: () => {
      utils.water.getToday.invalidate({ date: dateStr });
      utils.water.getLogs.invalidate({ date: dateStr });
    },
  });

  const setGoal = trpc.water.setGoal.useMutation({
    onSuccess: (_data, variables) => {
      utils.water.getToday.invalidate({ date: dateStr });
      utils.water.getGoal.invalidate();
      posthog.capture("water_goal_set", { goal_ml: variables.dailyTargetMl });
      setGoalDialogOpen(false);
    },
  });

  const upsertContainer = trpc.water.upsertContainer.useMutation({
    onSuccess: () => {
      utils.water.getContainers.invalidate();
      setEditingContainer(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteContainer = trpc.water.deleteContainer.useMutation({
    onSuccess: () => utils.water.getContainers.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const totalMl = todayData?.totalMl ?? 0;
  const goalMl = todayData?.goalMl ?? 2500;
  const percentage = Math.min((totalMl / goalMl) * 100, 100);
  const hasCustomContainers = containers && containers.length > 0;
  const quickButtons = hasCustomContainers
    ? containers.map((c) => ({ id: c.id, label: c.name, amountMl: c.amountMl }))
    : DEFAULT_QUICK_AMOUNTS.map((ml) => ({ id: String(ml), label: `${ml} ml`, amountMl: ml }));

  const handleOpenGoalDialog = () => {
    setGoalInput(String(goalMl));
    setGoalDialogOpen(true);
  };

  const handleSaveGoal = () => {
    if (!isValidGoal(goalInput)) return;
    setGoal.mutate({ dailyTargetMl: parseInt(goalInput, 10) });
  };

  const handleEditContainer = (container: { id: string; name: string; amountMl: number; sortOrder: number }) => {
    setEditingContainer({
      id: container.id,
      name: container.name,
      amountMl: String(container.amountMl),
      sortOrder: container.sortOrder,
    });
  };

  const handleAddNew = () => {
    const maxSort = containers?.reduce((max, c) => Math.max(max, c.sortOrder), -1) ?? -1;
    setEditingContainer({ name: "", amountMl: "", sortOrder: maxSort + 1 });
  };

  const handleSaveContainer = () => {
    if (!editingContainer) return;
    const amountMl = parseInt(editingContainer.amountMl, 10);
    if (!editingContainer.name.trim() || isNaN(amountMl) || amountMl < 1 || amountMl > 5000) return;

    upsertContainer.mutate({
      id: editingContainer.id,
      name: editingContainer.name.trim(),
      amountMl,
      sortOrder: editingContainer.sortOrder,
    });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-[760px] space-y-6 px-4 py-6">
      <DateNavigator date={date} onDateChange={handleDateChange} />

      <section className="rounded-3xl border border-border bg-white p-6 text-center shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <p className="text-sm font-semibold text-primary">Hydration</p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Water today</h1>

        <div className="mx-auto mt-6 max-w-sm">
          <div className="flex items-end justify-center gap-2">
            <span className="text-6xl font-semibold leading-none text-foreground tabular-nums">{totalMl.toLocaleString()}</span>
            <button onClick={handleOpenGoalDialog} className="pb-1 text-base font-medium text-muted-foreground">
              / {goalMl.toLocaleString()} ml
            </button>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percentage}%` }} />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {percentage >= 100 ? t("water:goalReached") : t("water:needMore", { amount: goalMl - totalMl })}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{t("water:quickAdd")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tap once when you drink water.</p>
          </div>
          <button
            onClick={() => {
              setEditingContainer(null);
              setContainerDialogOpen(true);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
            title={t("water:manageContainers")}
          >
            <Settings2 className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => logWater.mutate({ date: dateStr, amountMl: btn.amountMl })}
              disabled={logWater.isPending}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background p-3 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <Droplets className="h-5 w-5 text-primary" strokeWidth={1.8} />
              <span className="max-w-full truncate">{btn.label}</span>
              {hasCustomContainers && <span className="text-xs font-medium text-muted-foreground">{btn.amountMl} ml</span>}
            </button>
          ))}
        </div>
        <button
          onClick={() => undoLastLog.mutate({ date: dateStr })}
          disabled={undoLastLog.isPending || totalMl === 0}
          className="mx-auto mt-4 flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" strokeWidth={1.8} />
          {t("water:undoLast")}
        </button>
      </section>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <h2 className="text-xl font-semibold text-foreground">{t("water:todayLog")}</h2>
        {logs && logs.length > 0 ? (
          <div className="mt-4 space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-xl px-2 py-3 hover:bg-secondary/60">
                <span className="text-sm text-muted-foreground tabular-nums">{formatTime(log.loggedAt)}</span>
                <span className="text-sm font-semibold text-foreground">{log.amountMl} ml</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-6 text-center">
            <Droplets className="mx-auto h-8 w-8 text-primary" strokeWidth={1.8} />
            <p className="mt-3 text-sm font-medium text-muted-foreground">{t("water:noTodayLog")}</p>
          </div>
        )}
      </section>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogHeader>
          <DialogTitle>{t("water:setDailyGoal")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">{t("water:dailyWaterGoal")}</label>
            <Input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} min={500} max={10000} step={100} />
            {goalInput && !isValidGoal(goalInput) ? (
              <p className="text-xs text-destructive">{t("water:goalValidation")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("water:goalHint")}</p>
            )}
          </div>
          <Button onClick={handleSaveGoal} disabled={setGoal.isPending || !isValidGoal(goalInput)} className="w-full">
            {setGoal.isPending ? t("common:buttons.saving") : t("common:buttons.save")}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={containerDialogOpen}
        onOpenChange={(open) => {
          setContainerDialogOpen(open);
          if (!open) setEditingContainer(null);
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("water:manageCustomContainers")}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {containers && containers.length > 0 && !editingContainer && (
            <div className="space-y-2">
              {containers.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-border bg-background p-3">
                  <div>
                    <span className="text-sm font-semibold text-foreground">{c.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{c.amountMl} ml</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditContainer(c)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary">
                      <Pencil className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => deleteContainer.mutate({ id: c.id })}
                      disabled={deleteContainer.isPending}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editingContainer ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-foreground">
                  {editingContainer.id ? t("water:editContainer") : t("water:addContainer")}
                </p>
                <button onClick={() => setEditingContainer(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{t("water:containerName")}</label>
                <Input
                  value={editingContainer.name}
                  onChange={(e) => setEditingContainer({ ...editingContainer, name: e.target.value })}
                  placeholder={t("water:containerNamePlaceholder")}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{t("water:containerVolume")}</label>
                <Input
                  type="number"
                  value={editingContainer.amountMl}
                  onChange={(e) => setEditingContainer({ ...editingContainer, amountMl: e.target.value })}
                  min={1}
                  max={5000}
                  placeholder={t("water:containerVolumePlaceholder")}
                />
              </div>
              <Button onClick={handleSaveContainer} disabled={upsertContainer.isPending || !editingContainer.name.trim() || !editingContainer.amountMl} className="w-full">
                {upsertContainer.isPending ? t("common:buttons.saving") : t("common:buttons.save")}
              </Button>
            </div>
          ) : (
            (containers?.length ?? 0) < 4 && (
              <button
                onClick={handleAddNew}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary hover:text-primary"
              >
                <Plus className="h-4 w-4" strokeWidth={1.8} />
                {t("water:addContainer")}
              </button>
            )
          )}

          {!editingContainer && <p className="text-center text-xs text-muted-foreground">{t("water:maxContainerHint")}</p>}
        </div>
      </Dialog>
    </div>
  );
}

export default function WaterPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[760px] space-y-4 px-4 py-6">
          <div className="h-12 animate-pulse rounded-2xl bg-muted" />
          <div className="h-72 animate-pulse rounded-3xl bg-muted" />
          <div className="h-48 animate-pulse rounded-3xl bg-muted" />
        </div>
      }
    >
      <WaterContent />
    </Suspense>
  );
}
