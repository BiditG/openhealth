"use client";

import { getRankForPoints, type RankDefinition } from "@/lib/rank-system";
import { cn } from "@/lib/utils";

type RankBadgeProps = {
  points?: number | null;
  rank?: RankDefinition;
  compact?: boolean;
  showTitle?: boolean;
  className?: string;
};

export function RankBadge({ points, rank: providedRank, compact = false, showTitle = true, className }: RankBadgeProps) {
  const rank = providedRank ?? getRankForPoints(points ?? 0);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] shadow-sm",
        rankBadgeClass(rank),
        compact && "px-2.5 py-1 tracking-normal",
        className
      )}
      title={`Tier ${rank.tier}: ${rank.title}`}
    >
      <span className={cn("relative flex shrink-0 items-center justify-center", compact ? "h-5 w-5" : "h-6 w-6")}>
        <RankIcon rank={rank} className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      {showTitle ? rank.title : null}
    </span>
  );
}

function rankBadgeClass(rank: RankDefinition) {
  if (rank.key === "recruit") {
    return "border-slate-300 bg-[linear-gradient(135deg,#F8FAFC,#E2E8F0)] text-slate-700";
  }
  if (rank.key === "cadet") {
    return "border-sky-300 bg-[linear-gradient(135deg,#EFF6FF,#DBEAFE_48%,#BAE6FD)] text-sky-800 shadow-[0_8px_24px_rgba(14,165,233,0.14)]";
  }
  if (rank.key === "sergeant") {
    return "border-emerald-300 bg-[linear-gradient(135deg,#ECFDF5,#A7F3D0_54%,#34D399)] text-emerald-950 shadow-[0_8px_26px_rgba(16,185,129,0.18)]";
  }
  if (rank.key === "captain") {
    return "border-amber-300 bg-[linear-gradient(135deg,#FFF7ED,#FDBA74_42%,#B45309)] text-[#3B1D06] shadow-[0_10px_30px_rgba(180,83,9,0.22)]";
  }
  if (rank.key === "commander") {
    return "border-slate-300 bg-[linear-gradient(135deg,#FFFFFF,#E2E8F0_36%,#94A3B8_70%,#F8FAFC)] text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.9)_inset,0_12px_34px_rgba(100,116,139,0.28)]";
  }
  return "border-amber-300 bg-[linear-gradient(135deg,#080808,#1F2937_35%,#7F1D1D_70%,#F59E0B)] text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.35)_inset,0_0_34px_rgba(245,158,11,0.34),0_0_54px_rgba(220,38,38,0.22)]";
}

export function RankIcon({ rank, className }: { rank: RankDefinition; className?: string }) {
  const accent = rank.key === "ghost_operator" ? "#FDE68A" : rank.key === "captain" ? "#7C2D12" : "currentColor";
  const glow = rank.tier >= 5;
  if (rank.key === "recruit") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <path d="M16 4l10 5v7c0 6-4 10-10 12C10 26 6 22 6 16V9l10-5z" fill="url(#recruitFill)" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 13l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="recruitFill" x1="8" x2="24" y1="5" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0.9" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.18" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (rank.key === "cadet") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <path d="M16 3l10 5.2v8.2c0 5.7-4.1 9.7-10 11.6-5.9-1.9-10-5.9-10-11.6V8.2L16 3z" fill="#DBEAFE" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 11l7 5.8 7-5.8M9 17l7 5.8 7-5.8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 26h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (rank.key === "sergeant") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <path d="M16 3l10 5.2v8.2c0 5.7-4.1 9.7-10 11.6-5.9-1.9-10-5.9-10-11.6V8.2L16 3z" fill="#A7F3D0" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8.5 10.5l7.5 5.4 7.5-5.4M8.5 15.5l7.5 5.4 7.5-5.4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 8.2l1.5 3 3.4.5-2.5 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.5-2.3 3.4-.5 1.5-3z" fill="currentColor" />
      </svg>
    );
  }
  if (rank.key === "captain") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="#FDBA74" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 7l2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.7-5 2.7.9-5.5-4-3.9 5.6-.8L16 7z" fill={accent} />
        <path d="M9 25l-2.5 4 6.2-1.8M23 25l2.5 4-6.2-1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (rank.key === "commander") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        {glow && <circle cx="16" cy="16" r="14" fill="currentColor" opacity="0.12" />}
        <path d="M16 3l11 5v8.5c0 6.2-4.5 10.3-11 12.5C9.5 26.8 5 22.7 5 16.5V8l11-5z" fill="#F8FAFC" stroke="currentColor" strokeWidth="1.7" />
        <path d="M16 7l2.1 4.4 4.8.7-3.5 3.4.8 4.8-4.2-2.3-4.2 2.3.8-4.8-3.5-3.4 4.8-.7L16 7z" fill="currentColor" />
        <path d="M9 23h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#111827" stroke="#FBBF24" strokeWidth="1.7" />
      <path d="M16 4.5l2.6 7.6 8 .2-6.3 4.8 2.3 7.7-6.6-4.5-6.6 4.5 2.3-7.7-6.3-4.8 8-.2L16 4.5z" fill={accent} />
      <path d="M9 25.2l-2.7 4.2 6.7-1.9M23 25.2l2.7 4.2-6.7-1.9" stroke="#FBBF24" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 8.5v8.8" stroke="#111827" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
