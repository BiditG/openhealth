"use client";

import { ArrowLeft, Crown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Suspense } from "react";
import { trpc } from "@/lib/trpc-client";
import { useSession } from "@/lib/auth-client";
import { ProPlans } from "@/components/pro/pro-plans";

function SubscriptionContent() {
  const { t } = useTranslation("settings");
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const { data: subscription, isLoading } = trpc.subscription.getSubscription.useQuery(
    undefined,
    { enabled: !!session?.user }
  );
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Link>
        <h1 className="text-xl font-light tracking-wide">{t("subscription")}</h1>
      </div>

      {/* Success / Canceled banners */}
      {success && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-sm font-light text-green-700 dark:text-green-400">
            {t("subscriptionPage.successMessage")}
          </p>
        </div>
      )}
      {canceled && (
        <div className="rounded-lg border border-neutral-300/30 bg-neutral-100/50 dark:border-neutral-700/30 dark:bg-neutral-800/50 p-4">
          <p className="text-sm font-light text-neutral-500">
            {t("subscriptionPage.canceledMessage")}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-300" />
        </div>
      ) : isActive ? (
        /* --- Active subscription --- */
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium tracking-wide">Pro</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-light">
                <span className="text-neutral-500">{t("subscriptionPage.status")}</span>
                <span className="text-green-600 dark:text-green-400">
                  {subscription?.status === "trialing"
                    ? t("subscriptionPage.trialing")
                    : t("subscriptionPage.active")}
                </span>
              </div>
              {subscription?.currentPeriodEnd && (
                <div className="flex justify-between text-sm font-light">
                  <span className="text-neutral-500">
                    {subscription.cancelAtPeriodEnd
                      ? t("subscriptionPage.expiresOn")
                      : t("subscriptionPage.renewsOn")}
                  </span>
                  <span>
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            {subscription?.cancelAtPeriodEnd && (
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 font-light">
                {t("subscriptionPage.canceledNote")}
              </p>
            )}
          </div>
          <ProPlans compact />
        </div>
      ) : (
        /* --- Free plan / upgrade --- */
        <div className="space-y-6">
          {/* Current plan badge */}
          <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-5 space-y-1">
            <p className="text-xs tracking-[0.2em] uppercase text-neutral-400">
              {t("subscriptionPage.currentPlan")}
            </p>
            <p className="text-lg font-light">Free</p>
          </div>

          <ProPlans compact />
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-300" />
        </div>
      }
    >
      <SubscriptionContent />
    </Suspense>
  );
}
