"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, CheckCircle2, Pencil, Save, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc-client";
import { useSession } from "@/lib/auth-client";
import { NUTRIENT_IDS, NUTRIENT_I18N_KEY } from "@open-health/shared/constants";
import { useTranslation } from "react-i18next";



const categoryOrder = ["macro", "vitamin", "mineral", "other"];

export default function FoodDetailPage() {
  const { t } = useTranslation(["food", "common", "nutrients"]);
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string>();

  const utils = trpc.useUtils();
  const { data: food, isLoading } = trpc.food.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id }
  );

  const updateMutation = trpc.food.updateFood.useMutation({
    onSuccess: () => {
      utils.food.getById.invalidate({ id: params.id });
      setIsEditing(false);
    },
  });

  const deleteMutation = trpc.food.deleteFood.useMutation({
    onSuccess: () => {
      router.push("/hub/food/search");
      router.refresh();
    },
  });

  const handleDelete = () => {
    if (!food) return;
    if (!window.confirm(t("food:confirmDelete"))) return;
    deleteMutation.mutate({ id: food.id });
  };

  const [editForm, setEditForm] = useState({
    name: "",
    brand: "",
    description: "",
    servingSize: "",
    servingUnit: "",
    householdServing: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
  });

  const isOwner = !!(session?.user?.id && food?.createdBy && session.user.id === food.createdBy);

  function startEditing() {
    if (!food) return;
    const findNut = (name: string) =>
      food.nutrients.find((n) => n.name.toLowerCase().includes(name))?.amount ?? "0";
    setEditForm({
      name: food.name,
      brand: food.brand ?? "",
      description: food.description ?? "",
      servingSize: String(food.servingSize),
      servingUnit: food.servingUnit,
      householdServing: food.householdServing ?? "",
      calories: String(food.calories),
      protein: findNut("protein"),
      carbs: findNut("carbohydrate"),
      fat: findNut("fat") !== "0" ? findNut("fat") : findNut("lipid"),
      fiber: findNut("fiber"),
    });
    setValidationError(undefined);
    setIsEditing(true);
  }

  function handleSave() {
    if (!food) return;
    const servingSize = Number(editForm.servingSize);
    const calories = Number(editForm.calories);
    if (isNaN(servingSize) || servingSize <= 0 || isNaN(calories) || calories < 0) {
      setValidationError(t("food:enterValidNumber"));
      return;
    }
    setValidationError(undefined);
    const protein = Number(editForm.protein) || 0;
    const carbs = Number(editForm.carbs) || 0;
    const fat = Number(editForm.fat) || 0;
    const fiber = Number(editForm.fiber) || 0;
    const nutrients = [
      { nutrientId: NUTRIENT_IDS.protein, amount: protein },
      { nutrientId: NUTRIENT_IDS.totalCarbs, amount: carbs },
      { nutrientId: NUTRIENT_IDS.totalFat, amount: fat },
      { nutrientId: NUTRIENT_IDS.fiber, amount: fiber },
    ];
    updateMutation.mutate({
      id: food.id,
      name: editForm.name,
      brand: editForm.brand || null,
      description: editForm.description || null,
      servingSize,
      servingUnit: editForm.servingUnit,
      householdServing: editForm.householdServing || null,
      calories,
      nutrients,
    });
  }

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!food) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 py-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">{t("food:notFound")}</h1>
        </div>
      </div>
    );
  }

  const findNutrient = (name: string) =>
    food.nutrients.find((n) => n.name.toLowerCase().includes(name));

  const proteinG = findNutrient("protein")?.amount ?? "0";
  const carbsG = findNutrient("carbohydrate")?.amount ?? "0";
  const fatG = findNutrient("fat")?.amount ?? findNutrient("lipid")?.amount ?? "0";
  const fiberG = findNutrient("fiber")?.amount ?? "0";

  const nutrientsByCategory = categoryOrder
    .map((cat) => ({
      category: cat,
      label: cat,
      nutrients: food.nutrients.filter((n) => n.category === cat),
    }))
    .filter((group) => group.nutrients.length > 0);

  const foodMetadata = food.metadata as { imageUrl?: string } | null | undefined;
  const imageUrl = typeof foodMetadata?.imageUrl === "string" ? foodMetadata.imageUrl : null;

  if (!isEditing) {
    const caloriesValue = Math.round(Number(food.calories ?? 0));
    const mealRows = [
      { label: "Serving", detail: `${food.servingSize}${food.servingUnit}${food.householdServing ? ` (${food.householdServing})` : ""}`, calories: `${caloriesValue} kcal` },
      { label: t("common:macro.protein"), detail: `${Math.round(Number(proteinG ?? 0))}g`, calories: "Supports fullness" },
      { label: t("common:macro.carbs"), detail: `${Math.round(Number(carbsG ?? 0))}g`, calories: "Meal energy" },
      { label: t("common:macro.fat"), detail: `${Math.round(Number(fatG ?? 0))}g`, calories: "Adds satiety" },
    ];

    return (
      <div className="mx-auto max-w-[960px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button onClick={() => router.back()} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          {isOwner && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleteMutation.isPending} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-[0_4px_24px_rgba(20,50,40,0.045)] dark:bg-card">
            <div className="relative aspect-[4/3] bg-muted">
              {imageUrl ? (
                <img src={imageUrl} alt={food.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center bg-secondary">
                  <div className="text-center text-primary">
                    <Camera className="mx-auto h-16 w-16" strokeWidth={1.5} />
                    <p className="mt-4 text-lg font-bold">Meal photo</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 sm:p-7">
              <p className="text-sm font-semibold text-muted-foreground">{food.brand || "Your meal"}</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{food.name}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Good balance of energy and macros.</p>
            </div>
          </div>

          <aside className="rounded-3xl border border-border bg-white p-6 text-center shadow-[0_4px_24px_rgba(20,50,40,0.045)] dark:bg-card">
            <div className="mx-auto grid h-32 w-32 place-items-center rounded-full border-[9px] border-secondary border-t-primary">
              <div>
                <p className="text-4xl font-bold tabular-nums text-foreground">82</p>
                <p className="text-sm font-semibold text-primary">Balanced</p>
              </div>
            </div>
            <p className="mt-5 text-3xl font-bold tabular-nums text-foreground">{caloriesValue}</p>
            <p className="text-sm text-muted-foreground">{t("common:units.kcal")}</p>
            <Link href="/hub/diary" className="mt-6 inline-flex min-h-[50px] w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#0D8064]">
              Save meal
            </Link>
          </aside>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-white p-5 shadow-[0_4px_24px_rgba(20,50,40,0.045)] sm:p-6 dark:bg-card">
          <div className="grid grid-cols-4 gap-3 text-center">
            <MacroItem label={t("common:macro.protein")} value={proteinG} unit="g" />
            <MacroItem label={t("common:macro.carbs")} value={carbsG} unit="g" />
            <MacroItem label={t("common:macro.fat")} value={fatG} unit="g" />
            <MacroItem label={t("common:macro.fiber")} value={fiberG} unit="g" />
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-3xl border border-border bg-white p-5 sm:p-6 dark:bg-card">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">What&apos;s in your meal</h2>
            <div className="mt-5 divide-y divide-border">
              {mealRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-semibold text-foreground">{row.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
                  </div>
                  <p className="text-right text-sm font-medium text-muted-foreground">{row.calories}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-secondary p-5 sm:p-6">
            <CheckCircle2 className="h-6 w-6 text-primary" strokeWidth={1.8} />
            <p className="mt-5 text-xs font-semibold uppercase text-primary">One thing to try</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Pair it with vegetables.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">A little more fiber can make this meal feel more balanced.</p>
          </div>
        </section>

        {nutrientsByCategory.length > 0 && (
          <section className="mt-8 rounded-3xl border border-border bg-white p-5 sm:p-6 dark:bg-card">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">More nutrients</h2>
            <div className="mt-5 divide-y divide-border">
              {nutrientsByCategory.flatMap((group) => group.nutrients).slice(0, 10).map((nutrient, idx) => {
                const amount = Number(nutrient.amount ?? 0);
                return (
                  <div key={`${nutrient.name}-${idx}`} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm text-muted-foreground">{NUTRIENT_I18N_KEY[nutrient.name] ? t(`nutrients:${NUTRIENT_I18N_KEY[nutrient.name]}`) : nutrient.name}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{formatAmount(amount)} {nutrient.unit}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="font-semibold"
            />
          ) : (
            <>
              <h1 className="font-semibold truncate">{food.name}</h1>
              {food.brand && (
                <p className="text-xs text-muted-foreground">{food.brand}</p>
              )}
            </>
          )}
        </div>
        {isOwner && !isEditing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={startEditing}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        {isEditing && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(false)}
              disabled={updateMutation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Brand (edit mode) */}
      {isEditing && (
        <div className="mb-3 space-y-2">
          <Input
            value={editForm.brand}
            onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
            placeholder={t("food:brandOptional")}
          />
        </div>
      )}

      {/* Serving info */}
      {isEditing ? (
        <div className="rounded-lg bg-muted/50 px-4 py-3 mb-4 space-y-2">
          <p className="text-sm text-muted-foreground">{t("food:perServing")}</p>
          <div className="flex gap-2">
            <Input
              type="number"
              value={editForm.servingSize}
              onChange={(e) => setEditForm((f) => ({ ...f, servingSize: e.target.value }))}
              placeholder={t("food:servingSizeLabel")}
              className="w-24"
            />
            <Input
              value={editForm.servingUnit}
              onChange={(e) => setEditForm((f) => ({ ...f, servingUnit: e.target.value }))}
              placeholder={t("food:unitLabel")}
              className="w-20"
            />
            <Input
              value={editForm.householdServing}
              onChange={(e) => setEditForm((f) => ({ ...f, householdServing: e.target.value }))}
              placeholder={t("food:householdServing")}
              className="flex-1"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/50 px-4 py-3 mb-4">
          <p className="text-sm text-muted-foreground">{t("food:perServing")}</p>
          <p className="text-lg font-semibold">
            {food.servingSize}{food.servingUnit}
            {food.householdServing ? ` (${food.householdServing})` : ""}
          </p>
        </div>
      )}

      {/* Calories + Macros summary */}
      <div className="rounded-lg border p-4 mb-4">
        <div className="text-center mb-3">
          {isEditing ? (
            <div className="flex items-center justify-center gap-2">
              <Input
                type="number"
                value={editForm.calories}
                onChange={(e) => setEditForm((f) => ({ ...f, calories: e.target.value }))}
                className="w-28 text-center text-xl font-bold"
              />
              <span className="text-sm text-muted-foreground">{t("common:units.kcal")}</span>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold">{Math.round(Number(food.calories ?? 0))}</p>
              <p className="text-sm text-muted-foreground">{t("common:units.kcal")}</p>
            </>
          )}
        </div>
        {isEditing ? (
          <div className="grid grid-cols-4 gap-2 text-center">
            <EditableMacro label={t("common:macro.protein")} value={editForm.protein} onChange={(v) => setEditForm((f) => ({ ...f, protein: v }))} />
            <EditableMacro label={t("common:macro.carbs")} value={editForm.carbs} onChange={(v) => setEditForm((f) => ({ ...f, carbs: v }))} />
            <EditableMacro label={t("common:macro.fat")} value={editForm.fat} onChange={(v) => setEditForm((f) => ({ ...f, fat: v }))} />
            <EditableMacro label={t("common:macro.fiber")} value={editForm.fiber} onChange={(v) => setEditForm((f) => ({ ...f, fiber: v }))} />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 text-center">
            <MacroItem label={t("common:macro.protein")} value={proteinG} unit="g" />
            <MacroItem label={t("common:macro.carbs")} value={carbsG} unit="g" />
            <MacroItem label={t("common:macro.fat")} value={fatG} unit="g" />
            <MacroItem label={t("common:macro.fiber")} value={fiberG} unit="g" />
          </div>
        )}
      </div>

      {/* Errors */}
      {validationError && (
        <p className="text-sm text-red-500 mb-4">{validationError}</p>
      )}
      {updateMutation.isError && (
        <p className="text-sm text-red-500 mb-4">
          {updateMutation.error.message}
        </p>
      )}

      {/* Full nutrient list by category */}
      {nutrientsByCategory.map((group) => (
        <div key={group.category} className="mb-4">
          <h2 className="text-sm font-semibold mb-2 px-1">{t(`food:category.${group.label}`)}</h2>
          <div className="rounded-lg border divide-y">
            {group.nutrients.map((nutrient, idx) => {
              const amount = Number(nutrient.amount ?? 0);
              const dv = nutrient.dailyValue ? Number(nutrient.dailyValue) : null;
              const dvPercent = dv && dv > 0 ? Math.round((amount / dv) * 100) : null;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <span className="text-sm">{NUTRIENT_I18N_KEY[nutrient.name] ? t(`nutrients:${NUTRIENT_I18N_KEY[nutrient.name]}`) : nutrient.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums">
                      {formatAmount(amount)} {nutrient.unit}
                    </span>
                    {dvPercent !== null && (
                      <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                        {dvPercent}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Description / Notes */}
      {isEditing ? (
        <div className="mb-4">
          <Textarea
            value={editForm.description}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t("common:labels.notes")}
            rows={3}
          />
        </div>
      ) : (
        food.description && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold mb-2 px-1">{t("common:labels.notes")}</h2>
            <p className="text-sm text-muted-foreground px-1 whitespace-pre-wrap">{food.description}</p>
          </div>
        )
      )}
    </div>
  );
}

function MacroItem({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | null;
  unit: string;
}) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">
        {Math.round(Number(value ?? 0))}{unit}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EditableMacro({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-0.5">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 text-center text-lg font-semibold px-1 h-8"
        />
        <span className="text-sm font-semibold">g</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function formatAmount(amount: number): string {
  if (amount === 0) return "0";
  if (amount >= 1) return amount.toFixed(1).replace(/\.0$/, "");
  return amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
