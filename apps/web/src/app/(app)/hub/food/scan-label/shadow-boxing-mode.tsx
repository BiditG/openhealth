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
  Settings,
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

type BoxingPhase = "setup" | "countdown" | "active" | "paused" | "summary";
type CameraStatus = "idle" | "loading" | "ready" | "error";
type DrillKey = "leftJab" | "rightCross" | "alternating" | "random" | "speed" | "reaction" | "timed";
type DifficultyKey = "easy" | "normal" | "hard";
type TargetSizeKey = "large" | "normal" | "small";
type TargetZoneKey = "headLeft" | "headRight" | "chest" | "bodyLeft" | "bodyRight";
type PunchHand = "left" | "right" | "either";

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

type ActiveTargetState = {
  id: number;
  zone: TargetZoneKey;
  hand: PunchHand;
  createdAt: number;
};

type MaterializedTarget = ActiveTargetState & {
  label: string;
  x: number;
  y: number;
  r: number;
};

type HandSnapshot = {
  x: number;
  y: number;
  z: number;
  t: number;
  visible: boolean;
};

type RoundMetrics = {
  hits: number;
  misses: number;
  streak: number;
  bestStreak: number;
  reactionTimes: number[];
  startedAt: number | null;
  endedAt: number | null;
};

type DrillDefinition = {
  key: DrillKey;
  label: string;
  description: string;
  defaultSeconds: number;
};

const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const DRILLS: DrillDefinition[] = [
  {
    key: "leftJab",
    label: "Left jab targets",
    description: "Single-hand jab rhythm with head and chest targets.",
    defaultSeconds: 45,
  },
  {
    key: "rightCross",
    label: "Right cross targets",
    description: "Power-side punches with longer reach targets.",
    defaultSeconds: 45,
  },
  {
    key: "alternating",
    label: "Alternating hands",
    description: "Left, right, left, right for clean coordination.",
    defaultSeconds: 45,
  },
  {
    key: "random",
    label: "Random targets",
    description: "Mixed targets around the head and torso.",
    defaultSeconds: 60,
  },
  {
    key: "speed",
    label: "Speed mode",
    description: "Bigger targets, fast miss timer, maximum pace.",
    defaultSeconds: 30,
  },
  {
    key: "reaction",
    label: "Reaction mode",
    description: "Short target windows for quick reaction tracking.",
    defaultSeconds: 40,
  },
  {
    key: "timed",
    label: "Timed round",
    description: "Classic round with balanced scoring.",
    defaultSeconds: 60,
  },
];

const DIFFICULTIES: Record<DifficultyKey, { label: string; speed: number; missMs: number; scale: number }> = {
  easy: { label: "Easy", speed: 0.42, missMs: 2800, scale: 1.16 },
  normal: { label: "Normal", speed: 0.58, missMs: 2200, scale: 1 },
  hard: { label: "Hard", speed: 0.76, missMs: 1650, scale: 0.86 },
};

const TARGET_SIZES: Record<TargetSizeKey, { label: string; scale: number }> = {
  large: { label: "Large", scale: 1.18 },
  normal: { label: "Normal", scale: 1 },
  small: { label: "Small", scale: 0.86 },
};

const TARGET_LABELS: Record<TargetZoneKey, string> = {
  headLeft: "Head left",
  headRight: "Head right",
  chest: "Chest",
  bodyLeft: "Body left",
  bodyRight: "Body right",
};

const BOXING_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
];

const createMetrics = (): RoundMetrics => ({
  hits: 0,
  misses: 0,
  streak: 0,
  bestStreak: 0,
  reactionTimes: [],
  startedAt: null,
  endedAt: null,
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function visibility(point?: Landmark) {
  return point?.visibility ?? 1;
}

function isVisible(point?: Landmark, min = 0.45) {
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

function materializeTarget(
  active: ActiveTargetState | null,
  body: BodyFrame | null,
  difficulty: DifficultyKey,
  targetSize: TargetSizeKey
): MaterializedTarget | null {
  if (!active || !body) return null;

  const radius =
    clamp(body.shoulderWidth * 0.31, 0.045, 0.105) *
    DIFFICULTIES[difficulty].scale *
    TARGET_SIZES[targetSize].scale;
  const sideLift = body.torsoLength * 0.04;
  const chestY = body.shoulderMid.y + body.torsoLength * 0.34;
  const bodyY = body.shoulderMid.y + body.torsoLength * 0.58;

  const centerByZone: Record<TargetZoneKey, { x: number; y: number }> = {
    headLeft: {
      x: body.shoulderMid.x - body.shoulderWidth * 0.55,
      y: body.nose.y + sideLift,
    },
    headRight: {
      x: body.shoulderMid.x + body.shoulderWidth * 0.55,
      y: body.nose.y + sideLift,
    },
    chest: {
      x: body.shoulderMid.x,
      y: chestY,
    },
    bodyLeft: {
      x: body.shoulderMid.x - body.shoulderWidth * 0.48,
      y: bodyY,
    },
    bodyRight: {
      x: body.shoulderMid.x + body.shoulderWidth * 0.48,
      y: bodyY,
    },
  };

  const center = centerByZone[active.zone];
  return {
    ...active,
    label: TARGET_LABELS[active.zone],
    x: clamp(center.x, radius, 1 - radius),
    y: clamp(center.y, radius, 1 - radius),
    r: radius,
  };
}

function getWrist(landmarks: Landmark[] | undefined, hand: Exclude<PunchHand, "either">): Landmark | undefined {
  return landmarks?.[hand === "left" ? 15 : 16];
}

function getShoulder(landmarks: Landmark[] | undefined, hand: Exclude<PunchHand, "either">): Landmark | undefined {
  return landmarks?.[hand === "left" ? 11 : 12];
}

function getCurrentHands(landmarks: Landmark[] | undefined, now: number): Record<"left" | "right", HandSnapshot> {
  const left = getWrist(landmarks, "left");
  const right = getWrist(landmarks, "right");
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

export function ShadowBoxingMode() {
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectTimestampRef = useRef(0);
  const detectionErrorCountRef = useRef(0);
  const previousHandsRef = useRef<Record<"left" | "right", HandSnapshot> | null>(null);
  const activeTargetRef = useRef<ActiveTargetState | null>(null);
  const targetSerialRef = useRef(0);
  const alternateHandRef = useRef<Exclude<PunchHand, "either">>("left");
  const lastFeedbackAtRef = useRef(0);
  const feedbackRef = useRef("Start the camera and step into view.");
  const phaseRef = useRef<BoxingPhase>("setup");
  const drillRef = useRef<DrillKey>("random");
  const difficultyRef = useRef<DifficultyKey>("easy");
  const targetSizeRef = useRef<TargetSizeKey>("large");
  const soundEnabledRef = useRef(true);
  const metricsRef = useRef<RoundMetrics>(createMetrics());
  const audioContextRef = useRef<AudioContext | null>(null);
  const hitEffectTimeoutRef = useRef<number | null>(null);
  const hitEffectRef = useRef<{ id: number; x: number; y: number; r: number } | null>(null);

  const [phase, setPhase] = useState<BoxingPhase>("setup");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillKey>("random");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("easy");
  const [targetSize, setTargetSize] = useState<TargetSizeKey>("large");
  const [roundSeconds, setRoundSeconds] = useState(60);
  const [roundRemaining, setRoundRemaining] = useState(60);
  const [countdown, setCountdown] = useState<number | "GO" | null>(null);
  const [feedback, setFeedback] = useState("Start the camera and step into view.");
  const [metrics, setMetrics] = useState<RoundMetrics>(() => createMetrics());
  const [activeTarget, setActiveTarget] = useState<ActiveTargetState | null>(null);
  const [, setHitEffect] = useState<{ id: number; x: number; y: number; r: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedDrill = useMemo(
    () => DRILLS.find((item) => item.key === drill) ?? DRILLS[3],
    [drill]
  );

  const totalAttempts = metrics.hits + metrics.misses;
  const accuracy = totalAttempts > 0 ? Math.round((metrics.hits / totalAttempts) * 100) : 0;
  const averageReaction =
    metrics.reactionTimes.length > 0
      ? Math.round(metrics.reactionTimes.reduce((sum, item) => sum + item, 0) / metrics.reactionTimes.length)
      : 0;
  const elapsedSeconds =
    metrics.startedAt && metrics.endedAt
      ? Math.max(1, Math.round((metrics.endedAt - metrics.startedAt) / 1000))
      : Math.max(1, roundSeconds - roundRemaining);
  const punchesPerMinute = metrics.hits > 0 ? Math.round((metrics.hits / elapsedSeconds) * 60) : 0;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    drillRef.current = drill;
  }, [drill]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    targetSizeRef.current = targetSize;
  }, [targetSize]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  const commitMetrics = useCallback((updater: (current: RoundMetrics) => RoundMetrics) => {
    const next = updater(metricsRef.current);
    metricsRef.current = next;
    setMetrics(next);
  }, []);

  const updateFeedback = useCallback((message: string, force = false) => {
    const now = performance.now();
    if (!force && feedbackRef.current === message) return;
    if (!force && now - lastFeedbackAtRef.current < 850) return;
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
    (kind: "hit" | "miss" | "start" | "finish") => {
      if (!soundEnabledRef.current) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);

      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const frequency =
        kind === "hit" ? 740 : kind === "miss" ? 180 : kind === "finish" ? 540 : 420;
      oscillator.type = kind === "miss" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      if (kind === "hit") oscillator.frequency.exponentialRampToValueAtTime(960, now + 0.08);
      if (kind === "finish") oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.16);
      gain.gain.setValueAtTime(kind === "miss" ? 0.045 : 0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === "finish" ? 0.28 : 0.14));
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + (kind === "finish" ? 0.3 : 0.16));
    },
    [getAudioContext]
  );

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

  const pickNextTarget = useCallback((): Omit<ActiveTargetState, "id" | "createdAt"> => {
    const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
    const drillKey = drillRef.current;
    const allZones: TargetZoneKey[] = ["headLeft", "headRight", "chest", "bodyLeft", "bodyRight"];

    if (drillKey === "leftJab") {
      return { hand: "left", zone: randomItem(["headLeft", "chest", "bodyLeft"]) };
    }
    if (drillKey === "rightCross") {
      return { hand: "right", zone: randomItem(["headRight", "chest", "bodyRight"]) };
    }
    if (drillKey === "alternating") {
      const nextHand = alternateHandRef.current;
      alternateHandRef.current = nextHand === "left" ? "right" : "left";
      return {
        hand: nextHand,
        zone:
          nextHand === "left"
            ? randomItem(["headLeft", "chest", "bodyLeft"])
            : randomItem(["headRight", "chest", "bodyRight"]),
      };
    }
    if (drillKey === "speed") {
      return { hand: "either", zone: randomItem(allZones) };
    }
    if (drillKey === "reaction") {
      return {
        hand: randomItem(["left", "right"] as Array<Exclude<PunchHand, "either">>),
        zone: randomItem(allZones),
      };
    }
    return {
      hand: randomItem(["left", "right"] as Array<Exclude<PunchHand, "either">>),
      zone: randomItem(allZones),
    };
  }, []);

  const activateNextTarget = useCallback(() => {
    const picked = pickNextTarget();
    const next: ActiveTargetState = {
      ...picked,
      id: targetSerialRef.current + 1,
      createdAt: performance.now(),
    };
    targetSerialRef.current = next.id;
    activeTargetRef.current = next;
    setActiveTarget(next);
  }, [pickNextTarget]);

  const drawScene = useCallback(
    (landmarks?: Landmark[], materialTarget?: MaterializedTarget | null) => {
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

      if (landmarks) {
        ctx.lineCap = "round";
        ctx.lineWidth = 9;
        ctx.strokeStyle = "rgba(15, 23, 42, 0.55)";
        BOXING_CONNECTIONS.forEach(([aIndex, bIndex]) => {
          const a = landmarks[aIndex];
          const b = landmarks[bIndex];
          if (!isVisible(a, 0.42) || !isVisible(b, 0.42)) return;
          ctx.beginPath();
          ctx.moveTo(a.x * width, a.y * height);
          ctx.lineTo(b.x * width, b.y * height);
          ctx.stroke();
        });

        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(45, 212, 191, 0.9)";
        BOXING_CONNECTIONS.forEach(([aIndex, bIndex]) => {
          const a = landmarks[aIndex];
          const b = landmarks[bIndex];
          if (!isVisible(a, 0.42) || !isVisible(b, 0.42)) return;
          const isArm = [13, 14, 15, 16].includes(aIndex) || [13, 14, 15, 16].includes(bIndex);
          ctx.globalAlpha = isArm ? 1 : 0.35;
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

      if (materialTarget) {
        const x = materialTarget.x * width;
        const y = materialTarget.y * height;
        const r = materialTarget.r * Math.min(width, height);
        const pulse = 1 + Math.sin(performance.now() / 120) * 0.035;

        ctx.save();
        ctx.shadowColor = "rgba(20, 184, 166, 0.7)";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.fillStyle = "rgba(20, 184, 166, 0.24)";
        ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.lineWidth = 7;
        ctx.strokeStyle = "rgba(20, 184, 166, 0.98)";
        ctx.stroke();
        ctx.setLineDash([8, 9]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
      }

      const currentHitEffect = hitEffectRef.current;
      if (currentHitEffect) {
        const x = currentHitEffect.x * width;
        const y = currentHitEffect.y * height;
        const r = currentHitEffect.r * Math.min(width, height);
        ctx.save();
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.86)";
        ctx.beginPath();
        ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
        ctx.font = `${Math.max(22, r * 0.52)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+1", x, y);
        ctx.restore();
      }
    },
    []
  );

  const stopLoop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const registerHit = useCallback(
    (target: MaterializedTarget, now: number) => {
      playSound("hit");
      updateFeedback("Good hit", true);
      const nextHitEffect = { id: target.id, x: target.x, y: target.y, r: target.r };
      hitEffectRef.current = nextHitEffect;
      setHitEffect(nextHitEffect);
      if (hitEffectTimeoutRef.current) window.clearTimeout(hitEffectTimeoutRef.current);
      hitEffectTimeoutRef.current = window.setTimeout(() => {
        hitEffectRef.current = null;
        setHitEffect(null);
      }, 280);

      commitMetrics((current) => {
        const nextStreak = current.streak + 1;
        return {
          ...current,
          hits: current.hits + 1,
          streak: nextStreak,
          bestStreak: Math.max(current.bestStreak, nextStreak),
          reactionTimes: [...current.reactionTimes, now - target.createdAt],
        };
      });
      activateNextTarget();
    },
    [activateNextTarget, commitMetrics, playSound, updateFeedback]
  );

  const registerMiss = useCallback(() => {
    playSound("miss");
    updateFeedback("Return to guard", true);
    commitMetrics((current) => ({
      ...current,
      misses: current.misses + 1,
      streak: 0,
    }));
    activateNextTarget();
  }, [activateNextTarget, commitMetrics, playSound, updateFeedback]);

  const processPunchTarget = useCallback(
    (landmarks: Landmark[] | undefined, body: BodyFrame, target: MaterializedTarget, now: number) => {
      const currentHands = getCurrentHands(landmarks, now);
      const previousHands = previousHandsRef.current;
      const handCandidates: Array<Exclude<PunchHand, "either">> = ["left", "right"];
      let gaveNearTargetCue = false;

      for (const hand of handCandidates) {
        const currentHand = currentHands[hand];
        const wrist = getWrist(landmarks, hand);
        const shoulder = getShoulder(landmarks, hand);
        if (!currentHand.visible || !wrist || !shoulder) {
          continue;
        }

        const prev = previousHands?.[hand];
        const dt = prev ? Math.max(16, now - prev.t) / 1000 : 0;
        const speed = prev && dt > 0 ? distance2D(currentHand, prev) / dt : 0;
        const forwardDelta = prev ? prev.z - currentHand.z : 0;
        const extension = distance2D(wrist, shoulder) / body.shoulderWidth;
        const previousExtension = prev ? distance2D(prev, shoulder) / body.shoulderWidth : extension;
        const extensionDelta = extension - previousExtension;
        const targetDistance = distance2D(currentHand, target);
        const enteredTarget = targetDistance <= target.r;
        const forwardEnough = forwardDelta > 0.012 || extensionDelta > 0.05 || extension > 1.15;
        const fastEnough = speed >= DIFFICULTIES[difficultyRef.current].speed;

        if (enteredTarget && fastEnough && forwardEnough) {
          registerHit(target, now);
          previousHandsRef.current = currentHands;
          return;
        }

        if (enteredTarget && !fastEnough) {
          updateFeedback("Punch faster");
          gaveNearTargetCue = true;
        } else if (targetDistance <= target.r * 1.55 && !forwardEnough) {
          updateFeedback("Extend your arm");
          gaveNearTargetCue = true;
        }
      }

      if (!gaveNearTargetCue) {
        updateFeedback("Hit the glowing target");
      }
      previousHandsRef.current = currentHands;
    },
    [registerHit, updateFeedback]
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
        const materialTarget = materializeTarget(
          activeTargetRef.current,
          body,
          difficultyRef.current,
          targetSizeRef.current
        );
        drawScene(landmarks, materialTarget);

        if (!body) {
          previousHandsRef.current = null;
          if (phaseRef.current === "active") {
            updateFeedback("Step fully into the camera view.");
          }
          detectionErrorCountRef.current = 0;
          lastVideoTimeRef.current = video.currentTime;
          animationRef.current = requestAnimationFrame(runDetectionLoop);
          return;
        }

        if (phaseRef.current === "active") {
          if (!activeTargetRef.current) {
            activateNextTarget();
          } else if (materialTarget) {
            const age = timestamp - materialTarget.createdAt;
            const missWindow = drillRef.current === "reaction"
              ? Math.min(DIFFICULTIES[difficultyRef.current].missMs, 1550)
              : drillRef.current === "speed"
                ? Math.min(DIFFICULTIES[difficultyRef.current].missMs, 1750)
                : DIFFICULTIES[difficultyRef.current].missMs;

            if (age > missWindow) {
              registerMiss();
            } else {
              processPunchTarget(landmarks, body, materialTarget, timestamp);
            }
          }
        } else {
          previousHandsRef.current = getCurrentHands(landmarks, timestamp);
        }

        detectionErrorCountRef.current = 0;
      } catch (err) {
        detectionErrorCountRef.current += 1;
        if (detectionErrorCountRef.current === 1) {
          console.warn("Shadow boxing detection skipped a frame.", err);
        }
        if (detectionErrorCountRef.current > 4) {
          updateFeedback("Camera is settling. Keep your hands visible.", true);
        }
      }

      lastVideoTimeRef.current = video.currentTime;
    }

    animationRef.current = requestAnimationFrame(runDetectionLoop);
  }, [activateNextTarget, drawScene, processPunchTarget, registerMiss, updateFeedback]);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    previousHandsRef.current = null;
    activeTargetRef.current = null;
    setActiveTarget(null);
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
      setCameraStatus("ready");
      updateFeedback("Camera ready. Keep your head, chest, and hands visible.", true);
      stopLoop();
      animationRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start shadow boxing camera.");
      setCameraStatus("error");
      stopCamera();
    }
  }, [runDetectionLoop, stopCamera, stopLoop, updateFeedback]);

  const finishRound = useCallback(() => {
    setPhase("summary");
    setCountdown(null);
    activeTargetRef.current = null;
    setActiveTarget(null);
    commitMetrics((current) => ({ ...current, endedAt: performance.now() }));
    updateFeedback("Round complete", true);
    playSound("finish");
  }, [commitMetrics, playSound, updateFeedback]);

  const beginRound = useCallback(async () => {
    if (!streamRef.current || cameraStatus !== "ready") {
      await startCamera();
    }
    if (!streamRef.current) return;

    const freshMetrics = createMetrics();
    metricsRef.current = freshMetrics;
    setMetrics(freshMetrics);
    previousHandsRef.current = null;
    activeTargetRef.current = null;
    setActiveTarget(null);
    setRoundRemaining(roundSeconds);
    setCountdown(3);
    updateFeedback("Get ready", true);
    setPhase("countdown");
    playSound("start");
  }, [cameraStatus, playSound, roundSeconds, startCamera, updateFeedback]);

  const resetRound = useCallback(() => {
    const freshMetrics = createMetrics();
    metricsRef.current = freshMetrics;
    setMetrics(freshMetrics);
    activeTargetRef.current = null;
    setActiveTarget(null);
    setCountdown(null);
    setRoundRemaining(roundSeconds);
    updateFeedback("Start when ready.", true);
    setPhase("setup");
  }, [roundSeconds, updateFeedback]);

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
        setCountdown("GO");
        updateFeedback("Go!", true);
        playSound("start");
        return;
      }

      window.clearInterval(interval);
      commitMetrics((existing) => ({ ...existing, startedAt: performance.now(), endedAt: null }));
      setPhase("active");
      activateNextTarget();
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activateNextTarget, commitMetrics, phase, playSound, updateFeedback]);

  useEffect(() => {
    if (phase !== "active") return undefined;

    const interval = window.setInterval(() => {
      setRoundRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          finishRound();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [finishRound, phase]);

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
    setRoundSeconds(selectedDrill.defaultSeconds);
    setRoundRemaining(selectedDrill.defaultSeconds);
  }, [selectedDrill.defaultSeconds]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (document.fullscreenElement === cameraShellRef.current) {
        void document.exitFullscreen().catch(() => undefined);
      }
      landmarkerRef.current?.close?.();
      if (hitEffectTimeoutRef.current) window.clearTimeout(hitEffectTimeoutRef.current);
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, [stopCamera]);

  const activeTargetText = activeTarget
    ? `${TARGET_LABELS[activeTarget.zone]} - ${activeTarget.hand === "either" ? "any hand" : activeTarget.hand}`
    : "Looking for target";

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Shadow Boxing</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Punch Target Training</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedDrill.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((value) => !value)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
            aria-label="Open boxing settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {(phase === "setup" || phase === "summary" || showSettings) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Drill</span>
              <span className="relative block">
                <select
                  value={drill}
                  onChange={(event) => setDrill(event.target.value as DrillKey)}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                >
                  {DRILLS.map((item) => (
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
              <span className="text-xs font-semibold text-slate-500">Target size</span>
              <span className="relative block">
                <select
                  value={targetSize}
                  onChange={(event) => setTargetSize(event.target.value as TargetSizeKey)}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                >
                  {Object.entries(TARGET_SIZES).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </span>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Round</span>
              <span className="relative block">
                <select
                  value={roundSeconds}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setRoundSeconds(next);
                    setRoundRemaining(next);
                  }}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                >
                  {[30, 45, 60, 90, 120].map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} sec
                    </option>
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
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "absolute inset-0 h-full w-full object-cover scale-x-[-1]",
            cameraStatus === "ready" ? "opacity-100" : "opacity-30"
          )}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
        />

        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
          <div className="min-w-0 rounded-full border border-white/18 bg-black/34 px-4 py-2 text-white shadow-sm backdrop-blur-md">
            <p className="truncate text-sm font-semibold">{selectedDrill.label}</p>
            <p className="truncate text-xs text-white/72">{activeTargetText}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((value) => !value)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/34 text-white backdrop-blur-md"
              aria-label={soundEnabled ? "Mute boxing sounds" : "Enable boxing sounds"}
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/34 text-white backdrop-blur-md"
              aria-label={isFullscreen ? "Exit fullscreen camera" : "Enter fullscreen camera"}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
          {phase === "countdown" && (
            <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/30 bg-teal-500/88 text-6xl font-black text-white shadow-2xl backdrop-blur-md">
              {countdown}
            </div>
          )}
        </div>

        {(cameraStatus !== "ready" || phase === "setup") && (
          <div className="absolute inset-x-5 bottom-28 rounded-[24px] border border-white/18 bg-white/92 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-950">Punch the highlighted target</p>
                <p className="mt-1 text-sm text-slate-600">
                  The target follows your body. Punch with speed, extend your arm, then return to guard.
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
                <p className="text-lg font-black text-slate-950">Round complete</p>
                <p className="text-sm text-slate-500">{metrics.hits} hits in {elapsedSeconds} sec</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xl font-black text-slate-950">{accuracy}%</p>
                <p className="text-xs font-semibold text-slate-500">Accuracy</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xl font-black text-slate-950">{averageReaction}ms</p>
                <p className="text-xs font-semibold text-slate-500">Reaction</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xl font-black text-slate-950">{metrics.bestStreak}</p>
                <p className="text-xs font-semibold text-slate-500">Best streak</p>
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
                <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">Punch count</p>
                <p className="leading-none text-5xl font-black text-slate-950">{metrics.hits}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right text-sm">
                <div>
                  <p className="font-black text-slate-950">{roundRemaining}s</p>
                  <p className="text-xs font-semibold text-slate-500">Timer</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">{metrics.streak}</p>
                  <p className="text-xs font-semibold text-slate-500">Streak</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">{metrics.misses}</p>
                  <p className="text-xs font-semibold text-slate-500">Miss</p>
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
                    onClick={finishRound}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700"
                  >
                    End round
                  </button>
                </>
              ) : phase === "paused" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      updateFeedback("Back to work", true);
                      setPhase("active");
                    }}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm"
                  >
                    <Play className="h-5 w-5" />
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={finishRound}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700"
                  >
                    End
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={beginRound}
                    disabled={phase === "countdown"}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"
                  >
                    <Play className="h-5 w-5" />
                    Start round
                  </button>
                  {phase === "summary" && (
                    <button
                      type="button"
                      onClick={resetRound}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl bg-slate-50 p-3">
              <Activity className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.hits}</p>
              <p className="text-xs font-semibold text-slate-500">Hits</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <Target className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.misses}</p>
              <p className="text-xs font-semibold text-slate-500">Misses</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <Clock className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{averageReaction}ms</p>
              <p className="text-xs font-semibold text-slate-500">Avg reaction</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <TimerReset className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{punchesPerMinute}</p>
              <p className="text-xs font-semibold text-slate-500">Punches/min</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <CheckCircle2 className="mb-2 h-4 w-4 text-teal-600" />
              <p className="text-2xl font-black text-slate-950">{metrics.bestStreak}</p>
              <p className="text-xs font-semibold text-slate-500">Best streak</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
