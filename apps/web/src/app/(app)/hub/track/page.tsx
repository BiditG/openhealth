"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  Download,
  Loader2,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Route,
  Save,
  Square,
  Timer,
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

export default function TrackPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");
  const targetDistance = Number(searchParams.get("targetDistance"));
  const missionTargetMeters = Number.isFinite(targetDistance) && targetDistance > 0 ? targetDistance : null;
  const watchRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"walk" | "run">("run");
  const [status, setStatus] = useState<"idle" | "tracking" | "paused" | "complete">("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [savedActivities, setSavedActivities] = useState<SavedActivity[]>([]);
  const [missionCompleted, setMissionCompleted] = useState(false);
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
  const mapCenter = points.at(-1) ?? points[0] ?? null;
  const mapZoom = points.length > 1 && distanceMeters > 5000 ? 13 : points.length > 1 && distanceMeters > 1500 ? 14 : 15;
  const tiles = useMemo(() => mapTiles(mapCenter, mapZoom), [mapCenter, mapZoom]);
  const liveRoutePath = useMemo(() => mapRoutePath(points, mapCenter, mapZoom), [points, mapCenter, mapZoom]);
  const liveSpeed = points.at(-1)?.speed;
  const missionProgress = missionTargetMeters ? Math.min(100, Math.round((distanceMeters / missionTargetMeters) * 100)) : 0;

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
  };

  const saveActivity = () => {
    const activity: SavedActivity = {
      id: `${Date.now()}`,
      mode,
      title: `${mode === "run" ? "Run" : "Walk"} in Swastha`,
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
    <div className="min-h-screen bg-[#F7FAF9] px-4 py-5 sm:px-6 lg:px-0">
      <section className="overflow-hidden rounded-[26px] bg-[#123F37] p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Track you</p>
        <h1 className="mt-3 text-3xl font-black tracking-normal">Record your walk or run</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
          GPS tracking, distance, speed, time, route review, photos, and share image export. Saved activities stay available offline on this device.
        </p>
        {taskId && missionTargetMeters && (
          <div className="mt-5 rounded-[18px] bg-white/10 p-4">
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
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-[22px] border border-[#E3EAE7] bg-white shadow-sm">
          <div className="relative h-[360px] bg-[#EAF8F4]">
            <div className="absolute inset-0 overflow-hidden">
              {tiles.map((tile) => (
                <img
                  key={tile.key}
                  src={tile.url}
                  alt=""
                  className="absolute h-64 w-64 select-none"
                  style={{ left: tile.x, top: tile.y }}
                  draggable={false}
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
            <svg viewBox="0 0 640 360" className="absolute inset-0 h-full w-full">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#D8E6E1" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="640" height="360" fill={tiles.length ? "rgba(234,248,244,0.12)" : "url(#grid)"} />
              {liveRoutePath && <path d={liveRoutePath} fill="none" stroke="#123F37" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />}
              {!liveRoutePath && path && <path d={path} fill="none" stroke="#123F37" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />}
              {mapCenter && <circle cx="320" cy="180" r="9" fill="#20C7A4" stroke="#FFFFFF" strokeWidth="4" />}
            </svg>
            <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-[#123F37] shadow-sm">
              {points.length ? `${points.length} GPS points` : "Waiting for GPS"}
            </div>
            <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[#6B7773] shadow-sm">
              Map tiles © OpenStreetMap
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              ["Distance", `${km(distanceMeters)} km`],
              ["Time", formatTime(elapsedSeconds)],
              ["Pace", pace(distanceMeters, elapsedSeconds)],
              ["Speed", liveSpeed != null ? `${(liveSpeed * 3.6).toFixed(1)} km/h` : `${avgSpeed(distanceMeters, elapsedSeconds)} km/h`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[16px] bg-[#F7FAF9] p-4">
                <p className="text-xs font-semibold text-[#6B7773]">{label}</p>
                <p className="mt-1 text-xl font-black tabular-nums text-[#17201E]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[22px] border border-[#E3EAE7] bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2 rounded-full bg-[#F7FAF9] p-1">
              {(["run", "walk"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={cn("min-h-11 rounded-full text-sm font-bold capitalize", mode === item ? "bg-[#123F37] text-white" : "text-[#6B7773]")}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {status === "tracking" ? (
                <button type="button" onClick={pauseTracking} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#EAF8F4] font-bold text-[#123F37]">
                  <Pause className="h-4 w-4" />
                  Pause
                </button>
              ) : (
                <button type="button" onClick={startTracking} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#123F37] font-bold text-white">
                  <Play className="h-4 w-4" />
                  {status === "paused" ? "Resume" : "Start"}
                </button>
              )}
              <button type="button" onClick={finishTracking} disabled={points.length < 2} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#20C7A4] font-bold text-[#123F37] disabled:opacity-50">
                <Square className="h-4 w-4" />
                Finish
              </button>
              <button type="button" onClick={resetTracking} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#E3EAE7] font-bold text-[#123F37]">
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button type="button" onClick={saveActivity} disabled={status !== "complete"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#E3EAE7] font-bold text-[#123F37] disabled:opacity-50">
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
            {error && <p className="mt-3 rounded-[14px] bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </section>

          <section className="rounded-[22px] border border-[#E3EAE7] bg-white p-4 shadow-sm">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handlePhoto(event.target.files?.[0])} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#EAF8F4] font-bold text-[#123F37]">
              <Camera className="h-4 w-4" />
              Add activity photo
            </button>
            {photoDataUrl && <img src={photoDataUrl} alt="Activity" className="mt-3 aspect-video w-full rounded-[16px] object-cover" />}
            <button type="button" onClick={exportImage} disabled={points.length < 2} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#123F37] font-bold text-white disabled:opacity-50">
              <Download className="h-4 w-4" />
              Export share image
            </button>
          </section>

          <section className="rounded-[22px] border border-[#E3EAE7] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-[#17201E]">Offline history</h2>
            <div className="mt-3 space-y-2">
              {savedActivities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-[14px] bg-[#F7FAF9] p-3">
                  <Route className="h-5 w-5 text-[#20C7A4]" />
                  <div>
                    <p className="text-sm font-bold capitalize text-[#17201E]">{activity.mode}</p>
                    <p className="text-xs text-[#6B7773]">{km(activity.distanceMeters)} km - {formatTime(activity.elapsedSeconds)}</p>
                  </div>
                  <Timer className="h-4 w-4 text-[#6B7773]" />
                </div>
              ))}
              {!savedActivities.length && (
                <p className="rounded-[14px] bg-[#F7FAF9] p-3 text-sm text-[#6B7773]">Saved activities will appear here and remain available offline on this device.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
