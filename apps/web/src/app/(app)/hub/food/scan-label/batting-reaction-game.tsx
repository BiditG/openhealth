"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Target,
  TimerReset,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: Landmark[][] };
  close?: () => void;
};

type GamePhase = "setup" | "countdown" | "active" | "paused" | "summary";
type CameraStatus = "idle" | "loading" | "ready" | "error";
type GameModeKey = "quick12" | "thirtySeconds" | "sixChallenge" | "timingPractice" | "survival";
type DifficultyKey = "easy" | "normal" | "hard";
type BatTrackingMode = "hands" | "realBat";
type TimingLabel = "Too Early" | "Early" | "Perfect" | "Late" | "Too Late" | "Miss";
type ShotDirection = "Straight" | "Off Side" | "Leg Side" | "Pull" | "Defensive";

type Point3 = {
  x: number;
  y: number;
  z: number;
};

type BodyFrame = {
  nose: Point3;
  leftShoulder: Point3;
  rightShoulder: Point3;
  shoulderMid: Point3;
  hipMid: Point3;
  shoulderWidth: number;
  torsoLength: number;
};

type HandSnapshot = {
  x: number;
  y: number;
  z: number;
  t: number;
  visible: boolean;
};

type BatLine = {
  a: { x: number; y: number };
  b: { x: number; y: number };
  grip: { x: number; y: number };
  source: BatTrackingMode;
  confidence: number;
};

type BallState = {
  id: number;
  start: { x: number; y: number };
  target: { x: number; y: number };
  radius: number;
  startAt: number;
  durationMs: number;
  status: "incoming" | "hit" | "missed";
  hitAt?: number;
  hitFrom?: { x: number; y: number };
  flight?: { x: number; y: number };
};

type GameMetrics = {
  score: number;
  balls: number;
  hits: number;
  misses: number;
  wickets: number;
  fours: number;
  sixes: number;
  streak: number;
  bestStreak: number;
  timingHits: number;
  perfects: number;
  startedAt: number | null;
  endedAt: number | null;
};

type GameMode = {
  key: GameModeKey;
  label: string;
  description: string;
  ballLimit?: number;
  seconds?: number;
  survivalMisses?: number;
};

const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const GAME_MODES: GameMode[] = [
  {
    key: "quick12",
    label: "Quick 12 Balls",
    description: "A short over-style reaction game.",
    ballLimit: 12,
  },
  {
    key: "thirtySeconds",
    label: "30-Second Challenge",
    description: "Score as much as possible before time runs out.",
    seconds: 30,
  },
  {
    key: "sixChallenge",
    label: "Six-Hitting Challenge",
    description: "Bigger reward for perfect timing and fast swings.",
    ballLimit: 12,
  },
  {
    key: "timingPractice",
    label: "Timing Practice",
    description: "More forgiving balls with detailed timing feedback.",
    ballLimit: 18,
  },
  {
    key: "survival",
    label: "Survival",
    description: "Three wickets ends the innings.",
    survivalMisses: 3,
  },
];

const DIFFICULTIES: Record<DifficultyKey, { label: string; tolerance: number; speed: number; duration: number; zone: number }> = {
  easy: { label: "Easy", tolerance: 0.14, speed: 0.36, duration: 2050, zone: 1.24 },
  normal: { label: "Normal", tolerance: 0.105, speed: 0.5, duration: 1680, zone: 1 },
  hard: { label: "Hard", tolerance: 0.082, speed: 0.66, duration: 1320, zone: 0.82 },
};

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
];

const createMetrics = (): GameMetrics => ({
  score: 0,
  balls: 0,
  hits: 0,
  misses: 0,
  wickets: 0,
  fours: 0,
  sixes: 0,
  streak: 0,
  bestStreak: 0,
  timingHits: 0,
  perfects: 0,
  startedAt: null,
  endedAt: null,
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function visibility(point?: Landmark) {
  return point?.visibility ?? 1;
}

function isVisible(point?: Landmark, min = 0.42) {
  return Boolean(point) && visibility(point) >= min;
}

function toPoint(point: Landmark): Point3 {
  return { x: point.x, y: point.y, z: point.z ?? 0 };
}

function distance2D(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point3, b: Point3): Point3 {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

function getBodyFrame(landmarks?: Landmark[]): BodyFrame | null {
  if (!landmarks) return null;
  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  if (
    !isVisible(nose, 0.35) ||
    !isVisible(leftShoulder, 0.42) ||
    !isVisible(rightShoulder, 0.42) ||
    !isVisible(leftHip, 0.32) ||
    !isVisible(rightHip, 0.32)
  ) {
    return null;
  }

  const leftShoulderPoint = toPoint(leftShoulder);
  const rightShoulderPoint = toPoint(rightShoulder);
  const shoulderMid = midpoint(leftShoulderPoint, rightShoulderPoint);
  const hipMid = midpoint(toPoint(leftHip), toPoint(rightHip));
  const shoulderWidth = clamp(distance2D(leftShoulderPoint, rightShoulderPoint), 0.08, 0.42);
  const torsoLength = clamp(distance2D(shoulderMid, hipMid), 0.12, 0.5);

  return {
    nose: toPoint(nose),
    leftShoulder: leftShoulderPoint,
    rightShoulder: rightShoulderPoint,
    shoulderMid,
    hipMid,
    shoulderWidth,
    torsoLength,
  };
}

function getBallPosition(ball: BallState, now: number) {
  if (ball.status === "hit" && ball.hitAt && ball.hitFrom && ball.flight) {
    const travel = clamp((now - ball.hitAt) / 620, 0, 1);
    return {
      x: ball.hitFrom.x + ball.flight.x * travel,
      y: ball.hitFrom.y + ball.flight.y * travel,
      progress: 1,
    };
  }

  const progress = clamp((now - ball.startAt) / ball.durationMs, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  return {
    x: ball.start.x + (ball.target.x - ball.start.x) * eased,
    y: ball.start.y + (ball.target.y - ball.start.y) * eased,
    progress,
  };
}

function lineDistance(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (lengthSquared === 0) return distance2D(point, a);
  const t = clamp(((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared, 0, 1);
  return distance2D(point, {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
}

function getHands(landmarks: Landmark[] | undefined, now: number): Record<"left" | "right", HandSnapshot> {
  const left = landmarks?.[15];
  const right = landmarks?.[16];
  return {
    left: {
      x: left?.x ?? 0,
      y: left?.y ?? 0,
      z: left?.z ?? 0,
      t: now,
      visible: isVisible(left, 0.35),
    },
    right: {
      x: right?.x ?? 0,
      y: right?.y ?? 0,
      z: right?.z ?? 0,
      t: now,
      visible: isVisible(right, 0.35),
    },
  };
}

function getBatLine(hands: Record<"left" | "right", HandSnapshot>, body: BodyFrame): BatLine | null {
  if (!hands.left.visible || !hands.right.visible) return null;
  const left = hands.left;
  const right = hands.right;
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const extension = body.shoulderWidth * 0.9;
  const ux = dx / length;
  const uy = dy / length;
  return {
    a: { x: left.x - ux * extension, y: left.y - uy * extension },
    b: { x: right.x + ux * extension, y: right.y + uy * extension },
    grip: { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 },
    source: "hands",
    confidence: 1,
  };
}

function detectRealBatLine(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  hands: Record<"left" | "right", HandSnapshot>,
  body: BodyFrame
): BatLine | null {
  if (!video || !canvas || !hands.left.visible || !hands.right.visible || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  const width = 192;
  const height = 144;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height).data;
  const grip = {
    x: ((hands.left.x + hands.right.x) / 2) * width,
    y: ((hands.left.y + hands.right.y) / 2) * height,
  };
  const halfLength = clamp(body.shoulderWidth * width * 1.85, 34, 88);
  const steps = 44;
  const perpOffset = 4;

  const luminance = (x: number, y: number) => {
    const px = clamp(Math.round(x), 0, width - 1);
    const py = clamp(Math.round(y), 0, height - 1);
    const index = (py * width + px) * 4;
    return image[index] * 0.299 + image[index + 1] * 0.587 + image[index + 2] * 0.114;
  };

  let best: { angle: number; score: number } | null = null;
  let secondBest = 0;

  for (let angle = 0; angle < Math.PI; angle += Math.PI / 18) {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    let score = 0;
    let valid = 0;

    for (let i = -steps; i <= steps; i += 1) {
      const distance = (i / steps) * halfLength;
      const x = grip.x + ux * distance;
      const y = grip.y + uy * distance;
      if (x < 2 || x > width - 3 || y < 2 || y > height - 3) continue;

      const center = luminance(x, y);
      const sideA = luminance(x - uy * perpOffset, y + ux * perpOffset);
      const sideB = luminance(x + uy * perpOffset, y - ux * perpOffset);
      score += Math.abs(center - sideA) + Math.abs(center - sideB);
      valid += 1;
    }

    if (valid < steps * 1.2) continue;
    const normalizedScore = score / valid;
    if (!best || normalizedScore > best.score) {
      secondBest = best?.score ?? secondBest;
      best = { angle, score: normalizedScore };
    } else if (normalizedScore > secondBest) {
      secondBest = normalizedScore;
    }
  }

  if (!best || best.score < 22 || best.score - secondBest < 1.8) return null;

  const ux = Math.cos(best.angle);
  const uy = Math.sin(best.angle);
  return {
    a: {
      x: clamp((grip.x - ux * halfLength) / width, 0, 1),
      y: clamp((grip.y - uy * halfLength) / height, 0, 1),
    },
    b: {
      x: clamp((grip.x + ux * halfLength) / width, 0, 1),
      y: clamp((grip.y + uy * halfLength) / height, 0, 1),
    },
    grip: { x: clamp(grip.x / width, 0, 1), y: clamp(grip.y / height, 0, 1) },
    source: "realBat",
    confidence: clamp((best.score - 18) / 38, 0, 1),
  };
}

function classifyTiming(progress: number): TimingLabel {
  if (progress < 0.46) return "Too Early";
  if (progress < 0.62) return "Early";
  if (progress <= 0.82) return "Perfect";
  if (progress <= 0.94) return "Late";
  if (progress <= 1.04) return "Too Late";
  return "Miss";
}

function classifyShotDirection(vx: number, vy: number, speed: number): ShotDirection {
  if (speed < 0.5) return "Defensive";
  if (vy < -0.38) return "Pull";
  if (vx < -0.26) return "Off Side";
  if (vx > 0.26) return "Leg Side";
  return "Straight";
}

function getShotVector(direction: ShotDirection) {
  if (direction === "Off Side") return { x: -0.65, y: -0.32 };
  if (direction === "Leg Side") return { x: 0.65, y: -0.3 };
  if (direction === "Pull") return { x: 0.24, y: -0.72 };
  if (direction === "Defensive") return { x: 0.08, y: -0.22 };
  return { x: 0, y: -0.68 };
}

function scoreShot(timing: TimingLabel, swingSpeed: number, mode: GameModeKey) {
  if (timing === "Perfect" && swingSpeed > 1.05) return 6;
  if (timing === "Perfect") return mode === "sixChallenge" ? 4 : 4;
  if (timing === "Early" || timing === "Late") return swingSpeed > 0.72 ? 2 : 1;
  return 1;
}

async function loadPoseLandmarker(): Promise<PoseLandmarkerLike> {
  const dynamicImport = new Function("url", "return import(url)") as (
    url: string
  ) => Promise<{
    FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
    PoseLandmarker: {
      createFromOptions: (
        vision: unknown,
        options: Record<string, unknown>
      ) => Promise<PoseLandmarkerLike>;
    };
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

export function BattingReactionGame() {
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const batAnalysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectTimestampRef = useRef(0);
  const detectionErrorCountRef = useRef(0);
  const previousHandsRef = useRef<Record<"left" | "right", HandSnapshot> | null>(null);
  const previousBatRef = useRef<{ grip: { x: number; y: number }; t: number } | null>(null);
  const ballRef = useRef<BallState | null>(null);
  const ballSerialRef = useRef(0);
  const serveTimeoutRef = useRef<number | null>(null);
  const resultTimeoutRef = useRef<number | null>(null);
  const lastFeedbackAtRef = useRef(0);
  const feedbackRef = useRef("Start camera and stand far enough back.");
  const phaseRef = useRef<GamePhase>("setup");
  const modeRef = useRef<GameModeKey>("quick12");
  const difficultyRef = useRef<DifficultyKey>("easy");
  const batTrackingRef = useRef<BatTrackingMode>("hands");
  const soundEnabledRef = useRef(true);
  const metricsRef = useRef<GameMetrics>(createMetrics());
  const audioContextRef = useRef<AudioContext | null>(null);

  const [phase, setPhase] = useState<GamePhase>("setup");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GameModeKey>("quick12");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("easy");
  const [batTracking, setBatTracking] = useState<BatTrackingMode>("hands");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [countdown, setCountdown] = useState<number | "START" | null>(null);
  const [feedback, setFeedback] = useState("Start camera and stand far enough back.");
  const [bestTiming, setBestTiming] = useState<TimingLabel | null>(null);
  const [metrics, setMetrics] = useState<GameMetrics>(() => createMetrics());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastResult, setLastResult] = useState<{
    title: string;
    detail: string;
    kind: "runs" | "boundary" | "wicket";
  } | null>(null);

  const selectedMode = useMemo(
    () => GAME_MODES.find((item) => item.key === mode) ?? GAME_MODES[0],
    [mode]
  );

  const totalAttempts = metrics.hits + metrics.misses;
  const timingAccuracy = totalAttempts > 0 ? Math.round((metrics.timingHits / totalAttempts) * 100) : 0;

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
    batTrackingRef.current = batTracking;
  }, [batTracking]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  const commitMetrics = useCallback((updater: (current: GameMetrics) => GameMetrics) => {
    const next = updater(metricsRef.current);
    metricsRef.current = next;
    setMetrics(next);
  }, []);

  const updateFeedback = useCallback((message: string, force = false) => {
    const now = performance.now();
    if (!force && feedbackRef.current === message) return;
    if (!force && now - lastFeedbackAtRef.current < 700) return;
    lastFeedbackAtRef.current = now;
    feedbackRef.current = message;
    setFeedback(message);
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
    (kind: "contact" | "four" | "six" | "miss" | "wicket" | "start") => {
      if (!soundEnabledRef.current) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);

      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const frequency =
        kind === "six" ? 880 : kind === "four" ? 700 : kind === "contact" ? 520 : kind === "wicket" ? 160 : kind === "miss" ? 210 : 420;
      oscillator.type = kind === "miss" || kind === "wicket" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      if (kind === "six" || kind === "four") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, now + 0.12);
      gain.gain.setValueAtTime(kind === "miss" || kind === "wicket" ? 0.045 : 0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === "six" ? 0.28 : 0.16));
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + (kind === "six" ? 0.3 : 0.18));
    },
    [getAudioContext]
  );

  const showResult = useCallback((result: { title: string; detail: string; kind: "runs" | "boundary" | "wicket" }) => {
    setLastResult(result);
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = window.setTimeout(() => setLastResult(null), 950);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const cameraShell = cameraShellRef.current;
    if (!cameraShell || typeof document === "undefined") return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (!cameraShell.requestFullscreen) {
        setIsFullscreen((value) => !value);
        return;
      }
      await cameraShell.requestFullscreen();
    } catch {
      setIsFullscreen((value) => !value);
      updateFeedback("Fullscreen changed.", true);
    }
  }, [updateFeedback]);

  const getActiveBatLine = useCallback(
    (hands: Record<"left" | "right", HandSnapshot>, body: BodyFrame): BatLine | null => {
      const handLine = getBatLine(hands, body);
      if (batTrackingRef.current === "hands" || typeof document === "undefined") {
        return handLine;
      }

      if (!batAnalysisCanvasRef.current) {
        batAnalysisCanvasRef.current = document.createElement("canvas");
      }

      const detectedLine = detectRealBatLine(videoRef.current, batAnalysisCanvasRef.current, hands, body);
      return detectedLine ?? handLine;
    },
    []
  );

  const shouldEndGame = useCallback(
    (nextMetrics: GameMetrics) => {
      const activeMode = GAME_MODES.find((item) => item.key === modeRef.current) ?? GAME_MODES[0];
      if (activeMode.ballLimit && nextMetrics.balls >= activeMode.ballLimit) return true;
      if (activeMode.survivalMisses && nextMetrics.wickets >= activeMode.survivalMisses) return true;
      return false;
    },
    []
  );

  const finishGame = useCallback(() => {
    setPhase("summary");
    ballRef.current = null;
    if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
    commitMetrics((current) => ({ ...current, endedAt: performance.now() }));
    updateFeedback("Innings complete", true);
  }, [commitMetrics, updateFeedback]);

  const scheduleNextBall = useCallback(
    (delay = 850) => {
      if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
      serveTimeoutRef.current = window.setTimeout(() => {
        ballRef.current = null;
      }, delay);
    },
    []
  );

  const spawnBall = useCallback((body: BodyFrame) => {
    const currentDifficulty = DIFFICULTIES[difficultyRef.current];
    const currentBalls = metricsRef.current.balls;
    const difficultyRamp = Math.min(0.32, currentBalls * 0.018);
    const line = (Math.random() - 0.5) * body.shoulderWidth * 1.35;
    const targetY = body.shoulderMid.y + body.torsoLength * (0.34 + Math.random() * 0.18);
    const targetX = body.shoulderMid.x + line;
    const startX = clamp(targetX + (Math.random() - 0.5) * body.shoulderWidth * 0.7, 0.12, 0.88);
    const speedBoost = modeRef.current === "thirtySeconds" ? 0.16 : modeRef.current === "survival" ? 0.08 : 0;
    const durationMs = currentDifficulty.duration * (1 - difficultyRamp - speedBoost);
    const radius = clamp(body.shoulderWidth * 0.13 * currentDifficulty.zone, 0.028, 0.07);

    ballSerialRef.current += 1;
    ballRef.current = {
      id: ballSerialRef.current,
      start: { x: startX, y: 0.06 + Math.random() * 0.08 },
      target: {
        x: clamp(targetX, 0.13, 0.87),
        y: clamp(targetY, 0.32, 0.78),
      },
      radius,
      startAt: performance.now(),
      durationMs,
      status: "incoming",
    };
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
      const zoneWidth = body.shoulderWidth * 1.5 * DIFFICULTIES[difficultyRef.current].zone;
      const zoneHeight = body.torsoLength * 0.6 * DIFFICULTIES[difficultyRef.current].zone;
      const zoneX = (body.shoulderMid.x - zoneWidth / 2) * width;
      const zoneY = (body.shoulderMid.y + body.torsoLength * 0.16) * height;
      ctx.save();
      ctx.fillStyle = "rgba(20, 184, 166, 0.09)";
      ctx.strokeStyle = "rgba(20, 184, 166, 0.42)";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.roundRect(zoneX, zoneY, zoneWidth * width, zoneHeight * height, 22);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (landmarks) {
      ctx.lineCap = "round";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.55)";
      POSE_CONNECTIONS.forEach(([aIndex, bIndex]) => {
        const a = landmarks[aIndex];
        const b = landmarks[bIndex];
        if (!isVisible(a, 0.42) || !isVisible(b, 0.42)) return;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      });

      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(45, 212, 191, 0.88)";
      POSE_CONNECTIONS.forEach(([aIndex, bIndex]) => {
        const a = landmarks[aIndex];
        const b = landmarks[bIndex];
        if (!isVisible(a, 0.42) || !isVisible(b, 0.42)) return;
        ctx.globalAlpha = [13, 14, 15, 16].includes(aIndex) || [13, 14, 15, 16].includes(bIndex) ? 1 : 0.36;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      [15, 16].forEach((index) => {
        const point = landmarks[index];
        if (!isVisible(point, 0.35)) return;
        ctx.beginPath();
        ctx.fillStyle = index === 15 ? "rgba(56, 189, 248, 0.96)" : "rgba(20, 184, 166, 0.96)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 4;
        ctx.arc(point.x * width, point.y * height, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    const ball = ballRef.current;
    if (ball) {
      const now = performance.now();
      const ballPosition = getBallPosition(ball, now);
      const x = ballPosition.x * width;
      const y = ballPosition.y * height;
      const r = ball.radius * Math.min(width, height);
      const trailAlpha = ball.status === "incoming" ? 0.28 : 0.18;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${trailAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ball.start.x * width, ball.start.y * height);
      ctx.lineTo(ball.target.x * width, ball.target.y * height);
      ctx.stroke();

      ctx.shadowColor = ball.status === "hit" ? "rgba(16, 185, 129, 0.9)" : "rgba(251, 191, 36, 0.75)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = ball.status === "hit" ? "rgba(16, 185, 129, 0.96)" : "rgba(251, 191, 36, 0.98)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const registerMiss = useCallback(() => {
    playSound("wicket");
    setBestTiming("Miss");
    showResult({ title: "WICKET", detail: "Missed ball", kind: "wicket" });
    updateFeedback("Miss - wicket!", true);
    commitMetrics((current) => {
      const next = {
        ...current,
        balls: current.balls + 1,
        misses: current.misses + 1,
        wickets: current.wickets + 1,
        streak: 0,
      };
      if (shouldEndGame(next)) {
        window.setTimeout(finishGame, 650);
      }
      return next;
    });
    scheduleNextBall(900);
  }, [commitMetrics, finishGame, playSound, scheduleNextBall, shouldEndGame, showResult, updateFeedback]);

  const registerHit = useCallback(
    (ball: BallState, ballPosition: { x: number; y: number; progress: number }, swingSpeed: number, swingVector: { x: number; y: number }) => {
      const timing = classifyTiming(ballPosition.progress);
      const direction = classifyShotDirection(swingVector.x, swingVector.y, swingSpeed);
      const runs = scoreShot(timing, swingSpeed, modeRef.current);
      const shotVector = getShotVector(direction);
      ballRef.current = {
        ...ball,
        status: "hit",
        hitAt: performance.now(),
        hitFrom: { x: ballPosition.x, y: ballPosition.y },
        flight: shotVector,
      };

      setBestTiming(timing);
      playSound(runs === 6 ? "six" : runs === 4 ? "four" : "contact");
      showResult({
        title: `+${runs} RUN${runs > 1 ? "S" : ""}`,
        detail: runs === 6 ? "SIX!" : runs === 4 ? "FOUR!" : `${direction} shot`,
        kind: runs >= 4 ? "boundary" : "runs",
      });
      updateFeedback(`${timing} timing - ${runs === 6 ? "SIX!" : runs === 4 ? "FOUR!" : `${runs} run${runs > 1 ? "s" : ""}`}`, true);

      commitMetrics((current) => {
        const nextStreak = current.streak + 1;
        const next = {
          ...current,
          score: current.score + runs,
          balls: current.balls + 1,
          hits: current.hits + 1,
          fours: current.fours + (runs === 4 ? 1 : 0),
          sixes: current.sixes + (runs === 6 ? 1 : 0),
          streak: nextStreak,
          bestStreak: Math.max(current.bestStreak, nextStreak),
          timingHits: current.timingHits + (timing === "Perfect" || timing === "Early" || timing === "Late" ? 1 : 0),
          perfects: current.perfects + (timing === "Perfect" ? 1 : 0),
        };
        if (shouldEndGame(next)) {
          window.setTimeout(finishGame, 850);
        }
        return next;
      });
      scheduleNextBall(900);
    },
    [commitMetrics, finishGame, playSound, scheduleNextBall, shouldEndGame, showResult, updateFeedback]
  );

  const processSwing = useCallback(
    (
      hands: Record<"left" | "right", HandSnapshot>,
      body: BodyFrame,
      batLine: BatLine | null,
      ball: BallState,
      now: number
    ) => {
      const previousHands = previousHandsRef.current;
      if (!batLine || !previousHands?.left.visible || !previousHands.right.visible) {
        previousHandsRef.current = hands;
        previousBatRef.current = batLine ? { grip: batLine.grip, t: now } : null;
        updateFeedback(batTrackingRef.current === "realBat" ? "Keep hands and bat visible." : "Keep both hands visible.");
        return;
      }

      const ballPosition = getBallPosition(ball, now);
      const grip = batLine.grip;
      const handFallbackGrip = {
        x: (previousHands.left.x + previousHands.right.x) / 2,
        y: (previousHands.left.y + previousHands.right.y) / 2,
      };
      const previousBat = previousBatRef.current;
      const previousGrip = previousBat?.grip ?? handFallbackGrip;
      const dt = Math.max(16, now - (previousBat?.t ?? previousHands.left.t)) / 1000;
      const swingVector = {
        x: grip.x - previousGrip.x,
        y: grip.y - previousGrip.y,
      };
      const swingSpeed = distance2D(grip, previousGrip) / dt;
      const batDistance = lineDistance(ballPosition, batLine.a, batLine.b);
      const handDistance = Math.min(distance2D(ballPosition, hands.left), distance2D(ballPosition, hands.right));
      const contactTolerance = Math.max(
        ball.radius + DIFFICULTIES[difficultyRef.current].tolerance * body.shoulderWidth,
        ball.radius * 1.65
      );
      const timing = classifyTiming(ballPosition.progress);
      const validTiming =
        timing === "Too Early" ||
        timing === "Early" ||
        timing === "Perfect" ||
        timing === "Late" ||
        timing === "Too Late";
      const closeEnough = batDistance <= contactTolerance || handDistance <= contactTolerance * 0.78;
      const movingEnough = swingSpeed >= DIFFICULTIES[difficultyRef.current].speed;

      if (closeEnough && validTiming && movingEnough) {
        registerHit(ball, ballPosition, swingSpeed, swingVector);
      } else if (closeEnough && !movingEnough) {
        updateFeedback("Swing through the ball.");
      } else if (ballPosition.progress > 1.04) {
        registerMiss();
      } else if (timing === "Too Early") {
        updateFeedback("Wait for it.");
      } else if (timing === "Too Late") {
        updateFeedback("Swing sooner.");
      }

      previousHandsRef.current = hands;
      previousBatRef.current = { grip: batLine.grip, t: now };
    },
    [registerHit, registerMiss, updateFeedback]
  );

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const hasUsableFrame =
      video &&
      landmarker &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      video.currentTime !== lastVideoTimeRef.current;

    if (hasUsableFrame) {
      const timestamp = Math.max(performance.now(), lastDetectTimestampRef.current + 1);
      lastDetectTimestampRef.current = timestamp;

      try {
        const result = landmarker.detectForVideo(video, timestamp);
        const landmarks = result.landmarks?.[0];
        const body = getBodyFrame(landmarks);
        const hands = getHands(landmarks, timestamp);
        const batLine = body ? getActiveBatLine(hands, body) : null;
        drawScene(landmarks, body);

        if (!body) {
          previousHandsRef.current = null;
          previousBatRef.current = null;
          if (phaseRef.current === "active") updateFeedback("Step back so upper body and hands are visible.");
          detectionErrorCountRef.current = 0;
          lastVideoTimeRef.current = video.currentTime;
          animationRef.current = requestAnimationFrame(runDetectionLoop);
          return;
        }

        if (phaseRef.current === "active") {
          if (!ballRef.current) {
            spawnBall(body);
            updateFeedback("Watch the ball.", true);
          } else if (ballRef.current.status === "incoming") {
            processSwing(hands, body, batLine, ballRef.current, timestamp);
          }
        } else {
          previousHandsRef.current = hands;
          previousBatRef.current = batLine ? { grip: batLine.grip, t: timestamp } : null;
        }

        detectionErrorCountRef.current = 0;
      } catch (err) {
        detectionErrorCountRef.current += 1;
        if (detectionErrorCountRef.current === 1) {
          console.warn("Batting reaction detection skipped a frame.", err);
        }
        if (detectionErrorCountRef.current > 4) {
          updateFeedback("Camera is settling. Keep your hands visible.", true);
        }
      }

      lastVideoTimeRef.current = video.currentTime;
    }

    animationRef.current = requestAnimationFrame(runDetectionLoop);
  }, [drawScene, getActiveBatLine, processSwing, spawnBall, updateFeedback]);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    previousHandsRef.current = null;
    previousBatRef.current = null;
    ballRef.current = null;
    drawScene(undefined, null);
    setCameraStatus("idle");
  }, [drawScene, stopLoop]);

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraStatus("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported in this browser.");
      }
      if (!landmarkerRef.current) {
        landmarkerRef.current = await loadPoseLandmarker();
      }
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
      previousHandsRef.current = null;
      previousBatRef.current = null;
      setCameraStatus("ready");
      updateFeedback(
        batTrackingRef.current === "realBat"
          ? "Ready. Hold your bat or stick near both hands."
          : "Ready. Stand back with both hands visible.",
        true
      );
      stopLoop();
      animationRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start batting camera.");
      setCameraStatus("error");
      stopCamera();
    }
  }, [runDetectionLoop, stopCamera, stopLoop, updateFeedback]);

  const beginGame = useCallback(async () => {
    if (!streamRef.current || cameraStatus !== "ready") {
      await startCamera();
    }
    if (!streamRef.current) return;

    const freshMetrics = createMetrics();
    metricsRef.current = freshMetrics;
    setMetrics(freshMetrics);
    setBestTiming(null);
    setLastResult(null);
    ballRef.current = null;
    previousBatRef.current = null;
    if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
    setSecondsRemaining(selectedMode.seconds ?? 0);
    setCountdown(3);
    updateFeedback("Ready", true);
    setPhase("countdown");
    playSound("start");
  }, [cameraStatus, playSound, selectedMode.seconds, startCamera, updateFeedback]);

  const resetGame = useCallback(() => {
    const freshMetrics = createMetrics();
    metricsRef.current = freshMetrics;
    setMetrics(freshMetrics);
    setBestTiming(null);
    setLastResult(null);
    ballRef.current = null;
    previousBatRef.current = null;
    if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
    setCountdown(null);
    setSecondsRemaining(selectedMode.seconds ?? 0);
    updateFeedback("Start when ready.", true);
    setPhase("setup");
  }, [selectedMode.seconds, updateFeedback]);

  useEffect(() => {
    if (phase !== "countdown") return undefined;

    let current = 3;
    setCountdown(current);
    const interval = window.setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
        playSound("start");
        return;
      }

      if (current === 0) {
        setCountdown("START");
        updateFeedback("Start!", true);
        playSound("start");
        return;
      }

      window.clearInterval(interval);
      commitMetrics((existing) => ({ ...existing, startedAt: performance.now(), endedAt: null }));
      setPhase("active");
    }, 1000);

    return () => window.clearInterval(interval);
  }, [commitMetrics, phase, playSound, updateFeedback]);

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
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === cameraShellRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [phase]);

  useEffect(() => {
    setSecondsRemaining(selectedMode.seconds ?? 0);
  }, [selectedMode.seconds]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (document.fullscreenElement === cameraShellRef.current) {
        void document.exitFullscreen().catch(() => undefined);
      }
      if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
      if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
      landmarkerRef.current?.close?.();
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, [stopCamera]);

  const ballsLabel = selectedMode.ballLimit ? `${metrics.balls}/${selectedMode.ballLimit}` : String(metrics.balls);

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Batting Reaction</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Virtual Cricket Batting</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedMode.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setSoundEnabled((value) => !value)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
            aria-label={soundEnabled ? "Mute batting sounds" : "Enable batting sounds"}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>

        {(phase === "setup" || phase === "summary") && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Mode</span>
              <span className="relative block">
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as GameModeKey)}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                >
                  {GAME_MODES.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
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
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </span>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Bat</span>
              <span className="relative block">
                <select
                  value={batTracking}
                  onChange={(event) => setBatTracking(event.target.value as BatTrackingMode)}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                >
                  <option value="hands">Invisible bat</option>
                  <option value="realBat">Real bat / stick</option>
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
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "absolute inset-0 h-full w-full object-cover scale-x-[-1]",
            cameraStatus === "ready" ? "opacity-100" : "opacity-30"
          )}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" />

        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
          <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-white shadow-sm backdrop-blur-md">
            <p className="text-sm font-semibold">{selectedMode.label}</p>
            <p className="text-xs text-white/72">
              {batTracking === "realBat" ? "Real bat assist enabled" : "Invisible bat follows both hands"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-right text-white shadow-sm backdrop-blur-md">
              <p className="text-sm font-black">{secondsRemaining > 0 ? `${secondsRemaining}s` : ballsLabel}</p>
              <p className="text-xs text-white/72">{secondsRemaining > 0 ? "Timer" : "Balls"}</p>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/34 text-white backdrop-blur-md"
              aria-label={isFullscreen ? "Exit fullscreen batting camera" : "Enter fullscreen batting camera"}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {phase === "countdown" && (
          <div className="absolute left-1/2 top-[46%] flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-teal-500/88 text-5xl font-black text-white shadow-2xl backdrop-blur-md">
            {countdown}
          </div>
        )}

        {lastResult && phase !== "countdown" && (
          <div className="absolute left-1/2 top-[42%] min-w-40 -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/25 bg-white/94 px-6 py-5 text-center shadow-2xl backdrop-blur-md">
            <p
              className={cn(
                "text-4xl font-black leading-none",
                lastResult.kind === "wicket" ? "text-red-600" : "text-emerald-700"
              )}
            >
              {lastResult.title}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-600">{lastResult.detail}</p>
          </div>
        )}

        {(cameraStatus !== "ready" || phase === "setup") && (
          <div className="absolute inset-x-5 bottom-28 rounded-[24px] border border-white/18 bg-white/92 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-950">
                  {batTracking === "realBat" ? "Stand back and hold a bat or stick" : "Stand back and hold an invisible bat"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {batTracking === "realBat"
                    ? "Use a visible plastic bat, stick, or rod with both hands. The game will highlight it when detected and fall back to hand tracking if needed."
                    : "Keep your upper body, elbows, wrists, and both hands visible. Swing through the ball when it reaches the teal zone."}
                </p>
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
                <p className="text-lg font-black text-slate-950">Innings complete</p>
                <p className="text-sm text-slate-500">Game scoring only, not real batting power measurement.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xl font-black text-slate-950">{metrics.score}</p>
                <p className="text-xs font-semibold text-slate-500">Runs</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xl font-black text-slate-950">{metrics.hits}</p>
                <p className="text-xs font-semibold text-slate-500">Hits</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xl font-black text-slate-950">{metrics.wickets}</p>
                <p className="text-xs font-semibold text-slate-500">Wickets</p>
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
                <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">Runs</p>
                <p className="leading-none text-5xl font-black text-slate-950">{metrics.score}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-right text-sm">
                <div>
                  <p className="font-black text-slate-950">{ballsLabel}</p>
                  <p className="text-xs font-semibold text-slate-500">Balls</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">{metrics.wickets}</p>
                  <p className="text-xs font-semibold text-slate-500">Wicket</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">{metrics.streak}</p>
                  <p className="text-xs font-semibold text-slate-500">Streak</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">{bestTiming ?? "-"}</p>
                  <p className="text-xs font-semibold text-slate-500">Timing</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {cameraStatus !== "ready" ? (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraStatus === "loading"}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"
                >
                  {cameraStatus === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  Start camera
                </button>
              ) : phase === "active" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      updateFeedback("Paused", true);
                      setPhase("paused");
                    }}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-sm"
                  >
                    <Pause className="h-5 w-5" />
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={finishGame}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700"
                  >
                    End
                  </button>
                </>
              ) : phase === "paused" ? (
                <button
                  type="button"
                  onClick={() => {
                    updateFeedback("Back to crease", true);
                    setPhase("active");
                  }}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm"
                >
                  <Play className="h-5 w-5" />
                  Resume
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={beginGame}
                    disabled={phase === "countdown"}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"
                  >
                    <Play className="h-5 w-5" />
                    Start game
                  </button>
                  {phase === "summary" && (
                    <button
                      type="button"
                      onClick={resetGame}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700"
                    >
                      <RotateCcw className="h-5 w-5" />
                      Reset
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {phase === "summary" && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-3">
              <Activity className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.score}</p>
              <p className="text-xs font-semibold text-slate-500">Runs scored</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <Target className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.balls}</p>
              <p className="text-xs font-semibold text-slate-500">Balls faced</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <CheckCircle2 className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.fours}</p>
              <p className="text-xs font-semibold text-slate-500">Fours</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <TimerReset className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.sixes}</p>
              <p className="text-xs font-semibold text-slate-500">Sixes</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <Clock className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.bestStreak}</p>
              <p className="text-xs font-semibold text-slate-500">Best streak</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <Target className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.wickets}</p>
              <p className="text-xs font-semibold text-slate-500">Wickets</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
