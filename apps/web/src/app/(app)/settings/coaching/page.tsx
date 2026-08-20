"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { connectToCoach, disconnectFromCoach } from "@/server/actions/coaching";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { User, X, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CoachingSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation(["settings", "common", "coach"]);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data: coaches, isLoading } = trpc.coach.getMyCoaches.useQuery();

  const { data: messagesData, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.coach.getMyMessages.useInfiniteQuery(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!coaches?.length,
      }
    );

  const { data: unreadData } = trpc.coach.getUnreadMessageCount.useQuery(
    undefined,
    { enabled: !!coaches?.length }
  );

  const utils = trpc.useUtils();
  const markReadMutation = trpc.coach.markMessagesRead.useMutation({
    onSuccess: () => {
      utils.coach.getUnreadMessageCount.invalidate();
      utils.coach.getMyMessages.invalidate();
    },
  });

  const messages = messagesData?.pages.flatMap((p) => p.messages) ?? [];
  const unreadIds = messages.filter((m) => !m.readAt).map((m) => m.id);

  // Auto-mark messages as read when they appear on screen
  useEffect(() => {
    if (unreadIds.length > 0) {
      markReadMutation.mutate({ messageIds: unreadIds });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.length]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      const result = await connectToCoach({ code: code.trim() });
      if (!result.success) {
        toast.error(result.error);
      } else {
        toast.success(t("settings:coachingPage.joinedCoach"));
        setCode("");
        router.refresh();
      }
    } catch {
      toast.error(t("common:toast.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (coachId: string) => {
    try {
      await disconnectFromCoach(coachId);
      toast.success(t("common:toast.deleteSuccess"));
      router.refresh();
    } catch {
      toast.error(t("common:toast.error"));
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-light tracking-wide">{t("settings:coaching")}</h1>

      {/* Connect form */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("settings:coachingPage.joinCoach")}
        </p>
        <form onSubmit={handleConnect} className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("settings:coachingPage.coachCodePlaceholder")}
            maxLength={12}
            className="flex-1 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-3 py-2.5 text-sm font-light font-mono tracking-widest placeholder:text-neutral-300 dark:placeholder:text-neutral-700 focus:outline-none focus:border-foreground/20"
          />
          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="rounded-lg border border-foreground/20 px-4 py-2.5 text-sm font-light transition-all hover:bg-foreground/5 disabled:opacity-50"
          >
            {submitting ? t("settings:coachingPage.joining") : t("settings:coachingPage.join")}
          </button>
        </form>
      </div>

      {/* My coaches */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
          {t("settings:coachingPage.linkedCoaches")}
        </p>

        {isLoading ? (
          <p className="text-sm text-neutral-400 py-4">{t("common:buttons.loading")}</p>
        ) : !coaches?.length ? (
          <p className="text-sm text-neutral-400 font-light py-4">
            {t("settings:coachingPage.noCoach")}
          </p>
        ) : (
          <div className="space-y-2">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="flex items-center justify-between rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.06]">
                    <User
                      className="h-5 w-5 text-neutral-400"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-light">{coach.coachName}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-600">
                      {t("settings:coachingPage.since", { date: coach.startDate })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(coach.coachId)}
                  className="rounded-lg p-2 text-neutral-400 transition-all hover:text-destructive hover:bg-destructive/10"
                  title={t("settings:coachingPage.unlink")}
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coach Messages */}
      {coaches && coaches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 dark:text-neutral-600">
              {t("coach:messages.coachMessage")}
            </p>
            {(unreadData?.count ?? 0) > 0 && (
              <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] text-white leading-none">
                {unreadData!.count}
              </span>
            )}
          </div>

          {messages.length === 0 ? (
            <p className="text-sm text-neutral-400 font-light py-4">
              {t("coach:messages.noMessages")}
            </p>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle
                      className="h-3.5 w-3.5 text-neutral-400"
                      strokeWidth={1.5}
                    />
                    <span className="text-xs text-neutral-400 dark:text-neutral-600">
                      {msg.coachName}
                    </span>
                    <span className="text-[10px] text-neutral-300 dark:text-neutral-700">
                      {new Date(msg.createdAt).toLocaleString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-light whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              ))}

              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full py-2 text-xs text-neutral-400 hover:text-foreground transition-colors"
                >
                  {isFetchingNextPage
                    ? t("common:buttons.loading")
                    : t("coach:messages.viewAll")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
