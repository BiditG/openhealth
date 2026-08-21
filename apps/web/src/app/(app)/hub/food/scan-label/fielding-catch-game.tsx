"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Target,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Landmark = { x: number; y: number; z?: number; visibility?: number };
type PoseLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Landmark[][] };
  close?: () => void;
};
type Phase = "setup" | "countdown" | "active" | "paused" | "summary";
type CameraStatus = "idle" | "loading" | "ready" | "error";
type DifficultyKey = "easy" | "normal" | "hard";
type ModeKey = "quick12" | "thirtySeconds" | "survival";
type CatchQuality = "Safe Catch" | "Good Catch" | "Dropped" | null;
type Point = { x: number; y: number; z?: number };
type BodyFrame = { shoulderMid: Point; hipMid: Point; shoulderWidth: number; torsoLength: number };
type BallState = {
  id: number;
  start: Point;
  target: Point;
  radius: number;
  startAt: number;
  durationMs: number;
  status: "incoming" | "caught" | "dropped";
  caughtAt?: number;
};
type Metrics = {
  catches: number;
  drops: number;
  balls: number;
  streak: number;
  bestStreak: number;
  safeCatches: number;
  startedAt: number | null;
  endedAt: number | null;
};

const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const MODES: Record<ModeKey, { label: string; description: string; ballLimit?: number; seconds?: number; survivalDrops?: number }> = {
  quick12: { label: "Quick 12 Catches", description: "Twelve throws, catch as many as you can.", ballLimit: 12 },
  thirtySeconds: { label: "30-Second Fielding", description: "Fast catches until the timer ends.", seconds: 30 },
  survival: { label: "Survival Fielding", description: "Three drops ends the drill.", survivalDrops: 3 },
};

const DIFFICULTIES: Record<DifficultyKey, { label: string; duration: number; tolerance: number; radius: number }> = {
  easy: { label: "Easy", duration: 2200, tolerance: 0.2, radius: 0.055 },
  normal: { label: "Normal", duration: 1750, tolerance: 0.16, radius: 0.045 },
  hard: { label: "Hard", duration: 1350, tolerance: 0.125, radius: 0.038 },
};

const CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
];

const createMetrics = (): Metrics => ({
  catches: 0,
  drops: 0,
  balls: 0,
  streak: 0,
  bestStreak: 0,
  safeCatches: 0,
  startedAt: null,
  endedAt: null,
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function visible(point?: Landmark, min = 0.42) {
  return Boolean(point) && (point?.visibility ?? 1) >= min;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Landmark, b: Landmark): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 };
}

function getBodyFrame(landmarks?: Landmark[]): BodyFrame | null {
  const leftShoulder = landmarks?.[11];
  const rightShoulder = landmarks?.[12];
  const leftHip = landmarks?.[23];
  const rightHip = landmarks?.[24];
  if (!visible(leftShoulder) || !visible(rightShoulder) || !visible(leftHip, 0.34) || !visible(rightHip, 0.34)) return null;
  const shoulderMid = midpoint(leftShoulder as Landmark, rightShoulder as Landmark);
  const hipMid = midpoint(leftHip as Landmark, rightHip as Landmark);
  return {
    shoulderMid,
    hipMid,
    shoulderWidth: clamp(distance(leftShoulder as Landmark, rightShoulder as Landmark), 0.08, 0.42),
    torsoLength: clamp(distance(shoulderMid, hipMid), 0.12, 0.5),
  };
}

function getBallPosition(ball: BallState, now: number) {
  const progress = clamp((now - ball.startAt) / ball.durationMs, 0, 1.18);
  const eased = progress <= 1 ? progress * progress * (3 - 2 * progress) : progress;
  return {
    x: ball.start.x + (ball.target.x - ball.start.x) * eased,
    y: ball.start.y + (ball.target.y - ball.start.y) * eased,
    progress,
  };
}

function getHands(landmarks?: Landmark[]) {
  return [landmarks?.[15], landmarks?.[16]]
    .filter((point): point is Landmark => visible(point, 0.35))
    .map((point) => ({ x: point.x, y: point.y, z: point.z ?? 0 }));
}

async function loadPoseLandmarker(): Promise<PoseLandmarkerLike> {
  const dynamicImport = new Function("url", "return import(url)") as (
    url: string
  ) => Promise<{
    FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
    PoseLandmarker: { createFromOptions: (vision: unknown, options: Record<string, unknown>) => Promise<PoseLandmarkerLike> };
  }>;
  const visionTasks = await dynamicImport(TASKS_VISION_URL);
  const vision = await visionTasks.FilesetResolver.forVisionTasks(WASM_URL);
  return visionTasks.PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "CPU" },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.42,
    minPosePresenceConfidence: 0.42,
    minTrackingConfidence: 0.42,
  });
}

export function FieldingCatchGame() {
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const ballRef = useRef<BallState | null>(null);
  const ballSerialRef = useRef(0);
  const serveTimeoutRef = useRef<number | null>(null);
  const resultTimeoutRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectTimestampRef = useRef(0);
  const detectionErrorCountRef = useRef(0);
  const phaseRef = useRef<Phase>("setup");
  const modeRef = useRef<ModeKey>("quick12");
  const difficultyRef = useRef<DifficultyKey>("easy");
  const soundEnabledRef = useRef(true);
  const metricsRef = useRef<Metrics>(createMetrics());
  const audioContextRef = useRef<AudioContext | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [mode, setMode] = useState<ModeKey>("quick12");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("easy");
  const [metrics, setMetrics] = useState<Metrics>(() => createMetrics());
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [countdown, setCountdown] = useState<number | "START" | null>(null);
  const [feedback, setFeedback] = useState("Start camera and keep both hands visible.");
  const [quality, setQuality] = useState<CatchQuality>(null);
  const [lastResult, setLastResult] = useState<{ title: string; kind: "catch" | "drop" } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(() => MODES[mode], [mode]);
  const catchRate = metrics.balls > 0 ? Math.round((metrics.catches / metrics.balls) * 100) : 0;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const commitMetrics = useCallback((updater: (current: Metrics) => Metrics) => {
    const next = updater(metricsRef.current);
    metricsRef.current = next;
    setMetrics(next);
  }, []);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  }, []);

  const playSound = useCallback(
    (kind: "catch" | "drop" | "start") => {
      if (!soundEnabledRef.current) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "drop" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(kind === "catch" ? 760 : kind === "drop" ? 180 : 420, now);
      if (kind === "catch") osc.frequency.exponentialRampToValueAtTime(980, now + 0.1);
      gain.gain.setValueAtTime(kind === "drop" ? 0.045 : 0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    },
    [getAudioContext]
  );

  const showResult = useCallback((result: { title: string; kind: "catch" | "drop" }) => {
    setLastResult(result);
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = window.setTimeout(() => setLastResult(null), 900);
  }, []);

  const shouldEnd = useCallback((next: Metrics) => {
    const activeMode = MODES[modeRef.current];
    if (activeMode.ballLimit && next.balls >= activeMode.ballLimit) return true;
    if (activeMode.survivalDrops && next.drops >= activeMode.survivalDrops) return true;
    return false;
  }, []);

  const finishGame = useCallback(() => {
    setPhase("summary");
    ballRef.current = null;
    if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
    commitMetrics((current) => ({ ...current, endedAt: performance.now() }));
    setFeedback("Fielding drill complete.");
  }, [commitMetrics]);

  const scheduleNextBall = useCallback((delay = 850) => {
    if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
    serveTimeoutRef.current = window.setTimeout(() => {
      ballRef.current = null;
    }, delay);
  }, []);

  const spawnBall = useCallback((body: BodyFrame) => {
    const diff = DIFFICULTIES[difficultyRef.current];
    const ramp = Math.min(0.28, metricsRef.current.balls * 0.018);
    const x = clamp(body.shoulderMid.x + (Math.random() - 0.5) * body.shoulderWidth * 1.55, 0.14, 0.86);
    const y = clamp(body.shoulderMid.y + body.torsoLength * (0.15 + Math.random() * 0.45), 0.24, 0.8);
    ballSerialRef.current += 1;
    ballRef.current = {
      id: ballSerialRef.current,
      start: { x: clamp(x + (Math.random() - 0.5) * 0.22, 0.1, 0.9), y: 0.04 },
      target: { x, y },
      radius: diff.radius,
      startAt: performance.now(),
      durationMs: diff.duration * (1 - ramp),
      status: "incoming",
    };
    setFeedback("Track the ball.");
  }, []);

  const drawScene = useCallback((landmarks?: Landmark[], body?: BodyFrame | null) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const width = video.videoWidth || canvas.clientWidth;
    const height = video.videoHeight || canvas.clientHeight;
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    if (body) {
      const gloveR = body.shoulderWidth * 0.34 * width;
      const y = (body.shoulderMid.y + body.torsoLength * 0.22) * height;
      ctx.save();
      ctx.fillStyle = "rgba(20, 184, 166, 0.08)";
      ctx.strokeStyle = "rgba(20, 184, 166, 0.42)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.arc(body.shoulderMid.x * width, y, gloveR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (landmarks) {
      ctx.lineCap = "round";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.52)";
      CONNECTIONS.forEach(([aIndex, bIndex]) => {
        const a = landmarks[aIndex];
        const b = landmarks[bIndex];
        if (!visible(a) || !visible(b)) return;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      });
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(45, 212, 191, 0.9)";
      CONNECTIONS.forEach(([aIndex, bIndex]) => {
        const a = landmarks[aIndex];
        const b = landmarks[bIndex];
        if (!visible(a) || !visible(b)) return;
        ctx.globalAlpha = [13, 14, 15, 16].includes(aIndex) || [13, 14, 15, 16].includes(bIndex) ? 1 : 0.34;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      getHands(landmarks).forEach((hand) => {
        ctx.beginPath();
        ctx.fillStyle = "rgba(20, 184, 166, 0.96)";
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 4;
        ctx.arc(hand.x * width, hand.y * height, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    const ball = ballRef.current;
    if (ball) {
      const now = performance.now();
      const position = getBallPosition(ball, now);
      const x = position.x * width;
      const y = position.y * height;
      const r = ball.radius * Math.min(width, height);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.24)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ball.start.x * width, ball.start.y * height);
      ctx.lineTo(ball.target.x * width, ball.target.y * height);
      ctx.stroke();
      ctx.shadowColor = ball.status === "caught" ? "rgba(16,185,129,0.9)" : "rgba(251,191,36,0.75)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = ball.status === "caught" ? "rgba(16,185,129,0.95)" : "rgba(251,191,36,0.98)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  const registerCatch = useCallback((safe: boolean) => {
    playSound("catch");
    setQuality(safe ? "Safe Catch" : "Good Catch");
    showResult({ title: safe ? "SAFE CATCH" : "CATCH!", kind: "catch" });
    setFeedback(safe ? "Safe hands!" : "Good catch!");
    if (ballRef.current) ballRef.current = { ...ballRef.current, status: "caught", caughtAt: performance.now() };
    commitMetrics((current) => {
      const streak = current.streak + 1;
      const next = {
        ...current,
        catches: current.catches + 1,
        safeCatches: current.safeCatches + (safe ? 1 : 0),
        balls: current.balls + 1,
        streak,
        bestStreak: Math.max(current.bestStreak, streak),
      };
      if (shouldEnd(next)) window.setTimeout(finishGame, 700);
      return next;
    });
    scheduleNextBall(850);
  }, [commitMetrics, finishGame, playSound, scheduleNextBall, shouldEnd, showResult]);

  const registerDrop = useCallback(() => {
    playSound("drop");
    setQuality("Dropped");
    showResult({ title: "DROPPED", kind: "drop" });
    setFeedback("Dropped. Reset your hands.");
    commitMetrics((current) => {
      const next = { ...current, drops: current.drops + 1, balls: current.balls + 1, streak: 0 };
      if (shouldEnd(next)) window.setTimeout(finishGame, 700);
      return next;
    });
    scheduleNextBall(850);
  }, [commitMetrics, finishGame, playSound, scheduleNextBall, shouldEnd, showResult]);

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const usable =
      video &&
      landmarker &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      video.currentTime !== lastVideoTimeRef.current;
    if (usable) {
      const timestamp = Math.max(performance.now(), lastDetectTimestampRef.current + 1);
      lastDetectTimestampRef.current = timestamp;
      try {
        const result = landmarker.detectForVideo(video, timestamp);
        const landmarks = result.landmarks?.[0];
        const body = getBodyFrame(landmarks);
        drawScene(landmarks, body);
        if (!body) {
          if (phaseRef.current === "active") setFeedback("Step back so upper body and hands are visible.");
          lastVideoTimeRef.current = video.currentTime;
          animationRef.current = requestAnimationFrame(runDetectionLoop);
          return;
        }
        if (phaseRef.current === "active") {
          if (!ballRef.current) {
            spawnBall(body);
          } else if (ballRef.current.status === "incoming") {
            const position = getBallPosition(ballRef.current, timestamp);
            const hands = getHands(landmarks);
            const tolerance = ballRef.current.radius + body.shoulderWidth * DIFFICULTIES[difficultyRef.current].tolerance;
            const caught = hands.some((hand) => distance(hand, position) <= tolerance);
            if (caught && position.progress >= 0.45) {
              registerCatch(position.progress >= 0.62 && position.progress <= 0.96);
            } else if (position.progress > 1.06) {
              registerDrop();
            } else if (position.progress < 0.45) {
              setFeedback("Wait for the ball.");
            }
          }
        }
        detectionErrorCountRef.current = 0;
      } catch {
        detectionErrorCountRef.current += 1;
        if (detectionErrorCountRef.current > 4) {
          setFeedback("Camera is settling. Keep hands visible.");
        }
      }
      lastVideoTimeRef.current = video.currentTime;
    }
    animationRef.current = requestAnimationFrame(runDetectionLoop);
  }, [drawScene, registerCatch, registerDrop, spawnBall]);

  const stopLoop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    ballRef.current = null;
    drawScene(undefined, null);
    setCameraStatus("idle");
  }, [drawScene, stopLoop]);

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraStatus("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported in this browser.");
      if (!landmarkerRef.current) landmarkerRef.current = await loadPoseLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      lastVideoTimeRef.current = -1;
      lastDetectTimestampRef.current = 0;
      detectionErrorCountRef.current = 0;
      setCameraStatus("ready");
      setFeedback("Ready. Raise your hands into the catch zone.");
      stopLoop();
      animationRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start fielding camera.");
      setCameraStatus("error");
      stopCamera();
    }
  }, [runDetectionLoop, stopCamera, stopLoop]);

  const beginGame = useCallback(async () => {
    if (!streamRef.current || cameraStatus !== "ready") await startCamera();
    if (!streamRef.current) return;
    const fresh = createMetrics();
    metricsRef.current = fresh;
    setMetrics(fresh);
    setQuality(null);
    setLastResult(null);
    ballRef.current = null;
    setSecondsRemaining(selectedMode.seconds ?? 0);
    setCountdown(3);
    setFeedback("Ready");
    setPhase("countdown");
    playSound("start");
  }, [cameraStatus, playSound, selectedMode.seconds, startCamera]);

  const resetGame = useCallback(() => {
    const fresh = createMetrics();
    metricsRef.current = fresh;
    setMetrics(fresh);
    setQuality(null);
    setLastResult(null);
    ballRef.current = null;
    setCountdown(null);
    setSecondsRemaining(selectedMode.seconds ?? 0);
    setFeedback("Start when ready.");
    setPhase("setup");
  }, [selectedMode.seconds]);

  const toggleFullscreen = useCallback(async () => {
    const shell = cameraShellRef.current;
    if (!shell || typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else {
        setIsFullscreen((value) => !value);
      }
    } catch {
      setIsFullscreen((value) => !value);
    }
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return undefined;
    let current = 3;
    setCountdown(current);
    const interval = window.setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
        playSound("start");
      } else if (current === 0) {
        setCountdown("START");
        playSound("start");
      } else {
        window.clearInterval(interval);
        commitMetrics((existing) => ({ ...existing, startedAt: performance.now(), endedAt: null }));
        setPhase("active");
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [commitMetrics, phase, playSound]);

  useEffect(() => {
    if (phase !== "active" || !selectedMode.seconds) return undefined;
    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          finishGame();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [finishGame, phase, selectedMode.seconds]);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === cameraShellRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    setSecondsRemaining(selectedMode.seconds ?? 0);
  }, [selectedMode.seconds]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (document.fullscreenElement === cameraShellRef.current) void document.exitFullscreen().catch(() => undefined);
      if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
      if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
      landmarkerRef.current?.close?.();
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, [stopCamera]);

  const ballLabel = selectedMode.ballLimit ? `${metrics.balls}/${selectedMode.ballLimit}` : String(metrics.balls);

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Cricket Fielding</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Ball Catching</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedMode.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setSoundEnabled((value) => !value)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
        {(phase === "setup" || phase === "summary") && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Mode</span>
              <span className="relative block">
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as ModeKey)}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                >
                  {Object.entries(MODES).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </span>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Difficulty</span>
              <span className="relative block">
                <select
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as DifficultyKey)}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                >
                  {Object.entries(DIFFICULTIES).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </span>
            </label>
          </div>
        )}
      </div>

      <div
        ref={cameraShellRef}
        className={cn(
          "relative min-h-[560px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 shadow-sm sm:min-h-[640px]",
          isFullscreen && "fixed inset-0 z-[90] min-h-screen rounded-none border-0 sm:min-h-screen"
        )}
      >
        <video ref={videoRef} playsInline muted className={cn("absolute inset-0 h-full w-full object-cover scale-x-[-1]", cameraStatus === "ready" ? "opacity-100" : "opacity-30")} />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" />

        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
          <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-white shadow-sm backdrop-blur-md">
            <p className="text-sm font-semibold">{selectedMode.label}</p>
            <p className="text-xs text-white/72">Catch with either hand</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-right text-white shadow-sm backdrop-blur-md">
              <p className="text-sm font-black">{secondsRemaining > 0 ? `${secondsRemaining}s` : ballLabel}</p>
              <p className="text-xs text-white/72">{secondsRemaining > 0 ? "Timer" : "Balls"}</p>
            </div>
            <button type="button" onClick={toggleFullscreen} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/34 text-white backdrop-blur-md">
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {phase === "countdown" && (
          <div className="absolute left-1/2 top-[46%] flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-teal-500/88 text-5xl font-black text-white shadow-2xl backdrop-blur-md">
            {countdown}
          </div>
        )}

        {lastResult && (
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/25 bg-white/94 px-6 py-5 text-center shadow-2xl backdrop-blur-md">
            <p className={cn("text-4xl font-black leading-none", lastResult.kind === "drop" ? "text-red-600" : "text-emerald-700")}>{lastResult.title}</p>
          </div>
        )}

        {(cameraStatus !== "ready" || phase === "setup") && (
          <div className="absolute inset-x-5 bottom-28 rounded-[24px] border border-white/18 bg-white/92 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-950">Stand back, hands ready</p>
                <p className="mt-1 text-sm text-slate-600">Track the yellow ball and move a hand into it inside the catch circle.</p>
              </div>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}

        {phase === "summary" && (
          <div className="absolute inset-x-5 top-24 rounded-[24px] border border-white/18 bg-white/94 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-950">Fielding complete</p>
                <p className="text-sm text-slate-500">{metrics.catches} catches • {catchRate}% catch rate</p>
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-4 bottom-4 space-y-3">
          <div className="mx-auto w-fit max-w-full rounded-full border border-white/18 bg-black/38 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm backdrop-blur-md">
            {feedback}
          </div>
          <div className="rounded-[24px] border border-white/18 bg-white/94 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">Catches</p>
                <p className="leading-none text-5xl font-black text-slate-950">{metrics.catches}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-right text-sm">
                <div><p className="font-black text-slate-950">{ballLabel}</p><p className="text-xs font-semibold text-slate-500">Balls</p></div>
                <div><p className="font-black text-slate-950">{metrics.drops}</p><p className="text-xs font-semibold text-slate-500">Drops</p></div>
                <div><p className="font-black text-slate-950">{metrics.streak}</p><p className="text-xs font-semibold text-slate-500">Streak</p></div>
                <div><p className="font-black text-slate-950">{quality ?? "-"}</p><p className="text-xs font-semibold text-slate-500">Last</p></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {cameraStatus !== "ready" ? (
                <button type="button" onClick={startCamera} disabled={cameraStatus === "loading"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70">
                  {cameraStatus === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} Start camera
                </button>
              ) : phase === "active" ? (
                <>
                  <button type="button" onClick={() => setPhase("paused")} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-sm"><Pause className="h-5 w-5" /> Pause</button>
                  <button type="button" onClick={finishGame} className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700">End</button>
                </>
              ) : phase === "paused" ? (
                <button type="button" onClick={() => setPhase("active")} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm"><Play className="h-5 w-5" /> Resume</button>
              ) : (
                <>
                  <button type="button" onClick={beginGame} disabled={phase === "countdown"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"><Play className="h-5 w-5" /> Start fielding</button>
                  {phase === "summary" && <button type="button" onClick={resetGame} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700"><RotateCcw className="h-5 w-5" /> Reset</button>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {phase === "summary" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.catches}</p><p className="text-xs font-semibold text-slate-500">Catches</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.drops}</p><p className="text-xs font-semibold text-slate-500">Drops</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{catchRate}%</p><p className="text-xs font-semibold text-slate-500">Catch rate</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.safeCatches}</p><p className="text-xs font-semibold text-slate-500">Safe catches</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.bestStreak}</p><p className="text-xs font-semibold text-slate-500">Best streak</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
