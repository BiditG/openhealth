"use client";

import { Check, X, Cloud, Server, HeartPulse } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SiteNav } from "@/components/layout/site-nav";
import Link from "next/link";
import { ProPlans } from "@/components/pro/pro-plans";

type FeatureValue = boolean | string;

interface FeatureRow {
  key: string;
  free: FeatureValue;
  pro: FeatureValue;
  selfHosted: FeatureValue;
}

const featureRows: FeatureRow[] = [
  { key: "foodDiary", free: true, pro: true, selfHosted: true },
  { key: "foodSearch", free: true, pro: true, selfHosted: true },
  { key: "weightTracking", free: true, pro: true, selfHosted: true },
  { key: "waterTracking", free: true, pro: true, selfHosted: true },
  { key: "sleepTracking", free: true, pro: true, selfHosted: true },
  { key: "aiOcr", free: "3/day", pro: "unlimited", selfHosted: true },
  { key: "aiEstimate", free: "3/day", pro: "unlimited", selfHosted: true },
  { key: "aiChat", free: "10/day", pro: "100/day", selfHosted: true },
  { key: "micronutrients", free: false, pro: true, selfHosted: true },
  { key: "exercise", free: false, pro: true, selfHosted: true },
  { key: "fasting", free: false, pro: true, selfHosted: true },
  { key: "progressPhotos", free: false, pro: true, selfHosted: true },
  { key: "exportData", free: false, pro: true, selfHosted: true },
  { key: "savedMeals", free: false, pro: true, selfHosted: true },
];

function FeatureCell({ value, t }: { value: FeatureValue; t: (key: string) => string }) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-primary" strokeWidth={2} />;
  }
  if (value === false) {
    return <X className="h-4 w-4 text-neutral-300 dark:text-neutral-600 mx-auto" strokeWidth={2} />;
  }
  if (value === "unlimited") {
    return <span className="text-xs font-medium text-primary">{t("features.unlimited")}</span>;
  }
  // e.g. "3/day", "10/day", "100/day"
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export function PricingContent() {
  const { t } = useTranslation("pricing");

  return (
    <div className="premium-page-bg min-h-screen text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-28">
        {/* Header */}
        <div className="mb-16 space-y-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("title")}
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <ProPlans showDemoLink />

        {/* 3-Column Plans */}
        <div className="mx-auto my-20 grid max-w-5xl gap-5 md:grid-cols-3">
          {/* Free */}
          <div className="space-y-6 rounded-2xl border border-border bg-white p-8 dark:bg-card">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Cloud className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("free.badge")}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold">{t("free.price")}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("free.description")}
              </p>
            </div>

            <Link
              href="/hub"
              className="flex min-h-10 w-full items-center justify-center rounded-lg border border-border py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {t("free.cta")}
            </Link>
          </div>

          {/* Pro — highlighted */}
          <div className="relative space-y-6 rounded-2xl border border-primary bg-white p-8 dark:bg-card">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
                {t("pro.popular")}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <HeartPulse className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span className="text-xs font-semibold uppercase text-primary">
                  {t("pro.badge")}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold">Rs. 199</span>
                <span className="text-sm text-muted-foreground">
                  / month
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("pro.description")}
              </p>
            </div>

            <Link
              href="/hub"
              className="flex min-h-10 w-full items-center justify-center rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#125745]"
            >
              {t("pro.cta")}
            </Link>
          </div>

          {/* Self-Hosted — coming soon */}
          <div className="relative space-y-6 rounded-2xl border border-border bg-white p-8 dark:bg-card">
            <div className="absolute -top-3 right-6">
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {t("selfHosted.comingSoon")}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Server className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("selfHosted.badge")}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold">{t("selfHosted.price")}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("selfHosted.description")}
              </p>
            </div>

            <button
              disabled
              className="flex min-h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-border py-2 text-sm text-muted-foreground"
            >
              {t("selfHosted.comingSoon")}
            </button>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-xl font-semibold">
            {t("features.title")}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-[40%] py-4 pr-4 text-left font-medium text-muted-foreground" />
                  <th className="w-[20%] px-4 py-4 text-center font-medium text-muted-foreground">
                    {t("free.badge")}
                  </th>
                  <th className="w-[20%] px-4 py-4 text-center font-semibold text-primary">
                    {t("pro.badge")}
                  </th>
                  <th className="w-[20%] px-4 py-4 text-center font-medium text-muted-foreground">
                    {t("selfHosted.badge")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-border"
                  >
                    <td className="py-3.5 pr-4">
                      {t(`features.${row.key}`)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <FeatureCell value={row.free} t={t} />
                    </td>
                    <td className="bg-muted/50 px-4 py-3.5 text-center">
                      <FeatureCell value={row.pro} t={t} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <FeatureCell value={row.selfHosted} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ / Bottom */}
        <div className="mt-20 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("faq.openSource")}
          </p>
          <Link
            href="/hub"
            className="inline-block text-sm font-medium text-primary transition-colors hover:text-[#125745]"
          >
            {t("faq.tryNow")}
          </Link>
        </div>
      </main>
    </div>
  );
}
