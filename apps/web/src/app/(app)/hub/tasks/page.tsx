"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, Crown, Loader2, Search, Shield, Star, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";

type Metric = "overall" | "pushup" | "bicepCurl" | "pullup" | "squat";
type LeaderboardEntry = {
  userId: string;
  name: string | null;
  teamColor: string | null;
  points: number;
  score: number;
  todayPoints: number;
  rank: number;
  isCurrentUser: boolean;
  rankTitle: string;
  rankTier: number;
  eliteMedals: number;
};

const FILTERS: { value: Metric; label: string }[] = [
  { value: "overall", label: "All" },
  { value: "pushup", label: "Push-up" },
  { value: "bicepCurl", label: "Curl" },
  { value: "pullup", label: "Pull-up" },
  { value: "squat", label: "Squat" },
];

const PODIUM_ORDER = [2, 1, 3];
const SEASON_END = new Date("2026-09-30T23:59:59");

function initials(name?: string | null) {
  return (name ?? "OH")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function teamLabel(teamColor?: string | null) {
  if (teamColor === "red") return "Team Red";
  if (teamColor === "blue") return "Team Blue";
  return "OpenHealth";
}

function seasonCountdown() {
  const diff = Math.max(0, SEASON_END.getTime() - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return `${days}D ${hours}H`;
}

export default function LeaderboardPage() {
  const [metric, setMetric] = useState<Metric>("overall");
  const { data: leaderboard, isLoading } = trpc.tasks.getLeaderboard.useQuery({ metric });
  const { data: teamScores } = trpc.tasks.getTeamScores.useQuery();

  const entries = leaderboard ?? [];
  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);
  const currentUser = entries.find((entry) => entry.isCurrentUser) ?? null;
  const scoreLabel = metric === "overall" ? "pts" : "reps";

  const teamState = useMemo(() => {
    const red = teamScores?.teams.find((team) => team.teamColor === "red") ?? {
      teamColor: "red",
      label: "Team Red",
      points: 0,
      members: 0,
      completions: 0,
    };
    const blue = teamScores?.teams.find((team) => team.teamColor === "blue") ?? {
      teamColor: "blue",
      label: "Team Blue",
      points: 0,
      members: 0,
      completions: 0,
    };
    const leader = red.points >= blue.points ? red : blue;
    const gap = Math.abs(red.points - blue.points);
    return { red, blue, leader, gap };
  }, [teamScores]);

  const target = useMemo(() => {
    if (!currentUser) return "Complete a verified task to enter the table";
    const next = entries.find((entry) => Number(entry.rank) === Number(currentUser.rank) - 1);
    if (!next) return "Hold #1. Defend the crown.";
    return `${Math.max(1, Number(next.score) - Number(currentUser.score) + 1)} ${scoreLabel} to overtake #${next.rank}`;
  }, [currentUser, entries, scoreLabel]);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#20C7A4_0%,#75DEC9_42%,#F7FAF9_42%,#F7FAF9_100%)] text-foreground lg:bg-[linear-gradient(180deg,#20C7A4_0%,#75DEC9_36%,#F7FAF9_36%,#F7FAF9_100%)]">
      <div className="mx-auto w-full max-w-[440px] px-4 pb-6 pt-4 lg:max-w-[720px] lg:pt-6">
        <header className="flex h-11 items-center justify-between text-white">
          <Link href="/hub" className="inline-flex items-center gap-1 rounded-full py-2 pr-3 text-sm font-semibold text-white/82 transition hover:text-white" aria-label="Back to hub">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            Home
          </Link>
          <h1 className="text-lg font-black">Leaderboards</h1>
          <Link href="/hub/food/search" className="flex h-10 w-10 items-center justify-center rounded-full text-white/82 transition hover:bg-white/12 hover:text-white" aria-label="Search">
            <Search className="h-5 w-5" strokeWidth={2.2} />
          </Link>
        </header>

        <section className="pt-6">
          <div className="relative mx-auto flex min-h-[194px] max-w-[390px] items-end justify-center">
            <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 overflow-hidden rounded-b-[18px] rounded-t-[18px] bg-[#0F5A48] shadow-[0_18px_34px_rgba(13,79,64,0.22)]">
              <div className="h-[94px] bg-[#0D6C54]" />
              <div className="h-[130px] bg-[#157D61]" />
              <div className="h-[94px] bg-[#0D6C54]" />
            </div>

            <div className="relative z-10 grid w-full grid-cols-3 items-end px-2">
              {PODIUM_ORDER.map((rank) => {
                const entry = topThree.find((item) => item.rank === rank);
                return entry ? <PodiumSpot key={entry.userId} entry={entry} scoreLabel={scoreLabel} /> : <EmptyPodiumSpot key={rank} rank={rank} />;
              })}
            </div>
          </div>

          <div className="mx-auto mt-4 grid max-w-[390px] grid-cols-[1fr_54px_1fr] items-stretch gap-2 rounded-[20px] bg-white/18 p-2 text-white shadow-[0_12px_26px_rgba(13,79,64,0.12)] backdrop-blur">
            <TeamChip label="Red" score={teamState.red.points} active={teamState.leader.teamColor === "red"} tone="red" />
            <div className="flex min-w-0 flex-col items-center justify-center rounded-2xl bg-white/16 px-1 text-center">
              <p className="text-sm font-black uppercase text-white">VS</p>
              <p className="mt-0.5 max-w-full truncate text-[9px] font-black uppercase text-white/62">{seasonCountdown()}</p>
            </div>
            <TeamChip label="Blue" score={teamState.blue.points} active={teamState.leader.teamColor === "blue"} tone="blue" />
          </div>
        </section>

        <section className="mt-5 rounded-[22px] border border-white/80 bg-white p-3 shadow-[0_18px_42px_rgba(23,32,30,0.14)] lg:p-4">
          <div className="flex gap-1 overflow-x-auto rounded-2xl bg-[#0F5A48] p-1 scrollbar-hide">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMetric(item.value)}
                className={cn(
                  "min-h-10 shrink-0 rounded-xl px-4 text-xs font-black transition",
                  metric === item.value ? "bg-[#20C7A4] text-white shadow-[0_6px_16px_rgba(32,199,164,0.24)]" : "text-white/88 hover:bg-white/10"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 divide-y divide-border">
            {rest.map((entry) => (
              <RankRow key={entry.userId} entry={entry} scoreLabel={scoreLabel} />
            ))}
            {!entries.length && (
              <div className="px-2 py-8 text-center">
                <Trophy className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-3 text-sm font-bold text-muted-foreground">
                  No ranks yet. Complete a verified task to become the first ranked member.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="mt-4 rounded-[20px] border border-[#BFE7D4] bg-white/92 p-4 shadow-[0_12px_30px_rgba(20,50,40,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Your Rank</p>
              <p className="mt-1 truncate text-lg font-black text-foreground">
                {currentUser ? `#${currentUser.rank} ${currentUser.name ?? "You"}` : "Unranked"}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{target}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Target className="h-5 w-5" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TeamChip({ label, score, active, tone }: { label: string; score: number; active: boolean; tone: "red" | "blue" }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border px-2 py-2.5 text-center shadow-[0_10px_22px_rgba(13,79,64,0.16)]",
        tone === "red"
          ? "border-red-200/70 bg-[linear-gradient(180deg,#F87171_0%,#DC2626_100%)]"
          : "border-blue-200/70 bg-[linear-gradient(180deg,#60A5FA_0%,#2563EB_100%)]",
        active && "ring-2 ring-white/80"
      )}
    >
      <div className="flex items-center justify-center gap-1">
        <Shield className="h-3.5 w-3.5 text-white/88" />
        <p className="text-[10px] font-black uppercase text-white/84">Team {label}</p>
      </div>
      <p className="mt-1 truncate text-xl font-black leading-none tabular-nums text-white">{score.toLocaleString()}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase text-white/72">{active ? "Leading" : "Chasing"}</p>
    </div>
  );
}

function PodiumSpot({ entry, scoreLabel }: { entry: LeaderboardEntry; scoreLabel: string }) {
  const isChampion = entry.rank === 1;
  return (
    <article className={cn("flex min-w-0 flex-col items-center text-center text-white", isChampion ? "pb-4" : "pb-3")}>
      {isChampion ? <Crown className="mb-1 h-9 w-9 fill-accent text-accent drop-shadow-sm" /> : <div className="h-7" />}
      <div className="relative">
        <Avatar name={entry.name} team={entry.teamColor} large={isChampion} />
        <span
          className={cn(
            "absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-black text-white shadow-sm",
            isChampion ? "h-7 w-7 bg-accent text-accent-foreground" : entry.rank === 2 ? "h-6 w-6 bg-[#3976B9]" : "h-6 w-6 bg-primary"
          )}
        >
          {entry.rank}
        </span>
      </div>
      <h2 className={cn("mt-4 w-full truncate px-1 font-black", isChampion ? "text-sm" : "text-xs")}>{entry.name ?? "OpenHealth"}</h2>
      <p className={cn("mt-1 font-black tabular-nums", isChampion ? "text-accent" : "text-primary")}>{Number(entry.score).toLocaleString()}</p>
      <p className="mt-0.5 w-full truncate px-1 text-[10px] font-semibold text-white/58">{scoreLabel} / {entry.rankTitle}</p>
    </article>
  );
}

function EmptyPodiumSpot({ rank }: { rank: number }) {
  return (
    <article className="flex min-w-0 flex-col items-center pb-4 text-center text-white/70">
      <div className="h-7" />
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/40 bg-white/14 text-lg font-black">
        {rank}
      </div>
      <p className="mt-4 text-xs font-black">Open spot</p>
      <p className="mt-1 text-xs font-black tabular-nums">0</p>
      <p className="mt-0.5 text-[10px] font-semibold text-white/50">complete a task</p>
    </article>
  );
}

function RankRow({ entry, scoreLabel }: { entry: LeaderboardEntry; scoreLabel: string }) {
  return (
    <div className={cn("grid grid-cols-[34px_46px_minmax(0,1fr)_auto] items-center gap-3 px-1 py-3.5", entry.isCurrentUser && "rounded-2xl bg-secondary px-2")}>
      <div className="relative flex h-8 w-8 items-center justify-center">
        <Star className="absolute h-8 w-8 fill-accent text-accent" strokeWidth={1.7} />
        <span className="relative text-[10px] font-black tabular-nums text-accent-foreground">{entry.rank}</span>
      </div>
      <Avatar name={entry.name} team={entry.teamColor} />
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-foreground">{entry.name ?? "OpenHealth"}</p>
        <p className="truncate text-xs font-semibold text-muted-foreground">{teamLabel(entry.teamColor)} • {entry.rankTitle}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black tabular-nums text-[#0F5A48]">{Number(entry.score).toLocaleString()}</p>
        <p className="text-[10px] font-black uppercase text-muted-foreground">{scoreLabel}</p>
      </div>
    </div>
  );
}

function Avatar({ name, team, large = false }: { name?: string | null; team?: string | null; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-[3px] font-black shadow-[0_8px_18px_rgba(15,90,72,0.18)]",
        large ? "h-[82px] w-[82px] text-2xl" : "h-11 w-11 text-sm",
        team === "red"
          ? "border-red-300 bg-red-600 text-white"
          : team === "blue"
            ? "border-[#3976B9] bg-[#3976B9] text-white"
            : "border-primary bg-[#123F37] text-white"
      )}
    >
      {initials(name)}
    </div>
  );
}
