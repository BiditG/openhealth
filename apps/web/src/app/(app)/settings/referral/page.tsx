"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { useSession } from "@/lib/auth-client";
import { applyReferralCode, customizeReferralCode } from "@/server/actions/referral";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Check, Pencil, Users, Gift, ChevronRight, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

export default function ReferralPage() {
  const { t } = useTranslation(["settings", "common"]);
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const isLoggedIn = !!session?.user;

  const { data: codeData, refetch: refetchCode, isError: codeError } = trpc.referral.getMyCode.useQuery(
    undefined,
    { enabled: isLoggedIn }
  );
  const { data: stats, refetch: refetchStats } = trpc.referral.getStats.useQuery(
    undefined,
    { enabled: isLoggedIn }
  );

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [customError, setCustomError] = useState("");
  const [customLoading, setCustomLoading] = useState(false);

  const [referralInput, setReferralInput] = useState("");
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  const handleCopy = async () => {
    if (!codeData?.code) return;
    const shareText = `${t("referralPage.shareText")}\n\nhttps://openhealth.blog/?ref=${codeData.code}`;
    await navigator.clipboard.writeText(shareText);
    posthog.capture("referral_code_shared");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = codeData?.code
    ? `https://openhealth.blog/?ref=${codeData.code}`
    : "";

  const shareFullText = `${t("referralPage.shareText")}\n\n${shareUrl}`;

  const handleShareLink = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "FitNMove — Train, Move, Compete",
          text: t("referralPage.shareText"),
          url: shareUrl,
        });
        posthog.capture("referral_link_shared", { method: "native" });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareFullText);
      posthog.capture("referral_link_shared", { method: "clipboard" });
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleCustomize = async () => {
    if (!customCode.trim()) return;
    setCustomLoading(true);
    setCustomError("");
    try {
      const result = await customizeReferralCode({ code: customCode.trim() });
      if (result.success) {
        setEditing(false);
        setCustomCode("");
        refetchCode();
        router.refresh();
      } else {
        setCustomError(result.error || t("settings:referralPage.customFailed"));
      }
    } catch {
      setCustomError(t("settings:referralPage.customFailedRetry"));
    } finally {
      setCustomLoading(false);
    }
  };

  const handleApply = async () => {
    if (!referralInput.trim()) return;
    setApplyLoading(true);
    setApplyError("");
    setApplySuccess(false);
    try {
      const result = await applyReferralCode({ code: referralInput.trim() });
      if (result.success) {
        posthog.capture("referral_code_applied");
        setApplySuccess(true);
        setReferralInput("");
        refetchStats();
        router.refresh();
      } else {
        setApplyError(result.error || t("settings:referralPage.applyFailed"));
      }
    } catch {
      setApplyError(t("settings:referralPage.applyFailedRetry"));
    } finally {
      setApplyLoading(false);
    }
  };

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
        <h1 className="text-xl font-light tracking-wide">{t("settings:referral")}</h1>
      </div>

      {/* Auth guard */}
      {!sessionLoading && !isLoggedIn && (
        <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 text-center text-sm text-neutral-400">
          {t("referralPage.pleaseLogin")}
        </div>
      )}

      {sessionLoading && (
        <div className="text-center text-sm text-neutral-400 py-8">{t("common:buttons.loading")}</div>
      )}

      {isLoggedIn && (
      <>
      {/* My referral code */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("referralPage.myCode")}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-black/[0.06] dark:border-white/[0.06] px-4 py-3 text-center font-mono text-lg tracking-[0.2em]">
            {codeError ? t("referralPage.cannotLoad") : codeData?.code ?? t("common:buttons.loading")}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            disabled={!codeData?.code}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" strokeWidth={1.5} />
            ) : (
              <Copy className="h-4 w-4" strokeWidth={1.5} />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setEditing(!editing);
              setCustomCode(codeData?.code ?? "");
              setCustomError("");
            }}
          >
            <Pencil className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>

        {/* Share link button */}
        {codeData?.code && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleShareLink}
          >
            {linkCopied ? (
              <Check className="h-4 w-4 mr-2 text-green-500" strokeWidth={1.5} />
            ) : (
              <Share2 className="h-4 w-4 mr-2" strokeWidth={1.5} />
            )}
            {linkCopied ? t("referralPage.linkCopied") : t("referralPage.shareLink")}
          </Button>
        )}

        {editing && (
          <div className="space-y-2">
            <Input
              placeholder={t("settings:referralPage.customCodePlaceholder")}
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              maxLength={12}
            />
            {customError && (
              <p className="text-xs text-destructive">{customError}</p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCustomize}
                disabled={customLoading || !customCode.trim()}
              >
                {customLoading ? t("common:buttons.saving") : t("common:buttons.save")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setCustomError("");
                }}
              >
                {t("common:buttons.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Apply referral code (only if not already referred) */}
      {stats && !stats.wasReferred && !applySuccess && (
        <div className="space-y-3">
          <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
            {t("referralPage.enterReferralCode")}
          </p>
          <div className="flex gap-2">
            <Input
              placeholder={t("referralPage.enterFriendCode")}
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              maxLength={12}
            />
            <Button
              onClick={handleApply}
              disabled={applyLoading || !referralInput.trim()}
            >
              {applyLoading ? t("referralPage.submitting") : t("referralPage.submit")}
            </Button>
          </div>
          {applyError && (
            <p className="text-xs text-destructive">{applyError}</p>
          )}
        </div>
      )}

      {applySuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-300">
          {t("referralPage.referralSuccess")}
        </div>
      )}

      {stats?.wasReferred && !applySuccess && (
        <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-3 text-sm text-neutral-400">
          {t("referralPage.alreadyReferred")}
        </div>
      )}

      {/* Trial / Free days info */}
      {stats && (stats.totalFreeDaysEarned > 0 || stats.trialExpiresAt) && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-950/30 p-4 space-y-1">
          {stats.totalFreeDaysEarned > 0 && (
            <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t("referralPage.totalFreeDays", { count: stats.totalFreeDaysEarned })}
            </p>
          )}
          {stats.trialExpiresAt && new Date(stats.trialExpiresAt) > new Date() && (
            <p className="text-xs text-green-600 dark:text-green-400">
              {t("referralPage.trialExpires", { date: new Date(stats.trialExpiresAt).toLocaleDateString("en-US") })}
            </p>
          )}
        </div>
      )}

      {/* Rewards card */}
      <Link
        href="/settings/referral/rewards"
        className="flex items-center justify-between rounded-lg border border-black/[0.06] dark:border-white/[0.06] p-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      >
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t("settings:referralPage.revenueShare")}</p>
          <p className="text-xs text-neutral-400">
            {t("referralPage.revenueShareDesc")}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
      </Link>

      {/* Referral list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
            {t("referralPage.referralList")}
          </p>
          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <Users className="h-3 w-3" strokeWidth={1.5} />
            <span>{t("referralPage.personCount", { count: stats?.referralCount ?? 0 })}</span>
          </div>
        </div>

        {stats?.referralList && stats.referralList.length > 0 ? (
          <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
            {stats.referralList.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] px-1 py-3"
              >
                <div className="space-y-0.5">
                  <span className="text-sm font-light">{item.name}</span>
                  <span className={`block text-xs ${
                    item.status === "paid" ? "text-green-600" :
                    item.status === "trial" ? "text-amber-500" :
                    "text-neutral-400"
                  }`}>
                    {item.status === "paid" ? t("referralPage.paid") :
                     item.status === "trial" ? t("referralPage.trial") :
                     t("referralPage.registered")}
                  </span>
                </div>
                <span className="text-xs text-neutral-400">
                  {new Date(item.joinedAt).toLocaleDateString("en-US")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 dark:text-neutral-600">
            {t("referralPage.noReferrals")}
          </p>
        )}
      </div>
      </>
      )}
    </div>
  );
}
