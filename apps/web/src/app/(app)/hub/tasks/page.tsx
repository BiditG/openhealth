"use client";

import { useState } from "react";
import { Crown, Loader2, Medal, Shield, Star, Trophy } from "lucide-react";
import { RankBadge } from "@/components/ranks/rank-badge";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

function rankTone(rank: number) {
  if (rank === 1) return "from-yellow-100 to-white border-yellow-300";
  if (rank === 2) return "from-slate-100 to-white border-slate-300";
  if (rank === 3) return "from-amber-100 to-white border-amber-300";
  return "from-[#F7FAF9] to-white border-[#E3EAE7]";
}

export default function LeaderboardPage() {
  const [metric, setMetric] = useState<"overall" | "pushup" | "bicepCurl" | "pullup" | "squat">("overall");
  const { data: leaderboard, isLoading } = trpc.tasks.getLeaderboard.useQuery({ metric });
  const { data: teamScores } = trpc.tasks.getTeamScores.useQuery();
  const topThree = leaderboard?.slice(0, 3) ?? [];
  const rest = leaderboard?.slice(3) ?? [];
  const scoreLabel = metric === "overall" ? "points" : "verified reps";

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#20C7A4]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAF9] px-4 py-5 sm:px-6 lg:px-0">
      <section className="overflow-hidden rounded-[26px] bg-[#123F37] p-6 text-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Leaderboard</p>
            <h1 className="mt-3 text-3xl font-black tracking-normal">Ranks that feel earned</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Overall ranks prioritize mission points. Exercise filters rank users by verified reps completed through the app.
            </p>
          </div>
          <div className="hidden h-16 w-16 items-center justify-center rounded-full bg-white/10 sm:flex">
            <Trophy className="h-8 w-8 text-[#20C7A4]" />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2">
        {teamScores?.teams.map((team) => {
          const isLeader = teamScores.leaderTeam === team.teamColor;
          const total = Math.max(...teamScores.teams.map((item) => item.points), 1);
          const pct = Math.max(4, Math.round((team.points / total) * 100));
          return (
            <article
              key={team.teamColor}
              className={cn(
                "relative overflow-hidden rounded-[22px] border bg-white p-5 shadow-sm",
                team.teamColor === "red" ? "border-red-200" : "border-blue-200"
              )}
            >
              {isLeader && (
                <div className="absolute right-5 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm">
                  <Crown className="h-5 w-5 fill-amber-400" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[15px] text-white",
                    team.teamColor === "red" ? "bg-red-600" : "bg-blue-600"
                  )}
                >
                  <Shield className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6B7773]">
                    {isLeader ? "Leading team" : "Chasing team"}
                  </p>
                  <h2 className="text-xl font-black text-[#17201E]">{team.label}</h2>
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <p className="text-3xl font-black tabular-nums text-[#17201E]">{team.points.toLocaleString()}</p>
                <p className="text-sm font-semibold text-[#6B7773]">{team.members} members • {team.completions} completions</p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#F7FAF9]">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", team.teamColor === "red" ? "bg-red-500" : "bg-blue-500")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-5 flex gap-2 overflow-x-auto rounded-[18px] border border-[#E3EAE7] bg-white p-2 shadow-sm">
        {[
          ["overall", "Overall points"],
          ["pushup", "Top push-ups"],
          ["bicepCurl", "Top curls"],
          ["pullup", "Top pull-ups"],
          ["squat", "Top squats"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMetric(value as typeof metric)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition",
              metric === value ? "bg-[#123F37] text-white" : "bg-[#F7FAF9] text-[#6B7773]"
            )}
          >
            {label}
          </button>
        ))}
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {topThree.map((entry) => (
          <article
            key={entry.userId}
            className={cn(
              "relative overflow-hidden rounded-[22px] border bg-gradient-to-br p-5 shadow-sm",
              rankTone(entry.rank),
              entry.rank === 1 ? "md:-mt-2" : "md:mt-6"
            )}
          >
            <div className="absolute right-4 top-4 text-[#20C7A4]/15">
              <Crown className="h-16 w-16" />
            </div>
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#123F37] text-xl font-black text-white">
                {entry.rank}
              </div>
              <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-black text-[#17201E]">{entry.name}</h2>
                <RankBadge points={Number(entry.points)} compact />
              </div>
              <p className="mt-1 text-sm text-[#6B7773]">
                {entry.teamColor === "red" ? "Team RED" : entry.teamColor === "blue" ? "Team Blue" : "No team"} • {Number(entry.taskCount)} tasks • {Number(entry.missionCount)} missions
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#123F37] shadow-sm">
                <Star className="h-4 w-4 fill-[#20C7A4] text-[#20C7A4]" />
                {Number(entry.score)} {scoreLabel}
              </div>
              <p className="mt-3 text-xs font-semibold text-[#6B7773]">
                Push-ups {Number(entry.pushups)} • Curls {Number(entry.bicepCurls)} • Pull-ups {Number(entry.pullups)} • Squats {Number(entry.squats)}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-[22px] border border-[#E3EAE7] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#17201E]">All ranks</h2>
          <Medal className="h-5 w-5 text-[#20C7A4]" />
        </div>
        <div className="mt-4 space-y-3">
          {rest.map((entry) => (
            <div
              key={entry.userId}
              className={cn(
                "grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[16px] border p-3",
                entry.isCurrentUser ? "border-[#20C7A4]/40 bg-[#EAF8F4]" : "border-[#E3EAE7] bg-[#F7FAF9]"
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border-2 bg-[#123F37] text-sm font-black text-white",
                  Number(entry.rankTier) >= 6
                    ? "border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.45)]"
                    : Number(entry.rankTier) >= 5
                      ? "border-slate-300 shadow-[0_0_18px_rgba(148,163,184,0.5)]"
                      : "border-transparent"
                )}
              >
                {entry.rank}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-[#17201E]">{entry.name}</p>
                  <RankBadge points={Number(entry.points)} compact />
                </div>
                <p className="text-xs text-[#6B7773]">
                  {entry.teamColor === "red" ? "Team RED" : entry.teamColor === "blue" ? "Team Blue" : "No team"} • {Number(entry.taskCount)} tasks • {Number(entry.missionCount)} missions
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#123F37]">
                {Number(entry.score)} {metric === "overall" ? "pts" : "reps"}
              </span>
            </div>
          ))}
          {!leaderboard?.length && (
            <p className="rounded-[16px] bg-[#F7FAF9] p-4 text-sm text-[#6B7773]">
              No ranks yet. Complete a verified task to become the first ranked member.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
