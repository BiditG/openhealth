"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Flame,
  Heart,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
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
type EscapeMode = "escape" | "storm" | "survival";
type Lane = -1 | 0 | 1;
type Point = { x: number; y: number; z?: number };
type BodyFrame = { shoulderMid: Point; hipMid: Point; shoulderWidth: number; torsoLength: number };
type Fireball = {
  id: number;
  lane: Lane;
  createdAt: number;
  durationMs: number;
  size: number;
  resolved: boolean;
};
type Metrics = {
  score: number;
  dodges: number;
  hits: number;
  streak: number;
  bestStreak: number;
  startedAt: number | null;
  endedAt: number | null;
};

const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const LIVES = 3;

const MODES: Record<EscapeMode, { label: string; description: string; seconds?: number; hitLimit: number }> = {
  escape: {
    label: "Escape From Above",
    description: "Fireballs drop from above. Move quickly between lanes and survive with three lives.",
    seconds: 45,
    hitLimit: LIVES,
  },
  storm: {
    label: "Meteor Storm",
    description: "A faster 30-second storm with tight lane changes.",
    seconds: 30,
    hitLimit: LIVES,
  },
  survival: {
    label: "Last Hero Standing",
    description: "No timer. Keep dodging until all three lives are gone.",
    hitLimit: LIVES,
  },
};

const DIFFICULTIES: Record<DifficultyKey, { label: string; duration: number; spawnMs: number; laneTolerance: number; resolveAt: number }> = {
  easy: { label: "Easy", duration: 1450, spawnMs: 860, laneTolerance: 0.34, resolveAt: 0.74 },
  normal: { label: "Normal", duration: 1120, spawnMs: 620, laneTolerance: 0.28, resolveAt: 0.7 },
  hard: { label: "Hard", duration: 900, spawnMs: 480, laneTolerance: 0.23, resolveAt: 0.66 },
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
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

const createMetrics = (): Metrics => ({
  score: 0,
  dodges: 0,
  hits: 0,
  streak: 0,
  bestStreak: 0,
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

function getBodyLane(body: BodyFrame, baselineX: number, laneWidth: number, tolerance: number): Lane {
  const offset = (body.shoulderMid.x - baselineX) / Math.max(0.001, laneWidth);
  if (offset < -tolerance) return -1;
  if (offset > tolerance) return 1;
  return 0;
}

function fireballProgress(fireball: Fireball, now: number) {
  return clamp((now - fireball.createdAt) / fireball.durationMs, 0, 1.18);
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

export function RunningDodgeGame() {
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const fireballRef = useRef<Fireball | null>(null);
  const fireballSerialRef = useRef(0);
  const spawnTimeoutRef = useRef<number | null>(null);
  const resultTimeoutRef = useRef<number | null>(null);
  const burstTimeoutRef = useRef<number | null>(null);
  const impactBurstRef = useRef<{ lane: Lane; startedAt: number; id: number } | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectTimestampRef = useRef(0);
  const detectionErrorCountRef = useRef(0);
  const baselineXRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("setup");
  const modeRef = useRef<EscapeMode>("escape");
  const difficultyRef = useRef<DifficultyKey>("normal");
  const soundEnabledRef = useRef(true);
  const metricsRef = useRef<Metrics>(createMetrics());
  const audioContextRef = useRef<AudioContext | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [mode, setMode] = useState<EscapeMode>("escape");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("normal");
  const [secondsRemaining, setSecondsRemaining] = useState(MODES.escape.seconds ?? 0);
  const [countdown, setCountdown] = useState<number | "START" | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(() => createMetrics());
  const [feedback, setFeedback] = useState("Start camera and stand in the center lane.");
  const [runnerState, setRunnerState] = useState("Center");
  const [lastResult, setLastResult] = useState<{ title: string; kind: "good" | "bad" } | null>(null);
  const [, setImpactBurst] = useState<{ lane: Lane; startedAt: number; id: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(() => MODES[mode], [mode]);
  const livesRemaining = Math.max(0, LIVES - metrics.hits);
  const dodgeRate = metrics.dodges + metrics.hits > 0 ? Math.round((metrics.dodges / (metrics.dodges + metrics.hits)) * 100) : 0;

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
    (kind: "dodge" | "hit" | "start") => {
      if (!soundEnabledRef.current) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "hit" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(kind === "dodge" ? 820 : kind === "hit" ? 120 : 430, now);
      if (kind === "dodge") osc.frequency.exponentialRampToValueAtTime(1040, now + 0.1);
      if (kind === "hit") osc.frequency.exponentialRampToValueAtTime(64, now + 0.18);
      gain.gain.setValueAtTime(kind === "hit" ? 0.09 : 0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === "hit" ? 0.32 : 0.18));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + (kind === "hit" ? 0.34 : 0.2));

      if (kind === "hit") {
        const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.16), ctx.sampleRate);
        const channel = noiseBuffer.getChannelData(0);
        for (let i = 0; i < channel.length; i += 1) {
          channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
        }
        const noise = ctx.createBufferSource();
        const noiseGain = ctx.createGain();
        noise.buffer = noiseBuffer;
        noiseGain.gain.setValueAtTime(0.08, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.17);
      }
    },
    [getAudioContext]
  );

  const showResult = useCallback((title: string, kind: "good" | "bad") => {
    setLastResult({ title, kind });
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = window.setTimeout(() => setLastResult(null), 760);
  }, []);

  const finishGame = useCallback(() => {
    setPhase("summary");
    fireballRef.current = null;
    impactBurstRef.current = null;
    setImpactBurst(null);
    if (spawnTimeoutRef.current) window.clearTimeout(spawnTimeoutRef.current);
    if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
    commitMetrics((current) => ({ ...current, endedAt: performance.now() }));
    setFeedback("Escape complete.");
  }, [commitMetrics]);

  const shouldEnd = useCallback((next: Metrics) => next.hits >= MODES[modeRef.current].hitLimit, []);

  const scheduleNextFireball = useCallback((delay?: number) => {
    if (spawnTimeoutRef.current) window.clearTimeout(spawnTimeoutRef.current);
    const diff = DIFFICULTIES[difficultyRef.current];
    spawnTimeoutRef.current = window.setTimeout(() => {
      fireballRef.current = null;
    }, delay ?? diff.spawnMs);
  }, []);

  const spawnFireball = useCallback((currentLane?: Lane) => {
    const diff = DIFFICULTIES[difficultyRef.current];
    const lanes: Lane[] = [-1, 0, 1];
    const lane =
      Math.random() < 0.72 && currentLane !== undefined
        ? currentLane
        : lanes[Math.floor(Math.random() * lanes.length)];
    fireballSerialRef.current += 1;
    fireballRef.current = {
      id: fireballSerialRef.current,
      lane,
      createdAt: performance.now(),
      durationMs: modeRef.current === "storm" ? diff.duration * 0.82 : diff.duration,
      size: 0.9 + Math.random() * 0.28,
      resolved: false,
    };
    setFeedback("Fireball incoming. Move!");
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

    const centerX = (baselineXRef.current ?? body?.shoulderMid.x ?? 0.5) * width;
    const laneW = Math.max(88, (body?.shoulderWidth ?? 0.22) * width * 1.04);
    const topY = height * 0.08;
    const dangerY = height * 0.76;
    const floorY = height * 0.9;

    const sky = ctx.createLinearGradient(0, topY, 0, floorY);
    sky.addColorStop(0, "rgba(239,68,68,0.2)");
    sky.addColorStop(0.48, "rgba(15,23,42,0.08)");
    sky.addColorStop(1, "rgba(20,184,166,0.18)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    [-1, 0, 1].forEach((lane) => {
      const x = centerX + lane * laneW;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 14]);
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, floorY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.roundRect(x - laneW * 0.36, dangerY - 40, laneW * 0.72, 96, 22);
      ctx.fill();
    });

    ctx.strokeStyle = "rgba(251,113,133,0.7)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - laneW * 1.45, dangerY);
    ctx.lineTo(centerX + laneW * 1.45, dangerY);
    ctx.stroke();

    const fireball = fireballRef.current;
    if (fireball) {
      const progress = fireballProgress(fireball, performance.now());
      const eased = progress * progress * (3 - 2 * clamp(progress, 0, 1));
      const x = centerX + fireball.lane * laneW;
      const y = topY + (dangerY - topY + 72) * eased;
      const radius = Math.max(26, laneW * 0.22 * fireball.size * (0.7 + progress * 0.48));
      ctx.save();
      ctx.shadowColor = "rgba(249,115,22,0.98)";
      ctx.shadowBlur = 38;
      const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.25, "rgba(251,191,36,0.98)");
      gradient.addColorStop(0.66, "rgba(249,115,22,0.96)");
      gradient.addColorStop(1, "rgba(220,38,38,0.9)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    const burst = impactBurstRef.current;
    if (burst) {
      const elapsed = performance.now() - burst.startedAt;
      const progress = clamp(elapsed / 620, 0, 1);
      if (progress < 1) {
        const x = centerX + burst.lane * laneW;
        const y = dangerY + 20;
        const radius = laneW * (0.28 + progress * 0.82);
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.shadowColor = "rgba(249,115,22,1)";
        ctx.shadowBlur = 44;
        ctx.fillStyle = "rgba(248,113,113,0.2)";
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(3, 12 * (1 - progress));
        ctx.strokeStyle = "rgba(255,255,255,0.88)";
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i += 1) {
          const angle = (Math.PI * 2 * i) / 12;
          const inner = radius * 0.25;
          const outer = radius * (0.58 + progress * 0.55);
          ctx.strokeStyle = i % 2 === 0 ? "rgba(251,191,36,0.95)" : "rgba(248,113,113,0.9)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
          ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (landmarks) {
      ctx.lineCap = "round";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(15,23,42,0.55)";
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
      ctx.strokeStyle = "rgba(45,212,191,0.95)";
      CONNECTIONS.forEach(([aIndex, bIndex]) => {
        const a = landmarks[aIndex];
        const b = landmarks[bIndex];
        if (!visible(a) || !visible(b)) return;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      });
      if (body) {
        ctx.save();
        ctx.shadowColor = "rgba(20,184,166,0.8)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.fillStyle = "rgba(20,184,166,0.98)";
        ctx.strokeStyle = "rgba(255,255,255,0.94)";
        ctx.lineWidth = 4;
        ctx.arc(body.shoulderMid.x * width, body.shoulderMid.y * height, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }, []);

  const recordDodge = useCallback(() => {
    playSound("dodge");
    showResult("DODGED", "good");
    setFeedback("Good dodge. Stay alert.");
    commitMetrics((current) => {
      const streak = current.streak + 1;
      return {
        ...current,
        score: current.score + 10 + Math.floor(streak / 4) * 3,
        dodges: current.dodges + 1,
        streak,
        bestStreak: Math.max(current.bestStreak, streak),
      };
    });
    scheduleNextFireball(360);
  }, [commitMetrics, playSound, scheduleNextFireball, showResult]);

  const recordHit = useCallback(() => {
    const fireball = fireballRef.current;
    if (fireball) {
      const burst = { lane: fireball.lane, startedAt: performance.now(), id: fireball.id };
      impactBurstRef.current = burst;
      setImpactBurst(burst);
      if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
      burstTimeoutRef.current = window.setTimeout(() => {
        impactBurstRef.current = null;
        setImpactBurst(null);
      }, 660);
    }
    playSound("hit");
    showResult("LIFE LOST", "bad");
    setFeedback("Fireball hit. Move faster.");
    commitMetrics((current) => {
      const next = { ...current, hits: current.hits + 1, streak: 0 };
      if (shouldEnd(next)) window.setTimeout(finishGame, 620);
      return next;
    });
    scheduleNextFireball(560);
  }, [commitMetrics, finishGame, playSound, scheduleNextFireball, shouldEnd, showResult]);

  const processFireball = useCallback(
    (body: BodyFrame, fireball: Fireball, now: number) => {
      const baselineX = baselineXRef.current ?? body.shoulderMid.x;
      const laneWidth = body.shoulderWidth * 0.92;
      const lane = getBodyLane(body, baselineX, laneWidth, DIFFICULTIES[difficultyRef.current].laneTolerance);
      setRunnerState(lane === -1 ? "Left" : lane === 1 ? "Right" : "Center");

      const progress = fireballProgress(fireball, now);
      if (progress >= DIFFICULTIES[difficultyRef.current].resolveAt && !fireball.resolved) {
        fireballRef.current = { ...fireball, resolved: true };
        if (lane === fireball.lane) recordHit();
        else recordDodge();
      }
    },
    [recordDodge, recordHit]
  );

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
          if (phaseRef.current === "active") setFeedback("Step back so your full body is visible.");
          lastVideoTimeRef.current = video.currentTime;
          animationRef.current = requestAnimationFrame(runDetectionLoop);
          return;
        }
        if (!baselineXRef.current) baselineXRef.current = body.shoulderMid.x;
        if (phaseRef.current !== "active") {
          baselineXRef.current = baselineXRef.current * 0.94 + body.shoulderMid.x * 0.06;
        }
        if (phaseRef.current === "active") {
          const lane = getBodyLane(body, baselineXRef.current, body.shoulderWidth * 0.92, DIFFICULTIES[difficultyRef.current].laneTolerance);
          if (!fireballRef.current) spawnFireball(lane);
          else processFireball(body, fireballRef.current, timestamp);
        }
        detectionErrorCountRef.current = 0;
      } catch {
        detectionErrorCountRef.current += 1;
        if (detectionErrorCountRef.current > 4) setFeedback("Camera is settling. Stay in frame.");
      }
      lastVideoTimeRef.current = video.currentTime;
    }
    animationRef.current = requestAnimationFrame(runDetectionLoop);
  }, [drawScene, processFireball, spawnFireball]);

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
    fireballRef.current = null;
    impactBurstRef.current = null;
    setImpactBurst(null);
    if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
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
      setFeedback("Ready. Stand center. Dodge fast when fireballs drop.");
      stopLoop();
      animationRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start escape camera.");
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
    setLastResult(null);
    fireballRef.current = null;
    impactBurstRef.current = null;
    setImpactBurst(null);
    if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
    baselineXRef.current = null;
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
    setLastResult(null);
    fireballRef.current = null;
    impactBurstRef.current = null;
    setImpactBurst(null);
    if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
    setCountdown(null);
    setSecondsRemaining(selectedMode.seconds ?? 0);
    setFeedback("Start when ready.");
    setPhase("setup");
  }, [selectedMode.seconds]);

  const toggleFullscreen = useCallback(async () => {
    const shell = cameraShellRef.current;
    if (!shell || typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell.requestFullscreen) await shell.requestFullscreen();
      else setIsFullscreen((value) => !value);
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
      if (spawnTimeoutRef.current) window.clearTimeout(spawnTimeoutRef.current);
      if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
      if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
      landmarkerRef.current?.close?.();
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, [stopCamera]);

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Escape From Above</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Fireball Dodge</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedMode.description}</p>
          </div>
          <button type="button" onClick={() => setSoundEnabled((value) => !value)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm">
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
        {(phase === "setup" || phase === "summary") && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Mode</span>
              <span className="relative block">
                <select value={mode} onChange={(event) => setMode(event.target.value as EscapeMode)} className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-orange-300">
                  {Object.entries(MODES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </span>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Difficulty</span>
              <span className="relative block">
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyKey)} className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-orange-300">
                  {Object.entries(DIFFICULTIES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </span>
            </label>
          </div>
        )}
      </div>

      <div ref={cameraShellRef} className={cn("relative min-h-[560px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 shadow-sm sm:min-h-[640px]", isFullscreen && "fixed inset-0 z-[90] min-h-screen rounded-none border-0 sm:min-h-screen")}>
        <video ref={videoRef} playsInline muted className={cn("absolute inset-0 h-full w-full object-cover scale-x-[-1]", cameraStatus === "ready" ? "opacity-100" : "opacity-30")} />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" />

        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
          <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-white shadow-sm backdrop-blur-md">
            <p className="text-sm font-semibold">{selectedMode.label}</p>
            <p className="text-xs text-white/72">Move left or right to dodge</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-right text-white shadow-sm backdrop-blur-md">
              <p className="text-sm font-black">{selectedMode.seconds ? `${secondsRemaining}s` : `${livesRemaining} lives`}</p>
              <p className="text-xs text-white/72">{selectedMode.seconds ? "Timer" : "Lives"}</p>
            </div>
            <button type="button" onClick={toggleFullscreen} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/34 text-white backdrop-blur-md">
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {phase === "countdown" && <div className="absolute left-1/2 top-[46%] flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-orange-500/90 text-5xl font-black text-white shadow-2xl backdrop-blur-md">{countdown}</div>}
        {lastResult && <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/25 bg-white/94 px-6 py-5 text-center shadow-2xl backdrop-blur-md"><p className={cn("text-4xl font-black leading-none", lastResult.kind === "good" ? "text-emerald-700" : "text-red-600")}>{lastResult.title}</p></div>}

        {(cameraStatus !== "ready" || phase === "setup") && (
          <div className="absolute inset-x-5 bottom-28 rounded-[24px] border border-white/18 bg-white/92 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><ShieldAlert className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-slate-950">Three lives. Fireballs fall fast.</p>
                <p className="mt-1 text-sm text-slate-600">Start in the center. When a fireball drops into your lane, step hard left or right to escape.</p>
              </div>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}

        {phase === "summary" && (
          <div className="absolute inset-x-5 top-24 rounded-[24px] border border-white/18 bg-white/94 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600"><CheckCircle2 className="h-6 w-6" /></div>
              <div><p className="text-lg font-black text-slate-950">Escape complete</p><p className="text-sm text-slate-500">{metrics.score} points • {livesRemaining} lives left</p></div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-4 bottom-4 space-y-3">
          <div className="mx-auto w-fit max-w-full rounded-full border border-white/18 bg-black/38 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm backdrop-blur-md">{feedback}</div>
          <div className="rounded-[24px] border border-white/18 bg-white/94 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[11px] font-black uppercase tracking-wide text-orange-600">Score</p><p className="leading-none text-5xl font-black text-slate-950">{metrics.score}</p></div>
              <div className="grid grid-cols-4 gap-2 text-right text-sm">
                <div><p className="font-black text-slate-950">{runnerState}</p><p className="text-xs font-semibold text-slate-500">Lane</p></div>
                <div><p className="font-black text-slate-950">{metrics.streak}</p><p className="text-xs font-semibold text-slate-500">Streak</p></div>
                <div><p className="font-black text-slate-950">{livesRemaining}</p><p className="text-xs font-semibold text-slate-500">Lives</p></div>
                <div><p className="font-black text-slate-950">{dodgeRate}%</p><p className="text-xs font-semibold text-slate-500">Dodge</p></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {cameraStatus !== "ready" ? (
                <button type="button" onClick={startCamera} disabled={cameraStatus === "loading"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70">{cameraStatus === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} Start camera</button>
              ) : phase === "active" ? (
                <>
                  <button type="button" onClick={() => setPhase("paused")} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-sm"><Pause className="h-5 w-5" /> Pause</button>
                  <button type="button" onClick={finishGame} className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700">End</button>
                </>
              ) : phase === "paused" ? (
                <button type="button" onClick={() => setPhase("active")} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 px-5 text-sm font-bold text-white shadow-sm"><Play className="h-5 w-5" /> Resume</button>
              ) : (
                <>
                  <button type="button" onClick={beginGame} disabled={phase === "countdown"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"><Play className="h-5 w-5" /> Start escape</button>
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
            <div className="rounded-2xl bg-slate-50 p-3"><Sparkles className="mb-2 h-4 w-4 text-orange-500" /><p className="text-2xl font-black text-slate-950">{metrics.score}</p><p className="text-xs font-semibold text-slate-500">Score</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><Flame className="mb-2 h-4 w-4 text-orange-500" /><p className="text-2xl font-black text-slate-950">{metrics.dodges}</p><p className="text-xs font-semibold text-slate-500">Dodges</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><Heart className="mb-2 h-4 w-4 text-orange-500" /><p className="text-2xl font-black text-slate-950">{livesRemaining}</p><p className="text-xs font-semibold text-slate-500">Lives left</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.hits}</p><p className="text-xs font-semibold text-slate-500">Hits</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.bestStreak}</p><p className="text-xs font-semibold text-slate-500">Best streak</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
