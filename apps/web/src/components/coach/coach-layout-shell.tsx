"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { CoachSidebar } from "@/components/coach/coach-sidebar";

export function CoachLayoutShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("coach");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-6">
          <Link
            href="/coach"
            className="text-base font-light tracking-[0.3em] text-foreground transition-all duration-300 hover:opacity-60"
          >
            OH COACH
          </Link>
          <Link
            href="/hub"
            className="text-sm font-light text-neutral-500 transition-all duration-300 hover:text-foreground"
          >
            {t("backToApp")}
          </Link>
        </div>
      </header>
      <div className="flex">
        <CoachSidebar />
        <main className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
