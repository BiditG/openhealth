"use client";

import { useTranslation } from "react-i18next";
import { MicroNutrientSection } from "./micro-nutrient-section";

interface DailySummaryProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  fiberTarget: number;
  exerciseCalories?: number;
  date?: string;
  trackedNutrientIds?: number[];
}

export function DailySummary({
  calories,
  protein,
  carbs,
  fat,
  fiber,
  calorieTarget,
  proteinTarget,
  carbsTarget,
  fatTarget,
  fiberTarget,
  exerciseCalories = 0,
  date,
  trackedNutrientIds = [],
}: DailySummaryProps) {
  const { t } = useTranslation("common");
  const remaining = calorieTarget - calories + exerciseCalories;
  const caloriePercent = calorieTarget > 0 ? Math.min((calories / calorieTarget) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("labels.consumed")}</p>
            <p className="mt-1 text-5xl font-bold tracking-tight text-foreground tabular-nums">{Math.round(calories)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-muted-foreground">{t("labels.remaining")}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${remaining >= 0 ? "text-primary" : "text-destructive"}`}>
              {Math.round(remaining)}
            </p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E9F0ED]">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${caloriePercent}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(calories)} kcal</span>
          <span>{calorieTarget} kcal {t("labels.target").toLowerCase()}</span>
        </div>
      </div>

      {exerciseCalories > 0 && (
        <div className="rounded-xl bg-[#f8ead7] px-4 py-2 text-sm font-medium text-[#9a6625]">
          +{Math.round(exerciseCalories)} {t("labels.exerciseBurned")}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 rounded-2xl bg-muted p-4">
        <MacroItem label={t("macro.protein")} current={protein} target={proteinTarget} />
        <MacroItem label={t("macro.carbs")} current={carbs} target={carbsTarget} />
        <MacroItem label={t("macro.fat")} current={fat} target={fatTarget} />
        <MacroItem label={t("macro.fiber")} current={fiber} target={fiberTarget} />
      </div>

      {date && <MicroNutrientSection date={date} trackedNutrientIds={trackedNutrientIds} />}
    </div>
  );
}

function MacroItem({ label, current, target }: { label: string; current: number; target: number }) {
  return (
    <div className="text-center">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground tabular-nums">
        {current.toFixed(0)}
        <span className="text-sm font-medium text-muted-foreground">/{target}g</span>
      </p>
    </div>
  );
}
