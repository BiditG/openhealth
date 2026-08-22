"use client";

import { format, subDays } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bike,
  Bell,
  Check,
  Flame,
  Footprints,
  ListChecks,
  Medal,
  Route,
  Search,
  Scale,
  Sparkles,
  Trophy,
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

function getFirstName(name?: string | null) {
  if (!name) return "Naresh";
  return name.trim().split(/\s+/)[0] || "Naresh";
}

function pct(current: number, target: number) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function formatKg(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

function macroStatus(current: number, target: number) {
  const percent = target > 0 ? current / target : 0;
  if (percent < 0.55) return "Low";
  if (percent <= 1.1) return "Good";
  return "High";
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

type CoachGoalSuggestion = {
  source: "ollama" | "formula";
  suggestion: {
    calorieTarget: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    reason: string;
    cautions: string[];
  };
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
  const [activeQuickLog, setActiveQuickLog] = useState<"food" | "burn" | null>(null);
  const [isWeightEditing, setIsWeightEditing] = useState(false);
  const [coachGoals, setCoachGoals] = useState<CoachGoalSuggestion | null>(null);
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
  const { data: goals } = trpc.user.getGoals.useQuery(undefined, { enabled: isAuthed });
  const { data: profile } = trpc.user.getProfile.useQuery(undefined, { enabled: isAuthed });
  const { data: dateWeight } = trpc.progress.getDateWeight.useQuery({ date: today }, { enabled: isAuthed });
  const { data: weightHistory } = trpc.progress.getWeightHistory.useQuery({ limit: 7 }, { enabled: isAuthed });
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
  const getCoachGoalSuggestion = trpc.user.getCoachGoalSuggestion.useMutation({
    onSuccess: (data) => {
      setCoachGoals({
        source: data.source,
        suggestion: data.suggestion,
      });
      setStatusMessage("Coach suggestion ready. Review it before applying.");
    },
    onError: (error) => {
      setStatusMessage(error.message || "Coach suggestion could not be generated.");
    },
  });
  const updateGoals = trpc.user.updateGoals.useMutation({
    onSuccess: async () => {
      await utils.user.getGoals.invalidate();
      setCoachGoals(null);
      setStatusMessage("Coach goals saved. Hub targets updated.");
    },
    onError: (error) => {
      setStatusMessage(error.message || "Could not save coach goals.");
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
  const fiberTarget = goals?.fiberG ? Number(goals.fiberG) : DEFAULT_FIBER_G;
  const currentWeight = dateWeight ? Number(dateWeight.weightKg) : profile?.currentWeightKg ? Number(profile.currentWeightKg) : null;
  const displayWeight = currentWeight ?? 63;
  const targetWeight = goals?.targetWeightKg
    ? Number(goals.targetWeightKg)
    : !currentWeight || profile?.primaryGoal === "weight_reduction"
      ? displayWeight - 5
      : null;
  const firstTrackedWeight = weightHistory?.length ? Number(weightHistory[0].weightKg) : null;
  const latestTrackedWeight = weightHistory?.length ? Number(weightHistory[weightHistory.length - 1].weightKg) : currentWeight;
  const journeyStartWeight = firstTrackedWeight ?? displayWeight;
  const journeyTotal = targetWeight == null ? 0 : Math.abs(journeyStartWeight - targetWeight);
  const journeyCompleted = targetWeight == null ? 0 : Math.abs(journeyStartWeight - displayWeight);
  const journeyPercent = journeyTotal > 0 ? Math.max(8, Math.min(92, Math.round((journeyCompleted / journeyTotal) * 100))) : 0;
  const weeklyWeightDelta =
    latestTrackedWeight != null && firstTrackedWeight != null
      ? Number((latestTrackedWeight - firstTrackedWeight).toFixed(1))
      : null;
  const weightForBurn = currentWeight ?? 70;
  const exerciseCalories = exerciseData?.totalCalories ?? 0;
  const netCalories = Math.max(0, Math.round(totals.calories - exerciseCalories));
  const calorieBalance = Math.round(netCalories - calorieTarget);
  const balanceAbs = Math.abs(calorieBalance);
  const remainingCalories = Math.max(0, calorieTarget - netCalories);
  const burnPreview = useMemo(
    () => estimateBurn(activity, Number(activityMinutes), weightForBurn),
    [activity, activityMinutes, weightForBurn]
  );
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
      ? "Start with your first meal today"
      : totals.calories <= calorieTarget
        ? "You're on track today"
        : "A little over today";
  const todayStatus =
    totals.calories === 0
      ? "You have room for your first meal."
      : calorieBalance > 0
        ? "Eat a little lighter today."
        : remainingCalories <= 650
          ? "You have room for one more meal."
          : "On track today";
  const weightProgressText =
    targetWeight == null
      ? "Set a target weight to track progress"
      : goals?.goalType === "gain" || targetWeight > displayWeight
        ? targetWeight - displayWeight <= 0
          ? "You are at your goal"
          : `${formatKg(targetWeight - displayWeight)} kg to gain`
        : displayWeight - targetWeight <= 0
          ? "You are at your goal"
          : `${formatKg(displayWeight - targetWeight)} kg to go`;
  const foodMessage =
    remainingCalories > 0
      ? `You can still eat about ${remainingCalories.toLocaleString()} kcal today`
      : `${balanceAbs.toLocaleString()} kcal over your daily guide`;
  const foodGuidePercent = pct(totals.calories, calorieTarget);
  const TodayIcon = totals.calories === 0 ? Utensils : calorieBalance > 0 ? Flame : Check;
  const todayStatusTone =
    calorieBalance > 0
      ? "border-[#F2D0A0] bg-[#FFF8EB] text-[#9A5A00]"
      : remainingCalories <= 650 && totals.calories > 0
        ? "border-[#F2D0A0] bg-[#FFF8EB] text-[#9A5A00]"
        : "border-[#E3EAE7] bg-[#EAF8F4] text-[#15483F]";
  const foodDetailText =
    totals.calories === 0
      ? "You haven't logged food yet."
      : `${Math.round(totals.calories).toLocaleString()} of ${calorieTarget.toLocaleString()} kcal used today`;
  const weeklyProgressText =
    weeklyWeightDelta == null || weeklyWeightDelta === 0
      ? null
      : weeklyWeightDelta < 0
        ? `${Math.abs(weeklyWeightDelta)} kg progress this week`
        : `${weeklyWeightDelta} kg change this week`;
  const macroRows = [
    ["Protein", totals.protein, proteinTarget],
    ["Carbs", totals.carbs, carbsTarget],
    ["Fat", totals.fat, fatTarget],
  ] as const;

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
    if (!existing?.id) {
      setStatusMessage(`${option.label} preset is not available yet.`);
      return;
    }

    try {
      await logExercise.mutateAsync({
        date: today,
        exerciseId: existing.id,
        durationMin: burnPreview.durationMin,
        caloriesBurned: burnPreview.calories,
        intensity: option.intensity,
        note: `${Math.round(minutes)} min ${option.label.toLowerCase()}`,
      });
      setStatusMessage(`${option.label} logged. ${burnPreview.calories} kcal burned.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not log activity.");
    }
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
      setIsWeightEditing(false);
    });
  };

  const handleApplyCoachGoals = async () => {
    if (!coachGoals) return;
    const suggestion = coachGoals.suggestion;
    await updateGoals.mutateAsync({
      calorieTarget: Math.round(suggestion.calorieTarget),
      proteinG: Math.round(suggestion.proteinG),
      carbsG: Math.round(suggestion.carbsG),
      fatG: Math.round(suggestion.fatG),
      fiberG: Math.round(suggestion.fiberG),
    });
  };

  return (
    <div className="min-h-screen bg-[#F7FAF9]">
      <Dialog open={Boolean(foodConfirmation)} onOpenChange={(open) => !open && setFoodConfirmation(null)}>
        {foodConfirmation && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF8F4] text-primary ring-8 ring-[#F7FAF9] sm:h-16 sm:w-16">
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
      <div className="mx-auto max-w-[1180px] px-[18px] pb-[110px] pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <section className="mb-5 mt-6 lg:mb-7 lg:flex lg:items-end lg:justify-between lg:gap-6">
          <h1 className="text-[24px] font-bold leading-[1.2] text-[#17201E] sm:text-[30px] lg:text-[34px]">
            Good morning, {firstName} 👋
          </h1>
          <p className="mt-1.5 text-sm font-normal text-[#6B7773] lg:max-w-[360px] lg:text-right">
            Here&apos;s your health summary today.
          </p>
        </section>

        <div className="lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-start lg:gap-5 xl:gap-6">
          <div className="min-w-0">
        <section className="overflow-hidden rounded-[24px] bg-[#15483F] p-[22px] text-white lg:min-h-[286px] lg:p-7">
          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-white/65">Your weight goal</p>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-bold text-[#EAF8F4]">
                <Scale className="h-4 w-4" />
                {weightProgressText}
              </span>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-white/60">Current</p>
                  <p className="text-3xl font-bold leading-none tabular-nums">{formatKg(displayWeight)} kg</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-white/60">Goal</p>
                  <p className="text-3xl font-bold leading-none tabular-nums">
                    {targetWeight ? `${formatKg(targetWeight)} kg` : "Set goal"}
                  </p>
                </div>
              </div>
              <div className="relative h-14">
                <div className="absolute left-0 right-0 top-6 h-2 rounded-full bg-white/14" />
                <div
                  className="animate-weight-journey-fill absolute left-0 top-6 h-2 origin-left rounded-full bg-[#20C7A4]"
                  style={{ width: `${targetWeight ? journeyPercent : 0}%` }}
                />
                <div
                  className="animate-journey-marker absolute top-1 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${targetWeight ? journeyPercent : 0}%` }}
                >
                  <span className="animate-sparkle-once absolute -right-2 -top-1 h-2 w-2 rounded-full bg-[#F8D77C]" />
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white text-[#15483F] shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                    <Scale className="h-5 w-5" />
                  </span>
                </div>
              </div>
              {weeklyProgressText && (
                <p className="animate-status-pop mt-1 inline-flex min-h-8 items-center rounded-full bg-white/10 px-3 text-xs font-bold text-[#F8D77C]">
                  {weeklyProgressText}
                </p>
              )}
            </div>
          </div>

          <div className={`animate-status-pop mt-5 flex items-center gap-3 rounded-[16px] border px-4 py-3 ${todayStatusTone}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70">
              <TodayIcon className="h-5 w-5 animate-status-icon-once" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.04em] opacity-70">Today</p>
              <p className="text-base font-bold leading-5">{todayStatus}</p>
              <p className="mt-1 text-xs font-medium opacity-80">{foodDetailText}</p>
            </div>
          </div>

          <div className="mt-5 border-t border-white/12 pt-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-white/60">Daily food guide</p>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {Math.round(totals.calories).toLocaleString()} / {calorieTarget.toLocaleString()} kcal
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-white/60">Still available</p>
                <p className="text-lg font-bold tabular-nums">{remainingCalories.toLocaleString()} kcal</p>
              </div>
            </div>
            <div className="relative h-4 overflow-hidden rounded-full bg-white/14">
              <div
                className="animate-food-guide-fill h-full origin-left rounded-full bg-[#20C7A4]"
                style={{ width: `${foodGuidePercent}%` }}
              />
              <span
                className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-white text-[#15483F] shadow-sm"
                style={{ left: `${Math.max(4, Math.min(96, foodGuidePercent))}%` }}
              >
                <Utensils className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#EAF8F4]">{foodMessage}</p>
            <Link href="/hub/diary" className="mt-3 inline-flex min-h-9 items-center text-sm font-semibold text-white/80 underline-offset-4 hover:underline">
              View details -&gt;
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-[20px] border border-[#E3EAE7] bg-white p-[18px] shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#EAF8F4] text-[#123F37]">
              <Medal className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[16px] font-bold text-[#17201E]">Guidance, tasks, and ranks</p>
              <p className="mt-1 text-sm leading-5 text-[#6B7773]">Choose what you want to do next.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Link href="/hub/notifications" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#EAF8F4] px-3 text-sm font-semibold text-[#123F37] transition hover:bg-[#DDF3ED]">
              <Bell className="h-4 w-4" />
              Notifications
            </Link>
            <Link href="/hub/daily-tasks" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#EAF8F4] px-3 text-sm font-semibold text-[#123F37] transition hover:bg-[#DDF3ED]">
              <ListChecks className="h-4 w-4" />
              Tasks
            </Link>
            <Link href="/hub/tasks" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#EAF8F4] px-3 text-sm font-semibold text-[#123F37] transition hover:bg-[#DDF3ED]">
              <Trophy className="h-4 w-4" />
              Leaderboard
            </Link>
            <Link href="/hub/track" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#EAF8F4] px-3 text-sm font-semibold text-[#123F37] transition hover:bg-[#DDF3ED]">
              <Route className="h-4 w-4" />
              Track
            </Link>
          </div>
        </section>

        <section className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[#17201E]">Nutrition</h2>
            <button
              type="button"
              onClick={() => getCoachGoalSuggestion.mutate()}
              disabled={!isAuthed || getCoachGoalSuggestion.isPending || updateGoals.isPending}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#EAF8F4] px-3 text-xs font-bold text-[#15483F] transition-colors hover:bg-[#E3EAE7] disabled:opacity-55"
            >
              <Sparkles className="h-4 w-4" />
              {getCoachGoalSuggestion.isPending ? "Thinking..." : "Coach Suggestion"}
            </button>
          </div>
          <div className="mt-3 rounded-[20px] border border-[#E3EAE7] bg-white p-[18px]">
            <div className="grid grid-cols-3 gap-3">
              {macroRows.map(([label, value, target]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-[#6B7773]">{label}</p>
                  <p className="mt-1 text-lg font-bold text-[#17201E]">{macroStatus(Number(value), Number(target))}</p>
                  <p className="mt-0.5 text-[11px] font-medium tabular-nums text-[#6B7773]">
                    {Math.round(Number(value))} g of {Math.round(Number(target))} g
                  </p>
                  <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#E9F1EE]">
                    <div
                      className="h-full rounded-full bg-[#20C7A4]"
                      style={{ width: `${pct(Number(value), Number(target))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[#EDF2F0] pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-[#17201E]">Fiber: {macroStatus(totals.fiber, fiberTarget)}</p>
                <p className="text-sm font-bold tabular-nums text-[#17201E]">
                  {Math.round(totals.fiber)} of {Math.round(fiberTarget)} g
                </p>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#6B7773]">Add fruit, vegetables, or dal.</p>
            </div>
          </div>
        </section>

        {coachGoals && (
          <section className="mt-4 rounded-[20px] border border-[#CFECE4] bg-white p-[18px]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#EAF8F4] text-[#20C7A4]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-[#17201E]">Coach goals</h2>
                <p className="mt-1 text-xs leading-5 text-[#6B7773]">
                  {coachGoals.suggestion.reason}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[
                ["Calories", calorieTarget, coachGoals.suggestion.calorieTarget, "kcal"],
                ["Protein", proteinTarget, coachGoals.suggestion.proteinG, "g"],
                ["Carbs", carbsTarget, coachGoals.suggestion.carbsG, "g"],
                ["Fat", fatTarget, coachGoals.suggestion.fatG, "g"],
                ["Fiber", fiberTarget, coachGoals.suggestion.fiberG, "g"],
              ].map(([label, current, suggested, unit]) => (
                <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[12px] bg-[#F7FAF9] px-3 py-2">
                  <p className="text-xs font-semibold text-[#6B7773]">{label}</p>
                  <p className="text-xs font-bold tabular-nums text-[#17201E]">
                    {Math.round(Number(current))} {"->"} {Math.round(Number(suggested))} {unit}
                  </p>
                </div>
              ))}
            </div>
            {coachGoals.suggestion.cautions.length > 0 && (
              <p className="mt-3 text-xs leading-5 text-[#6B7773]">
                {coachGoals.suggestion.cautions[0]}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCoachGoals(null)}
                className="h-[48px] rounded-[14px] border-[#E3EAE7] font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApplyCoachGoals}
                disabled={updateGoals.isPending}
                className="h-[48px] rounded-[14px] bg-[#20C7A4] font-semibold text-white hover:bg-[#1BB392]"
              >
                {updateGoals.isPending ? "Saving..." : "Apply goals"}
              </Button>
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[#17201E]">Micronutrient coverage</h2>
            <p className="text-xl font-bold tabular-nums text-[#20C7A4]">{micronutrientCoverage}%</p>
          </div>
          <div className="mt-3 rounded-[20px] border border-[#E3EAE7] bg-white p-[18px]">
            <div className="space-y-3">
              {micronutrientRows.slice(0, 5).map((item) => (
                <div key={item.nutrientId}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-semibold text-[#6B7773]">{item.name}</p>
                    <p className="shrink-0 text-xs font-medium tabular-nums text-[#6B7773]">
                      {Math.round(item.total)}
                      {item.unit}
                    </p>
                  </div>
                  <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-[#E9F1EE]">
                    <div className="h-full rounded-full bg-[#20C7A4]" style={{ width: item.width }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#6B7773]">
              Based on foods logged today. More detailed vitamins and minerals are available in your diary.
            </p>
          </div>
        </section>

          </div>

          <div className="min-w-0 lg:sticky lg:top-6">
        <section className="mt-6 lg:mt-0">
          <h2 className="text-[17px] font-semibold text-[#17201E]">Quick log</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveQuickLog(activeQuickLog === "food" ? null : "food")}
              className="min-h-[88px] rounded-[18px] border border-[#E3EAE7] bg-white p-4 text-left transition-colors hover:border-[#20C7A4]/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#EAF8F4] text-[#20C7A4]">
                <Utensils className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-[15px] font-semibold leading-5 text-[#17201E]">Add food</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveQuickLog(activeQuickLog === "burn" ? null : "burn")}
              className="min-h-[88px] rounded-[18px] border border-[#E3EAE7] bg-white p-4 text-left transition-colors hover:border-[#F1B65F]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF3DF] text-[#C96B08]">
                <Flame className="h-5 w-5" />
              </span>
              <span className="mt-3 block text-[15px] font-semibold leading-5 text-[#17201E]">Burn calories</span>
            </button>
          </div>

          {activeQuickLog === "food" && (
            <div className="mt-3 rounded-[20px] border border-[#E3EAE7] bg-white p-[18px]">
              <h3 className="text-[15px] font-semibold text-[#17201E]">Add food</h3>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7773]" />
                <Input
                  className="h-[52px] rounded-[14px] border-[#E3EAE7] bg-white pl-11 text-sm"
                  value={foodQuery}
                  onChange={(e) => setFoodQuery(e.target.value)}
                  placeholder="Search dal, bhat, chiya..."
                />
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-[#6B7773]">Meal</p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type)}
                      className={`min-h-11 rounded-[12px] px-2 text-xs font-semibold transition-colors ${
                        mealType === type
                          ? "bg-[#20C7A4] text-white"
                          : "border border-[#E3EAE7] bg-white text-[#6B7773]"
                      }`}
                    >
                      {mealLabel(type)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-[#6B7773]">Quantity</p>
                <div className="mt-2 grid grid-cols-[52px_1fr_52px] items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setServingQty(String(Math.max(0.25, getSafeServingQty() - 0.25)))}
                    className="min-h-11 rounded-[14px] border border-[#E3EAE7] bg-white text-lg font-semibold text-[#6B7773]"
                  >
                    -
                  </button>
                  <div className="flex min-h-11 items-center justify-center rounded-[14px] border border-[#E3EAE7] bg-[#F7FAF9] text-sm font-semibold text-[#17201E]">
                    {getSafeServingQty()} serving{getSafeServingQty() === 1 ? "" : "s"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setServingQty(String(getSafeServingQty() + 0.25))}
                    className="min-h-11 rounded-[14px] border border-[#E3EAE7] bg-white text-lg font-semibold text-[#6B7773]"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {hasHydrated && foodSearching && <p className="text-sm text-[#6B7773]">Searching...</p>}
                {localFoodResults.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => openLocalFoodConfirmation(food)}
                    className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[14px] border border-[#E3EAE7] bg-white px-3 py-3 text-left"
                  >
                    <span className="min-w-0 overflow-hidden">
                      <span className="block truncate text-sm font-semibold text-[#17201E]">{food.name}</span>
                      <span className="block truncate text-xs text-[#6B7773]">Food data • {Math.round(food.protein)}g protein</span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#17201E]">{Math.round(food.calories)} kcal</span>
                  </button>
                ))}
                {(foodResults ?? []).map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => openDatabaseFoodConfirmation(food.id, food.name, Number(food.calories || 0))}
                    disabled={logFood.isPending}
                    className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[14px] border border-[#E3EAE7] bg-white px-3 py-3 text-left disabled:opacity-60"
                  >
                    <span className="min-w-0 overflow-hidden">
                      <span className="block truncate text-sm font-semibold text-[#17201E]">{food.name}</span>
                      <span className="block truncate text-xs text-[#6B7773]">{food.householdServing ?? `${food.servingSize}${food.servingUnit}`}</span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#17201E]">{Math.round(Number(food.calories || 0))} kcal</span>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                onClick={() => setStatusMessage("Search and choose a food to add.")}
                className="mt-4 h-[50px] w-full rounded-[14px] bg-[#20C7A4] font-semibold text-white hover:bg-[#1BB392]"
              >
                Add food
              </Button>
            </div>
          )}

          {activeQuickLog === "burn" && (
            <div className="mt-3 rounded-[20px] border border-[#E3EAE7] bg-white p-[18px]">
              <h3 className="text-[15px] font-semibold text-[#17201E]">Burn calories</h3>
              <div className="mt-4">
                <p className="text-xs font-medium text-[#6B7773]">Activity</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(Object.keys(activityOptions) as Array<keyof typeof activityOptions>).map((key) => {
                    const option = activityOptions[key];
                    const Icon = option.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActivity(key)}
                        className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] text-xs font-semibold transition-colors ${
                          activity === key
                            ? "border border-[#F1B65F] bg-[#FFF1D8] text-[#B35D00]"
                            : "border border-[#E3EAE7] bg-white text-[#6B7773]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-[#6B7773]">Duration</p>
                <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={activityMinutes}
                    onChange={(e) => setActivityMinutes(e.target.value)}
                    className="h-[50px] rounded-[14px] border-[#E3EAE7] text-sm"
                  />
                  <span className="text-sm font-medium text-[#6B7773]">minutes</span>
                </div>
              </div>
              <div className="mt-4 rounded-[14px] bg-[#FFF8EB] p-[14px]">
                <p className="text-xs font-medium text-[#B35D00]">Estimated burn</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[#17201E]">{burnPreview.calories} kcal</p>
                <p className="mt-1 text-xs text-[#6B7773]">{burnPreview.durationMin} min • based on {weightForBurn} kg</p>
              </div>
              <Button
                onClick={handleLogActivity}
                disabled={logExercise.isPending}
                className="mt-4 h-[50px] w-full rounded-[14px] bg-[#20C7A4] font-semibold text-white hover:bg-[#1BB392]"
              >
                {logExercise.isPending ? "Logging..." : "Log activity"}
              </Button>
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-[17px] font-semibold text-[#17201E]">Weight</h2>
          <div className="mt-3 rounded-[20px] border border-[#E3EAE7] bg-white p-[18px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[30px] font-bold leading-none tabular-nums text-[#17201E]">
                  {currentWeight ? `${currentWeight.toFixed(1)} kg` : "No weight"}
                </p>
                <p className="mt-2 text-sm text-[#6B7773]">Today</p>
              </div>
              <Scale className="h-5 w-5 text-[#20C7A4]" />
            </div>
            {isWeightEditing && (
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    value={weightInput}
                    onChange={(event) => setWeightInput(event.target.value)}
                    placeholder="63.0"
                    className="h-[50px] rounded-[14px] border-[#E3EAE7] pr-10 text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7773]">kg</span>
                </div>
                <Button
                  onClick={handleLogWeight}
                  disabled={!weightInput || isPendingWeight || logWeight.isPending}
                  className="h-[50px] rounded-[14px] bg-[#20C7A4] px-5 font-semibold text-white hover:bg-[#1BB392]"
                >
                  {isPendingWeight || logWeight.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsWeightEditing((value) => !value)}
              className="mt-5 block min-h-11 text-sm font-semibold text-[#17201E]"
            >
              Update weight
            </button>
            <Link href="/hub/progress" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#20C7A4]">
              View progress →
            </Link>
          </div>
        </section>

          </div>
        </div>

        {(statusMessage || nutritionStatus) && (
          <div className="mt-6 flex items-center gap-2 rounded-[14px] bg-[#EAF8F4] px-[15px] py-[13px] text-sm font-semibold text-[#15483F]">
            <Check className="h-4 w-4" />
            <span>{statusMessage || nutritionStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
}
