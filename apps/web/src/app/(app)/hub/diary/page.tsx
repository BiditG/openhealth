"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format, parseISO, isValid } from "date-fns";
import { Plus, Salad } from "lucide-react";
import Link from "next/link";
import { DateNavigator } from "@/components/diary/date-navigator";
import { DailySummary } from "@/components/diary/daily-summary";
import { MealSection } from "@/components/diary/meal-section";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { trpc } from "@/lib/trpc-client";
import {
  DEFAULT_CALORIE_TARGET,
  DEFAULT_PROTEIN_G,
  DEFAULT_CARBS_G,
  DEFAULT_FAT_G,
  DEFAULT_FIBER_G,
} from "@open-health/shared/constants";

const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

function parseDateParam(param: string | null): Date {
  if (param) {
    const parsed = parseISO(param);
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

function DiaryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = parseDateParam(searchParams.get("date"));
  const dateStr = format(date, "yyyy-MM-dd");

  const handleDateChange = useCallback(
    (newDate: Date) => {
      const newDateStr = format(newDate, "yyyy-MM-dd");
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const url = newDateStr === todayStr ? "/hub/diary" : `/hub/diary?date=${newDateStr}`;
      router.replace(url);
    },
    [router]
  );
  const { isAuthenticated, showLoginDialog, setShowLoginDialog } = useAuthGuard();

  const { data } = trpc.diary.getDay.useQuery(
    { date: dateStr },
    { enabled: isAuthenticated }
  );
  const { data: goals } = trpc.user.getGoals.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const calorieTarget = goals?.calorieTarget ? Number(goals.calorieTarget) : DEFAULT_CALORIE_TARGET;
  const proteinTarget = goals?.proteinG ? Number(goals.proteinG) : DEFAULT_PROTEIN_G;
  const carbsTarget = goals?.carbsG ? Number(goals.carbsG) : DEFAULT_CARBS_G;
  const fatTarget = goals?.fatG ? Number(goals.fatG) : DEFAULT_FAT_G;
  const fiberTarget = goals?.fiberG ? Number(goals.fiberG) : DEFAULT_FIBER_G;

  const entries = data?.entries ?? [];
  const getEntriesForMeal = (meal: string) =>
    entries.filter((e) => e.mealType === meal);

  const handleRequireAuth = () => {
    setShowLoginDialog(true);
  };

  const handleFabClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      setShowLoginDialog(true);
    }
  };

  return (
    <div className="space-y-6 px-4 py-6">
      <DateNavigator date={date} onDateChange={handleDateChange} />

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Salad className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Food journal</h1>
            <p className="text-sm text-muted-foreground">Meals and nutrition for this day.</p>
          </div>
        </div>
        <DailySummary
          calories={data?.totals.calories ?? 0}
          protein={data?.totals.protein ?? 0}
          carbs={data?.totals.carbs ?? 0}
          fat={data?.totals.fat ?? 0}
          fiber={data?.totals.fiber ?? 0}
          calorieTarget={calorieTarget}
          proteinTarget={proteinTarget}
          carbsTarget={carbsTarget}
          fatTarget={fatTarget}
          fiberTarget={fiberTarget}
          date={dateStr}
          trackedNutrientIds={Array.isArray(goals?.trackedNutrientIds) ? goals.trackedNutrientIds : []}
        />
      </section>

      <div className="space-y-4">
        {mealTypes.map((meal) => (
          <MealSection
            key={meal}
            mealType={meal}
            entries={getEntriesForMeal(meal)}
            date={dateStr}
            isAuthenticated={isAuthenticated}
            onRequireAuth={handleRequireAuth}
          />
        ))}
      </div>

      {/* Floating Action Button */}
      <Link
        href={`/hub/food/search?date=${dateStr}&meal=snack`}
        className="fixed bottom-24 right-4 z-50 lg:right-[calc((100vw-1120px)/2+24px)]"
        onClick={handleFabClick}
        data-testid="add-entry-fab"
      >
        <button className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(23,107,87,0.22)] transition-all duration-200 hover:bg-[#125745]">
          <Plus className="h-6 w-6" strokeWidth={1.8} />
        </button>
      </Link>

      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
      />
    </div>
  );
}

export default function DiaryPage() {
  return (
    <Suspense fallback={<DiarySkeleton />}>
      <DiaryContent />
    </Suspense>
  );
}

function DiarySkeleton() {
  return (
    <div className="space-y-4 px-4 py-6">
      {/* Date navigator skeleton */}
      <div className="flex items-center justify-center gap-4 rounded-2xl bg-muted p-4">
        <div className="h-8 w-8 rounded-full bg-white/70" />
        <div className="h-5 w-28 rounded bg-white/70" />
        <div className="h-8 w-8 rounded-full bg-white/70" />
      </div>
      {/* Daily summary skeleton */}
      <div className="rounded-3xl bg-muted p-5">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 rounded bg-white/70" />
          <div className="h-8 w-32 rounded bg-white/70" />
        </div>
        <div className="flex justify-between">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-3 w-8 rounded bg-white/70" />
              <div className="h-2 w-16 rounded-full bg-white/70" />
            </div>
          ))}
        </div>
      </div>
      {/* Meal sections skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-3xl bg-muted p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-white/70" />
                <div className="h-4 w-10 rounded bg-white/70" />
                <div className="h-3 w-12 rounded bg-white/70" />
              </div>
            </div>
            <div className="h-12 rounded-2xl border border-dashed border-white/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
