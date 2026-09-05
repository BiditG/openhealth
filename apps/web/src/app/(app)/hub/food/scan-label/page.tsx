"use client";

import { Suspense, useEffect, useState, useTransition, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Activity, ArrowLeft, Camera, Dumbbell, Leaf, RotateCcw, Loader2, ImageIcon, Route, Target } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recognizeNutritionLabel } from "@/server/actions/nutrition-label";
import { createCustomFood } from "@/server/actions/food";
import { logFood } from "@/server/actions/diary";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { NUTRIENT_IDS, DEFAULT_SERVING_SIZE } from "@open-health/shared/constants";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";
import { WorkoutAnalyzerMode } from "./workout-analyzer-mode";
import { MeditationMode } from "./meditation-mode";
import { VirtualGamesMode } from "./virtual-games-mode";
import { TrackExperience } from "../../track/track-experience";

function compressImage(dataUrl: string, maxWidth = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function InferredBadge() {
  return (
    <span className="ml-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
      AI inferred
    </span>
  );
}

function ScanLabelContent() {
  const { t } = useTranslation(["food", "common"]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const meal = (searchParams.get("meal") || "snack") as
    | "breakfast"
    | "lunch"
    | "dinner"
    | "snack";
  const requestedMode = searchParams.get("mode");
  const initialGame =
    requestedMode === "boxing" || requestedMode === "shadow-boxing"
      ? "boxing"
      : requestedMode === "football"
        ? "football"
        : requestedMode === "running" || requestedMode === "escape"
          ? "running"
          : requestedMode === "hero"
            ? "hero"
            : "cricket";
  const initialCricketMode =
    requestedMode === "fielding"
      ? "fielding"
      : requestedMode === "bowling"
        ? "bowling"
        : "batting";
  const initialMode: ExploreMode =
    requestedMode === "workout"
      ? "workout"
      : requestedMode === "track" || requestedMode === "run" || requestedMode === "walk"
        ? "track"
      : requestedMode === "meditation"
        ? "meditation"
        : requestedMode === "stretch" || requestedMode === "stretching"
          ? "stretch"
          : requestedMode === "games" ||
              requestedMode === "batting" ||
              requestedMode === "fielding" ||
              requestedMode === "bowling" ||
              requestedMode === "football" ||
              requestedMode === "running" ||
              requestedMode === "escape" ||
              requestedMode === "hero" ||
              requestedMode === "boxing" ||
              requestedMode === "shadow-boxing"
            ? "games"
            : "food";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ExploreMode>(initialMode);
  const [recentMode, setRecentMode] = useState<ExploreMode | null>(null);
  const [hasLoadedRecentMode, setHasLoadedRecentMode] = useState(false);
  const [stage, setStage] = useState<"capture" | "recognizing" | "edit">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("openhealth-explore-recent-mode") as ExploreMode | null;
      if (saved && exploreActivities.some((activity) => activity.mode === saved)) {
        setRecentMode(saved);
      }
    } catch {
      setRecentMode(null);
    } finally {
      setHasLoadedRecentMode(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRecentMode) return;
    try {
      window.localStorage.setItem("openhealth-explore-recent-mode", mode);
    } catch {
      // Recent shortcuts are helpful, but Explore should not depend on storage.
    }
  }, [hasLoadedRecentMode, mode]);

  // Form fields
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingSize, setServingSize] = useState(String(DEFAULT_SERVING_SIZE));
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
  const [calcium, setCalcium] = useState("");
  const [iron, setIron] = useState("");
  const [potassium, setPotassium] = useState("");
  const [vitaminA, setVitaminA] = useState("");
  const [vitaminC, setVitaminC] = useState("");
  const [vitaminD, setVitaminD] = useState("");
  const [notes, setNotes] = useState("");
  const [inferredFields, setInferredFields] = useState<Set<string>>(new Set());

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Create preview and compress
    const reader = new FileReader();
    reader.onerror = () => {
      setError(t("food:fileReadError"));
      setStage("capture");
    };
    reader.onload = async (event) => {
      const rawDataUrl = event.target?.result as string;
      const dataUrl = await compressImage(rawDataUrl);
      setImagePreview(dataUrl);
      setStage("recognizing");

      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64 = dataUrl.split(",")[1];

      try {
        const result = await recognizeNutritionLabel(base64);

        if (result.success) {
          const data = result.data;
          setName(data.foodName || "");
          setBrand(data.brand || "");
          setServingSize(String(data.servingSize ?? DEFAULT_SERVING_SIZE));
          setServingUnit(data.servingUnit || "g");
          setCalories(String(data.calories || 0));
          setProtein(String(data.proteinG || 0));
          setCarbs(String(data.carbsG || 0));
          setFat(String(data.fatG || 0));
          setSodium(String(data.sodiumMg ?? ""));
          setSugar(String(data.sugarG ?? ""));
          setFiber(String(data.fiberG ?? ""));
          setSaturatedFat(String(data.saturatedFatG ?? ""));
          setTransFat(String(data.transFatG ?? ""));
          setCholesterol(String(data.cholesterolMg ?? ""));
          setCalcium(String(data.calciumMg ?? ""));
          setIron(String(data.ironMg ?? ""));
          setPotassium(String(data.potassiumMg ?? ""));
          setVitaminA(String(data.vitaminAMcg ?? ""));
          setVitaminC(String(data.vitaminCMg ?? ""));
          setVitaminD(String(data.vitaminDMcg ?? ""));
          setNotes(data.notes ?? "");
          // Map AI inferredFields to form field names
          const fieldMap: Record<string, string> = {
            calories: "calories", proteinG: "protein", fatG: "fat", carbsG: "carbs",
            fiberG: "fiber", sugarG: "sugar", saturatedFatG: "saturatedFat",
            transFatG: "transFat", cholesterolMg: "cholesterol", sodiumMg: "sodium",
            calciumMg: "calcium", ironMg: "iron", potassiumMg: "potassium",
            vitaminAMcg: "vitaminA", vitaminCMg: "vitaminC", vitaminDMcg: "vitaminD",
          };
          setInferredFields(new Set(
            (data.inferredFields ?? []).map((f: string) => fieldMap[f] ?? f)
          ));
          posthog.capture("ai_food_photo_scanned", { success: true });
          setStage("edit");
        } else {
          posthog.capture("ai_food_photo_scanned", { success: false });
          setError(result.error || t("food:recognitionFailed"));
          setStage("capture");
        }
      } catch (err) {
        if (err instanceof Error && err.message === "AI_LIMIT_REACHED") {
          posthog.capture("ai_limit_reached", { feature: "food_photo_scan" });
          setShowUpgrade(true);
          setStage("capture");
        } else {
          setError(t("food:recognitionError"));
          setStage("capture");
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setStage("capture");
    setImagePreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation (replaces HTML5 native validation which is invisible in PWA)
    if (!name.trim()) {
      toast.error(t("food:foodName") + " " + t("common:validation.required", { defaultValue: "is required" }));
      return;
    }
    const parsedServing = parseFloat(servingSize);
    if (!parsedServing || parsedServing <= 0) {
      toast.error(t("food:servingSizeLabel") + " " + t("common:validation.mustBePositive", { defaultValue: "must be greater than 0" }));
      return;
    }
    const parsedCalories = parseFloat(calories);
    if (isNaN(parsedCalories) || parsedCalories < 0) {
      toast.error(t("food:caloriesKcalRequired") + " " + t("common:validation.mustBeNonNegative", { defaultValue: "must be 0 or greater" }));
      return;
    }

    startTransition(async () => {
      try {
        const nutrients: { nutrientId: number; amount: number }[] = [
          { nutrientId: NUTRIENT_IDS.protein, amount: parseFloat(protein) || 0 },
          { nutrientId: NUTRIENT_IDS.totalFat, amount: parseFloat(fat) || 0 },
          { nutrientId: NUTRIENT_IDS.totalCarbs, amount: parseFloat(carbs) || 0 },
        ];

        // Add optional nutrients if provided
        if (fiber) nutrients.push({ nutrientId: NUTRIENT_IDS.fiber, amount: parseFloat(fiber) });
        if (sugar) nutrients.push({ nutrientId: NUTRIENT_IDS.sugar, amount: parseFloat(sugar) });
        if (saturatedFat) nutrients.push({ nutrientId: NUTRIENT_IDS.saturatedFat, amount: parseFloat(saturatedFat) });
        if (transFat) nutrients.push({ nutrientId: NUTRIENT_IDS.transFat, amount: parseFloat(transFat) });
        if (cholesterol) nutrients.push({ nutrientId: NUTRIENT_IDS.cholesterol, amount: parseFloat(cholesterol) });
        if (sodium) nutrients.push({ nutrientId: NUTRIENT_IDS.sodium, amount: parseFloat(sodium) });
        if (calcium) nutrients.push({ nutrientId: NUTRIENT_IDS.calcium, amount: parseFloat(calcium) });
        if (iron) nutrients.push({ nutrientId: NUTRIENT_IDS.iron, amount: parseFloat(iron) });
        if (potassium) nutrients.push({ nutrientId: NUTRIENT_IDS.potassium, amount: parseFloat(potassium) });
        if (vitaminA) nutrients.push({ nutrientId: NUTRIENT_IDS.vitaminA, amount: parseFloat(vitaminA) });
        if (vitaminC) nutrients.push({ nutrientId: NUTRIENT_IDS.vitaminC, amount: parseFloat(vitaminC) });
        if (vitaminD) nutrients.push({ nutrientId: NUTRIENT_IDS.vitaminD, amount: parseFloat(vitaminD) });

        const result = await createCustomFood({
          name: name.trim(),
          brand: brand || undefined,
          description: notes || undefined,
          servingSize: parsedServing,
          servingUnit,
          calories: parsedCalories,
          nutrients,
        });

        if (result.success && result.foodId) {
          await logFood({
            date,
            mealType: meal,
            foodId: result.foodId,
            servingQty: 1,
          });
          await utils.diary.getDay.invalidate();
          posthog.capture("food_logged", { source: "food_photo_scan", meal_type: meal, calories: parseFloat(calories) });
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

  const hour = new Date().getHours();
  const recommendedMode: ExploreMode =
    recentMode && recentMode !== mode
      ? recentMode
      : hour >= 17
        ? "track"
        : hour < 11
          ? "food"
          : "workout";
  const recommendedActivity = exploreActivities.find((activity) => activity.mode === recommendedMode) ?? exploreActivities[0];
  const RecommendedIcon = recommendedActivity.icon;
  const recommendationText =
    recommendedMode === "track"
      ? "20-minute evening walk"
      : recentMode && recentMode !== mode
        ? `Continue ${recommendedActivity.title}`
        : recommendedMode === "food"
          ? "Scan your first meal"
          : "Continue your workout";
  const openActivity = (nextMode: ExploreMode) => {
    if (nextMode === "workout") {
      router.push("/hub/workout");
      return;
    }
    setMode(nextMode);
    router.push(`/hub/food/scan-label?mode=${nextMode}`);
  };
  const focusedActivity =
    requestedMode && mode !== "food"
      ? exploreActivities.find((activity) => activity.mode === mode)
      : null;

  if (focusedActivity) {
    return (
      <div className="px-4 py-4">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setMode("food");
              router.push("/hub/food/scan-label");
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1A4D40] bg-[#0B2C24] text-[#B8F34A] shadow-sm"
            aria-label="Back to activities"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-black leading-tight text-[#F4F8F5]">{focusedActivity.title}</h1>
            <p className="mt-1 text-sm leading-5 text-[#C0D1CA]">{focusedActivity.description}</p>
          </div>
        </div>

        {mode === "workout" && <WorkoutAnalyzerMode />}
        {mode === "track" && <TrackExperience />}
        {mode === "meditation" && <MeditationMode />}
        {mode === "games" && <VirtualGamesMode initialGame={initialGame} initialCricketMode={initialCricketMode} />}
        {mode === "stretch" && (
          <section className="space-y-4 rounded-[24px] border border-[#1A4D40] bg-[#0B2C24]/90 p-5 shadow-sm backdrop-blur">
            <div>
              <p className="text-xl font-black text-[#F4F8F5]">Mobility & recovery</p>
              <p className="mt-1 text-sm leading-5 text-[#C0D1CA]">
                Pick a light routine to loosen up and recover.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {stretchRoutines.map((routine) => (
                <button
                  key={routine.title}
                  type="button"
                  onClick={() => toast.success(`${routine.title} selected. Start gently and breathe steadily.`)}
                  className="min-h-[132px] rounded-[18px] border border-[#1A4D40] bg-[#10372D] p-4 text-left transition hover:border-[#B8F34A]/55 hover:bg-[#16453A]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#07251E] text-[#B8F34A]">
                    <Activity className="h-6 w-6" />
                  </span>
                  <span className="mt-4 block text-base font-black text-[#F4F8F5]">{routine.title}</span>
                  <span className="mt-1 block text-xs font-bold text-[#B8F34A]">{routine.duration}</span>
                  <span className="mt-1 block text-sm leading-5 text-[#C0D1CA]">{routine.detail}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <section className="mb-4 rounded-[24px] border border-[#1A4D40] bg-[#0B2C24]/90 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[24px] font-black leading-tight text-[#F4F8F5]">Explore</h1>
            <p className="mt-1 text-sm leading-5 text-[#C0D1CA]">
              Choose how you want to move, eat or recharge.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openActivity(recommendedMode)}
            className="flex min-h-[78px] items-center gap-3 rounded-[18px] border border-[#35D39A]/20 bg-[#10372D] px-4 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:border-[#B8F34A]/60 hover:bg-[#16453A]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#07251E] text-[#B8F34A]">
              <RecommendedIcon className="h-7 w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-[#35D39A]">Recommended for you</span>
              <span className="mt-1 block truncate text-sm font-black text-[#F4F8F5]">{recommendationText}</span>
            </span>
          </button>
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-[#8BA59B]">Or choose an activity</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {exploreActivities.map((activity) => {
            const Icon = activity.icon;
            const isActive = mode === activity.mode;
            return (
              <button
                key={activity.mode}
                type="button"
                onClick={() => openActivity(activity.mode)}
                className={`min-h-[126px] rounded-[18px] border p-4 text-left transition ${
                  isActive
                    ? "border-[#B8F34A] bg-[#10372D] shadow-[0_12px_28px_rgba(184,243,74,0.12)]"
                    : "border-[#1A4D40] bg-[#0B2C24]/82 hover:border-[#35D39A]/45 hover:bg-[#16453A]"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className={`flex h-[52px] w-[52px] items-center justify-center rounded-[16px] ${isActive ? "bg-[#B8F34A] text-[#041A15]" : "bg-[#10372D] text-[#8BA59B]"}`}>
                    <Icon className="h-7 w-7" />
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-[#B8F34A] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#041A15]">
                      Active
                    </span>
                  )}
                </span>
                <span className="mt-4 block text-base font-black text-[#F4F8F5]">{activity.title}</span>
                <span className="mt-1 block text-sm leading-5 text-[#C0D1CA]">{activity.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      {mode === "workout" && <WorkoutAnalyzerMode />}
      {mode === "track" && <TrackExperience />}
      {mode === "meditation" && <MeditationMode />}
      {mode === "games" && <VirtualGamesMode initialGame={initialGame} initialCricketMode={initialCricketMode} />}
      {mode === "stretch" && (
        <section className="space-y-4 rounded-[24px] border border-[#1A4D40] bg-[#0B2C24]/90 p-5 shadow-sm backdrop-blur">
          <div>
            <p className="text-xl font-black text-[#F4F8F5]">Mobility & recovery</p>
            <p className="mt-1 text-sm leading-5 text-[#C0D1CA]">
              Pick a light routine to loosen up and recover.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {stretchRoutines.map((routine) => (
              <button
                key={routine.title}
                type="button"
                onClick={() => toast.success(`${routine.title} selected. Start gently and breathe steadily.`)}
                className="min-h-[132px] rounded-[18px] border border-[#1A4D40] bg-[#10372D] p-4 text-left transition hover:border-[#B8F34A]/55 hover:bg-[#16453A]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#07251E] text-[#B8F34A]">
                  <Activity className="h-6 w-6" />
                </span>
                <span className="mt-4 block text-base font-black text-[#F4F8F5]">{routine.title}</span>
                <span className="mt-1 block text-xs font-bold text-[#B8F34A]">{routine.duration}</span>
                <span className="mt-1 block text-sm leading-5 text-[#C0D1CA]">{routine.detail}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {mode === "food" && (
        <>
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stage 1: Capture */}
      {stage === "capture" && (
        <div className="space-y-4">
          {/* Hidden camera input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          {/* Hidden gallery input (no capture attribute) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                {t("food:takePhotoOfLabel")}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                {t("food:takePhoto")}
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                <ImageIcon className="h-4 w-4" />
                {t("food:chooseFromGallery")}
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stage 2: Recognizing */}
      {stage === "recognizing" && (
        <div className="space-y-4">
          {imagePreview && (
            <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-muted">
              <Image
                src={imagePreview}
                alt={t("food:labelPhotoAlt")}
                fill
                className="object-contain"
              />
            </div>
          )}
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("food:recognizing")}</p>
          </div>
        </div>
      )}

      {/* Stage 3: Edit & Confirm */}
      {stage === "edit" && (
        <div className="space-y-4 pb-32">
          <div className="flex items-center justify-between">
            {imagePreview && (
              <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-muted">
                <Image
                  src={imagePreview}
                  alt={t("food:labelPhotoAlt")}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              {t("food:retakePhoto")}
            </Button>
          </div>

          <form id="scan-label-form" onSubmit={handleSubmit} noValidate className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("common:labels.basicInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("food:foodName")} *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("food:foodNamePlaceholder")}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t("food:brand")}</label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={t("common:labels.optional")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("food:servingSizeLabel")} *</label>
                    <Input
                      type="number"
                      value={servingSize}
                      onChange={(e) => setServingSize(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("food:unitLabel")} *</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={servingUnit}
                      onChange={(e) => setServingUnit(e.target.value)}
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="oz">oz</option>
                      <option value="cup">cup</option>
                      <option value="bowl">bowl</option>
                      <option value="plate">plate</option>
                      <option value="serving">serving</option>
                      <option value="piece">{t("common:units.pieces")}</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("common:labels.nutritionInfoPerServing")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {t("food:caloriesKcalRequired")} *
                    {inferredFields.has("calories") && <InferredBadge />}
                  </label>
                  <Input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-blue-500">
                      {t("common:macro.protein")} (g)
                      {inferredFields.has("protein") && <InferredBadge />}
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-amber-500">
                      {t("common:macro.carbs")} (g)
                      {inferredFields.has("carbs") && <InferredBadge />}
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-rose-500">
                      {t("common:macro.fat")} (g)
                      {inferredFields.has("fat") && <InferredBadge />}
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-muted-foreground mb-2">{t("common:labels.otherNutrients")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.saturatedFat")} (g)
                        {inferredFields.has("saturatedFat") && <InferredBadge />}
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={saturatedFat}
                        onChange={(e) => setSaturatedFat(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.transFat")} (g)
                        {inferredFields.has("transFat") && <InferredBadge />}
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={transFat}
                        onChange={(e) => setTransFat(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.sugar")} (g)
                        {inferredFields.has("sugar") && <InferredBadge />}
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={sugar}
                        onChange={(e) => setSugar(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.dietaryFiber")} (g)
                        {inferredFields.has("fiber") && <InferredBadge />}
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={fiber}
                        onChange={(e) => setFiber(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.sodium")} (mg)
                        {inferredFields.has("sodium") && <InferredBadge />}
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={sodium}
                        onChange={(e) => setSodium(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.cholesterol")} (mg)
                        {inferredFields.has("cholesterol") && <InferredBadge />}
                      </label>
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

                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-muted-foreground mb-2">{t("common:labels.microNutrients")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.calcium")} (mg)
                        {inferredFields.has("calcium") && <InferredBadge />}
                      </label>
                      <Input type="number" step="0.1" value={calcium} onChange={(e) => setCalcium(e.target.value)} placeholder="-" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.iron")} (mg)
                        {inferredFields.has("iron") && <InferredBadge />}
                      </label>
                      <Input type="number" step="0.1" value={iron} onChange={(e) => setIron(e.target.value)} placeholder="-" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.potassium")} (mg)
                        {inferredFields.has("potassium") && <InferredBadge />}
                      </label>
                      <Input type="number" step="0.1" value={potassium} onChange={(e) => setPotassium(e.target.value)} placeholder="-" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.vitaminA")} (mcg)
                        {inferredFields.has("vitaminA") && <InferredBadge />}
                      </label>
                      <Input type="number" step="0.1" value={vitaminA} onChange={(e) => setVitaminA(e.target.value)} placeholder="-" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.vitaminC")} (mg)
                        {inferredFields.has("vitaminC") && <InferredBadge />}
                      </label>
                      <Input type="number" step="0.1" value={vitaminC} onChange={(e) => setVitaminC(e.target.value)} placeholder="-" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        {t("common:nutrientLabels.vitaminD")} (mcg)
                        {inferredFields.has("vitaminD") && <InferredBadge />}
                      </label>
                      <Input type="number" step="0.1" value={vitaminD} onChange={(e) => setVitaminD(e.target.value)} placeholder="-" />
                    </div>
                  </div>
                </div>

                {notes && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-muted-foreground mb-1">{t("common:labels.notes")}</p>
                    <p className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">{notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </form>

          <div className="fixed left-0 right-0 z-40 border-t bg-background p-4 bottom-[calc(4rem+env(safe-area-inset-bottom))]">
            <div className="max-w-lg lg:max-w-3xl mx-auto">
              <Button
                type="submit"
                form="scan-label-form"
                className="w-full"
                disabled={isPending}
                onTouchEnd={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
              >
                {isPending ? t("common:buttons.creating") : t("food:confirmAndAdd")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
        </>
      )}
    </div>
  );
}

type ExploreMode = "food" | "workout" | "track" | "meditation" | "games" | "stretch";

const exploreActivities: Array<{
  mode: ExploreMode;
  title: string;
  description: string;
  icon: typeof Camera;
}> = [
  { mode: "food", title: "Food Scan", description: "Check a meal or label", icon: Camera },
  { mode: "workout", title: "Workout", description: "Train with your coach", icon: Dumbbell },
  { mode: "meditation", title: "Meditation", description: "Relax & reset", icon: Leaf },
  { mode: "track", title: "Run / Walk", description: "Track distance & pace", icon: Route },
  { mode: "games", title: "Games", description: "Move, play & compete", icon: Target },
  { mode: "stretch", title: "Stretch", description: "Mobility & recovery", icon: Activity },
];

const stretchRoutines = [
  { title: "Morning Mobility", duration: "6 min", detail: "Neck rolls, shoulder circles, hip openers" },
  { title: "Post-Walk Reset", duration: "8 min", detail: "Calves, hamstrings, quads, glutes" },
  { title: "Desk Relief", duration: "5 min", detail: "Chest opener, upper back, wrists, hips" },
];

export default function ScanLabelPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-4 space-y-4">
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <ScanLabelContent />
    </Suspense>
  );
}
