"use client";

import { useEffect, useState, useTransition, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Droplets, Loader2, Salad, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";
import { updateGoals } from "@/server/actions/goals";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

export default function GoalsPage() {
  const { t } = useTranslation(["settings", "common"]);
  const { data: goals, isLoading: goalsLoading } = trpc.user.getGoals.useQuery();
  const { data: waterGoal } = trpc.water.getGoal.useQuery();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setWaterGoal = trpc.water.setGoal.useMutation({
    onSuccess: () => toast.success(t("settings:goalsPage.goalsSaved")),
  });

  const [calorieTarget, setCalorieTarget] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [fiberG, setFiberG] = useState("");
  const [waterTargetMl, setWaterTargetMl] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && goals !== undefined) {
      if (goals) {
        setCalorieTarget(goals.calorieTarget ? String(goals.calorieTarget) : "");
        setProteinG(goals.proteinG ? String(goals.proteinG) : "");
        setCarbsG(goals.carbsG ? String(goals.carbsG) : "");
        setFatG(goals.fatG ? String(goals.fatG) : "");
        setFiberG(goals.fiberG ? String(goals.fiberG) : "");
      }
      setInitialized(true);
    }
  }, [goals, initialized]);

  useEffect(() => {
    if (waterGoal?.dailyTargetMl) setWaterTargetMl(String(waterGoal.dailyTargetMl));
  }, [waterGoal]);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateGoals({
        calorieTarget: calorieTarget ? Number(calorieTarget) : null,
        proteinG: proteinG ? Number(proteinG) : null,
        carbsG: carbsG ? Number(carbsG) : null,
        fatG: fatG ? Number(fatG) : null,
        fiberG: fiberG ? Number(fiberG) : null,
      });
      if (!result.success) {
        toast.error(result.error || t("settings:goalsPage.goalsSaveFailed"));
        return;
      }
      if (waterTargetMl) {
        const wml = parseInt(waterTargetMl, 10);
        if (!isNaN(wml) && wml >= 500 && wml <= 10000) setWaterGoal.mutate({ dailyTargetMl: wml });
      }
      posthog.capture("goals_updated", { calorie_target: calorieTarget ? Number(calorieTarget) : null });
      toast.success(t("settings:goalsPage.goalsSaved"));
      router.refresh();
    });
  };

  if (goalsLoading) return <LoadingSpinner />;

  const macroTotal =
    calorieTarget && proteinG && carbsG && fatG
      ? Math.round(Number(proteinG) * 4 + Number(carbsG) * 4 + Number(fatG) * 9)
      : null;

  return (
    <div className="mx-auto max-w-[640px] space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <p className="text-sm font-semibold text-primary">Health targets</p>
          <h1 className="text-3xl font-semibold text-foreground">{t("settings:goals")}</h1>
        </div>
      </div>

      <GoalSection icon={Target} title={t("settings:goalsPage.calorieGoal")} description="Set the energy target you want to plan around.">
        <Field label={t("settings:goalsPage.targetCalories")}>
          <Input type="number" placeholder="2000" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} />
        </Field>
      </GoalSection>

      <GoalSection icon={Salad} title={t("settings:goalsPage.macroGoals")} description="Use simple macro goals to guide meal balance.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MacroField label={t("common:macro.protein")} value={proteinG} onChange={setProteinG} tone="green" placeholder="150" />
          <MacroField label={t("common:macro.carbs")} value={carbsG} onChange={setCarbsG} tone="amber" placeholder="250" />
          <MacroField label={t("common:macro.fat")} value={fatG} onChange={setFatG} tone="blue" placeholder="67" />
          <MacroField label={t("common:macro.fiber")} value={fiberG} onChange={setFiberG} tone="green" placeholder="28" />
        </div>
        {macroTotal !== null && (
          <p className="rounded-xl bg-background px-4 py-3 text-sm text-muted-foreground">
            {t("settings:goalsPage.macroTotalCalc", { total: macroTotal, target: calorieTarget })}
          </p>
        )}
      </GoalSection>

      <GoalSection icon={Droplets} title={t("settings:goalsPage.waterGoal")} description={t("settings:goalsPage.waterHint")}>
        <Field label={t("settings:goalsPage.waterAmount")}>
          <Input
            type="number"
            placeholder="2000"
            value={waterTargetMl}
            onChange={(e) => setWaterTargetMl(e.target.value)}
            min={500}
            max={10000}
            step={100}
          />
        </Field>
      </GoalSection>

      <Button className="w-full" onClick={handleSave} disabled={isPending}>
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common:buttons.saving")}
          </span>
        ) : (
          t("settings:goalsPage.saveGoals")
        )}
      </Button>
    </div>
  );
}

function GoalSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}

function MacroField({
  label,
  value,
  onChange,
  tone,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tone: "green" | "amber" | "blue";
  placeholder: string;
}) {
  const toneClass = tone === "green" ? "text-primary" : tone === "amber" ? "text-[#d99535]" : "text-[#3976b9]";
  return (
    <Field label={label}>
      <Input type="number" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <p className={`text-xs font-semibold ${toneClass}`}>grams</p>
    </Field>
  );
}
