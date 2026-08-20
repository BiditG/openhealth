"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc-client";
import { deleteChatSession } from "@/server/actions/chat";
import { ChatMessage } from "../chat-message";
import { VoiceInputButton } from "../voice-input-button";
import {
  Send,
  RotateCcw,
  Loader2,
  Bot,
  Plus,
  Trash2,
  ArrowLeft,
  Crown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Suspense } from "react";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import posthog from "posthog-js";

const MAX_USER_MESSAGES_PER_CONVERSATION = 5;
const quickPrompts = [
  "Analyze my health status",
  "Ask me what I ate today",
  "Give me one healthy habit for today",
  "Motivate me to stay on track",
];

function ChatDetail() {
  const { t } = useTranslation("ai");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();
  const [input, setInput] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const initSentRef = useRef(false);

  const sessionId = params.id;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ sessionId }),
      }),
    [sessionId]
  );

  const utils = trpc.useUtils();

  // Load existing messages for this session
  const { data: existingMessages, isLoading: isLoadingMessages } =
    trpc.chat.getMessages.useQuery(
      { sessionId },
      { enabled: !!session?.user }
    );

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!existingMessages) return [];
    return existingMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      parts: (msg.parts as UIMessage["parts"]) ?? [
        { type: "text" as const, text: msg.content },
      ],
    }));
  }, [existingMessages]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
  } = useChat({
    id: sessionId,
    transport,
    onFinish: () => {
      posthog.capture("chat_message_sent");
      utils.chat.getDailyUsage.invalidate();
      utils.chat.listSessions.invalidate();
    },
  });

  // Sync DB messages into useChat when they load
  const messagesSyncedRef = useRef(false);
  useEffect(() => {
    if (initialMessages.length > 0 && !messagesSyncedRef.current) {
      messagesSyncedRef.current = true;
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  const { data: dailyUsage } = trpc.chat.getDailyUsage.useQuery(undefined, {
    enabled: !!session?.user,
  });

  // Handle init message from search params (first message flow)
  const initMessage = searchParams.get("init");
  useEffect(() => {
    if (initMessage && !initSentRef.current && !isLoadingMessages) {
      initSentRef.current = true;
      sendMessage({ text: initMessage });
      // Clear the search param without adding to history
      router.replace(`/hub/chat/${sessionId}`, { scroll: false });
    }
  }, [initMessage, isLoadingMessages, sendMessage, router, sessionId]);

  const isLoading = status === "submitted" || status === "streaming";
  const hasError = status === "error";

  if (isPending || isLoadingMessages) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" strokeWidth={1.5} />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4 px-4">
        <Bot className="h-10 w-10 text-neutral-300 dark:text-neutral-700" strokeWidth={1.5} />
        <p className="text-sm font-light text-neutral-400">{t("loginRequired")}</p>
      </div>
    );
  }

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const isConversationLimitReached =
    userMessageCount >= MAX_USER_MESSAGES_PER_CONVERSATION;
  const isDailyLimitReached =
    dailyUsage && dailyUsage.used >= dailyUsage.limit;
  const dailyRemaining = dailyUsage
    ? dailyUsage.limit - dailyUsage.used
    : null;

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isDailyLimitReached) return;
    setInput("");
    sendMessage({ text });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleDelete = async () => {
    await deleteChatSession(sessionId);
    utils.chat.listSessions.invalidate();
    router.push("/hub/chat");
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Top bar */}
      <div className="border-b border-black/[0.06] dark:border-white/[0.06] px-4 py-2">
        <div className="mx-auto flex max-w-lg lg:max-w-3xl items-center justify-between">
          <button
            onClick={() => router.push("/hub/chat")}
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-light text-neutral-400 transition-all duration-300 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            {t("back")}
          </button>
          <div className="flex items-center gap-2">
            {dailyRemaining !== null && (
              <span className="text-xs font-light text-neutral-400">
                {t("dailyRemaining", { count: dailyRemaining })}
              </span>
            )}
            <button
              onClick={() => router.push("/hub/chat")}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-light text-neutral-400 transition-all duration-300 hover:text-foreground"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              {t("newChat")}
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 text-neutral-300 dark:text-neutral-700 transition-all duration-300 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg lg:max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-black/[0.06] px-4 py-4 dark:border-white/[0.06]">
              <p className="text-sm font-medium text-foreground">Start with a coaching question</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="rounded-xl border border-black/[0.06] px-3 py-2 text-left text-sm font-light text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary hover:text-foreground dark:border-white/[0.06]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.06]">
                <Bot className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.5} />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] px-4 py-2 text-sm font-light text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                {t("analyzing2")}
              </div>
            </div>
          )}

          {hasError && error && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-destructive/20">
                <Bot className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5} />
              </div>
              <div className="max-w-[85%] rounded-2xl border border-destructive/20 px-4 py-2 text-sm font-light text-destructive">
                {error.message?.includes("429")
                  ? t("dailyLimitError", { limit: dailyUsage?.limit ?? 100 })
                  : t("errorRetry")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06] bg-background px-4 py-3">
        <div className="mx-auto max-w-lg lg:max-w-3xl">
          {isConversationLimitReached || isDailyLimitReached ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-light text-neutral-400">
                {isDailyLimitReached
                  ? t("dailyLimitReached", { limit: dailyUsage?.limit ?? 10 })
                  : t("conversationLimitReached", { limit: MAX_USER_MESSAGES_PER_CONVERSATION })}
              </p>
              {isDailyLimitReached ? (
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="flex items-center gap-1.5 text-sm font-light text-amber-600 hover:text-amber-500 transition-colors"
                >
                  <Crown className="h-4 w-4" />
                  {t("upgradePro")}
                </button>
              ) : (
                <button
                  onClick={() => router.push("/hub/chat")}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-light border border-black/[0.06] dark:border-white/[0.06] rounded-lg transition-all duration-300 hover:border-foreground/20"
                >
                  <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                  {t("startNewChat")}
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <VoiceInputButton
                disabled={isLoading}
                onTranscript={(text) => {
                  setInput((current) => [current.trim(), text].filter(Boolean).join(" "));
                }}
              />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("inputPlaceholder")}
                className="flex-1 rounded-full border border-black/[0.06] dark:border-white/[0.06] bg-transparent px-4 py-2.5 text-sm font-light outline-none transition-all duration-300 focus:border-foreground/20 placeholder:text-neutral-400"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all duration-300 hover:opacity-80 disabled:opacity-30"
              >
                <Send className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </form>
          )}
          <p className="text-center text-[10px] font-light text-neutral-400 dark:text-neutral-600 mt-2">
            {t("disclaimer")}
          </p>
        </div>
      </div>

      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
    </div>
  );
}

export default function ChatDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" strokeWidth={1.5} />
        </div>
      }
    >
      <ChatDetail />
    </Suspense>
  );
}
