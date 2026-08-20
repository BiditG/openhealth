"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition, type ComponentType } from "react";
import { eachDayOfInterval, format, isToday, isValid, parseISO, subDays } from "date-fns";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, ChevronDown, Droplets, Footprints, Scale, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateNavigator } from "@/components/diary/date-navigator";
import { trpc } from "@/lib/trpc-client";
import { logWeight } from "@/server/actions/progress";
import {
  DEFAULT_CALORIE_TARGET,
  DEFAULT_CARBS_G,
  DEFAULT_FAT_G,
  DEFAULT_PROTEIN_G,
  DEFAULT_WATER_GOAL_ML,
  NUTRIENT_IDS,
} from "@open-health/shared/constants";

const NUTRIENT_PROGRESS_METRICS = [
  { key: "fiber", label: "Dietary Fiber", unit: "g", target: 28, color: "#5A8E62", nutrientId: NUTRIENT_IDS.fiber },
  { key: "cholesterol", label: "Cholesterol", unit: "mg", target: 300, color: "#B76A16", nutrientId: NUTRIENT_IDS.cholesterol },
  { key: "sodium", label: "Sodium", unit: "mg", target: 2300, color: "#3976B9", nutrientId: NUTRIENT_IDS.sodium },
  { key: "foodWater", label: "Water", unit: "g", target: null, color: "#2E9DC5", nutrientId: NUTRIENT_IDS.water },
  { key: "vitaminA", label: "Vitamin A", unit: "mcg", target: 900, color: "#6E65B8", nutrientId: NUTRIENT_IDS.vitaminA },
  { key: "vitaminB1", label: "Vitamin B1", unit: "mg", target: 1.2, color: "#5A8E62", nutrientId: NUTRIENT_IDS.vitaminB1 },
  { key: "vitaminB11", label: "Vitamin B11", unit: "mcg", target: 400, color: "#7B6BB7", nutrientId: NUTRIENT_IDS.folate },
  { key: "vitaminB12", label: "Vitamin B12", unit: "mcg", target: 2.4, color: "#6E65B8", nutrientId: NUTRIENT_IDS.vitaminB12 },
  { key: "vitaminB2", label: "Vitamin B2", unit: "mg", target: 1.3, color: "#3976B9", nutrientId: NUTRIENT_IDS.vitaminB2 },
  { key: "vitaminB3", label: "Vitamin B3", unit: "mg", target: 16, color: "#D99535", nutrientId: NUTRIENT_IDS.vitaminB3 },
  { key: "vitaminB5", label: "Vitamin B5", unit: "mg", target: 5, color: "#16A085", nutrientId: NUTRIENT_IDS.vitaminB5 },
  { key: "vitaminB6", label: "Vitamin B6", unit: "mg", target: 1.7, color: "#5A8E62", nutrientId: NUTRIENT_IDS.vitaminB6 },
  { key: "vitaminC", label: "Vitamin C", unit: "mg", target: 90, color: "#16A085", nutrientId: NUTRIENT_IDS.vitaminC },
  { key: "vitaminD", label: "Vitamin D", unit: "mcg", target: 20, color: "#6E65B8", nutrientId: NUTRIENT_IDS.vitaminD },
  { key: "vitaminE", label: "Vitamin E", unit: "mg", target: 15, color: "#D99535", nutrientId: NUTRIENT_IDS.vitaminE },
  { key: "vitaminK", label: "Vitamin K", unit: "mcg", target: 120, color: "#5A8E62", nutrientId: NUTRIENT_IDS.vitaminK },
  { key: "calcium", label: "Calcium", unit: "mg", target: 1300, color: "#3976B9", nutrientId: NUTRIENT_IDS.calcium },
  { key: "copper", label: "Copper", unit: "mg", target: 0.9, color: "#B76A16", nutrientId: NUTRIENT_IDS.copper },
  { key: "iron", label: "Iron", unit: "mg", target: 18, color: "#171A19", nutrientId: NUTRIENT_IDS.iron },
  { key: "magnesium", label: "Magnesium", unit: "mg", target: 420, color: "#16A085", nutrientId: NUTRIENT_IDS.magnesium },
  { key: "manganese", label: "Manganese", unit: "mg", target: 2.3, color: "#7B6BB7", nutrientId: NUTRIENT_IDS.manganese },
  { key: "phosphorus", label: "Phosphorus", unit: "mg", target: 1250, color: "#3976B9", nutrientId: NUTRIENT_IDS.phosphorus },
  { key: "potassium", label: "Potassium", unit: "mg", target: 4700, color: "#5A8E62", nutrientId: NUTRIENT_IDS.potassium },
  { key: "selenium", label: "Selenium", unit: "mcg", target: 55, color: "#6E65B8", nutrientId: NUTRIENT_IDS.selenium },
  { key: "zinc", label: "Zinc", unit: "mg", target: 11, color: "#171A19", nutrientId: NUTRIENT_IDS.zinc },
] as const;

type NutrientMetricKey = (typeof NUTRIENT_PROGRESS_METRICS)[number]["key"];
type MetricKey = "calories" | "carbs" | "protein" | "fat" | "weight" | "steps" | "water" | NutrientMetricKey;
type MetricPoint = { date: string; label: string } & Record<string, number | string | null>;
type MetricConfig = {
  key: MetricKey;
  label: string;
  unit: string;
  target?: number | null;
  color: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

function parseDateParam(param: string | null): Date {
  if (param) {
    const parsed = parseISO(param);
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function ProgressContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = parseDateParam(searchParams.get("date"));
  const dateStr = format(date, "yyyy-MM-dd");
  const startDate = format(subDays(date, 29), "yyyy-MM-dd");
  const dayLabel = isToday(date) ? "Today" : format(date, "MMM d");

  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("calories");
  const [weight, setWeight] = useState("");
  const [isPendingWeight, startWeightTransition] = useTransition();
  const utils = trpc.useUtils();
  const selectedNutrientMetric = NUTRIENT_PROGRESS_METRICS.find((metric) => metric.key === selectedMetric);

  const queryOptions = { staleTime: 60_000, retry: false };
  const { data: goals } = trpc.user.getGoals.useQuery(undefined, queryOptions);
  const { data: dateWeight } = trpc.progress.getDateWeight.useQuery({ date: dateStr }, queryOptions);
  const { data: weightHistory } = trpc.progress.getWeightHistory.useQuery({ limit: 30 }, queryOptions);
  const { data: analytics } = trpc.progress.getAnalytics.useQuery({ days: 30 }, queryOptions);
  const { data: nutritionSummary } = trpc.diary.getWeekSummary.useQuery({ startDate, endDate: dateStr }, queryOptions);
  const { data: nutrientSummary } = trpc.diary.getNutrientSummary.useQuery(
    {
      startDate,
      endDate: dateStr,
      nutrientIds: selectedNutrientMetric ? [selectedNutrientMetric.nutrientId] : [NUTRIENT_IDS.vitaminD],
    },
    { enabled: Boolean(selectedNutrientMetric), staleTime: 60_000, retry: false }
  );

  const currentWeight = dateWeight ? toNumber(dateWeight.weightKg) : null;
  const targetWeight = goals?.targetWeightKg ? toNumber(goals.targetWeightKg) : null;
  const recordedAt = dateWeight?.createdAt ? format(new Date(dateWeight.createdAt), "MMM d, h:mm a") : null;

  useEffect(() => {
    setWeight(currentWeight !== null ? String(currentWeight) : "");
  }, [currentWeight, dateStr]);

  const handleDateChange = useCallback(
    (newDate: Date) => {
      const newDateStr = format(newDate, "yyyy-MM-dd");
      const todayStr = format(new Date(), "yyyy-MM-dd");
      router.replace(newDateStr === todayStr ? "/hub/progress" : `/hub/progress?date=${newDateStr}`);
    },
    [router]
  );

  const dates = useMemo(
    () => eachDayOfInterval({ start: subDays(date, 29), end: date }).map((day) => format(day, "yyyy-MM-dd")),
    [date]
  );

  const nutritionByDate = useMemo(
    () => new Map((nutritionSummary ?? []).map((day) => [day.date, day])),
    [nutritionSummary]
  );

  const nutrientByDate = useMemo(() => {
    const map = new Map<string, Record<number, number>>();
    for (const item of nutrientSummary ?? []) {
      const row = map.get(item.date) ?? {};
      row[item.nutrientId] = item.totalAmount;
      map.set(item.date, row);
    }
    return map;
  }, [nutrientSummary]);

  const metricData = useMemo<MetricPoint[]>(() => {
    const weightMap = new Map((weightHistory ?? []).map((item) => [item.date, toNumber(item.weightKg)]));
    const stepsMap = new Map((analytics?.steps ?? []).map((item) => [item.date, toNumber(item.value)]));
    const waterMap = new Map((analytics?.water ?? []).map((item) => [item.date, toNumber(item.value)]));

    return dates.map((day) => {
      const nutrition = nutritionByDate.get(day);
      const nutrients = nutrientByDate.get(day);
      const nutrientValues = Object.fromEntries(
        NUTRIENT_PROGRESS_METRICS.map((metric) => [metric.key, nutrients?.[metric.nutrientId] ?? 0])
      );

      return {
        date: day,
        label: format(parseISO(day), "MMM d"),
        calories: toNumber(nutrition?.totalCalories),
        carbs: toNumber(nutrition?.totalCarbs),
        protein: toNumber(nutrition?.totalProtein),
        fat: toNumber(nutrition?.totalFat),
        weight: weightMap.get(day) ?? null,
        steps: stepsMap.get(day) ?? 0,
        water: waterMap.get(day) ?? 0,
        ...nutrientValues,
      };
    });
  }, [analytics?.steps, analytics?.water, dates, nutrientByDate, nutritionByDate, weightHistory]);

  const metricOptions = useMemo<MetricConfig[]>(
    () => [
      { key: "calories", label: "Calories", unit: "kcal", target: goals?.calorieTarget ? toNumber(goals.calorieTarget) : DEFAULT_CALORIE_TARGET, color: "#16A085", icon: Utensils },
      { key: "carbs", label: "Carbohydrates", unit: "g", target: goals?.carbsG ? toNumber(goals.carbsG) : DEFAULT_CARBS_G, color: "#3976B9", icon: BarChart3 },
      { key: "protein", label: "Protein", unit: "g", target: goals?.proteinG ? toNumber(goals.proteinG) : DEFAULT_PROTEIN_G, color: "#16A085", icon: BarChart3 },
      { key: "fat", label: "Fat", unit: "g", target: goals?.fatG ? toNumber(goals.fatG) : DEFAULT_FAT_G, color: "#D99535", icon: BarChart3 },
      ...NUTRIENT_PROGRESS_METRICS.map((metric) => ({ ...metric, icon: BarChart3 })),
      { key: "weight", label: "Weight", unit: "kg", target: targetWeight, color: "#171A19", icon: Scale },
      { key: "steps", label: "Steps", unit: "steps", target: 10000, color: "#3976B9", icon: Footprints },
      { key: "water", label: "Water intake", unit: "ml", target: toNumber(analytics?.waterGoalMl ?? DEFAULT_WATER_GOAL_ML), color: "#2E9DC5", icon: Droplets },
    ],
    [analytics?.waterGoalMl, goals?.calorieTarget, goals?.carbsG, goals?.fatG, goals?.proteinG, targetWeight]
  );
  const metricConfig = useMemo(() => new Map(metricOptions.map((metric) => [metric.key, metric])), [metricOptions]);
  const selected = metricConfig.get(selectedMetric) ?? metricOptions[0];
  const latestPoint = [...metricData].reverse().find((point) => point[selectedMetric] !== null);
  const latestValue = latestPoint ? toNumber(latestPoint[selectedMetric]) : 0;
  const averageValue = Math.round(metricData.reduce((sum, point) => sum + toNumber(point[selectedMetric]), 0) / Math.max(metricData.length, 1));
  const progressPct = selected.target ? Math.min(100, Math.round((latestValue / selected.target) * 100)) : null;

  const handleLogWeight = () => {
    const numericWeight = Number(weight);
    if (!Number.isFinite(numericWeight) || numericWeight <= 0) return;

    startWeightTransition(async () => {
      await logWeight({ date: dateStr, weightKg: numericWeight });
      await utils.progress.invalidate();
    });
  };

  return (
    <div className="bg-[#F6F8F7] px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-[1080px] space-y-7">
        <DateNavigator date={date} onDateChange={handleDateChange} />

        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Progress</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Health trends</h1>
            <p className="mt-2 text-sm text-muted-foreground">Calories, nutrients, weight, movement.</p>
          </div>
          <Link href="/hub/progress/analysis">
            <Button variant="outline" className="rounded-full">
              <BarChart3 className="h-4 w-4" />
              Analysis
            </Button>
          </Link>
        </section>

        <section className="rounded-3xl border border-[#DCE8E3] bg-white p-4 shadow-[0_4px_24px_rgba(20,50,40,0.04)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Metric</p>
              <p className="mt-1 text-sm text-muted-foreground">Choose one category to graph.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <select
                value={selectedMetric}
                onChange={(event) => setSelectedMetric(event.target.value as MetricKey)}
                className="h-11 w-full appearance-none rounded-full border border-[#DCE8E3] bg-[#F8FCFA] px-4 pr-10 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <optgroup label="Nutrition">
                  <option value="calories">Calories</option>
                  <option value="carbs">Carbohydrates</option>
                  <option value="protein">Protein</option>
                  <option value="fat">Fat</option>
                </optgroup>
                <optgroup label="Food data nutrients">
                  {NUTRIENT_PROGRESS_METRICS.map((metric) => (
                    <option key={metric.key} value={metric.key}>
                      {metric.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Body and activity">
                  <option value="weight">Weight</option>
                  <option value="steps">Steps</option>
                  <option value="water">Water intake</option>
                </optgroup>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="min-h-[280px] min-w-0">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selected.label}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {Math.round(latestValue).toLocaleString()} <span className="text-sm font-medium text-muted-foreground">{selected.unit}</span>
                </p>
              </div>
              <div className="h-[230px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#E6EEEA" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B7470" }} minTickGap={18} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B7470" }} />
                    <Tooltip
                      cursor={{ stroke: "#D9E7E2" }}
                      contentStyle={{ borderRadius: 14, border: "1px solid #DCE8E3", boxShadow: "0 12px 36px rgba(20,50,40,0.12)" }}
                      formatter={(value) => [`${Math.round(Number(value)).toLocaleString()} ${selected.unit}`, selected.label]}
                    />
                    <Line type="monotone" dataKey={selectedMetric} stroke={selected.color} strokeWidth={2.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-3">
              <MiniStat label="Latest" value={Math.round(latestValue).toLocaleString()} unit={selected.unit} />
              <MiniStat label="Daily average" value={averageValue.toLocaleString()} unit={selected.unit} />
              <MiniStat label="Target" value={selected.target ? Math.round(selected.target).toLocaleString() : "--"} unit={selected.unit} />
              {progressPct !== null && (
                <div className="rounded-2xl bg-[#F4F8F6] p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Coverage</span>
                    <span className="font-semibold text-foreground">{progressPct}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E0EAE5]">
                    <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: selected.color }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-[#DCE8E3] bg-[#F8FCFA] p-5 shadow-[0_4px_24px_rgba(20,50,40,0.04)] sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary">
                <Scale className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Enter weight</h2>
                <p className="text-xs text-muted-foreground">{dayLabel} • saved with date and time</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Input type="number" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Weight" className="pr-14" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
              </div>
              <Button onClick={handleLogWeight} disabled={!weight || isPendingWeight} className="rounded-full">
                {isPendingWeight ? "Saving..." : "Save"}
              </Button>
            </div>
            <div className="mt-5 rounded-2xl bg-white p-4">
              <p className="text-xs font-medium text-muted-foreground">Current reading</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{currentWeight ? `${currentWeight} kg` : "--"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{recordedAt ? `Saved ${recordedAt}` : "No saved time yet"}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#DCE8E3] bg-white p-5 shadow-[0_4px_24px_rgba(20,50,40,0.04)] sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">Quick status</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatusCard label="Calories" value={Math.round(toNumber(nutritionByDate.get(dateStr)?.totalCalories)).toLocaleString()} unit="kcal" />
              <StatusCard label="Carbs" value={Math.round(toNumber(nutritionByDate.get(dateStr)?.totalCarbs)).toLocaleString()} unit="g" />
              <StatusCard label="Vitamin D" value={Math.round(nutrientByDate.get(dateStr)?.[NUTRIENT_IDS.vitaminD] ?? 0).toLocaleString()} unit="mcg" />
            </div>
            <div className="mt-5 h-24 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricData.slice(-7)}>
                  <Area type="monotone" dataKey="calories" stroke="#16A085" fill="#DDF4EE" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-[#F4F8F6] p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
        {value} <span className="text-xs font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function StatusCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-[#F6F8F7] p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
        {value} <span className="text-xs font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<div className="px-4 py-6"><div className="h-64 animate-pulse rounded-3xl bg-muted" /></div>}>
      <ProgressContent />
    </Suspense>
  );
}
