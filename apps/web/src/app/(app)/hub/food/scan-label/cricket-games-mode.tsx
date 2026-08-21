"use client";

import { useState } from "react";
import { Activity, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { BattingReactionGame } from "./batting-reaction-game";
import { BowlingCricketGame } from "./bowling-cricket-game";
import { FieldingCatchGame } from "./fielding-catch-game";

type CricketMode = "batting" | "fielding" | "bowling";

type CricketGamesModeProps = {
  initialMode?: CricketMode;
};

const CRICKET_MODES: Array<{
  key: CricketMode;
  title: string;
  subtitle: string;
}> = [
  {
    key: "batting",
    title: "Batting Reaction",
    subtitle: "Time the ball, score 1s, 2s, fours, and sixes.",
  },
  {
    key: "fielding",
    title: "Ball Catching",
    subtitle: "React to throws, catch the ball, and build a streak.",
  },
  {
    key: "bowling",
    title: "Bowling Attack",
    subtitle: "Complete a bowling action and aim for the wicket.",
  },
];

export function CricketGamesMode({ initialMode = "batting" }: CricketGamesModeProps) {
  const [selectedMode, setSelectedMode] = useState<CricketMode>(initialMode);

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Cricket</p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">Reaction Cricket</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick batting or fielding. Both use the live camera and forgiving body tracking.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CRICKET_MODES.map((mode) => {
            const active = selectedMode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => setSelectedMode(mode.key)}
                className={cn(
                  "min-h-24 rounded-[22px] border p-4 text-left transition-all",
                  active
                    ? "border-teal-200 bg-teal-50 text-slate-950 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-200 hover:bg-white"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                  {mode.key === "batting" ? (
                    <Activity className="h-5 w-5" />
                  ) : mode.key === "bowling" ? (
                    <Target className="h-5 w-5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                </div>
                <p className="mt-3 font-black">{mode.title}</p>
                <p className="mt-1 text-sm text-slate-500">{mode.subtitle}</p>
              </button>
            );
          })}
        </div>
      </section>

      {selectedMode === "batting" && <BattingReactionGame />}
      {selectedMode === "fielding" && <FieldingCatchGame />}
      {selectedMode === "bowling" && <BowlingCricketGame />}
    </div>
  );
}
