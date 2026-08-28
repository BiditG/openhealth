"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Crown,
  Loader2,
  Medal,
  Minus,
  Shield,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
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
  { value: "overall", label: "Overall" },
  { value: "pushup", label: "Push-up" },
  { value: "bicepCurl", label: "Curl" },
  { value: "pullup", label: "Pull-up" },
  { value: "squat", label: "Squat" },
];

const PODIUM_ORDER = [1, 2, 3];
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
  return "Unaffiliated";
}

function movement(rank: number, eliteMedals: number) {
  if (rank <= 3 || eliteMedals > 0) return { label: `+${Math.max(1, eliteMedals || 1)}`, tone: "up" as const };
  if (rank % 5 === 0) return { label: "-1", tone: "down" as const };
  return { label: "0", tone: "flat" as const };
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
  const scoreLabel = metric === "overall" ? "PTS" : "REPS";

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
    const total = Math.max(red.points + blue.points, 1);
    return { red, blue, leader, gap, total };
  }, [teamScores]);

  const target = useMemo(() => {
    if (!currentUser) {
      const gate = entries[16];
      return gate ? `${Number(gate.score) + 1} points to enter #17` : "Complete a verified task to enter the table";
    }
    const next = entries.find((entry) => Number(entry.rank) === Number(currentUser.rank) - 1);
    if (!next) return "Hold #1. Defend the crown.";
    return `${Math.max(1, Number(next.score) - Number(currentUser.score) + 1)} ${scoreLabel.toLowerCase()} to overtake #${next.rank}`;
  }, [currentUser, entries, scoreLabel]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white">
        <Loader2 className="h-7 w-7 animate-spin text-[#0F5A48]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-5 text-[#101815] sm:px-6 lg:px-0">
      <section className="border border-[#DDE6E0] bg-[#F7F4EA] p-5 shadow-[0_18px_50px_rgba(16,24,21,0.10)] sm:p-6" style={{ borderRadius: 18 }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0F5A48]">Season 01 / Live Championship</p>
            <h1 className="mt-3 text-5xl font-black uppercase tracking-normal text-[#101815] sm:text-7xl">
              THE ARENA
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[#53645E]">
              <span>Active Season</span>
              <span className="text-[#A8B4AE]">/</span>
              <span>{teamState.leader.label} leads by {teamState.gap.toLocaleString()}</span>
              <span className="text-[#A8B4AE]">/</span>
              <span>{seasonCountdown()} left</span>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-end gap-3 sm:min-w-[420px]">
            <ScoreBlock team="red" label="Team Red" score={teamState.red.points} />
            <div className="pb-3 text-center text-xs font-black uppercase tracking-[0.2em] text-[#6A7973]">VS</div>
            <ScoreBlock team="blue" label="Team Blue" score={teamState.blue.points} alignRight />
          </div>
        </div>
      </section>

      <section className="mt-4 border border-[#DDE6E0] bg-white p-4 shadow-[0_14px_36px_rgba(16,24,21,0.06)] sm:p-5" style={{ borderRadius: 18 }}>
        <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <TeamSide team="red" name="Team Red" score={teamState.red.points} total={teamState.total} leading={teamState.leader.teamColor === "red"} />
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center border border-[#DDE6E0] bg-[#F7F4EA] text-[#101815]" style={{ borderRadius: 16 }}>
              <Swords className="h-7 w-7" />
            </div>
          </div>
          <TeamSide team="blue" name="Team Blue" score={teamState.blue.points} total={teamState.total} leading={teamState.leader.teamColor === "blue"} />
        </div>
        <div className="mt-5 grid gap-3 border-t border-[#DDE6E0] pt-4 sm:grid-cols-3">
          <CompactStat label="Current leader" value={teamState.leader.label} />
          <CompactStat label="Score gap" value={teamState.gap.toLocaleString()} />
          <CompactStat label="Season countdown" value={seasonCountdown()} />
        </div>
      </section>

      <section className="mt-4 flex gap-2 overflow-x-auto border border-[#DDE6E0] bg-[#F8FAF7] p-2 shadow-[0_10px_30px_rgba(16,24,21,0.05)]" style={{ borderRadius: 14 }}>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setMetric(item.value)}
            className={cn(
              "shrink-0 px-4 py-2 text-sm font-black uppercase tracking-[0.08em] transition",
              metric === item.value
                ? "bg-[#101815] text-[#F7F4EA]"
                : "border border-[#DDE6E0] bg-white text-[#53645E] hover:text-[#101815]"
            )}
            style={{ borderRadius: 12 }}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section className="mt-6 grid items-end gap-4 lg:grid-cols-3">
        {PODIUM_ORDER.map((rank) => {
          const entry = topThree.find((item) => item.rank === rank);
          return entry ? <PodiumCard key={entry.userId} entry={entry} scoreLabel={scoreLabel} /> : null;
        })}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="border border-[#DDE6E0] bg-white shadow-[0_14px_40px_rgba(16,24,21,0.06)]" style={{ borderRadius: 18 }}>
          <div className="grid grid-cols-[58px_52px_1.4fr_0.9fr_0.9fr_0.9fr] gap-3 border-b border-[#DDE6E0] bg-[#F8FAF7] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#6A7973] max-md:hidden">
            <span>Rank</span>
            <span>Move</span>
            <span>User</span>
            <span>Team</span>
            <span>Today</span>
            <span>Total</span>
          </div>
          <div className="divide-y divide-[#DDE6E0]">
            {rest.map((entry) => (
              <RankRow key={entry.userId} entry={entry} scoreLabel={scoreLabel} />
            ))}
            {!entries.length && (
              <p className="p-5 text-sm font-semibold text-[#53645E]">
                No ranks yet. Complete a verified task to become the first ranked member.
              </p>
            )}
          </div>
        </div>

        <aside className="sticky bottom-4 top-4 border border-[#BFE7D4] bg-[#F4FBF6] p-4 shadow-[0_18px_45px_rgba(15,90,72,0.12)]" style={{ borderRadius: 18 }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F5A48]">Your Rank</p>
              <p className="mt-1 text-3xl font-black text-[#101815]">
                {currentUser ? `#${currentUser.rank}` : "Unranked"}
              </p>
            </div>
            <Target className="h-8 w-8 text-[#0F5A48]" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={currentUser?.name ?? "You"} team={currentUser?.teamColor ?? null} />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#101815]">{currentUser?.name ?? "You"}</p>
              <p className="text-xs font-semibold text-[#53645E]">{teamLabel(currentUser?.teamColor)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <CompactStat label="Today" value={String(Number(currentUser?.todayPoints ?? 0))} />
            <CompactStat label="Total" value={String(Number(currentUser?.score ?? 0))} />
          </div>
          <div className="mt-4 border border-[#BFE7D4] bg-white p-3 text-sm font-black text-[#0F5A48]" style={{ borderRadius: 14 }}>
            {target}
          </div>
        </aside>
      </section>
    </div>
  );
}

function ScoreBlock({ team, label, score, alignRight = false }: { team: "red" | "blue"; label: string; score: number; alignRight?: boolean }) {
  return (
    <div className={cn("min-w-0", alignRight && "text-right")}>
      <p className={cn("text-xs font-black uppercase tracking-[0.18em]", team === "red" ? "text-red-400" : "text-blue-400")}>{label}</p>
      <p className="mt-1 text-4xl font-black tabular-nums text-[#101815] sm:text-5xl">{score.toLocaleString()}</p>
    </div>
  );
}

function TeamSide({ team, name, score, total, leading }: { team: "red" | "blue"; name: string; score: number; total: number; leading: boolean }) {
  const pct = Math.max(4, Math.round((score / total) * 100));
  return (
    <div className={cn("relative overflow-hidden border p-4", leading ? "border-[#C9A34E]/55 bg-[#FFF8E5]" : "border-[#DDE6E0] bg-[#F8FAF7]")} style={{ borderRadius: 16 }}>
      {leading && (
        <div className="absolute right-4 top-4 text-[#C9A34E]">
          <Crown className="h-6 w-6 fill-[#C9A34E]/35" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className={cn("flex h-11 w-11 items-center justify-center text-white", team === "red" ? "bg-red-600" : "bg-blue-600")} style={{ borderRadius: 14 }}>
          <Shield className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6A7973]">{leading ? "Leading" : "Chasing"}</p>
          <h2 className="text-xl font-black text-[#101815]">{name}</h2>
        </div>
      </div>
      <p className="mt-5 text-4xl font-black tabular-nums text-[#101815]">{score.toLocaleString()}</p>
      <div className="mt-4 h-2 overflow-hidden bg-[#E7EDE9]" style={{ borderRadius: 12 }}>
        <div className={cn("h-full", team === "red" ? "bg-red-500" : "bg-blue-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#DDE6E0] bg-white px-3 py-2" style={{ borderRadius: 12 }}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6A7973]">{label}</p>
      <p className="mt-1 truncate text-base font-black text-[#101815]">{value}</p>
    </div>
  );
}

function PodiumCard({ entry, scoreLabel }: { entry: LeaderboardEntry; scoreLabel: string }) {
  const isChampion = entry.rank === 1;
  const medalTone = entry.rank === 2 ? "text-[#D7DEE4]" : entry.rank === 3 ? "text-[#C78955]" : "text-[#C9A34E]";
  const podiumOrder = entry.rank === 1 ? "lg:order-2" : entry.rank === 2 ? "lg:order-1" : "lg:order-3";
  const podiumBorder =
    entry.rank === 1
      ? "border-[#C9A34E]/65 bg-[radial-gradient(circle_at_top,rgba(201,163,78,0.20),rgba(255,248,229,0.98)_44%,#FFFFFF_100%)] lg:-mt-8 lg:min-h-[360px]"
      : entry.rank === 2
        ? "border-[#B9C1C8] bg-[radial-gradient(circle_at_top,rgba(215,222,228,0.28),#FFFFFF_48%)] lg:min-h-[310px]"
        : "border-[#C78955]/55 bg-[radial-gradient(circle_at_top,rgba(199,137,85,0.18),#FFFFFF_48%)] lg:min-h-[310px]";
  const move = movement(Number(entry.rank), Number(entry.eliteMedals));
  return (
    <article
      className={cn(
        "relative overflow-hidden border p-4 shadow-[0_18px_45px_rgba(16,24,21,0.10)]",
        podiumOrder,
        podiumBorder
      )}
      style={{ borderRadius: 18 }}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1", entry.rank === 1 ? "bg-[#C9A34E]" : entry.rank === 2 ? "bg-[#D7DEE4]" : "bg-[#C78955]")} />
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-black uppercase tracking-[0.18em]", medalTone)}>#{entry.rank}</span>
        {isChampion ? <Trophy className="h-7 w-7 fill-[#C9A34E]/30 text-[#C9A34E]" /> : <Medal className={cn("h-6 w-6", medalTone)} />}
      </div>
      <div className="mt-5 flex justify-center">
        <Avatar name={entry.name} team={entry.teamColor} large={isChampion} />
      </div>
      <div className="mt-5 text-center">
        <h2 className={cn("truncate font-black text-[#101815]", isChampion ? "text-3xl" : "text-2xl")}>{entry.name}</h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#6A7973]">{entry.rankTitle}</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <PodiumValue label="Move" value={move.label} tone={move.tone} />
        <PodiumValue label="Team" value={entry.teamColor === "red" ? "Red" : entry.teamColor === "blue" ? "Blue" : "-"} team={entry.teamColor} />
        <PodiumValue label={scoreLabel} value={Number(entry.score).toLocaleString()} />
      </div>
    </article>
  );
}

function PodiumValue({ label, value, tone, team }: { label: string; value: string; tone?: "up" | "down" | "flat"; team?: string | null }) {
  return (
    <div className="border border-[#DDE6E0] bg-white/82 p-2 text-center" style={{ borderRadius: 12 }}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6A7973]">{label}</p>
      <p className={cn("mt-1 text-sm font-black", tone === "up" && "text-[#0F8B65]", tone === "down" && "text-red-500", team === "red" && "text-red-500", team === "blue" && "text-blue-500", !tone && !team && "text-[#101815]")}>{value}</p>
    </div>
  );
}

function RankRow({ entry, scoreLabel }: { entry: LeaderboardEntry; scoreLabel: string }) {
  const move = movement(Number(entry.rank), Number(entry.eliteMedals));
  const MoveIcon = move.tone === "up" ? ArrowUp : move.tone === "down" ? ArrowDown : Minus;
  return (
    <div className={cn("grid gap-3 px-4 py-3 md:grid-cols-[58px_52px_1.4fr_0.9fr_0.9fr_0.9fr] md:items-center", entry.isCurrentUser ? "bg-[#EAF8F0]" : "bg-transparent")}>
      <div className="flex items-center justify-between md:block">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[#6A7973] md:hidden">Rank</span>
        <span className="text-lg font-black tabular-nums text-[#101815]">#{entry.rank}</span>
      </div>
      <div className={cn("inline-flex w-fit items-center gap-1 text-xs font-black", move.tone === "up" ? "text-[#0F8B65]" : move.tone === "down" ? "text-red-500" : "text-[#6A7973]")}>
        <MoveIcon className="h-3.5 w-3.5" />
        {move.label}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={entry.name} team={entry.teamColor} />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#101815]">{entry.name}</p>
          <p className="text-xs font-semibold text-[#6A7973]">{entry.rankTitle}</p>
        </div>
      </div>
      <p className={cn("text-sm font-black", entry.teamColor === "red" ? "text-red-500" : entry.teamColor === "blue" ? "text-blue-500" : "text-[#6A7973]")}>{teamLabel(entry.teamColor)}</p>
      <p className="text-sm font-black tabular-nums text-[#0F8B65]">{Number(entry.todayPoints ?? 0).toLocaleString()}</p>
      <p className="text-sm font-black tabular-nums text-[#101815]">{Number(entry.score).toLocaleString()} {scoreLabel}</p>
    </div>
  );
}

function Avatar({ name, team, large = false }: { name?: string | null; team?: string | null; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border font-black text-[#F6F0E4]",
        large ? "h-24 w-24 text-3xl" : "h-11 w-11 text-sm",
        team === "red" ? "border-red-300 bg-red-600 text-white" : team === "blue" ? "border-blue-300 bg-blue-600 text-white" : "border-[#DDE6E0] bg-[#101815] text-white"
      )}
      style={{ borderRadius: large ? 18 : 14 }}
    >
      {initials(name)}
    </div>
  );
}
