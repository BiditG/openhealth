"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Crown, Loader2, Medal, Shield, Target, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";
import { RankIcon } from "@/components/ranks/rank-badge";
import { getRankForPoints } from "@/lib/rank-system";

type Metric = "overall" | "pushup" | "bicepCurl" | "pullup" | "squat" | "plank";
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

const FILTERS: { value: Metric; label: string; image: string; detail: string }[] = [
  { value: "overall", label: "All", image: "/Workout/leaderboard-banner.png", detail: "All verified points" },
  { value: "pushup", label: "Push-up", image: "/Workout/pushup.png", detail: "Chest, core, control" },
  { value: "bicepCurl", label: "Curl", image: "/Workout/bicep-curl.png", detail: "Arm strength reps" },
  { value: "pullup", label: "Pull-up", image: "/Workout/bicep-curl.png", detail: "Upper-body strength" },
  { value: "squat", label: "Squat", image: "/Workout/squat.png", detail: "Lower-body power" },
  { value: "plank", label: "Plank", image: "/Workout/plank.png", detail: "Core hold streaks" },
];

const PODIUM_ORDER = [2, 1, 3];
const SEASON_END = new Date("2026-09-30T23:59:59");

function initials(name?: string | null) {
  return (name ?? "FM")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function teamLabel(teamColor?: string | null) {
  if (teamColor === "red") return "Team Red";
  if (teamColor === "blue") return "Team Blue";
  return "FitNMove";
}

function seasonCountdown() {
  const diff = Math.max(0, SEASON_END.getTime() - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return `${days}D ${hours}H`;
}

export default function LeaderboardPage() {
  const [mounted, setMounted] = useState(false);
  const [metric, setMetric] = useState<Metric>("overall");
  const { data: leaderboard, isLoading } = trpc.tasks.getLeaderboard.useQuery({ metric });
  const { data: teamScores } = trpc.tasks.getTeamScores.useQuery();

  const entries = leaderboard ?? [];
  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);
  const currentUser = entries.find((entry) => entry.isCurrentUser) ?? null;
  const scoreLabel = metric === "overall" ? "pts" : "reps";
  const activeFilter = FILTERS.find((item) => item.value === metric) ?? FILTERS[0];
  const leaderName = entries[0]?.name ?? "Open spot";

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="premium-page-bg min-h-screen text-foreground">
      <div className="mx-auto w-full max-w-[460px] px-5 pb-10 pt-5 sm:px-6 lg:max-w-[980px] lg:px-8 lg:pb-12 lg:pt-8">
        <section className="relative overflow-hidden rounded-[30px] border border-white/40 bg-[#07110F] text-white shadow-[0_24px_60px_rgba(7,17,15,0.22)]">
          <div className="relative min-h-[430px] sm:min-h-[520px] lg:min-h-[620px]">
            <div className="absolute inset-0">
              <Image
                src="/Workout/leaderboard-banner.png"
                alt="FitNMove leaderboard banner"
                fill
                sizes="(min-width: 1024px) 980px, 100vw"
                className="object-cover object-center"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,15,0.28)_0%,rgba(7,17,15,0.08)_45%,rgba(7,17,15,0.62)_100%)]" />
            </div>

            <div className="relative z-10 flex h-full min-h-[430px] flex-col justify-between p-5 sm:min-h-[520px] sm:p-6 lg:min-h-[620px] lg:p-7">
            <header className="flex h-11 items-center justify-between">
              <Link href="/hub" className="inline-flex items-center gap-1 rounded-full bg-white/10 py-2 pl-2 pr-3 text-sm font-semibold text-white/88 backdrop-blur transition hover:bg-white/16 hover:text-white" aria-label="Back to hub">
                <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
                Home
              </Link>
              <h1 className="text-sm font-black uppercase tracking-[0.18em] text-white/82">Leaderboards</h1>
              <span className="h-10 w-[76px]" aria-hidden="true" />
            </header>

            <div className="grid grid-cols-3 gap-2">
              {[
                ["Leader", leaderName],
                ["Board", activeFilter.label],
                ["Season", seasonCountdown()],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-2xl border border-white/14 bg-[#07110F]/38 p-3 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">{label}</p>
                  <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
                </div>
              ))}
            </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[30px] border border-white bg-white p-7 shadow-[0_18px_50px_rgba(23,32,30,0.10)] sm:mt-8 sm:p-8 lg:mt-10 lg:p-10">
          <div className="flex items-center justify-between gap-4 px-1 sm:px-2 lg:px-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Top competitors</p>
              <h2 className="mt-1 text-xl font-black text-[#17201E]">TOP PERFORMER</h2>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#DDEAE5] bg-[#F7FAF9] px-3 py-1.5 text-xs font-black text-[#123F37]">
              <Medal className="h-3.5 w-3.5 text-primary" />
              {scoreLabel.toUpperCase()}
            </div>
          </div>

          <div className="relative mx-auto mt-10 flex min-h-[278px] max-w-[540px] items-end justify-center overflow-hidden rounded-[28px] px-3 pt-10 sm:mt-12">
            <motion.div
              aria-hidden="true"
              animate={{ opacity: [0.25, 0.5, 0.25], scale: [0.92, 1.05, 0.92] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-1/2 top-12 h-40 w-40 -translate-x-1/2 rounded-full bg-[#B8F34A]/20 blur-3xl"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-2 bottom-0 grid grid-cols-3 overflow-hidden rounded-[24px] border border-[#CFE8DF] bg-[#0F5A48] shadow-[0_24px_54px_rgba(13,79,64,0.22)]"
            >
              <div className="h-[112px] bg-[linear-gradient(180deg,#1B8E70,#0D6C54)]" />
              <div className="relative h-[154px] overflow-hidden bg-[linear-gradient(180deg,#D7FF8A,#20C7A4_40%,#157D61)]">
                <motion.span
                  aria-hidden="true"
                  animate={{ x: ["-140%", "160%"] }}
                  transition={{ duration: 2.9, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
                  className="absolute inset-y-0 w-12 rotate-12 bg-white/35 blur-md"
                />
              </div>
              <div className="h-[112px] bg-[linear-gradient(180deg,#1B8E70,#0D6C54)]" />
            </motion.div>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.12, delayChildren: 0.18 } },
              }}
              className="relative z-10 grid w-full grid-cols-3 items-end px-2"
            >
              {PODIUM_ORDER.map((rank) => {
                const entry = topThree.find((item) => item.rank === rank);
                return entry ? <PodiumSpot key={entry.userId} entry={entry} scoreLabel={scoreLabel} /> : <EmptyPodiumSpot key={rank} rank={rank} />;
              })}
            </motion.div>
          </div>

          <div className="mx-auto mt-9 grid max-w-[540px] grid-cols-[1fr_72px_1fr] items-stretch gap-3 rounded-[24px] border border-[#1A4D40] bg-[#07251E]/80 p-4 text-[#F4F8F5] sm:mt-10">
            <TeamChip label="Red" score={teamState.red.points} active={teamState.leader.teamColor === "red"} tone="red" />
            <div className="flex min-w-0 flex-col items-center justify-center rounded-2xl border border-[#35D39A]/15 bg-[#10372D] px-1 text-center shadow-sm">
              <p className="text-sm font-black uppercase text-[#B8F34A]">VS</p>
              <p className="mt-0.5 max-w-full truncate text-[9px] font-black uppercase text-[#C0D1CA]">{teamState.gap.toLocaleString()} gap</p>
            </div>
            <TeamChip label="Blue" score={teamState.blue.points} active={teamState.leader.teamColor === "blue"} tone="blue" />
          </div>
        </section>

        <section className="mt-6 rounded-[26px] border border-[#E3EAE7] bg-white p-5 shadow-[0_14px_36px_rgba(23,32,30,0.08)] sm:p-6 lg:p-8">
          <div className="mb-5 overflow-hidden rounded-[22px] border border-[#D7ECE5] bg-[#07110F]">
            <div className="grid min-h-[132px] grid-cols-[1fr_132px] items-stretch sm:grid-cols-[1fr_170px]">
              <div className="min-w-0 p-4 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20C7A4]">Active board</p>
                <h2 className="mt-2 truncate text-2xl font-black">{activeFilter.label}</h2>
                <p className="mt-1 text-xs font-semibold text-white/62">{activeFilter.detail}</p>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-white/42">{entries.length} ranked athletes</p>
              </div>
              <div className="relative min-h-[136px] overflow-hidden">
                <Image
                  src={activeFilter.image}
                  alt={`${activeFilter.label} leaderboard artwork`}
                  fill
                  sizes="132px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#07110F]/12" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto rounded-2xl border border-[#DDEAE5] bg-[#F7FAF9] p-2 scrollbar-hide">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={metric === item.value}
                onClick={() => setMetric(item.value)}
                className={cn(
                  "grid w-[92px] shrink-0 gap-1 overflow-hidden rounded-xl p-1 text-left text-xs font-black transition",
                  metric === item.value ? "bg-[#123F37] text-white shadow-[0_8px_20px_rgba(18,63,55,0.16)]" : "bg-white text-[#123F37] hover:bg-[#EAF8F4]"
                )}
              >
                <span className="relative h-12 overflow-hidden rounded-lg bg-black/20">
                  <Image src={item.image} alt="" fill sizes="86px" className="object-cover" />
                </span>
                <span className="truncate px-1 pb-0.5">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-[20px] border border-[#E3EAE7]">
            <div className="grid grid-cols-[48px_minmax(0,1fr)_80px] bg-[#F7FAF9] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              <span>Rank</span>
              <span>Athlete</span>
              <span className="text-right">Score</span>
            </div>
            <div className="divide-y divide-border bg-white">
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
          </div>
        </section>

        <aside className="mt-6 rounded-[22px] border border-[#BFE7D4] bg-white/92 p-5 shadow-[0_12px_30px_rgba(20,50,40,0.08)] backdrop-blur sm:p-6">
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
        "min-w-0 rounded-2xl border px-2 py-2.5 text-center shadow-sm transition",
        tone === "red"
          ? "border-[#FF5C68]/40 bg-[linear-gradient(180deg,rgba(255,92,104,0.22),rgba(11,44,36,0.96))] text-[#FFD9DD]"
          : "border-[#67B7E8]/40 bg-[linear-gradient(180deg,rgba(103,183,232,0.22),rgba(11,44,36,0.96))] text-[#D9F0FF]",
        active && "ring-2 ring-[#B8F34A]/70"
      )}
    >
      <div className="flex items-center justify-center gap-1">
        <Shield className="h-3.5 w-3.5" />
        <p className="text-[10px] font-black uppercase">Team {label}</p>
      </div>
      <p className="mt-1 truncate text-xl font-black leading-none tabular-nums text-[#F4F8F5]">{score.toLocaleString()}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase text-[#C0D1CA]">{active ? "Leading" : "Chasing"}</p>
    </div>
  );
}

function PodiumSpot({ entry, scoreLabel }: { entry: LeaderboardEntry; scoreLabel: string }) {
  const isChampion = entry.rank === 1;
  const rank = getRankForPoints(entry.points);
  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 32, scale: 0.92, filter: "blur(8px)" },
        show: {
          opacity: 1,
          y: isChampion ? [0, -8, 0] : 0,
          scale: 1,
          filter: "blur(0px)",
          transition: {
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
            y: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
          },
        },
      }}
      whileHover={{ y: -8, scale: 1.03 }}
      className={cn("flex min-w-0 flex-col items-center text-center text-white", isChampion ? "pb-4" : "pb-3")}
    >
      {isChampion ? (
        <motion.div
          animate={{ rotate: [-3, 3, -3], y: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Crown className="mb-1 h-9 w-9 fill-accent text-accent drop-shadow-[0_0_14px_rgba(184,243,74,0.42)]" />
        </motion.div>
      ) : (
        <div className="h-7" />
      )}
      <div className="relative">
        <Avatar name={entry.name} team={entry.teamColor} large={isChampion} />
        <span className={cn("absolute -right-2 -top-2 flex items-center justify-center rounded-full border border-white/70 bg-white shadow-[0_10px_24px_rgba(15,90,72,0.24)]", isChampion ? "h-9 w-9 text-amber-700" : "h-7 w-7 text-[#0F5A48]")}>
          <RankIcon rank={rank} className={isChampion ? "h-7 w-7" : "h-5 w-5"} />
        </span>
        <span
          className={cn(
            "absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-black text-white shadow-sm",
            isChampion ? "h-7 w-7 bg-accent text-accent-foreground" : entry.rank === 2 ? "h-6 w-6 bg-[#3976B9]" : "h-6 w-6 bg-primary"
          )}
        >
          {entry.rank}
        </span>
      </div>
      <h2 className={cn("mt-4 w-full truncate px-1 font-black", isChampion ? "text-sm" : "text-xs")}>{entry.name ?? "FitNMove"}</h2>
      <p className={cn("mt-1 font-black tabular-nums", isChampion ? "text-accent" : "text-primary")}>{Number(entry.score).toLocaleString()}</p>
      <p className="mt-0.5 w-full truncate px-1 text-[10px] font-semibold text-white/58">{scoreLabel} / {entry.rankTitle}</p>
    </motion.article>
  );
}

function EmptyPodiumSpot({ rank }: { rank: number }) {
  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 28, scale: 0.94 },
        show: { opacity: 1, y: 0, scale: 1 },
      }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-w-0 flex-col items-center pb-4 text-center text-white/70"
    >
      <div className="h-7" />
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/40 bg-white/14 text-lg font-black">
        {rank}
      </div>
      <p className="mt-4 text-xs font-black">Open spot</p>
      <p className="mt-1 text-xs font-black tabular-nums">0</p>
      <p className="mt-0.5 text-[10px] font-semibold text-white/50">complete a task</p>
    </motion.article>
  );
}

function RankRow({ entry, scoreLabel }: { entry: LeaderboardEntry; scoreLabel: string }) {
  const rank = getRankForPoints(entry.points);
  return (
    <div className={cn("grid grid-cols-[48px_46px_minmax(0,1fr)_84px] items-center gap-4 px-4 py-4 sm:px-5", entry.isCurrentUser && "bg-[#EAF8F4]")}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DDEAE5] bg-[#F7FAF9] text-[11px] font-black tabular-nums text-[#123F37]">
        #{entry.rank}
      </div>
      <div className="relative">
        <Avatar name={entry.name} team={entry.teamColor} />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white text-[#0F5A48] shadow-sm">
          <RankIcon rank={rank} className="h-4 w-4" />
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-foreground">{entry.name ?? "FitNMove"}</p>
        <p className="truncate text-xs font-semibold text-muted-foreground">{teamLabel(entry.teamColor)} / {entry.rankTitle}</p>
        <p className="mt-0.5 truncate text-[10px] font-bold text-[#5F6F69]">
          +{Number(entry.todayPoints).toLocaleString()} today / {entry.eliteMedals} elite medals
        </p>
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
