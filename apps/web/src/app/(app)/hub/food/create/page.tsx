"use client";

import { Suspense, useState, useTransition, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Plus, Salad } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomFood } from "@/server/actions/food";
import { logFood } from "@/server/actions/diary";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { NUTRIENT_IDS, NUTRIENT_I18N_KEY, MACRO_NUTRIENT_IDS, DEFAULT_SERVING_SIZE } from "@open-health/shared/constants";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

const MACRO_IDS = new Set(MACRO_NUTRIENT_IDS);

function CreateFoodContent() {
  const { t } = useTranslation(["food", "common", "nutrients"]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const meal = (searchParams.get("meal") || "snack") as "breakfast" | "lunch" | "dinner" | "snack";
  const defaultName = searchParams.get("name") || "";

  const [isPending, startTransition] = useTransition();
  const utils = trpc.useUtils();
  const [name, setName] = useState(defaultName);
  const [brand, setBrand] = useState("");
  const [servingSize, setServingSize] = useState(String(DEFAULT_SERVING_SIZE));
  const [servingUnit, setServingUnit] = useState("g");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [microExpanded, setMicroExpanded] = useState(false);
  const [microValues, setMicroValues] = useState<Record<number, string>>({});

  const { data: nutrientDefs } = trpc.user.getNutrientDefinitions.useQuery(undefined, { enabled: microExpanded });
  const microNutrients = nutrientDefs?.filter((n) => !MACRO_IDS.has(n.id)) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const allNutrients = [
          { nutrientId: NUTRIENT_IDS.protein, amount: parseFloat(protein) || 0 },
          { nutrientId: NUTRIENT_IDS.totalFat, amount: parseFloat(fat) || 0 },
          { nutrientId: NUTRIENT_IDS.totalCarbs, amount: parseFloat(carbs) || 0 },
          ...Object.entries(microValues)
            .filter(([, v]) => v && parseFloat(v) > 0)
            .map(([id, v]) => ({ nutrientId: Number(id), amount: parseFloat(v) })),
        ];

        const result = await createCustomFood({
          name,
          brand: brand || undefined,
          servingSize: parseFloat(servingSize),
          servingUnit,
          calories: parseFloat(calories),
          nutrients: allNutrients,
        });

        if (result.success && result.foodId) {
          await logFood({ date, mealType: meal, foodId: result.foodId, servingQty: 1 });
          await utils.diary.getDay.invalidate();
          posthog.capture("food_logged", { source: "create", meal_type: meal, calories: parseFloat(calories) });
          toast.success(t("common:toast.addedToDiary"));
          router.push(`/hub/diary?date=${date}`);
          router.refresh();
        } else {
          toast.error(t("common:toast.createFoodFailed"));
        }
      } catch (err) {
        console.error("createCustomFood/logFood failed:", err);
        toast.error(t("common:toast.addFailed"));
      }
    });
  };

  return (
    <div className="mx-auto max-w-[640px] space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href={`/hub/food/search?date=${date}&meal=${meal}`}>
          <Button variant="ghost" size="icon" aria-label="Back to food search">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <p className="text-sm font-semibold text-primary">Add to {t(`diary:${meal}`)}</p>
          <h1 className="text-3xl font-semibold text-foreground">{t("food:customFood")}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <Salad className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>{t("common:labels.basicInfo")}</CardTitle>
                <p className="text-sm text-muted-foreground">Name the food and serving size.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label={`${t("food:foodName")} *`}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("food:foodNamePlaceholder")} required />
            </Field>
            <Field label={t("food:brand")}>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("common:labels.optional")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={`${t("food:servingSizeLabel")} *`}>
                <Input type="number" value={servingSize} onChange={(e) => setServingSize(e.target.value)} required />
              </Field>
              <Field label={`${t("food:unitLabel")} *`}>
                <select
                  className="flex min-h-12 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-card"
                  value={servingUnit}
                  onChange={(e) => setServingUnit(e.target.value)}
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="oz">oz</option>
                  <option value="cup">cup</option>
                  <option value="piece">{t("common:units.pieces")}</option>
                </select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("common:labels.nutritionInfoPerServing")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label={`${t("food:caloriesKcal")} *`}>
              <Input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="0" required />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <MacroInput label={t("common:macro.protein")} value={protein} onChange={setProtein} tone="green" />
              <MacroInput label={t("common:macro.carbs")} value={carbs} onChange={setCarbs} tone="amber" />
              <MacroInput label={t("common:macro.fat")} value={fat} onChange={setFat} tone="blue" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setMicroExpanded(!microExpanded)}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>{t("food:deepNutrients")}</CardTitle>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("food:deepNutrientsHint")}</p>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${microExpanded ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
          {microExpanded && (
            <CardContent className="space-y-4">
              {microNutrients.map((n) => {
                const label = NUTRIENT_I18N_KEY[n.name] ? t(`nutrients:${NUTRIENT_I18N_KEY[n.name]}`) : n.name;
                return (
                  <div key={n.id} className="grid grid-cols-[1fr_120px_40px] items-center gap-3">
                    <label className="truncate text-sm font-medium text-foreground">{label}</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={microValues[n.id] || ""}
                      onChange={(e) => setMicroValues((prev) => ({ ...prev, [n.id]: e.target.value }))}
                    />
                    <span className="text-sm text-muted-foreground">{n.unit}</span>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border border-border bg-white/95 p-3 shadow-[0_-8px_24px_rgba(20,40,30,0.08)] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none dark:bg-card/95">
          <Button type="submit" className="w-full" disabled={isPending}>
            <Plus className="h-4 w-4" />
            {isPending ? t("common:buttons.creating") : t("food:createAndAdd")}
          </Button>
        </div>
      </form>
    </div>
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

function MacroInput({ label, value, onChange, tone }: { label: string; value: string; onChange: (value: string) => void; tone: "green" | "amber" | "blue" }) {
  const toneClass = tone === "green" ? "text-primary" : tone === "amber" ? "text-[#d99535]" : "text-[#3976b9]";
  return (
    <div className="space-y-2">
      <label className={`text-sm font-semibold ${toneClass}`}>{label}</label>
      <Input type="number" step="0.1" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" />
      <p className="text-xs text-muted-foreground">g</p>
    </div>
  );
}

export default function CreateFoodPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[640px] space-y-4 px-4 py-6">
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-3xl bg-muted" />
          <div className="h-48 animate-pulse rounded-3xl bg-muted" />
        </div>
      }
    >
      <CreateFoodContent />
    </Suspense>
  );
}
