"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dumbbell, Images, RotateCcw, Sparkles } from "lucide-react";
import {
  HeatmapLegend,
  MuscleMapWidget,
  type BodyGender,
  type BodySide,
  type Muscle,
} from "@/lib/MuscleMapJS/src";
import {
  MUSCLE_TRAINING_STORAGE_KEY,
  formatMuscleName,
  getDecayedMuscleScore,
  getMuscleSuggestion,
  getWorkoutForMuscle,
  type MuscleTrainingProfile,
} from "@/lib/exercise-media";

const defaultHeatmap: Array<{ muscle: Muscle; intensity: number }> = [
  { muscle: "chest", intensity: 0.92 },
  { muscle: "abs", intensity: 0.88 },
  { muscle: "quadriceps", intensity: 0.82 },
  { muscle: "gluteal", intensity: 0.72 },
  { muscle: "upper-back", intensity: 0.7 },
  { muscle: "biceps", intensity: 0.54 },
  { muscle: "triceps", intensity: 0.5 },
  { muscle: "calves", intensity: 0.42 },
  { muscle: "hamstring", intensity: 0.62 },
  { muscle: "deltoids", intensity: 0.58 },
  { muscle: "obliques", intensity: 0.48 },
];

type HubMuscleMapProps = {
  compact?: boolean;
};

export function HubMuscleMap({ compact = false }: HubMuscleMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const legendContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MuscleMapWidget | null>(null);
  const [gender, setGender] = useState<BodyGender>("male");
  const [side, setSide] = useState<BodySide>("front");
  const [selectedMuscles, setSelectedMuscles] = useState<Muscle[]>([]);
  const [trainingProfile, setTrainingProfile] = useState<MuscleTrainingProfile>({});

  const primaryMuscle = selectedMuscles[0] ?? null;
  const workout = primaryMuscle ? getWorkoutForMuscle(primaryMuscle) : null;
  const primaryProfile = primaryMuscle ? trainingProfile[primaryMuscle] : undefined;
  const primaryScore = primaryMuscle && primaryProfile ? getDecayedMuscleScore(primaryProfile) : 0;
  const primarySuggestion = primaryMuscle
    ? getMuscleSuggestion(primaryScore, primaryProfile?.lastTrainedAt)
    : "Tap a muscle to plan training.";
  const selectedLabel = selectedMuscles.length
    ? selectedMuscles.map(formatMuscleName).join(", ")
    : "Tap the map";

  const heatmapData = useMemo(
    () => [
      ...defaultHeatmap,
      ...Object.entries(trainingProfile).map(([muscle, value]) => ({
        muscle: muscle as Muscle,
        intensity: Math.min(1, Math.max(0.12, getDecayedMuscleScore(value) / 100)),
      })),
      ...selectedMuscles.map((muscle) => ({ muscle, intensity: 1 })),
    ],
    [selectedMuscles, trainingProfile]
  );

  useEffect(() => {
    const loadProfile = () => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(MUSCLE_TRAINING_STORAGE_KEY) ?? "{}") as MuscleTrainingProfile;
        setTrainingProfile(parsed);
      } catch {
        setTrainingProfile({});
      }
    };

    loadProfile();
    window.addEventListener("storage", loadProfile);
    window.addEventListener("openhealth:muscle-training-updated", loadProfile);
    return () => {
      window.removeEventListener("storage", loadProfile);
      window.removeEventListener("openhealth:muscle-training-updated", loadProfile);
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || (!compact && !legendContainerRef.current)) return;

    mapContainerRef.current.innerHTML = "";
    if (legendContainerRef.current) legendContainerRef.current.innerHTML = "";

    const map = new MuscleMapWidget(mapContainerRef.current, {
      gender,
      side,
      style: "medical",
      multiSelect: true,
      showSubGroups: true,
      animated: true,
      animationDuration: 260,
      onSelectionChange: setSelectedMuscles,
    });

    map.enableTooltip((muscle, muscleSide) => `${formatMuscleName(muscle)}<br><small>${muscleSide} side</small>`);
    map.enableHistory(30);
    map.enablePulse(1.4, 0.64, 1);

    mapRef.current = map;

    if (legendContainerRef.current) {
      new HeatmapLegend(legendContainerRef.current, {
        colorScale: "workout",
        orientation: "horizontal",
        barThickness: 14,
        labelMin: "Light",
        labelMax: "Heavy",
        steps: 48,
      });
    }

    return () => {
      map.destroy();
      mapContainerRef.current?.replaceChildren();
      legendContainerRef.current?.replaceChildren();
      mapRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setGender(gender);
    map.setSide(side);
    map.setHeatmap(heatmapData, {
      colorScale: "workout",
      interpolation: { type: "easeInOut" },
      threshold: 0.08,
      gradientFill: true,
      gradientDirection: "topToBottom",
      gradientLowFactor: 0.22,
    });
  }, [gender, heatmapData, selectedMuscles, side]);

  const clearSelection = () => {
    mapRef.current?.clearSelection();
    setSelectedMuscles([]);
  };

  if (compact) {
    return (
      <div className="mt-5 border-t border-white/12 pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-white/60">Body training</p>
            <p className="mt-1 truncate text-sm font-bold text-white">{selectedLabel}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 rounded-full bg-white/10 p-1">
            {(["front", "back"] as BodySide[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSide(item)}
                className={`min-h-8 rounded-full px-3 text-[11px] font-black capitalize transition ${
                  side === item ? "bg-white text-[#15483F]" : "text-white/70"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center">
          <div
            ref={mapContainerRef}
            className="h-[300px] overflow-hidden rounded-[18px] border border-white/12 bg-white/[0.06] sm:h-[250px]"
          />
          <div className="min-w-0">
            <div className="rounded-[16px] bg-white/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-white/70">Trained</p>
                <p className="text-2xl font-black tabular-nums text-white">{primaryScore}%</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/14">
                <div className="h-full rounded-full bg-[#20C7A4]" style={{ width: `${primaryScore}%` }} />
              </div>
              <p className="mt-2 text-xs font-bold text-[#EAF8F4]">{primarySuggestion}</p>
            </div>
            <div className="mt-3 grid gap-2">
              {primaryMuscle && workout ? (
                <>
                  <Link
                    href={`/hub/muscle/${encodeURIComponent(primaryMuscle)}`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-3 text-xs font-black text-[#15483F]"
                  >
                    <Images className="h-4 w-4" />
                    See more
                  </Link>
                  <Link
                    href={`/hub/workout/quick?exercise=${workout.exercise}&tracking=manual&muscle=${encodeURIComponent(primaryMuscle)}`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#20C7A4] px-3 text-xs font-black text-white"
                  >
                    <Dumbbell className="h-4 w-4" />
                    Train
                  </Link>
                </>
              ) : (
                <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white/10 px-3 text-xs font-black text-white/58">
                  Select a muscle first
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[22px] border border-[#DDE8E4] bg-white shadow-sm">
      <div className="border-b border-[#EDF2F0] p-[18px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#20C7A4]" />
              <p className="text-[16px] font-bold text-[#17201E]">Body training map</p>
            </div>
            <p className="mt-1 text-sm leading-5 text-[#6B7773]">
              Tap a body area to find exercises or start training.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[260px]">
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value as BodyGender)}
              className="h-10 rounded-full border border-[#DDE8E4] bg-[#F7FAF9] px-3 text-xs font-black text-[#17201E] outline-none"
              aria-label="Body model"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <select
              value={side}
              onChange={(event) => setSide(event.target.value as BodySide)}
              className="h-10 rounded-full border border-[#DDE8E4] bg-[#F7FAF9] px-3 text-xs font-black text-[#17201E] outline-none"
              aria-label="Body side"
            >
              <option value="front">Front</option>
              <option value="back">Back</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-[18px] lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div
            ref={mapContainerRef}
            className="h-[520px] min-h-[420px] overflow-hidden rounded-[18px] border border-[#E3EAE7] bg-[#F7FAF9] sm:h-[620px]"
          />
          <div ref={legendContainerRef} className="mt-3 h-10 px-1" />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-[18px] bg-[#F7FAF9] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#20C7A4]">Muscle selected</p>
            <p className="mt-2 text-2xl font-black leading-tight text-[#17201E]">{selectedLabel}</p>
            <p className="mt-2 text-sm leading-5 text-[#6B7773]">
              What do you want to do with this muscle group?
            </p>
            <div className="mt-4 rounded-[14px] border border-[#DDE8E4] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B7773]">Trained</p>
                <p className="text-lg font-black tabular-nums text-[#17201E]">{primaryScore}%</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E3EAE7]">
                <div className="h-full rounded-full bg-[#20C7A4]" style={{ width: `${primaryScore}%` }} />
              </div>
              <p className="mt-2 text-xs font-bold text-[#15483F]">{primarySuggestion}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {primaryMuscle && workout ? (
                <>
                  <Link
                    href={`/hub/muscle/${encodeURIComponent(primaryMuscle)}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#20C7A4] px-4 text-sm font-black text-white transition hover:bg-[#1BB392]"
                  >
                    <Images className="h-4 w-4" />
                    See more exercises
                  </Link>
                  <Link
                    href={`/hub/workout/quick?exercise=${workout.exercise}&tracking=manual&muscle=${encodeURIComponent(primaryMuscle)}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#15483F] px-4 text-sm font-black text-white transition hover:bg-[#123F37]"
                  >
                    <Dumbbell className="h-4 w-4" />
                    Train {workout.label}
                  </Link>
                </>
              ) : (
                <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#EAF8F4] px-4 text-sm font-black text-[#6B7773]">
                  Select a muscle first
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[18px] border border-[#E3EAE7] p-3">
            <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-[#6B7773]">Selection data</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedMuscles.length ? (
                selectedMuscles.map((muscle) => (
                  <span key={muscle} className="rounded-full bg-[#EAF8F4] px-3 py-1.5 text-xs font-black text-[#15483F]">
                    {formatMuscleName(muscle)}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-[#F7FAF9] px-3 py-1.5 text-xs font-semibold text-[#6B7773]">No muscles selected</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#DDE8E4] bg-white px-4 text-sm font-black text-[#17201E] transition hover:bg-[#F7FAF9]"
          >
            <RotateCcw className="h-4 w-4" />
            Clear selection
          </button>
        </div>
      </div>
    </section>
  );
}
