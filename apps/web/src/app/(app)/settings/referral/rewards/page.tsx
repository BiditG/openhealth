"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { REFERRAL, REWARD_TYPES, REWARD_STATUSES } from "@open-health/shared/constants";
import { useTranslation } from "react-i18next";

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case REWARD_STATUSES.PENDING:
      return t("rewardsPage.pendingStatus");
    case REWARD_STATUSES.CONFIRMED:
      return t("rewardsPage.confirmedStatus");
    case REWARD_STATUSES.PAID:
      return t("rewardsPage.withdrawnStatus");
    case REWARD_STATUSES.CLAWED_BACK:
      return t("rewardsPage.clawedBackStatus");
    default:
      return status;
  }
}

function statusColor(status: string) {
  switch (status) {
    case REWARD_STATUSES.PENDING:
      return "text-amber-500";
    case REWARD_STATUSES.CONFIRMED:
      return "text-green-600";
    case REWARD_STATUSES.PAID:
      return "text-blue-500";
    case REWARD_STATUSES.CLAWED_BACK:
      return "text-red-500";
    default:
      return "text-neutral-400";
  }
}

export default function RewardsPage() {
  const { t } = useTranslation("settings");
  const { data: session, isPending: sessionLoading } = useSession();
  const isLoggedIn = !!session?.user;

  const { data: stats } = trpc.referral.getRewardStats.useQuery(undefined, {
    enabled: isLoggedIn,
  });
  const { data: history } = trpc.referral.getRewardHistory.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isLoggedIn }
  );

  const utils = trpc.useUtils();
  const payoutMutation = trpc.referral.requestPayout.useMutation({
    onSuccess: () => {
      utils.referral.getRewardStats.invalidate();
      utils.referral.getRewardHistory.invalidate();
    },
  });

  const [payoutError, setPayoutError] = useState("");

  const handlePayout = async () => {
    setPayoutError("");
    const result = await payoutMutation.mutateAsync({
      method: "subscription_credit",
    });
    if (!result.success) {
      setPayoutError(result.error);
    }
  };

  const canWithdraw =
    (stats?.withdrawableAmount ?? 0) >= REFERRAL.MIN_PAYOUT_CENTS;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings/referral"
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Link>
        <h1 className="text-xl font-light tracking-wide">{t("rewardsPage.title")}</h1>
      </div>

      {sessionLoading && (
        <div className="text-center text-sm text-neutral-400 py-8">
          {t("common:buttons.loading")}
        </div>
      )}

      {!sessionLoading && !isLoggedIn && (
        <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 text-center text-sm text-neutral-400">
          {t("rewardsPage.pleaseLogin")}
        </div>
      )}

      {isLoggedIn && stats && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <DollarSign className="h-3 w-3" strokeWidth={1.5} />
                <span>{t("rewardsPage.totalRevenue")}</span>
              </div>
              <p className="text-lg font-light">
                {formatUsd(
                  stats.totalPending + stats.totalConfirmed + stats.totalPaid
                )}
              </p>
            </div>
            <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <CheckCircle className="h-3 w-3" strokeWidth={1.5} />
                <span>{t("rewardsPage.withdrawable")}</span>
              </div>
              <p className="text-lg font-light">
                {formatUsd(stats.withdrawableAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock className="h-3 w-3" strokeWidth={1.5} />
                <span>{t("rewardsPage.pending")}</span>
              </div>
              <p className="text-lg font-light">
                {formatUsd(stats.totalPending)}
              </p>
            </div>
            <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <DollarSign className="h-3 w-3" strokeWidth={1.5} />
                <span>{t("rewardsPage.payingReferees")}</span>
              </div>
              <p className="text-lg font-light">
                {t("rewardsPage.personCount", { count: stats.payingRefereeCount })}
              </p>
            </div>
          </div>

          {/* Payout section */}
          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
              {t("rewardsPage.withdraw")}
            </p>
            <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 space-y-3">
              <p className="text-sm text-neutral-500">
                {t("rewardsPage.withdrawNote")}
              </p>
              <Button
                onClick={handlePayout}
                disabled={!canWithdraw || payoutMutation.isPending}
                className="w-full"
              >
                {payoutMutation.isPending
                  ? t("rewardsPage.processing")
                  : canWithdraw
                    ? t("rewardsPage.withdrawAmount", { amount: formatUsd(stats.withdrawableAmount) })
                    : t("rewardsPage.insufficientBalance")}
              </Button>
              {payoutError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {payoutError}
                </p>
              )}
              {payoutMutation.isSuccess && payoutMutation.data.success && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {t("rewardsPage.withdrawSubmitted")}
                </p>
              )}
            </div>
          </div>

          {/* History */}
          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
              {t("rewardsPage.rewardDetails")}
            </p>
            {history && history.length > 0 ? (
              <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
                {history.map((reward) => (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] px-1 py-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-light">
                        {reward.type === REWARD_TYPES.FREE_DAYS
                          ? t("rewardsPage.freeDays", { count: reward.freeDays ?? 0 })
                          : t("rewardsPage.revenueAmount", { amount: formatUsd(reward.amountNtd ?? 0) })}
                      </p>
                      {reward.subscriptionMonth && (
                        <p className="text-xs text-neutral-400">
                          {reward.subscriptionMonth}
                        </p>
                      )}
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className={`text-xs ${statusColor(reward.status)}`}>
                        {statusLabel(reward.status, t)}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {new Date(reward.createdAt).toLocaleDateString("en-US")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 dark:text-neutral-600">
                {t("rewardsPage.noRewards")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
