"use client";

import { format, subDays } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  Bot,
  Camera,
  Check,
  Droplets,
  Flame,
  Footprints,
  HeartPulse,
  Plus,
  Search,
  Scale,
  Utensils,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { loadLocalFoods, searchLocalFoods, type LocalFood } from "@/lib/local-food-data";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_CALORIE_TARGET,
  DEFAULT_CARBS_G,
  DEFAULT_FAT_G,
  DEFAULT_FIBER_G,
  DEFAULT_PROTEIN_G,
  NUTRIENT_IDS,
} from "@open-health/shared/constants";

const quickActions = [
  {
    href: "/hub/chat",
    title: "Ask AI",
    body: "Health answers",
    icon: Bot,
  },
  {
    href: "/hub/food/search",
    title: "Add meal",
    body: "Search food",
    icon: Plus,
  },
  {
    href: "/hub/water",
    title: "Log water",
    body: "250 ml",
    icon: Droplets,
  },
  {
    href: "/hub/progress",
    title: "Progress",
    body: "View trends",
    icon: Scale,
  },
];

function getFirstName(name?: string | null) {
  if (!name) return "Naresh";
  return name.trim().split(/\s+/)[0] || "Naresh";
}

function pct(current: number, target: number) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function mealLabel(mealType: string) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

const activityOptions = {
  walk: { label: "Walk", icon: Footprints, met: 3.5, query: "walking", intensity: "low" as const },
  run: { label: "Run", icon: Flame, met: 9.8, query: "running", intensity: "high" as const },
  cycle: { label: "Cycle", icon: Bike, met: 6.8, query: "cycling", intensity: "moderate" as const },
};

const micronutrientIds = [
  NUTRIENT_IDS.vitaminA,
  NUTRIENT_IDS.vitaminC,
  NUTRIENT_IDS.vitaminD,
  NUTRIENT_IDS.vitaminK,
  NUTRIENT_IDS.calcium,
  NUTRIENT_IDS.iron,
  NUTRIENT_IDS.magnesium,
  NUTRIENT_IDS.potassium,
  NUTRIENT_IDS.zinc,
];

type LocalLoggedFood = LocalFood & {
  loggedId: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  servingQty: number;
};

type FoodConfirmation = {
  source: "database" | "local";
  name: string;
  quantity: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  foodId?: string;
  localFood?: LocalFood;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

const micronutrientFallbackTargets: Record<number, number> = {
  [NUTRIENT_IDS.vitaminA]: 900,
  [NUTRIENT_IDS.vitaminC]: 90,
  [NUTRIENT_IDS.vitaminD]: 20,
  [NUTRIENT_IDS.vitaminE]: 15,
  [NUTRIENT_IDS.vitaminK]: 120,
  [NUTRIENT_IDS.calcium]: 1000,
  [NUTRIENT_IDS.iron]: 18,
  [NUTRIENT_IDS.magnesium]: 420,
  [NUTRIENT_IDS.potassium]: 3400,
  [NUTRIENT_IDS.sodium]: 2300,
  [NUTRIENT_IDS.zinc]: 11,
};

const micronutrientDisplay: Record<number, { name: string; unit: string }> = {
  [NUTRIENT_IDS.vitaminA]: { name: "Vitamin A", unit: "mcg" },
  [NUTRIENT_IDS.vitaminC]: { name: "Vitamin C", unit: "mg" },
  [NUTRIENT_IDS.vitaminD]: { name: "Vitamin D", unit: "mcg" },
  [NUTRIENT_IDS.vitaminE]: { name: "Vitamin E", unit: "mg" },
  [NUTRIENT_IDS.vitaminK]: { name: "Vitamin K", unit: "mcg" },
  [NUTRIENT_IDS.calcium]: { name: "Calcium", unit: "mg" },
  [NUTRIENT_IDS.iron]: { name: "Iron", unit: "mg" },
  [NUTRIENT_IDS.magnesium]: { name: "Magnesium", unit: "mg" },
  [NUTRIENT_IDS.potassium]: { name: "Potassium", unit: "mg" },
  [NUTRIENT_IDS.sodium]: { name: "Sodium", unit: "mg" },
  [NUTRIENT_IDS.zinc]: { name: "Zinc", unit: "mg" },
};

function estimateBurn(activity: keyof typeof activityOptions, minutes: number, weightKg: number) {
  const option = activityOptions[activity];
  if (!minutes || minutes <= 0) return { calories: 0, durationMin: 0 };
  const hours = minutes / 60;
  return {
    calories: Math.round(option.met * weightKg * hours),
    durationMin: Math.max(1, Math.round(minutes)),
  };
}

export default function HubPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const firstName = getFirstName(session?.user?.name);
  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const isAuthed = !!session?.user;
  const [foodQuery, setFoodQuery] = useState("");
  const [debouncedFoodQuery, setDebouncedFoodQuery] = useState("");
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");
  const [servingQty, setServingQty] = useState("1");
  const [activity, setActivity] = useState<keyof typeof activityOptions>("walk");
  const [activityMinutes, setActivityMinutes] = useState("20");
  const [statusMessage, setStatusMessage] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [localFoods, setLocalFoods] = useState<LocalFood[]>([]);
  const [localLoggedFoods, setLocalLoggedFoods] = useState<LocalLoggedFood[]>([]);
  const [foodConfirmation, setFoodConfirmation] = useState<FoodConfirmation | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [isPendingWeight, startWeightTransition] = useTransition();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedFoodQuery(foodQuery.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [foodQuery]);

  useEffect(() => {
    if (!hasHydrated) return;

    let cancelled = false;
    loadLocalFoods()
      .then((foods) => {
        if (!cancelled) setLocalFoods(foods);
      })
      .catch(() => {
        if (!cancelled) setStatusMessage("Food data could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [hasHydrated]);

  const { data: diaryData } = trpc.diary.getDay.useQuery({ date: today }, { enabled: isAuthed });
  const { data: weekSummary } = trpc.diary.getWeekSummary.useQuery({ startDate: weekStart, endDate: today }, { enabled: isAuthed });
  const { data: goals } = trpc.user.getGoals.useQuery(undefined, { enabled: isAuthed });
  const { data: waterData } = trpc.water.getToday.useQuery({ date: today }, { enabled: isAuthed });
  const { data: dateWeight } = trpc.progress.getDateWeight.useQuery({ date: today }, { enabled: isAuthed });
  const { data: dateSteps } = trpc.progress.getDateSteps.useQuery({ date: today }, { enabled: isAuthed });
  const { data: exerciseData } = trpc.exercise.getDay.useQuery({ date: today }, { enabled: isAuthed });
  const { data: micronutrients } = trpc.diary.getDayNutrients.useQuery(
    { date: today, nutrientIds: micronutrientIds },
    { enabled: isAuthed }
  );
  const { data: foodResults, isFetching: foodSearching } = trpc.food.search.useQuery(
    { query: debouncedFoodQuery, limit: 6, cursor: 0, offset: 0 },
    {
      enabled: hasHydrated && isAuthed && debouncedFoodQuery.length >= 2,
      staleTime: 60_000,
      retry: false,
    }
  );
  const localFoodResults = useMemo(
    () => searchLocalFoods(localFoods, foodQuery, 6),
    [foodQuery, localFoods]
  );
  const { data: cardioPresets } = trpc.exercise.getPresets.useQuery({ category: "cardio" }, { enabled: isAuthed });
  const logFood = trpc.diary.logFood.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.diary.getDay.invalidate({ date: today }),
        utils.diary.getDayNutrients.invalidate({ date: today, nutrientIds: micronutrientIds }),
        utils.diary.getWeekSummary.invalidate({ startDate: weekStart, endDate: today }),
      ]);
    },
  });
  const createFood = trpc.food.createCustomFood.useMutation();
  const logExercise = trpc.exercise.logExercise.useMutation({
    onSuccess: async () => {
      await utils.exercise.getDay.invalidate({ date: today });
    },
  });
  const logWeight = trpc.progress.logWeight.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.progress.getDateWeight.invalidate({ date: today }),
        utils.progress.getWeightHistory.invalidate(),
      ]);
    },
  });
  const createExercise = trpc.exercise.createCustomExercise.useMutation({
    onSuccess: async () => {
      await utils.exercise.getPresets.invalidate({ category: "cardio" });
    },
  });

  const savedTotals = diaryData?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const localTotals = localLoggedFoods.reduce(
    (sum, food) => ({
      calories: sum.calories + food.calories * food.servingQty,
      protein: sum.protein + food.protein * food.servingQty,
      carbs: sum.carbs + food.carbs * food.servingQty,
      fat: sum.fat + food.fat * food.servingQty,
      fiber: sum.fiber + food.fiber * food.servingQty,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
  const totals = {
    calories: Number(savedTotals.calories ?? 0) + localTotals.calories,
    protein: Number(savedTotals.protein ?? 0) + localTotals.protein,
    carbs: Number(savedTotals.carbs ?? 0) + localTotals.carbs,
    fat: Number(savedTotals.fat ?? 0) + localTotals.fat,
    fiber: Number(savedTotals.fiber ?? 0) + localTotals.fiber,
  };
  const calorieTarget = goals?.calorieTarget ? Number(goals.calorieTarget) : DEFAULT_CALORIE_TARGET;
  const proteinTarget = goals?.proteinG ? Number(goals.proteinG) : DEFAULT_PROTEIN_G;
  const carbsTarget = goals?.carbsG ? Number(goals.carbsG) : DEFAULT_CARBS_G;
  const fatTarget = goals?.fatG ? Number(goals.fatG) : DEFAULT_FAT_G;
  const waterTotal = waterData?.totalMl ?? 0;
  const waterGoal = waterData?.goalMl ?? 2000;
  const currentWeight = dateWeight ? Number(dateWeight.weightKg) : null;
  const weightForBurn = currentWeight ?? 70;
  const currentSteps = dateSteps ? Number(dateSteps.steps) : 0;
  const exerciseCalories = exerciseData?.totalCalories ?? 0;
  const netCalories = Math.max(0, Math.round(totals.calories - exerciseCalories));
  const calorieBalance = Math.round(netCalories - calorieTarget);
  const balanceLabel = calorieBalance > 0 ? "surplus" : "deficit";
  const balanceAbs = Math.abs(calorieBalance);
  const isWeightGainSignal = calorieBalance > 0;
  const WeightSignalIcon = isWeightGainSignal ? ArrowUpRight : ArrowDownRight;
  const weightSignalLabel = isWeightGainSignal ? "Likely gain" : "Likely decrease";
  const weightSignalTone = isWeightGainSignal ? "text-[#B76A16]" : "text-primary";
  const weekMeals = weekSummary?.reduce((sum, day) => sum + Number(day.entryCount ?? 0), 0) ?? 0;
  const burnPreview = useMemo(
    () => estimateBurn(activity, Number(activityMinutes), weightForBurn),
    [activity, activityMinutes, weightForBurn]
  );
  const progressItems = [
    { label: "Meal logging", value: `${Math.min(weekMeals, 21)} / 21`, width: `${pct(weekMeals, 21)}%` },
    { label: "Protein goal", value: `${Math.round(totals.protein)}g`, width: `${pct(totals.protein, proteinTarget)}%` },
    { label: "Water", value: `${(waterTotal / 1000).toFixed(1)}L`, width: `${pct(waterTotal, waterGoal)}%` },
  ];
  const localMicronutrients = localLoggedFoods.reduce<Record<number, number>>((sum, food) => {
    sum[NUTRIENT_IDS.vitaminA] = (sum[NUTRIENT_IDS.vitaminA] ?? 0) + food.vitaminA * food.servingQty;
    sum[NUTRIENT_IDS.vitaminC] = (sum[NUTRIENT_IDS.vitaminC] ?? 0) + food.vitaminC * food.servingQty;
    sum[NUTRIENT_IDS.vitaminD] = (sum[NUTRIENT_IDS.vitaminD] ?? 0) + food.vitaminD * food.servingQty;
    sum[NUTRIENT_IDS.vitaminK] = (sum[NUTRIENT_IDS.vitaminK] ?? 0) + food.vitaminK * food.servingQty;
    sum[NUTRIENT_IDS.calcium] = (sum[NUTRIENT_IDS.calcium] ?? 0) + food.calcium * food.servingQty;
    sum[NUTRIENT_IDS.iron] = (sum[NUTRIENT_IDS.iron] ?? 0) + food.iron * food.servingQty;
    sum[NUTRIENT_IDS.magnesium] = (sum[NUTRIENT_IDS.magnesium] ?? 0) + food.magnesium * food.servingQty;
    sum[NUTRIENT_IDS.potassium] = (sum[NUTRIENT_IDS.potassium] ?? 0) + food.potassium * food.servingQty;
    sum[NUTRIENT_IDS.zinc] = (sum[NUTRIENT_IDS.zinc] ?? 0) + food.zinc * food.servingQty;
    return sum;
  }, {});
  const micronutrientRows = micronutrientIds.map((nutrientId) => {
    const row = micronutrients?.find((item) => item.nutrientId === nutrientId);
    const target = row?.dailyValue ?? micronutrientFallbackTargets[nutrientId] ?? 0;
    const total = (row?.totalAmount ?? 0) + (localMicronutrients[nutrientId] ?? 0);
    return {
      nutrientId,
      name: row?.name ?? micronutrientDisplay[nutrientId]?.name ?? "Nutrient",
      unit: row?.unit ?? micronutrientDisplay[nutrientId]?.unit ?? "mg",
      total,
      target,
      width: `${pct(total, target)}%`,
    };
  });
  const micronutrientCoverage = Math.round(
    micronutrientRows.reduce((sum, row) => sum + pct(row.total, row.target), 0) / micronutrientRows.length
  );
  const nutritionStatus =
    totals.calories === 0
      ? "Start with your first meal."
      : totals.calories <= calorieTarget
        ? "You're on track."
        : "A little over today.";

  useEffect(() => {
    setWeightInput(currentWeight ? String(currentWeight) : "");
  }, [currentWeight, today]);

  const getSafeServingQty = () => {
    const qty = Number(servingQty);
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
  };

  const openDatabaseFoodConfirmation = (foodId: string, foodName: string, calories?: number) => {
    const safeQty = getSafeServingQty();
    setFoodConfirmation({
      source: "database",
      name: foodName,
      quantity: safeQty,
      mealType,
      foodId,
      calories: calories ? calories * safeQty : undefined,
    });
  };

  const openLocalFoodConfirmation = (food: LocalFood) => {
    const safeQty = getSafeServingQty();
    setFoodConfirmation({
      source: "local",
      name: food.name,
      quantity: safeQty,
      mealType,
      localFood: food,
      calories: food.calories * safeQty,
      protein: food.protein * safeQty,
      carbs: food.carbs * safeQty,
      fat: food.fat * safeQty,
    });
  };

  const confirmSelectedFood = async () => {
    if (!foodConfirmation) return;

    if (foodConfirmation.source === "database") {
      if (!isAuthed || !foodConfirmation.foodId) {
        setStatusMessage("Log in to add food.");
        return;
      }

      await logFood.mutateAsync({
        date: today,
        mealType: foodConfirmation.mealType,
        foodId: foodConfirmation.foodId,
        servingQty: foodConfirmation.quantity,
      });
      setStatusMessage(`${foodConfirmation.name} added.`);
      setFoodConfirmation(null);
      return;
    }

    const localFood = foodConfirmation.localFood;
    if (!localFood) return;

    if (!isAuthed) {
      setLocalLoggedFoods((current) => [
        {
          ...localFood,
          loggedId: `${localFood.id}-${Date.now()}`,
          mealType: foodConfirmation.mealType,
          servingQty: foodConfirmation.quantity,
        },
        ...current,
      ]);
      setStatusMessage(`${foodConfirmation.name} added locally. Log in to save it.`);
      setFoodConfirmation(null);
      return;
    }

    const nutrients = [
      [NUTRIENT_IDS.protein, localFood.protein],
      [NUTRIENT_IDS.totalFat, localFood.fat],
      [NUTRIENT_IDS.totalCarbs, localFood.carbs],
      [NUTRIENT_IDS.fiber, localFood.fiber],
      [NUTRIENT_IDS.sugar, localFood.sugar],
      [NUTRIENT_IDS.saturatedFat, localFood.saturatedFat],
      [NUTRIENT_IDS.sodium, localFood.sodium],
      [NUTRIENT_IDS.vitaminA, localFood.vitaminA],
      [NUTRIENT_IDS.vitaminB1, localFood.vitaminB1],
      [NUTRIENT_IDS.folate, localFood.vitaminB11],
      [NUTRIENT_IDS.vitaminB12, localFood.vitaminB12],
      [NUTRIENT_IDS.vitaminB2, localFood.vitaminB2],
      [NUTRIENT_IDS.vitaminB3, localFood.vitaminB3],
      [NUTRIENT_IDS.vitaminB5, localFood.vitaminB5],
      [NUTRIENT_IDS.vitaminB6, localFood.vitaminB6],
      [NUTRIENT_IDS.vitaminC, localFood.vitaminC],
      [NUTRIENT_IDS.vitaminD, localFood.vitaminD],
      [NUTRIENT_IDS.vitaminE, localFood.vitaminE],
      [NUTRIENT_IDS.vitaminK, localFood.vitaminK],
      [NUTRIENT_IDS.calcium, localFood.calcium],
      [NUTRIENT_IDS.copper, localFood.copper],
      [NUTRIENT_IDS.iron, localFood.iron],
      [NUTRIENT_IDS.magnesium, localFood.magnesium],
      [NUTRIENT_IDS.manganese, localFood.manganese],
      [NUTRIENT_IDS.phosphorus, localFood.phosphorus],
      [NUTRIENT_IDS.potassium, localFood.potassium],
      [NUTRIENT_IDS.selenium, localFood.selenium],
      [NUTRIENT_IDS.zinc, localFood.zinc],
    ]
      .filter(([, amount]) => Number(amount) > 0)
      .map(([nutrientId, amount]) => ({ nutrientId: Number(nutrientId), amount: Number(amount) }));

    const created = await createFood.mutateAsync({
      name: localFood.name,
      brand: localFood.category || undefined,
      description: `Imported from food data${localFood.basis ? ` (${localFood.basis})` : ""}`,
      servingSize: 1,
      servingUnit: "serving",
      householdServing: localFood.basis || "1 serving",
      calories: localFood.calories,
      nutrients,
    });

    await logFood.mutateAsync({
      date: today,
      mealType: foodConfirmation.mealType,
      foodId: created.foodId,
      servingQty: foodConfirmation.quantity,
    });

    setStatusMessage(`${foodConfirmation.name} saved to diary.`);
    setFoodConfirmation(null);
  };

  const handleLogActivity = async () => {
    if (!isAuthed) {
      setStatusMessage("Log in to log activity.");
      return;
    }
    const minutes = Number(activityMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setStatusMessage("Enter minutes first.");
      return;
    }

    const option = activityOptions[activity];
    const existing = cardioPresets?.find((preset) =>
      preset.name.toLowerCase().includes(option.query)
    );
    const exerciseId =
      existing?.id ??
      (await createExercise.mutateAsync({
        name: option.label,
        category: "cardio",
        metValue: option.met,
      })).id;

    await logExercise.mutateAsync({
      date: today,
      exerciseId,
      durationMin: burnPreview.durationMin,
      caloriesBurned: burnPreview.calories,
      intensity: option.intensity,
      note: `${Math.round(minutes)} min ${option.label.toLowerCase()}`,
    });
    setStatusMessage(`${option.label} logged. ${burnPreview.calories} kcal burned.`);
  };

  const handleLogWeight = () => {
    if (!isAuthed) {
      setStatusMessage("Log in to save weight.");
      return;
    }

    const numericWeight = Number(weightInput);
    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      setStatusMessage("Enter today's weight.");
      return;
    }

    startWeightTransition(async () => {
      await logWeight.mutateAsync({
        date: today,
        weightKg: numericWeight,
        note: `Net ${calorieBalance >= 0 ? "+" : ""}${calorieBalance} kcal`,
      });
      setStatusMessage("Weight saved.");
    });
  };

  return (
    <div className="bg-[#F6F8F7] px-4 py-6 sm:px-6 lg:py-10">
      <Dialog open={Boolean(foodConfirmation)} onOpenChange={(open) => !open && setFoodConfirmation(null)}>
        {foodConfirmation && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF8F3] text-primary ring-8 ring-[#F4FBF8] sm:h-16 sm:w-16">
              <Check className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
            </div>
            <DialogTitle className="mt-4 text-center text-lg sm:mt-5 sm:text-xl">Confirm food</DialogTitle>
            <DialogDescription className="mx-auto mt-2 max-w-[18rem] text-center text-sm leading-5">
              Add {foodConfirmation.name} to {mealLabel(foodConfirmation.mealType).toLowerCase()}?
            </DialogDescription>
            <div className="mt-4 rounded-2xl border border-[#DCE8E3] bg-[#F8FCFA] p-3 text-left sm:mt-5 sm:p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-muted-foreground">Quantity</span>
                <span className="text-sm font-semibold text-foreground">{foodConfirmation.quantity} serving{foodConfirmation.quantity === 1 ? "" : "s"}</span>
              </div>
              {foodConfirmation.calories != null && (
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Calories</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{Math.round(foodConfirmation.calories)} kcal</span>
                </div>
              )}
              {foodConfirmation.protein != null && foodConfirmation.carbs != null && foodConfirmation.fat != null && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4">
                  {[
                    ["Protein", foodConfirmation.protein],
                    ["Carbs", foodConfirmation.carbs],
                    ["Fat", foodConfirmation.fat],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white px-2 py-2 text-center sm:px-3">
                      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{Math.round(Number(value))}g</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5">
              <Button variant="outline" className="rounded-full" onClick={() => setFoodConfirmation(null)}>
                Cancel
              </Button>
              <Button className="rounded-full" onClick={confirmSelectedFood} disabled={logFood.isPending || createFood.isPending}>
                {logFood.isPending || createFood.isPending ? "Adding..." : "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <div className="mx-auto max-w-[1080px] space-y-7 sm:space-y-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Good morning, {firstName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Calories, macros, burn.</p>
          </div>
          <Link href="/today" className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            Details
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#DCE8E3] bg-[#133A31] p-5 text-white shadow-[0_16px_42px_rgba(19,58,49,0.16)] sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase text-white/60">Net calories</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-5xl font-semibold leading-none tracking-tight sm:text-6xl">{netCalories.toLocaleString()}</span>
                  <span className="pb-2 text-sm font-medium text-white/60">/ {calorieTarget.toLocaleString()}</span>
                </div>
                <p className={`mt-3 text-sm font-semibold ${calorieBalance > 0 ? "text-[#F5C76B]" : "text-[#8CE5C9]"}`}>
                  {balanceAbs.toLocaleString()} kcal {balanceLabel}
                </p>
                <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/12">
                  <WeightSignalIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{weightSignalLabel}</span>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/14">
                <div className="h-full rounded-full bg-[#7EE0C1]" style={{ width: `${pct(netCalories, calorieTarget)}%` }} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Food", `${Math.round(totals.calories)}`],
                  ["Burn", `-${Math.round(exerciseCalories)}`],
                  ["Steps", currentSteps.toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
                    <p className="text-xs font-medium text-white/58">{label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-white/12 pt-5">
                {[
                  ["Protein", `${Math.round(totals.protein)}g`, proteinTarget],
                  ["Carbs", `${Math.round(totals.carbs)}g`, carbsTarget],
                  ["Fat", `${Math.round(totals.fat)}g`, fatTarget],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-white/58">{label}</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/12">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-white/58">Weight check-in</p>
                    <p className="mt-1 truncate text-lg font-semibold text-white">
                      {currentWeight ? `${currentWeight} kg today` : "Add today's weight"}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ${calorieBalance > 0 ? "text-[#F5C76B]" : "text-[#8CE5C9]"}`}>
                    <WeightSignalIcon className="h-5 w-5" strokeWidth={2} />
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="relative min-w-0">
                    <Input
                      type="number"
                      min="1"
                      step="0.1"
                      value={weightInput}
                      onChange={(event) => setWeightInput(event.target.value)}
                      placeholder="Weight"
                      className="border-white/15 bg-white/12 pr-12 text-sm text-white placeholder:text-white/45"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/55">kg</span>
                  </div>
                  <Button
                    onClick={handleLogWeight}
                    disabled={!weightInput || isPendingWeight || logWeight.isPending}
                    className="rounded-full bg-white text-[#133A31] hover:bg-white/90"
                  >
                    {isPendingWeight || logWeight.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
                <Link href="/hub/progress" className="mt-3 inline-flex text-sm font-semibold text-[#8CE5C9]">
                  View weight graph
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#BFE3D6] bg-[#F0FBF7] p-4 text-foreground shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-primary shadow-[0_6px_14px_rgba(22,160,133,0.12)]">
                    <Utensils className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">Add food</h2>
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9 text-sm"
                      value={foodQuery}
                      onChange={(e) => setFoodQuery(e.target.value)}
                      placeholder="Dal, bhat, chiya..."
                    />
                  </div>
                  <Input
                    className="w-20 text-sm"
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={servingQty}
                    onChange={(e) => setServingQty(e.target.value)}
                    aria-label="Servings"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mealType === type ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground ring-1 ring-[#D7EAE3]"}`}
                    >
                      {mealLabel(type)}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {hasHydrated && foodSearching && <p className="text-sm text-muted-foreground">Searching...</p>}
                  {localFoodResults.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => openLocalFoodConfirmation(food)}
                      className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-xl border border-[#CFE5DC] bg-white px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-[#FAFFFD]"
                    >
                      <span className="min-w-0 overflow-hidden">
                        <span className="block truncate text-sm font-semibold text-foreground">{food.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">Food data • {Math.round(food.protein)}g protein</span>
                      </span>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">{Math.round(food.calories)} kcal</span>
                    </button>
                  ))}
                  {(foodResults ?? []).map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => openDatabaseFoodConfirmation(food.id, food.name, Number(food.calories || 0))}
                      disabled={logFood.isPending}
                      className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-xl border border-[#CFE5DC] bg-white px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-[#FAFFFD] disabled:opacity-60"
                    >
                      <span className="min-w-0 overflow-hidden">
                        <span className="block truncate text-sm font-semibold text-foreground">{food.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{food.householdServing ?? `${food.servingSize}${food.servingUnit}`}</span>
                      </span>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">{Math.round(Number(food.calories || 0))} kcal</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#F0D9B4] bg-[#FFF5E4] p-4 text-foreground shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#B76A16] shadow-[0_6px_14px_rgba(183,106,22,0.12)]">
                    <Flame className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">Burn calories</h2>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(Object.keys(activityOptions) as Array<keyof typeof activityOptions>).map((key) => {
                    const option = activityOptions[key];
                    const Icon = option.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActivity(key)}
                        className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-colors ${activity === key ? "bg-[#B76A16] text-white" : "bg-white text-muted-foreground ring-1 ring-[#F0D9B4]"}`}
                      >
                        <Icon className="h-4 w-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={activityMinutes}
                    onChange={(e) => setActivityMinutes(e.target.value)}
                    placeholder="Minutes"
                    className="text-sm"
                  />
                  <Button onClick={handleLogActivity} disabled={logExercise.isPending || createExercise.isPending}>
                    Log
                  </Button>
                </div>
                <div className="mt-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#F1DFBF]">
                  <p className="text-xs font-medium text-[#B76A16]">Estimated burn</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{burnPreview.calories} kcal</p>
                  <p className="mt-1 text-xs text-muted-foreground">{burnPreview.durationMin} min • {weightForBurn} kg basis</p>
                </div>
                <Link href="/hub/food/scan" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  <Camera className="h-4 w-4" />
                  Scan meal
                </Link>
              </div>
            </div>

            {(statusMessage || nutritionStatus) && (
              <p className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white">{statusMessage || nutritionStatus}</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[#DCE4F2] bg-[#F4F7FF] p-5 shadow-[0_4px_24px_rgba(44,68,112,0.045)] sm:p-6 dark:bg-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Vitamins & minerals</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Micronutrient coverage</h2>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-primary">{micronutrientCoverage}%</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {micronutrientRows.map((item) => (
              <div key={item.nutrientId} className="rounded-2xl border border-[#DDE6F5] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs font-medium tabular-nums text-muted-foreground">
                    {Math.round(item.total)}
                    {item.unit}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E6ECF7]">
                  <div className="h-full rounded-full bg-[#4568A8]" style={{ width: item.width }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.target ? `${pct(item.total, item.target)}% of target` : "Logged from foods"}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Updates from foods you log today. Values depend on available food nutrient data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Quick actions</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map(({ href, title, body, icon: Icon }, index) => (
              <Link
                key={title}
                href={href}
                className={`group rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 ${
                  index === 0
                    ? "border-[#D9E7E2] bg-[#EEF8F4]"
                    : index === 1
                      ? "border-[#E7E1D5] bg-[#FBF7EF]"
                      : index === 2
                        ? "border-[#D8E5EF] bg-[#F0F7FB]"
                        : "border-[#E2E1ED] bg-[#F6F4FB]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary shadow-[0_6px_16px_rgba(20,50,40,0.06)]">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl border border-[#DCE8E3] bg-white p-5 shadow-[0_4px_24px_rgba(20,50,40,0.035)] sm:p-7 dark:bg-card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">This week</h2>
              <Link href="/hub/progress" className="text-sm font-medium text-primary">Progress</Link>
            </div>
            <div className="mt-6 space-y-5">
              {progressItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">{item.label}</span>
                    <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E9F0ED]">
                    <div className="h-full rounded-full bg-primary" style={{ width: item.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#CFE7DE] bg-[#EAF8F3] p-5 sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary shadow-[0_6px_16px_rgba(20,50,40,0.06)]">
              <HeartPulse className="h-5 w-5" strokeWidth={2} />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase text-primary">One thing to try</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {totals.fiber < DEFAULT_FIBER_G ? "Add fiber today." : "Nice balance today."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {totals.fiber < DEFAULT_FIBER_G ? "Vegetables or dal help." : "Keep portions steady."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
