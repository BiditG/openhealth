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
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em]",
        rank.toneClass,
        compact && "px-2 py-1 tracking-normal",
        className
      )}
      title={`Tier ${rank.tier}: ${rank.title}`}
    >
      <RankIcon rank={rank} className={compact ? "h-4 w-4" : "h-5 w-5"} />
      {showTitle ? rank.title : null}
    </span>
  );
}

export function RankIcon({ rank, className }: { rank: RankDefinition; className?: string }) {
  if (rank.key === "recruit") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <path d="M7 11l9 9 9-9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (rank.key === "cadet") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <path d="M7 8l9 8 9-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 15l9 8 9-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 26h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (rank.key === "sergeant") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <path d="M7 6l9 7 9-7M7 12l9 7 9-7M7 18l9 7 9-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 10.5l1.4 2.8 3.1.5-2.2 2.1.5 3.1-2.8-1.5-2.8 1.5.5-3.1-2.2-2.1 3.1-.5L16 10.5z" fill="currentColor" />
      </svg>
    );
  }
  if (rank.key === "captain") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <rect x="9" y="6" width="5" height="20" rx="1.5" fill="currentColor" />
        <rect x="18" y="6" width="5" height="20" rx="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (rank.key === "commander") {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
        <path d="M16 4l10 4v8c0 6-4.2 10.2-10 12-5.8-1.8-10-6-10-12V8l10-4z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        {[9, 12.5, 16, 19.5, 23].map((x, index) => (
          <path
            key={x}
            d={`M${x} 13l.8 1.5 1.7.3-1.2 1.1.3 1.7-1.6-.8-1.5.8.3-1.7-1.3-1.1 1.8-.3L${x} 13z`}
            fill="currentColor"
            transform={`translate(0 ${index % 2 ? 3 : 0})`}
          />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M6 18l-3 5 8-2M26 18l3 5-8-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4v16M12 8l8 8M20 8l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="15" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M13 14h.1M19 14h.1M13.5 19h5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
