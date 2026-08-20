"use client";

import { Minus, Moon, Plus, Sandwich, Soup, Sunrise, Trash2 } from "lucide-react";
import Link from "next/link";
import { removeEntry, updateEntryServings } from "@/server/actions/diary";
import { useState, useTransition, type ComponentType, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const mealIcons: Record<MealType, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  breakfast: Sunrise,
  lunch: Soup,
  dinner: Moon,
  snack: Sandwich,
};

interface DiaryEntry {
  id: string;
  foodId: string;
  foodName: string;
  foodBrand: string | null;
  servingQty: string;
  foodServingSize: string;
  foodServingUnit: string;
  calories: string | null;
  proteinG: string | null;
  carbsG: string | null;
  fatG: string | null;
}

interface MealSectionProps {
  mealType: MealType;
  entries: DiaryEntry[];
  date: string;
  onRequireAuth?: () => void;
  isAuthenticated?: boolean;
}

export function MealSection({ mealType, entries, date, onRequireAuth, isAuthenticated }: MealSectionProps) {
  const { t } = useTranslation("diary");
  const mealCalories = entries.reduce((sum, e) => sum + Number(e.calories || 0), 0);
  const Icon = mealIcons[mealType];

  const handleAddClick = (e: MouseEvent) => {
    if (!isAuthenticated && onRequireAuth) {
      e.preventDefault();
      onRequireAuth();
    }
  };

  const addHref = `/hub/food/search?date=${date}&meal=${mealType}`;

  return (
    <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_18px_rgba(20,40,30,0.04)] dark:bg-card">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t(mealType)}</h3>
            <p className="text-sm text-muted-foreground">{Math.round(mealCalories)} kcal</p>
          </div>
        </div>
        <Link href={addHref} onClick={handleAddClick}>
          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-primary" aria-label={`Add ${mealType}`}>
            <Plus className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </Link>
      </div>

      {entries.length === 0 ? (
        <Link
          href={addHref}
          onClick={handleAddClick}
          className="block rounded-2xl border border-dashed border-border bg-background px-4 py-5 text-center text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary hover:text-primary"
        >
          {t("clickToAddFood")}
        </Link>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} mealType={mealType} />
          ))}
        </div>
      )}
    </section>
  );
}

function EntryRow({ entry, mealType }: { entry: DiaryEntry; mealType: MealType }) {
  const [isPending, startTransition] = useTransition();
  const [localQty, setLocalQty] = useState(Number(entry.servingQty));
  const router = useRouter();
  const utils = trpc.useUtils();

  const handleRemove = () => {
    startTransition(async () => {
      await removeEntry(entry.id);
      await utils.diary.getDay.invalidate();
      posthog.capture("food_deleted", { meal_type: mealType, calories: Number(entry.calories || 0) });
      router.refresh();
    });
  };

  const handleQtyChange = (delta: number) => {
    const prevQty = localQty;
    const newQty = Math.max(1, localQty + delta);
    setLocalQty(newQty);
    startTransition(async () => {
      try {
        await updateEntryServings({ entryId: entry.id, servingQty: newQty });
        await utils.diary.getDay.invalidate();
        router.refresh();
      } catch {
        setLocalQty(prevQty);
      }
    });
  };

  const perServingCal = Number(entry.calories || 0) / Number(entry.servingQty || 1);
  const displayCal = Math.round(perServingCal * localQty);

  return (
    <div className={`rounded-2xl bg-background p-3 ${isPending ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/hub/food/${entry.foodId}`}>
            <p className="truncate text-base font-semibold text-foreground">{entry.foodName}</p>
          </Link>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {entry.foodServingSize}
            {entry.foodServingUnit}
            {entry.foodBrand ? ` · ${entry.foodBrand}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold tabular-nums text-foreground">{displayCal}</p>
          <p className="text-xs text-muted-foreground">kcal</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground transition-colors hover:text-primary disabled:opacity-40 dark:bg-card"
            onClick={() => handleQtyChange(-1)}
            disabled={isPending || localQty <= 1}
            aria-label="Decrease serving"
          >
            <Minus className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <span className="min-w-10 text-center text-sm font-semibold tabular-nums text-foreground">{localQty}</span>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground transition-colors hover:text-primary disabled:opacity-40 dark:bg-card"
            onClick={() => handleQtyChange(1)}
            disabled={isPending}
            aria-label="Increase serving"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          onClick={handleRemove}
          disabled={isPending}
          aria-label="Remove food"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
