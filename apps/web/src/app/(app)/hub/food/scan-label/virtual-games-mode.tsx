"use client";

import { useState } from "react";
import { CircleDot, Flame, Goal, Route, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { CricketGamesMode } from "./cricket-games-mode";
import { FootballReactionGame } from "./football-reaction-game";
import { RunningDodgeGame } from "./running-dodge-game";
import { ShadowBoxingMode } from "./shadow-boxing-mode";
import { SuperheroFireballGame } from "./superhero-fireball-game";

type VirtualGameKey = "cricket" | "boxing" | "football" | "running" | "hero";

type VirtualGamesModeProps = {
  initialGame?: VirtualGameKey;
  initialCricketMode?: "batting" | "fielding" | "bowling";
};

const GAME_OPTIONS: Array<{
  key: VirtualGameKey;
  title: string;
  subtitle: string;
  tag: string;
}> = [
  {
    key: "cricket",
    title: "Cricket",
    subtitle: "Batting reaction and ball-catching fielding games.",
    tag: "Cricket",
  },
  {
    key: "boxing",
    title: "Punch Targets",
    subtitle: "Fast reaction targets for jabs, crosses, speed drills, and timed rounds.",
    tag: "Boxing",
  },
  {
    key: "football",
    title: "Football",
    subtitle: "Penalty kick and keeper save camera challenges.",
    tag: "Football",
  },
  {
    key: "running",
    title: "Escape From Above",
    subtitle: "Fireballs drop from above. Dodge fast with three lives.",
    tag: "Escape",
  },
  {
    key: "hero",
    title: "Hero Blast",
    subtitle: "Charge fireballs with arm rolls and defeat incoming enemies.",
    tag: "Superhero",
  },
];

export function VirtualGamesMode({ initialGame = "cricket", initialCricketMode = "batting" }: VirtualGamesModeProps) {
  const [selectedGame, setSelectedGame] = useState<VirtualGameKey>(initialGame);

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Virtual Games</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Camera Fitness Games</h2>
            <p className="mt-1 text-sm text-slate-500">
              Play lightweight movement games using the same live body tracking camera.
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <CircleDot className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GAME_OPTIONS.map((game) => {
            const active = selectedGame === game.key;
            return (
              <button
                key={game.key}
                type="button"
                onClick={() => setSelectedGame(game.key)}
                className={cn(
                  "min-h-28 rounded-[22px] border p-4 text-left transition-all",
                  active
                    ? "border-teal-200 bg-teal-50 text-slate-950 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-200 hover:bg-white"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                    {game.key === "cricket" ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : game.key === "football" ? (
                      <Goal className="h-5 w-5" />
                    ) : game.key === "running" ? (
                      <Route className="h-5 w-5" />
                    ) : game.key === "hero" ? (
                      <Flame className="h-5 w-5" />
                    ) : (
                      <Target className="h-5 w-5" />
                    )}
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-teal-700 shadow-sm">
                    {game.tag}
                  </span>
                </div>
                <p className="mt-3 font-black">{game.title}</p>
                <p className="mt-1 text-sm text-slate-500">{game.subtitle}</p>
              </button>
            );
          })}
        </div>
      </section>

      {selectedGame === "cricket" && <CricketGamesMode initialMode={initialCricketMode} />}
      {selectedGame === "boxing" && <ShadowBoxingMode />}
      {selectedGame === "football" && <FootballReactionGame />}
      {selectedGame === "running" && <RunningDodgeGame />}
      {selectedGame === "hero" && <SuperheroFireballGame />}
    </div>
  );
}
