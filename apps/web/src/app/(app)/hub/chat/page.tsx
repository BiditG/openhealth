"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc-client";
import { createChatSession, deleteChatSession } from "@/server/actions/chat";
import { ArrowRight, Crown, HeartPulse, Loader2, Lock, Send, ShieldCheck, Trash2 } from "lucide-react";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";
import { VoiceInputButton } from "./voice-input-button";

const suggestedPrompts = [
  "Analyze my health status",
  "Ask me about my food details",
  "Build a simple plan for today",
  "How can I reduce weight safely?",
  "How do I gain muscle with Nepali food?",
  "Motivate me to stay consistent",
];

export default function ChatPage() {
  const { t } = useTranslation("ai");
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const utils = trpc.useUtils();

  const { data: sessionsData } = trpc.chat.listSessions.useQuery(undefined, {
    enabled: !!session?.user,
  });

  const { data: dailyUsage } = trpc.chat.getDailyUsage.useQuery(undefined, {
    enabled: !!session?.user,
  });

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" strokeWidth={1.8} />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Lock className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Sign in to ask about your health</h1>
        <p className="text-sm leading-6 text-muted-foreground">{t("loginRequired")}</p>
      </div>
    );
  }

  const isDailyLimitReached = dailyUsage && dailyUsage.used >= dailyUsage.limit;
  const dailyRemaining = dailyUsage ? dailyUsage.limit - dailyUsage.used : null;

  const handleSend = async (text: string) => {
    if (!text.trim() || isSending || isDailyLimitReached) return;
    setIsSending(true);
    setSendError(null);
    let newSession: { id: string };
    try {
      newSession = await createChatSession({
        title: text.slice(0, 50),
      });
    } catch {
      setIsSending(false);
      setSendError(t("cannotCreateChat"));
      return;
    }
    posthog.capture("chat_session_created");
    router.push(`/hub/chat/${newSession.id}?init=${encodeURIComponent(text)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteChatSession(id);
    utils.chat.listSessions.invalidate();
  };

  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-28 pt-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,760px)_300px] lg:gap-8 lg:pb-10 lg:pt-10">
      <div className="space-y-7">
        <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_24px_rgba(20,50,40,0.045)] sm:p-7 dark:bg-card">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-secondary text-primary">
              <HeartPulse className="h-7 w-7" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Wellness coach</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Your practical health coach.</h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                Ask for meal ideas, progress analysis, simple habits, motivation, or quick explanations in everyday language.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_4px_24px_rgba(20,50,40,0.045)] sm:p-6 dark:bg-card">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Quick questions</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={isSending || !!isDailyLimitReached}
                className="group flex min-h-24 items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4 text-left text-base font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary disabled:opacity-50"
              >
                <span>{prompt}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </button>
            ))}
          </div>

          {sendError && (
            <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {sendError}
            </p>
          )}

          {isDailyLimitReached ? (
            <div className="mt-5 rounded-2xl border border-border bg-background p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("dailyLimitReached", { limit: dailyUsage?.limit ?? 10 })}
              </p>
              <button
                onClick={() => setShowUpgrade(true)}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#d99535]"
              >
                <Crown className="h-4 w-4" />
                {t("upgradePro")}
              </button>
            </div>
          ) : (
            <ChatComposer input={input} setInput={setInput} isSending={isSending} onSubmit={handleSubmit} placeholder={t("inputPlaceholder")} />
          )}
        </section>

        <section className="rounded-3xl border border-border bg-secondary p-5">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.8} />
            <p className="text-sm leading-6 text-muted-foreground">
              General wellness information, not medical diagnosis. For urgent or personal medical concerns, contact a qualified clinician.
            </p>
          </div>
        </section>
      </div>

      <aside className="mt-6 space-y-4 lg:mt-0">
        <section className="rounded-3xl border border-border bg-white p-5 dark:bg-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Usage today</h2>
            {dailyRemaining !== null && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                {dailyRemaining} left
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Short questions work best. You can also tap the mic and speak naturally.</p>
        </section>

        {sessionsData && sessionsData.length > 0 && (
          <section className="rounded-3xl border border-border bg-white p-5 dark:bg-card">
            <h2 className="text-lg font-bold text-foreground">{t("chatHistory")}</h2>
            <div className="mt-4 space-y-1">
              {sessionsData.slice(0, 8).map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/hub/chat/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/hub/chat/${s.id}`);
                  }}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.title || t("newChat")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white hover:text-destructive"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
    </div>
  );
}

function ChatComposer({
  input,
  setInput,
  isSending,
  onSubmit,
  placeholder,
}: {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isSending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-5 flex items-center gap-3 rounded-[22px] border border-input bg-background p-2">
      <VoiceInputButton
        disabled={isSending}
        onTranscript={(text) => {
          setInput((current) => [current.trim(), text].filter(Boolean).join(" "));
        }}
      />
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder || "Ask anything about food or health..."}
        className="min-h-12 flex-1 bg-transparent text-base outline-none placeholder:text-[#929A96]"
        disabled={isSending}
      />
      <button
        type="submit"
        disabled={isSending || !input.trim()}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[#0D8064] disabled:opacity-40"
        aria-label="Send message"
      >
        {isSending ? (
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
        ) : (
          <Send className="h-5 w-5" strokeWidth={1.8} />
        )}
      </button>
    </form>
  );
}
