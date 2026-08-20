"use client";

import { Suspense, useCallback, type ComponentType } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format, parseISO, isValid } from "date-fns";
import Link from "next/link";
import { ArrowRight, Bot, Droplets, Footprints, Plus, Salad, Scale } from "lucide-react";
import { DateNavigator } from "@/components/diary/date-navigator";
import { DailySummary } from "@/components/diary/daily-summary";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { trpc } from "@/lib/trpc-client";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_CALORIE_TARGET,
  DEFAULT_PROTEIN_G,
  DEFAULT_CARBS_G,
  DEFAULT_FAT_G,
  DEFAULT_FIBER_G,
} from "@open-health/shared/constants";

function parseDateParam(param: string | null): Date {
  if (param) {
    const parsed = parseISO(param);
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

const WEIGHT_TREND_DAYS = 7;
const DEFAULT_WATER_GOAL_ML = 2000;

function TodayContent() {
  const { t } = useTranslation(["diary", "common", "ai", "progress"]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = parseDateParam(searchParams.get("date"));
  const dateStr = format(date, "yyyy-MM-dd");

  const handleDateChange = useCallback(
    (newDate: Date) => {
      const newDateStr = format(newDate, "yyyy-MM-dd");
      const todayStr = format(new Date(), "yyyy-MM-dd");
      router.replace(newDateStr === todayStr ? "/today" : `/today?date=${newDateStr}`);
    },
    [router],
  );

  const { isAuthenticated, showLoginDialog, setShowLoginDialog } = useAuthGuard();

  const { data: diaryData } = trpc.diary.getDay.useQuery({ date: dateStr }, { enabled: isAuthenticated });
  const { data: goals } = trpc.user.getGoals.useQuery(undefined, { enabled: isAuthenticated });
  const { data: dateWeight } = trpc.progress.getDateWeight.useQuery({ date: dateStr }, { enabled: isAuthenticated });
  const { data: dateSteps } = trpc.progress.getDateSteps.useQuery({ date: dateStr }, { enabled: isAuthenticated });
  const { data: weightHistory } = trpc.progress.getWeightHistory.useQuery({ limit: WEIGHT_TREND_DAYS }, { enabled: isAuthenticated });
  const { data: waterData } = trpc.water.getToday.useQuery({ date: dateStr }, { enabled: isAuthenticated });

  const calorieTarget = goals?.calorieTarget ? Number(goals.calorieTarget) : DEFAULT_CALORIE_TARGET;
  const proteinTarget = goals?.proteinG ? Number(goals.proteinG) : DEFAULT_PROTEIN_G;
  const carbsTarget = goals?.carbsG ? Number(goals.carbsG) : DEFAULT_CARBS_G;
  const fatTarget = goals?.fatG ? Number(goals.fatG) : DEFAULT_FAT_G;
  const fiberTarget = goals?.fiberG ? Number(goals.fiberG) : DEFAULT_FIBER_G;

  const calories = diaryData?.totals.calories ?? 0;
  const currentWeight = dateWeight ? Number(dateWeight.weightKg) : null;
  const currentSteps = dateSteps ? Number(dateSteps.steps) : null;
  const waterTotal = waterData?.totalMl ?? 0;
  const waterGoal = waterData?.goalMl ?? DEFAULT_WATER_GOAL_ML;
  const waterPercent = Math.min((waterTotal / waterGoal) * 100, 100);

  const weightTrend = (() => {
    if (!weightHistory || weightHistory.length < 2) return null;
    const latest = Number(weightHistory[weightHistory.length - 1].weightKg);
    const first = Number(weightHistory[0].weightKg);
    return +(latest - first).toFixed(1);
  })();

  return (
    <div className="mx-auto max-w-[1080px] space-y-8 px-4 py-6 sm:px-6 lg:py-10">
      <DateNavigator date={date} onDateChange={handleDateChange} />

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_24px_rgba(20,50,40,0.045)] sm:p-7 dark:bg-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Your health</p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight text-foreground">Today</h1>
            <p className="mt-2 text-base text-muted-foreground">Food, water, movement.</p>
          </div>
          <Link
            href={`/hub/food/search?date=${dateStr}&meal=snack`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
            aria-label="Add food"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-7 rounded-3xl bg-background p-5">
          <Link href={`/hub/diary?date=${dateStr}`} className="block">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Salad className="h-5 w-5 text-primary" strokeWidth={1.8} />
                <p className="text-sm font-semibold text-foreground">{t("diary:calorieIntake")}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <DailySummary
              calories={calories}
              protein={diaryData?.totals.protein ?? 0}
              carbs={diaryData?.totals.carbs ?? 0}
              fat={diaryData?.totals.fat ?? 0}
              fiber={diaryData?.totals.fiber ?? 0}
              calorieTarget={calorieTarget}
              proteinTarget={proteinTarget}
              carbsTarget={carbsTarget}
              fatTarget={fatTarget}
              fiberTarget={fiberTarget}
            />
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Readings</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MetricLink
          href={`/hub/water?date=${dateStr}`}
          icon={Droplets}
          title={t("common:hub.items.water")}
          value={`${waterTotal.toLocaleString()} ml`}
          helper={`${Math.max(waterGoal - waterTotal, 0).toLocaleString()} ml left`}
          progress={waterPercent}
        />
        <MetricLink
          href="/hub/progress"
          icon={Scale}
          title={t("progress:weightLabel")}
          value={currentWeight !== null ? `${currentWeight} kg` : "--"}
          helper={weightTrend !== null ? `${weightTrend > 0 ? "+" : ""}${weightTrend} kg this week` : "Add your first reading"}
        />
        <MetricLink
          href="/hub/progress"
          icon={Footprints}
          title={t("progress:stepsLabel")}
          value={currentSteps !== null ? currentSteps.toLocaleString() : "--"}
          helper={currentSteps !== null ? t("common:units.steps") : "Log today's steps"}
        />
        </div>
      </section>

      <Link href="/hub/chat" className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-secondary p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary">
            <Bot className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase text-primary">One insight</p>
            <p className="mt-1 text-lg font-bold text-foreground">{t("ai:todayCard.title")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("ai:todayCard.description")}</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
      </Link>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}

function MetricLink({
  href,
  icon: Icon,
  title,
  value,
  helper,
  progress,
}: {
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  value: string;
  helper: string;
  progress?: number;
}) {
  return (
    <Link href={href} className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_24px_rgba(20,50,40,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 dark:bg-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
      </div>
      <p className="mt-5 text-3xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
      {progress !== undefined && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E9F0ED]">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
    </Link>
  );
}

export default function TodayPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 px-4 py-6">
          <div className="h-14 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-3xl bg-muted" />
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      }
    >
      <TodayContent />
    </Suspense>
  );
}
