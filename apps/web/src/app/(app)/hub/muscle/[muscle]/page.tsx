"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Dumbbell, Play, RefreshCw, ShieldCheck } from "lucide-react";
import {
  formatMuscleName,
  getWorkoutForMuscle,
  type ExerciseMedia,
} from "@/lib/exercise-media";

type ExerciseLibraryResponse = {
  success: boolean;
  data: ExerciseMedia[];
  source?: string;
  message?: string;
  cached?: boolean;
};

const CLIENT_CACHE_TTL_MS = 50 * 60 * 1000;

function getBestImage(exercise: ExerciseMedia) {
  return (
    exercise.imageUrls?.["720p"] ||
    exercise.imageUrls?.["480p"] ||
    exercise.imageUrls?.["360p"] ||
    exercise.imageUrl ||
    ""
  );
}

function joinList(values?: string[]) {
  return values?.length ? values.slice(0, 3).join(" • ") : "Bodyweight or gym movement";
}

function getClientCacheKey(muscle: string) {
  return `openhealth-exercise-library-${muscle}`;
}

export default function MuscleExercisePage() {
  const params = useParams<{ muscle: string }>();
  const muscle = decodeURIComponent(Array.isArray(params.muscle) ? params.muscle[0] : params.muscle);
  const muscleLabel = formatMuscleName(muscle);
  const workout = getWorkoutForMuscle(muscle);
  const [exercises, setExercises] = useState<ExerciseMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cacheNote, setCacheNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadExercises = async () => {
      setIsLoading(true);
      setMessage("");
      setCacheNote("");
      try {
        const cacheKey = getClientCacheKey(muscle);
        const cached = window.sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { savedAt: number; data: ExerciseMedia[] };
          if (Date.now() - parsed.savedAt < CLIENT_CACHE_TTL_MS && Array.isArray(parsed.data)) {
            setExercises(parsed.data);
            setCacheNote("Showing recently loaded exercises.");
            setIsLoading(false);
            return;
          }
        }

        const response = await fetch(`/api/exercises/local-dataset?muscle=${encodeURIComponent(muscle)}&limit=9`, {
          cache: "default",
        });
        const payload = (await response.json()) as ExerciseLibraryResponse;
        if (cancelled) return;
        const nextData = Array.isArray(payload.data) ? payload.data : [];
        setExercises(nextData);
        if (nextData.length) {
          window.sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: nextData }));
        }
        if (payload.cached) setCacheNote("Showing saved exercises.");
        if (!response.ok || !payload.success || nextData.length === 0) {
          setMessage(payload.message || "No exercises found for this muscle yet.");
        }
      } catch {
        if (!cancelled) setMessage("Could not load exercises right now.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadExercises();

    return () => {
      cancelled = true;
    };
  }, [muscle]);

  return (
    <div className="min-h-screen bg-[#F7FAF9]">
      <div className="mx-auto max-w-[1120px] px-[18px] pb-[110px] pt-6 sm:px-6 lg:px-8 lg:pb-12">
        <Link href="/hub" className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#15483F]">
          <ArrowLeft className="h-4 w-4" />
          Back to hub
        </Link>

        <section className="mt-4 overflow-hidden rounded-[26px] bg-[#15483F] p-5 text-white sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8DE8D3]">Target muscle</p>
              <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{muscleLabel}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
                Pick a demo, learn the movement, then start a simple workout when you are ready.
              </p>
            </div>
            <Link
              href={`/hub/workout/quick?exercise=${workout.exercise}&tracking=manual&muscle=${encodeURIComponent(muscle)}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#15483F] transition hover:bg-[#EAF8F4]"
            >
              <Dumbbell className="h-4 w-4" />
              Train {workout.label}
            </Link>
          </div>
        </section>

        <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-[#DDE8E4] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#EAF8F4] text-[#20C7A4]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-[#17201E]">Exercise demos</p>
              <p className="mt-1 text-xs leading-5 text-[#6B7773]">Videos and images come from the saved exercise library.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              window.sessionStorage.removeItem(getClientCacheKey(muscle));
              window.location.reload();
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#DDE8E4] px-4 text-xs font-black text-[#17201E]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-[18px] border border-[#F2D0A0] bg-[#FFF8EB] p-4 text-sm font-semibold leading-6 text-[#9A5A00]">
            {message}
          </div>
        )}

        {cacheNote && (
          <div className="mt-4 rounded-[18px] border border-[#CFECE4] bg-[#EAF8F4] p-4 text-sm font-semibold leading-6 text-[#15483F]">
            {cacheNote}
          </div>
        )}

        {isLoading ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[360px] animate-pulse rounded-[22px] bg-white" />
            ))}
          </div>
        ) : exercises.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {exercises.map((exercise) => {
              const image = getBestImage(exercise);
              return (
                <article key={exercise.exerciseId} className="overflow-hidden rounded-[22px] border border-[#DDE8E4] bg-white shadow-sm">
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#0B211D]">
                    {exercise.videoUrl ? (
                      <video
                        src={exercise.videoUrl}
                        poster={image || undefined}
                        controls
                        muted
                        loop
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : image ? (
                      <img src={image} alt={exercise.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/70">
                        <Play className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-black leading-tight text-[#17201E]">{exercise.name}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#20C7A4]">
                      {exercise.exerciseType ?? "Exercise"}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-[#6B7773]">{joinList(exercise.equipments)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(exercise.targetMuscles ?? exercise.bodyParts ?? []).slice(0, 3).map((item) => (
                        <span key={item} className="rounded-full bg-[#EAF8F4] px-3 py-1 text-[11px] font-black text-[#15483F]">
                          {item}
                        </span>
                      ))}
                    </div>
                    {exercise.overview && (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#6B7773]">{exercise.overview}</p>
                    )}
                    {exercise.instructions?.length ? (
                      <ol className="mt-3 space-y-1 text-sm leading-5 text-[#17201E]">
                        {exercise.instructions.slice(0, 2).map((step, index) => (
                          <li key={`${exercise.exerciseId}-${index}`} className="grid grid-cols-[22px_1fr] gap-2">
                            <span className="font-black text-[#20C7A4]">{index + 1}</span>
                            <span>{step.replace(/^Step:\d+\s*/i, "")}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    <Link
                      href={`/hub/workout/quick?exercise=${workout.exercise}&tracking=manual&muscle=${encodeURIComponent(muscle)}&exerciseName=${encodeURIComponent(exercise.name)}`}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#15483F] px-4 text-sm font-black text-white"
                    >
                      <Dumbbell className="h-4 w-4" />
                      Start workout
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[22px] border border-[#DDE8E4] bg-white p-6 text-center">
            <p className="text-lg font-black text-[#17201E]">No exercises found</p>
            <p className="mt-2 text-sm text-[#6B7773]">Try another muscle from the hub map.</p>
          </div>
        )}
      </div>
    </div>
  );
}
