"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  Download,
  Pause,
  Play,
  RotateCcw,
  Route,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";

type TrackPoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
};

type SavedActivity = {
  id: string;
  mode: "walk" | "run";
  title: string;
  points: TrackPoint[];
  distanceMeters: number;
  elapsedSeconds: number;
  startedAt: number;
  endedAt: number;
  photoDataUrl?: string;
};

const STORAGE_KEY = "swastha.offline.activities";
const DEFAULT_TRACK_WEIGHT_KG = 70;
const CELEBRATION_LINES = [
  "Congratulations. Activity saved.",
  "Keep pushing. That effort counts.",
  "Nice finish. Your food guide has been updated.",
];

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceBetween(a: TrackPoint, b: TrackPoint) {
  const radius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function km(value: number) {
  return (value / 1000).toFixed(2);
}

function pace(distanceMeters: number, elapsedSeconds: number) {
  if (distanceMeters < 5) return "--";
  const secondsPerKm = elapsedSeconds / (distanceMeters / 1000);
  return `${Math.floor(secondsPerKm / 60)}:${String(Math.round(secondsPerKm % 60)).padStart(2, "0")} /km`;
}

function avgSpeed(distanceMeters: number, elapsedSeconds: number) {
  if (elapsedSeconds <= 0) return "0.0";
  return ((distanceMeters / 1000) / (elapsedSeconds / 3600)).toFixed(1);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function estimateCalories(mode: "walk" | "run", elapsedSeconds: number, weightKg: number) {
  const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const met = mode === "run" ? 9.8 : 3.5;
  return {
    minutes,
    calories: Math.round(met * weightKg * (minutes / 60)),
    intensity: mode === "run" ? ("high" as const) : ("low" as const),
  };
}

function routePath(points: TrackPoint[], width = 640, height = 360) {
  if (points.length < 2) return "";
  const minLat = Math.min(...points.map((p) => p.lat));
  const maxLat = Math.max(...points.map((p) => p.lat));
  const minLng = Math.min(...points.map((p) => p.lng));
  const maxLng = Math.max(...points.map((p) => p.lng));
  const latSpan = Math.max(0.00001, maxLat - minLat);
  const lngSpan = Math.max(0.00001, maxLng - minLng);
  const padding = 28;
  return points
    .map((point, index) => {
      const x = padding + ((point.lng - minLng) / lngSpan) * (width - padding * 2);
      const y = padding + ((maxLat - point.lat) / latSpan) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function lngToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number) {
  const rad = toRad(lat);
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

function projectPoint(point: TrackPoint, center: TrackPoint, zoom: number, width = 640, height = 360) {
  const scale = 256;
  const centerX = lngToTileX(center.lng, zoom) * scale;
  const centerY = latToTileY(center.lat, zoom) * scale;
  const pointX = lngToTileX(point.lng, zoom) * scale;
  const pointY = latToTileY(point.lat, zoom) * scale;
  return {
    x: width / 2 + pointX - centerX,
    y: height / 2 + pointY - centerY,
  };
}

function mapRoutePath(points: TrackPoint[], center: TrackPoint | null, zoom: number, width = 640, height = 360) {
  if (!center || points.length < 2) return "";
  return points
    .map((point, index) => {
      const projected = projectPoint(point, center, zoom, width, height);
      return `${index === 0 ? "M" : "L"} ${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
    })
    .join(" ");
}

function mapTiles(center: TrackPoint | null, zoom: number, width = 640, height = 360) {
  if (!center) return [];
  const scale = 256;
  const centerTileX = lngToTileX(center.lng, zoom);
  const centerTileY = latToTileY(center.lat, zoom);
  const centerPixelX = centerTileX * scale;
  const centerPixelY = centerTileY * scale;
  const startTileX = Math.floor(centerTileX) - 2;
  const startTileY = Math.floor(centerTileY) - 2;
  const tiles: Array<{ key: string; url: string; x: number; y: number }> = [];

  for (let x = startTileX; x <= startTileX + 4; x += 1) {
    for (let y = startTileY; y <= startTileY + 4; y += 1) {
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        x: width / 2 + x * scale - centerPixelX,
        y: height / 2 + y * scale - centerPixelY,
      });
    }
  }

  return tiles;
}

function loadActivities() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedActivity[];
  } catch {
    return [];
  }
}

export function TrackExperience() {
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const taskId = searchParams.get("taskId");
  const targetDistance = Number(searchParams.get("targetDistance"));
  const missionTargetMeters = Number.isFinite(targetDistance) && targetDistance > 0 ? targetDistance : null;
  const watchRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedOnFinishRef = useRef(false);
  const [mode, setMode] = useState<"walk" | "run">("run");
  const [status, setStatus] = useState<"idle" | "tracking" | "paused" | "complete">("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [savedActivities, setSavedActivities] = useState<SavedActivity[]>([]);
  const [missionCompleted, setMissionCompleted] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const { data: cardioPresets } = trpc.exercise.getPresets.useQuery({ category: "cardio" });
  const { data: profile } = trpc.user.getProfile.useQuery();
  const logExercise = trpc.exercise.logExercise.useMutation({
    onSuccess: async () => {
      await utils.exercise.getDay.invalidate({ date: localDateString() });
    },
  });
  const completeTask = trpc.tasks.completeTask.useMutation({
    onSuccess: (data) => {
      setMissionCompleted(true);
      toast.success(data.message);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  useEffect(() => {
    setSavedActivities(loadActivities());
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (timerRef.current != null) window.clearInterval(timerRef.current);
    };
  }, []);

  const path = useMemo(() => routePath(points), [points]);
  const liveSpeed = points.at(-1)?.speed;
  const missionProgress = missionTargetMeters ? Math.min(100, Math.round((distanceMeters / missionTargetMeters) * 100)) : 0;
  const activityBurn = estimateCalories(mode, elapsedSeconds, Number(profile?.currentWeightKg ?? DEFAULT_TRACK_WEIGHT_KG));

  const stopWatch = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("GPS is not available in this browser.");
      return;
    }
    setError(null);
    setStatus("tracking");
    if (!startTimeRef.current) startTimeRef.current = Date.now() - elapsedSeconds * 1000;
    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));
      }
    }, 1000);
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next: TrackPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };
        setPoints((current) => {
          const previous = current.at(-1);
          if (previous && distanceBetween(previous, next) < 2) return current;
          const nextPoints = [...current, next];
          if (previous) setDistanceMeters((value) => value + distanceBetween(previous, next));
          return nextPoints;
        });
      },
      (geoError) => {
        setError(geoError.message || "Could not read live location.");
        setStatus("paused");
        stopWatch();
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
    );
  };

  const pauseTracking = () => {
    stopWatch();
    setStatus("paused");
  };

  const finishTracking = () => {
    stopWatch();
    setStatus("complete");
    if (!savedOnFinishRef.current) {
      savedOnFinishRef.current = true;
      const activity = saveActivity();
      const optionQuery = mode === "run" ? "running" : "walking";
      const existing = cardioPresets?.find((preset) => preset.name.toLowerCase().includes(optionQuery));
      if (existing?.id) {
        logExercise.mutate({
          date: localDateString(),
          exerciseId: existing.id,
          durationMin: activityBurn.minutes,
          caloriesBurned: activityBurn.calories,
          intensity: activityBurn.intensity,
          note: `${km(activity.distanceMeters)} km ${mode} from GPS tracker`,
        });
      }
      const message = CELEBRATION_LINES[Math.floor(Math.random() * CELEBRATION_LINES.length)];
      setCompletionMessage(message);
      toast.success(`${message} ${activityBurn.calories} kcal deducted from today's guide.`);
    }
    if (taskId && missionTargetMeters && distanceMeters >= missionTargetMeters && !missionCompleted) {
      completeTask.mutate({
        taskKey: taskId,
        distanceMeters,
        source: "tracker",
      });
    }
  };

  const resetTracking = () => {
    stopWatch();
    startTimeRef.current = null;
    setStatus("idle");
    setPoints([]);
    setElapsedSeconds(0);
    setDistanceMeters(0);
    setPhotoDataUrl(undefined);
    setError(null);
    setCompletionMessage(null);
    savedOnFinishRef.current = false;
  };

  const saveActivity = () => {
    const activity: SavedActivity = {
      id: `${Date.now()}`,
      mode,
      title: `${mode === "run" ? "Run" : "Walk"} in FitNMove`,
      points,
      distanceMeters,
      elapsedSeconds,
      startedAt: startTimeRef.current ?? Date.now(),
      endedAt: Date.now(),
      photoDataUrl,
    };
    const next = [activity, ...savedActivities].slice(0, 20);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedActivities(next);
    return activity;
  };

  const handlePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const exportImage = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#F7FAF9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#123F37";
    ctx.fillRect(0, 0, canvas.width, 430);
    ctx.fillStyle = "#20C7A4";
    ctx.font = "bold 34px Arial";
    ctx.fillText("SWASTHA ACTIVITY", 70, 105);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 92px Arial";
    ctx.fillText(`${km(distanceMeters)} km`, 70, 230);
    ctx.font = "36px Arial";
    ctx.fillText(`${formatTime(elapsedSeconds)} time    ${pace(distanceMeters, elapsedSeconds)} pace`, 70, 305);
    if (photoDataUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 70, 470, 940, 420);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = photoDataUrl;
      });
    }
    ctx.strokeStyle = "#20C7A4";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const exportPath = routePath(points, 940, 300);
    if (exportPath) {
      const commands = exportPath.match(/[ML] [^ML]+/g) ?? [];
      ctx.beginPath();
      commands.forEach((command) => {
        const [kind, x, y] = command.split(" ");
        const px = Number(x) + 70;
        const py = Number(y) + 950;
        if (kind === "M") ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    ctx.fillStyle = "#17201E";
    ctx.font = "bold 42px Arial";
    ctx.fillText(`${mode === "run" ? "Run" : "Walk"} completed`, 70, 1280);
    const link = document.createElement("a");
    link.download = `swastha-${mode}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#071512] px-5 py-8 text-white sm:px-6">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handlePhoto(event.target.files?.[0])} />
      {completionMessage && (
        <div className="fixed inset-x-5 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-[28px] border border-[#20C7A4]/30 bg-white p-6 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF8F4] text-[#123F37]">
            <Route className="h-8 w-8" />
          </div>
          <h2 className="mt-3 text-xl font-black text-[#17201E]">{completionMessage}</h2>
          <p className="mt-2 text-sm font-semibold text-[#6B7773]">
            {km(distanceMeters)} km • {formatTime(elapsedSeconds)} • {activityBurn.calories} kcal deducted from the daily food guide.
          </p>
          {photoDataUrl && <img src={photoDataUrl} alt="Activity" className="mt-4 aspect-video w-full rounded-[18px] object-cover" />}
          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#EAF8F4] px-5 text-sm font-bold text-[#123F37]"
            >
              <Camera className="h-4 w-4" />
              Add activity photo
            </button>
            <button
              type="button"
              onClick={exportImage}
              disabled={points.length < 2}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#20C7A4] px-5 text-sm font-bold text-[#071512] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={resetTracking}
              className="min-h-12 rounded-full border border-[#DDEAE5] px-5 text-sm font-bold text-[#123F37]"
            >
              End
            </button>
          </div>
        </div>
      )}

      <main className="w-full max-w-[520px] text-center">
        {taskId && missionTargetMeters && (
          <div className="mb-8 rounded-[22px] border border-white/10 bg-white/10 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{missionCompleted ? "Mission completed" : "Mission in progress"}</span>
              <span className="text-sm font-black tabular-nums">
                {km(distanceMeters)} / {km(missionTargetMeters)} km
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#20C7A4] transition-all duration-700" style={{ width: `${missionProgress}%` }} />
            </div>
          </div>
        )}

        <div className="mx-auto grid w-full max-w-[220px] grid-cols-2 gap-2 rounded-full bg-white/10 p-1">
          {(["run", "walk"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => status === "idle" && setMode(item)}
              disabled={status !== "idle"}
              className={cn("min-h-11 rounded-full text-sm font-bold capitalize transition", mode === item ? "bg-emerald-200 text-[#071512]" : "text-white/60", status !== "idle" && "cursor-not-allowed opacity-70")}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-12">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200/70">{status === "idle" ? "Ready" : status === "complete" ? "Finished" : mode}</p>
          <p className="mt-4 text-[72px] font-black leading-none tracking-normal sm:text-[96px]">{km(distanceMeters)}</p>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.22em] text-white/50">km</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-sm grid-cols-3 gap-3">
          {[
            ["Time", formatTime(elapsedSeconds)],
            ["Pace", pace(distanceMeters, elapsedSeconds)],
            ["Speed", liveSpeed != null ? `${(liveSpeed * 3.6).toFixed(1)}` : avgSpeed(distanceMeters, elapsedSeconds)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-[18px] border border-white/10 bg-white/8 p-3">
              <p className="truncate text-[11px] font-semibold text-white/45">{label}</p>
              <p className="mt-1 truncate text-sm font-black tabular-nums text-white">{value}</p>
            </div>
          ))}
        </div>

        {error && <p className="mx-auto mt-6 max-w-sm rounded-[16px] bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

        <div className="mt-12 flex flex-col items-center gap-4">
          {status === "tracking" ? (
            <button
              type="button"
              onClick={pauseTracking}
              className="inline-flex h-28 w-28 items-center justify-center rounded-full bg-white text-[#071512] shadow-[0_0_80px_rgba(255,255,255,0.18)]"
              aria-label="Pause activity"
            >
              <Pause className="h-11 w-11 fill-[#071512]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startTracking}
              disabled={status === "complete"}
              className="inline-flex h-28 w-28 items-center justify-center rounded-full bg-[#20C7A4] text-[#071512] shadow-[0_0_80px_rgba(32,199,164,0.28)] disabled:opacity-50"
              aria-label={status === "paused" ? "Resume activity" : "Start activity"}
            >
              <Play className="ml-1 h-12 w-12 fill-[#071512]" />
            </button>
          )}

          {(status === "tracking" || status === "paused") && (
            <button
              type="button"
              onClick={finishTracking}
              disabled={elapsedSeconds < 1}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 px-6 text-sm font-black text-white disabled:opacity-45"
            >
              <Square className="h-4 w-4 fill-white" />
              Finish
            </button>
          )}

          {status === "complete" && !completionMessage && (
            <button
              type="button"
              onClick={() => setCompletionMessage("Activity complete.")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 px-6 text-sm font-black text-white"
            >
              Options
            </button>
          )}

          {status !== "idle" && (
            <button type="button" onClick={resetTracking} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white/55">
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          )}
        </div>

        {path && (
          <svg viewBox="0 0 640 360" className="mx-auto mt-10 h-28 w-full max-w-sm opacity-70">
            <path d={path} fill="none" stroke="#6EE7B7" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </main>
    </div>
  );
}
