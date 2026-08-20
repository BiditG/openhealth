"use client";

import { Suspense, useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, Keyboard, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lookupOpenFoodFacts, createFoodFromBarcode } from "@/server/actions/barcode";
import { logFood } from "@/server/actions/diary";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

type Stage = "scanning" | "searching" | "edit" | "not_found";

function ScanContent() {
  const { t } = useTranslation(["food", "common"]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const meal = (searchParams.get("meal") || "snack") as
    | "breakfast"
    | "lunch"
    | "dinner"
    | "snack";

  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);
  const [stage, setStage] = useState<Stage>("scanning");
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [existingFoodId, setExistingFoodId] = useState<string | null>(null);
  const [offImageUrl, setOffImageUrl] = useState<string | undefined>();
  const utils = trpc.useUtils();

  // Form fields
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingSize, setServingSize] = useState("100");
  const [servingUnit, setServingUnit] = useState("g");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [sodium, setSodium] = useState("");
  const [sugar, setSugar] = useState("");
  const [fiber, setFiber] = useState("");
  const [saturatedFat, setSaturatedFat] = useState("");
  const [transFat, setTransFat] = useState("");
  const [cholesterol, setCholesterol] = useState("");

  const stopScanner = useCallback(async () => {
    try {
      const scanner = html5QrRef.current as { stop?: () => Promise<void>; clear?: () => void } | null;
      if (scanner) {
        if (scanner.stop) await scanner.stop();
        if (scanner.clear) scanner.clear();
      }
    } catch {
      // Scanner may already be stopped
    }
    html5QrRef.current = null;
  }, []);

  const handleBarcodeLookup = useCallback(
    async (code: string) => {
      setBarcode(code);
      setStage("searching");
      setError(null);
      await stopScanner();

      try {
        // 1. Check local DB first
        const localFood = await utils.food.getByBarcode.fetch({ barcode: code });
        if (localFood) {
          setExistingFoodId(localFood.id);
          setName(localFood.name);
          setBrand(localFood.brand || "");
          setServingSize(String(localFood.servingSize));
          setServingUnit(localFood.servingUnit);
          setCalories(String(localFood.calories));

          // Extract macros from nutrients
          const nutrientMap: Record<string, string> = {};
          if (localFood.nutrients) {
            for (const n of localFood.nutrients) {
              nutrientMap[n.name] = n.amount;
            }
          }
          setProtein(nutrientMap["Protein"] || "0");
          setFat(nutrientMap["Total Fat"] || "0");
          setCarbs(nutrientMap["Total Carbohydrate"] || "0");
          setFiber(nutrientMap["Dietary Fiber"] || "");
          setSugar(nutrientMap["Sugars"] || "");
          setSaturatedFat(nutrientMap["Saturated Fat"] || "");
          setTransFat(nutrientMap["Trans Fat"] || "");
          setCholesterol(nutrientMap["Cholesterol"] || "");
          setSodium(nutrientMap["Sodium"] || "");
          setStage("edit");
          return;
        }

        // 2. Query Open Food Facts
        const offResult = await lookupOpenFoodFacts(code);
        if (offResult.found) {
          setExistingFoodId(null);
          setName(offResult.name || "");
          setBrand(offResult.brand || "");
          setServingSize(String(offResult.servingSize || 100));
          setServingUnit(offResult.servingUnit || "g");
          setCalories(String(Math.round(offResult.calories || 0)));
          setProtein(String(Math.round((offResult.protein || 0) * 10) / 10));
          setFat(String(Math.round((offResult.fat || 0) * 10) / 10));
          setCarbs(String(Math.round((offResult.carbs || 0) * 10) / 10));
          setFiber(offResult.fiber != null ? String(Math.round(offResult.fiber * 10) / 10) : "");
          setSugar(offResult.sugar != null ? String(Math.round(offResult.sugar * 10) / 10) : "");
          setSaturatedFat(offResult.saturatedFat != null ? String(Math.round(offResult.saturatedFat * 10) / 10) : "");
          setTransFat(offResult.transFat != null ? String(Math.round(offResult.transFat * 10) / 10) : "");
          setCholesterol(offResult.cholesterol != null ? String(Math.round(offResult.cholesterol * 10) / 10) : "");
          setSodium(offResult.sodium != null ? String(Math.round(offResult.sodium * 10) / 10) : "");
          setOffImageUrl(offResult.imageUrl);
          setStage("edit");
          return;
        }

        // 3. Not found
        posthog.capture("barcode_not_found", { barcode: code });
        setStage("not_found");
      } catch {
        setError(t("food:lookupError"));
        setStage("not_found");
      }
    },
    [stopScanner, utils.food.getByBarcode]
  );

  // Start scanner
  useEffect(() => {
    if (stage !== "scanning" || !scannerRef.current) return;

    let cancelled = false;

    async function startScanner() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5Qrcode("barcode-scanner");
      html5QrRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!cancelled) {
              handleBarcodeLookup(decodedText);
            }
          },
          () => {
            // ignore scan failures (no code detected yet)
          }
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Camera start failed:", err);
          setShowManualInput(true);
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [stage, handleBarcodeLookup, stopScanner]);

  const handleReset = () => {
    setStage("scanning");
    setBarcode("");
    setManualBarcode("");
    setError(null);
    setExistingFoodId(null);
    setOffImageUrl(undefined);
    setShowManualInput(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualBarcode.trim();
    if (code) {
      handleBarcodeLookup(code);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        let foodId = existingFoodId;

        if (!foodId) {
          // Create new food from barcode data
          const result = await createFoodFromBarcode({
            barcode,
            name,
            brand: brand || undefined,
            servingSize: parseFloat(servingSize),
            servingUnit,
            calories: parseFloat(calories) || 0,
            protein: parseFloat(protein) || 0,
            fat: parseFloat(fat) || 0,
            carbs: parseFloat(carbs) || 0,
            fiber: fiber ? parseFloat(fiber) : undefined,
            sugar: sugar ? parseFloat(sugar) : undefined,
            saturatedFat: saturatedFat ? parseFloat(saturatedFat) : undefined,
            transFat: transFat ? parseFloat(transFat) : undefined,
            cholesterol: cholesterol ? parseFloat(cholesterol) : undefined,
            sodium: sodium ? parseFloat(sodium) : undefined,
            imageUrl: offImageUrl,
          });

          if (result.success && result.foodId) {
            foodId = result.foodId;
          }
        }

        if (foodId) {
          await logFood({
            date,
            mealType: meal,
            foodId,
            servingQty: 1,
          });
          await utils.diary.getDay.invalidate();
          posthog.capture("food_logged", { source: "barcode", meal_type: meal, barcode, is_existing: !!existingFoodId, calories: parseFloat(calories) || 0 });
          toast.success(t("common:toast.addedToDiary"));
          router.push(`/hub/diary?date=${date}`);
          router.refresh();
        }
      } catch {
        toast.error(t("common:toast.saveFailed2"));
      }
    });
  };

  const handleCreateManual = () => {
    router.push(`/hub/food/create?date=${date}&meal=${meal}&barcode=${barcode}`);
  };

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <Link href={`/hub/food/search?date=${date}&meal=${meal}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <span className="text-sm font-medium text-muted-foreground">Back</span>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stage 1: Scanning */}
      {stage === "scanning" && (
        <div className="space-y-8">
          <section>
            <p className="text-sm font-semibold text-primary">Food scanner</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">What&apos;s on your plate?</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Scan a barcode and we&apos;ll pull nutrition details for your diary.
            </p>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-border bg-[#F1F6F3] p-4 shadow-[0_4px_24px_rgba(20,50,40,0.045)]">
            <div className="pointer-events-none absolute left-6 top-6 h-8 w-8 border-l-2 border-t-2 border-primary/60" />
            <div className="pointer-events-none absolute right-6 top-6 h-8 w-8 border-r-2 border-t-2 border-primary/60" />
            <div className="pointer-events-none absolute bottom-6 left-6 h-8 w-8 border-b-2 border-l-2 border-primary/60" />
            <div className="pointer-events-none absolute bottom-6 right-6 h-8 w-8 border-b-2 border-r-2 border-primary/60" />
            <div className="overflow-hidden rounded-[1.4rem] bg-white">
              <div
                id="barcode-scanner"
                ref={scannerRef}
                className="min-h-[360px] w-full"
              />
            </div>
          </section>

          <p className="text-center text-sm text-muted-foreground">{t("food:alignBarcodeHint")}</p>

          {/* Manual barcode input toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary"
            >
              <Keyboard className="h-4 w-4" />
              {t("food:manualBarcodeInput")}
            </button>
          </div>

          {showManualInput && (
            <form onSubmit={handleManualSubmit} className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-[1fr_auto] dark:bg-card">
              <Input
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder={t("food:barcodePlaceholder")}
                inputMode="numeric"
                autoFocus
              />
              <Button type="submit" disabled={!manualBarcode.trim()}>
                {t("food:query")}
              </Button>
            </form>
          )}
        </div>
      )}

      {/* Stage 2: Searching */}
      {stage === "searching" && (
        <div className="space-y-8">
          <section>
            <p className="text-sm font-semibold text-primary">Scanning</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">Looking at your meal...</h1>
          </section>
          <section className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-[#F1F6F3] shadow-[0_4px_24px_rgba(20,50,40,0.045)]">
            <div className="absolute inset-6 rounded-[1.4rem] border border-white bg-white/70" />
            <div className="absolute left-8 right-8 top-1/2 h-1 animate-pulse rounded-full bg-primary" />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-5 text-lg font-semibold text-foreground">Identifying foods...</p>
                <p className="mt-2 text-sm text-muted-foreground">{t("food:searchingBarcode", { barcode })}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Not found */}
      {stage === "not_found" && (
        <div className="space-y-6">
          <Card className="rounded-3xl">
            <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary text-primary">
                <Camera className="h-8 w-8" strokeWidth={1.8} />
              </div>
              <p className="text-2xl font-bold">{t("food:productNotFound")}</p>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                {t("food:barcodeNotFoundDesc", { barcode })}
              </p>
              <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t("food:rescan")}
                </Button>
                <Button onClick={handleCreateManual}>
                  {t("food:manualCreate")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stage 3: Edit & Confirm */}
      {stage === "edit" && (
        <div className="space-y-6">
          {existingFoodId && (
            <div className="rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-primary">
              {t("food:existsInLocal")}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("food:barcodeLabel")}: {barcode}</p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              {t("food:rescan")}
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Card className="overflow-hidden rounded-3xl">
              <div className="relative aspect-[4/3] bg-muted">
                {offImageUrl ? (
                  <img src={offImageUrl} alt={name || "Scanned food"} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center bg-secondary">
                    <div className="text-center text-primary">
                      <CheckCircle2 className="mx-auto h-14 w-14" strokeWidth={1.6} />
                      <p className="mt-4 text-lg font-bold">Here&apos;s what we found</p>
                    </div>
                  </div>
                )}
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Your {meal}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">{t("food:foodName")} *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("food:foodNamePlaceholder")}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">{t("food:brand")}</label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={t("common:labels.optional")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">{t("food:servingSizeLabel")} *</label>
                    <Input
                      type="number"
                      value={servingSize}
                      onChange={(e) => setServingSize(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">{t("food:unitLabel")} *</label>
                    <select
                      className="flex h-[50px] w-full rounded-xl border border-input bg-white px-4 py-3 text-base dark:bg-card"
                      value={servingUnit}
                      onChange={(e) => setServingUnit(e.target.value)}
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="oz">oz</option>
                      <option value="cup">cup</option>
                      <option value="piece">{t("common:units.pieces")}</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-2xl">Nutrition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2 text-center">
                  <label className="text-sm font-medium text-muted-foreground">{t("food:caloriesKcalRequired")} *</label>
                  <Input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="0"
                    required
                    className="mx-auto max-w-[180px] text-center text-4xl font-bold tabular-nums"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted p-4 text-center">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("common:macro.protein")}</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("common:macro.carbs")}</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("common:macro.fat")}</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="mt-5 border-t border-border pt-5">
                  <p className="text-xs text-muted-foreground mb-2">{t("common:labels.otherNutrients")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t("common:nutrientLabels.saturatedFat")} (g)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={saturatedFat}
                        onChange={(e) => setSaturatedFat(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t("common:nutrientLabels.transFat")} (g)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={transFat}
                        onChange={(e) => setTransFat(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t("common:nutrientLabels.sugar")} (g)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={sugar}
                        onChange={(e) => setSugar(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t("common:nutrientLabels.dietaryFiber")} (g)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={fiber}
                        onChange={(e) => setFiber(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t("common:nutrientLabels.sodium")} (mg)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={sodium}
                        onChange={(e) => setSodium(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">{t("common:nutrientLabels.cholesterol")} (mg)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={cholesterol}
                        onChange={(e) => setCholesterol(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border border-border bg-white/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 dark:bg-card/95">
              <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? t("common:buttons.creating") : existingFoodId ? t("food:confirmAndAdd") : t("food:saveAndAdd")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function ScanBarcodePage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-4 space-y-4">
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <ScanContent />
    </Suspense>
  );
}
