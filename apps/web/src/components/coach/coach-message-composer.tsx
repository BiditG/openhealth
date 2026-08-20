"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface CoachMessageComposerProps {
  clientId: string;
}

export function CoachMessageComposer({ clientId }: CoachMessageComposerProps) {
  const { t } = useTranslation("coach");
  const [content, setContent] = useState("");

  const utils = trpc.useUtils();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.coach.getClientMessages.useInfiniteQuery(
      { clientId, limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const sendMutation = trpc.coach.sendMessage.useMutation({
    onSuccess: () => {
      setContent("");
      toast.success(t("messages.sent"));
      utils.coach.getClientMessages.invalidate({ clientId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    sendMutation.mutate({ clientId, content: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = data?.pages.flatMap((p) => p.messages) ?? [];

  return (
    <div className="space-y-4">
      {/* Compose */}
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={1000}
          placeholder={t("messages.placeholder")}
          className="flex-1 rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-3 py-2 text-sm font-light placeholder:text-neutral-300 dark:placeholder:text-neutral-700 focus:outline-none focus:border-foreground/20 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sendMutation.isPending || !content.trim()}
          className="self-end rounded-lg border border-foreground/20 px-3 py-2 text-sm font-light transition-all hover:bg-foreground/5 disabled:opacity-50"
        >
          <Send className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-lg border border-black/[0.04] dark:border-white/[0.04] px-3 py-2"
            >
              <p className="text-sm font-light whitespace-pre-wrap">
                {msg.content}
              </p>
              <p className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-600">
                {new Date(msg.createdAt).toLocaleString("en-US", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {msg.readAt && (
                  <span className="ml-2 text-green-500/60">
                    {t("messages.read")}
                  </span>
                )}
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
                ? t("buttons.loading", { ns: "common" })
                : t("messages.viewAll")}
            </button>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <p className="text-xs text-neutral-400 font-light">
          {t("messages.noMessages")}
        </p>
      )}
    </div>
  );
}
