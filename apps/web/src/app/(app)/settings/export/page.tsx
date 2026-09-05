"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  Dumbbell,
  Weight,
  Droplets,
  Timer,
  Scale,
  Footprints,
  Ruler,
  Armchair,
  ArrowLeft,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const EXPORT_CATEGORIES = [
  { key: "diary", labelKey: "common:hub.items.diary", icon: UtensilsCrossed },
  { key: "exercise", labelKey: "common:hub.items.exercise", icon: Dumbbell },
  { key: "workout", labelKey: "common:hub.items.workout", icon: Weight },
  { key: "weight", labelKey: "common:hub.items.weight", icon: Scale },
  { key: "body_measurements", labelKey: "settings:profilePage.bodyInfo", icon: Ruler },
  { key: "steps", labelKey: "common:hub.items.steps", icon: Footprints },
  { key: "water", labelKey: "common:hub.items.water", icon: Droplets },
  { key: "fasting", labelKey: "common:hub.items.fasting", icon: Timer },
  { key: "posture", labelKey: "common:hub.items.posture", icon: Armchair },
] as const;

export default function ExportPage() {
  const router = useRouter();
  const { t } = useTranslation(["settings", "common"]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === EXPORT_CATEGORIES.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(EXPORT_CATEGORIES.map((c) => c.key)));
    }
  };

  const [error, setError] = useState<string | null>(null);

  const downloadCsv = async (category: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/export?category=${category}`);
      if (!res.ok) return false;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const catItem = EXPORT_CATEGORIES.find((c) => c.key === category);
      a.download = `FitNMove_${catItem ? t(catItem.labelKey) : category}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 100);
      return true;
    } catch {
      return false;
    }
  };

  const downloadSelected = async () => {
    setDownloading("all");
    setError(null);
    const failed: string[] = [];
    try {
      const keys = Array.from(selected);
      for (let i = 0; i < keys.length; i++) {
        const success = await downloadCsv(keys[i]);
        if (!success) {
          const failedCat = EXPORT_CATEGORIES.find((c) => c.key === keys[i]);
          failed.push(failedCat ? t(failedCat.labelKey) : keys[i]);
        }
        // Delay between downloads so browser processes each one
        if (i < keys.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      if (failed.length > 0) {
        setError(t("settings:exportPage.exportFailed", { items: failed.join(", ") }));
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-light tracking-wide">{t("settings:export")}</h1>
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("settings:exportPage.description")}
      </p>

      <div className="flex items-center justify-between">
        <button
          onClick={selectAll}
          className="text-sm text-primary hover:underline"
        >
          {selected.size === EXPORT_CATEGORIES.length ? t("settings:exportPage.deselectAll") : t("settings:exportPage.selectAll")}
        </button>
        <span className="text-xs text-neutral-400">
          {t("settings:exportPage.selectedCount", { count: selected.size })}
        </span>
      </div>

      <div className="space-y-2">
        {EXPORT_CATEGORIES.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
              selected.has(key)
                ? "border-primary/30 bg-primary/5 dark:bg-primary/10"
                : "border-black/[0.06] dark:border-white/[0.06] hover:border-foreground/20"
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                selected.has(key)
                  ? "bg-primary/10 dark:bg-primary/20"
                  : "bg-neutral-100 dark:bg-neutral-800"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  selected.has(key)
                    ? "text-primary"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
                strokeWidth={1.5}
              />
            </div>
            <span
              className={`text-sm ${
                selected.has(key)
                  ? "text-foreground font-medium"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              {t(labelKey)}
            </span>
            <div className="ml-auto">
              <div
                className={`h-5 w-5 rounded-full border-2 transition-all flex items-center justify-center ${
                  selected.has(key)
                    ? "border-primary bg-primary"
                    : "border-neutral-300 dark:border-neutral-600"
                }`}
              >
                {selected.has(key) && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <Button
        onClick={downloadSelected}
        disabled={selected.size === 0 || downloading !== null}
        className="w-full"
        size="lg"
      >
        {downloading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t("settings:exportPage.exporting")}
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            {t("settings:exportPage.exportSelected", { count: selected.size })}
          </>
        )}
      </Button>
    </div>
  );
}
