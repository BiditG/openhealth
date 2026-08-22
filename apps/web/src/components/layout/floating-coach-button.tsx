"use client";

import Link from "next/link";
import { HeartPulse, Sparkles } from "lucide-react";

export function FloatingCoachButton() {
  return (
    <Link
      href="/hub/chat"
      aria-label="Open AI Coach"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-14 items-center gap-2 rounded-full border border-[#20C7A4]/25 bg-white px-3.5 text-[#123F37] shadow-[0_14px_34px_rgba(18,63,55,0.18)] transition hover:-translate-y-0.5 hover:border-[#20C7A4]/45 lg:bottom-6 lg:right-6 lg:px-4"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF8F4]">
        <HeartPulse className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="hidden pr-1 text-sm font-black lg:inline">Coach</span>
      <Sparkles className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-[#20C7A4] p-1 text-[#123F37]" strokeWidth={2.4} />
    </Link>
  );
}
