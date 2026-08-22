export type RankTier = 1 | 2 | 3 | 4 | 5 | 6;
export type RankKey = "recruit" | "cadet" | "sergeant" | "captain" | "commander" | "ghost_operator";

export type RankDefinition = {
  tier: RankTier;
  key: RankKey;
  title: string;
  pointsNeeded: number;
  colorName: string;
  toneClass: string;
  profileFrameClass: string;
  path: string;
};

export const RANKS: RankDefinition[] = [
  {
    tier: 1,
    key: "recruit",
    title: "Recruit",
    pointsNeeded: 0,
    colorName: "Tactical Gray",
    toneClass: "border-slate-300 bg-slate-100 text-slate-700",
    profileFrameClass: "border-slate-200",
    path: "Just sign up and get started at camp.",
  },
  {
    tier: 2,
    key: "cadet",
    title: "Cadet",
    pointsNeeded: 300,
    colorName: "Steel Blue",
    toneClass: "border-blue-300 bg-blue-50 text-blue-700",
    profileFrameClass: "border-blue-300",
    path: "Do steady daily tasks or a couple of medium challenges.",
  },
  {
    tier: 3,
    key: "sergeant",
    title: "Sergeant",
    pointsNeeded: 1500,
    colorName: "Army Green",
    toneClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
    profileFrameClass: "border-emerald-400",
    path: "Finish basic training and complete your first major missions.",
  },
  {
    tier: 4,
    key: "captain",
    title: "Captain",
    pointsNeeded: 5000,
    colorName: "Bronze / Copper",
    toneClass: "border-orange-300 bg-orange-50 text-orange-800",
    profileFrameClass: "border-orange-400",
    path: "Crush daily goals and complete high-point operations.",
  },
  {
    tier: 5,
    key: "commander",
    title: "Commander",
    pointsNeeded: 15000,
    colorName: "Polished Silver",
    toneClass: "border-slate-300 bg-white text-slate-800 shadow-[0_0_24px_rgba(148,163,184,0.35)]",
    profileFrameClass: "border-slate-300 shadow-[0_0_0_4px_rgba(226,232,240,0.9),0_0_28px_rgba(148,163,184,0.5)]",
    path: "Show serious discipline over months of tracking and hard challenges.",
  },
  {
    tier: 6,
    key: "ghost_operator",
    title: "Ghost Operator",
    pointsNeeded: 40000,
    colorName: "Midnight Black & Neon Red / Gold",
    toneClass: "border-red-400 bg-[#111111] text-amber-200 shadow-[0_0_30px_rgba(239,68,68,0.35)]",
    profileFrameClass: "border-red-400 shadow-[0_0_0_4px_rgba(251,191,36,0.3),0_0_35px_rgba(239,68,68,0.55)]",
    path: "The ultimate status for users finishing the toughest missions.",
  },
];

export function getRankForPoints(points: number | null | undefined) {
  const score = Number(points ?? 0);
  return [...RANKS].reverse().find((rank) => score >= rank.pointsNeeded) ?? RANKS[0];
}

export function getNextRank(points: number | null | undefined) {
  const score = Number(points ?? 0);
  return RANKS.find((rank) => score < rank.pointsNeeded) ?? null;
}

export function getRankProgress(points: number | null | undefined) {
  const score = Number(points ?? 0);
  const current = getRankForPoints(score);
  const next = getNextRank(score);
  if (!next) {
    return { current, next, progressPct: 100, pointsToNext: 0 };
  }
  const span = next.pointsNeeded - current.pointsNeeded;
  const gained = score - current.pointsNeeded;
  return {
    current,
    next,
    progressPct: Math.max(0, Math.min(100, Math.round((gained / span) * 100))),
    pointsToNext: Math.max(0, next.pointsNeeded - score),
  };
}

export function didRankUp(previousPoints: number, nextPoints: number) {
  return getRankForPoints(previousPoints).tier < getRankForPoints(nextPoints).tier;
}
