"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Flame,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
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
type ModeKey = "quick" | "survival" | "boss";
type Point = { x: number; y: number; z?: number };
type BodyFrame = { shoulderMid: Point; hipMid: Point; shoulderWidth: number; torsoLength: number };
type Fireball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  power: number;
  createdAt: number;
  kind: "small" | "mega";
};
type Enemy = {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  speed: number;
  kind: "drone" | "brute" | "boss";
};
type Metrics = {
  score: number;
  blasts: number;
  megaBlasts: number;
  enemiesDefeated: number;
  hitsTaken: number;
  streak: number;
  bestStreak: number;
  startedAt: number | null;
  endedAt: number | null;
};
type WristSample = { left?: Point; right?: Point; t: number; leftAngle?: number; rightAngle?: number };

const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const MODES: Record<ModeKey, { label: string; description: string; seconds?: number; hitLimit?: number }> = {
  quick: {
    label: "Hero Training",
    description: "Charge fireballs and clear enemy waves for 45 seconds.",
    seconds: 45,
  },
  survival: {
    label: "Survival",
    description: "Enemies keep coming. Five hits ends the mission.",
    hitLimit: 5,
  },
  boss: {
    label: "Boss Wave",
    description: "Stronger enemies appear. Mega fireballs matter.",
    seconds: 60,
  },
};

const DIFFICULTIES: Record<DifficultyKey, { label: string; charge: number; close: number; enemyMs: number; enemySpeed: number }> = {
  easy: { label: "Easy", charge: 4.4, close: 0.72, enemyMs: 1500, enemySpeed: 0.00007 },
  normal: { label: "Normal", charge: 5.5, close: 0.6, enemyMs: 1180, enemySpeed: 0.000095 },
  hard: { label: "Hard", charge: 6.6, close: 0.5, enemyMs: 900, enemySpeed: 0.00012 },
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
  score: 0,
  blasts: 0,
  megaBlasts: 0,
  enemiesDefeated: 0,
  hitsTaken: 0,
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

function angleDelta(previous: number, current: number) {
  let delta = current - previous;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
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

export function SuperheroFireballGame() {
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectTimestampRef = useRef(0);
  const detectionErrorCountRef = useRef(0);
  const phaseRef = useRef<Phase>("setup");
  const modeRef = useRef<ModeKey>("quick");
  const difficultyRef = useRef<DifficultyKey>("easy");
  const soundEnabledRef = useRef(true);
  const metricsRef = useRef<Metrics>(createMetrics());
  const audioContextRef = useRef<AudioContext | null>(null);
  const wristTrailRef = useRef<WristSample[]>([]);
  const fireballsRef = useRef<Fireball[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const enemySerialRef = useRef(0);
  const fireballSerialRef = useRef(0);
  const lastCastAtRef = useRef(0);
  const lastEnemyAtRef = useRef(0);
  const resultTimeoutRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [mode, setMode] = useState<ModeKey>("quick");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("easy");
  const [secondsRemaining, setSecondsRemaining] = useState(MODES.quick.seconds ?? 0);
  const [countdown, setCountdown] = useState<number | "START" | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(() => createMetrics());
  const [feedback, setFeedback] = useState("Stand back and bring your hands in front of your chest.");
  const [chargeLabel, setChargeLabel] = useState("No charge");
  const [lastResult, setLastResult] = useState<{ title: string; kind: "good" | "bad" } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(() => MODES[mode], [mode]);
  const accuracy = metrics.blasts > 0 ? Math.round((metrics.enemiesDefeated / metrics.blasts) * 100) : 0;

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
    (kind: "small" | "mega" | "hit" | "damage" | "start") => {
      if (!soundEnabledRef.current) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const frequency = kind === "mega" ? 980 : kind === "small" ? 620 : kind === "hit" ? 760 : kind === "damage" ? 170 : 420;
      oscillator.type = kind === "damage" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      if (kind !== "damage") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.32, now + 0.12);
      gain.gain.setValueAtTime(kind === "damage" ? 0.05 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === "mega" ? 0.3 : 0.18));
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + (kind === "mega" ? 0.32 : 0.2));
    },
    [getAudioContext]
  );

  const showResult = useCallback((title: string, kind: "good" | "bad") => {
    setLastResult({ title, kind });
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = window.setTimeout(() => setLastResult(null), 850);
  }, []);

  const finishGame = useCallback(() => {
    setPhase("summary");
    fireballsRef.current = [];
    enemiesRef.current = [];
    commitMetrics((current) => ({ ...current, endedAt: performance.now() }));
    setFeedback("Hero mission complete.");
  }, [commitMetrics]);

  const shouldEnd = useCallback((next: Metrics) => {
    const activeMode = MODES[modeRef.current];
    return Boolean(activeMode.hitLimit && next.hitsTaken >= activeMode.hitLimit);
  }, []);

  const spawnEnemy = useCallback((body?: BodyFrame | null) => {
    const diff = DIFFICULTIES[difficultyRef.current];
    const isBossMode = modeRef.current === "boss";
    const kind: Enemy["kind"] =
      isBossMode && Math.random() > 0.68 ? "boss" : Math.random() > 0.72 ? "brute" : "drone";
    enemySerialRef.current += 1;
    const lane = [-0.46, 0, 0.46][Math.floor(Math.random() * 3)];
    const baseX = body?.shoulderMid.x ?? 0.5;
    enemiesRef.current = [
      ...enemiesRef.current,
      {
        id: enemySerialRef.current,
        x: clamp(baseX + lane * (body?.shoulderWidth ?? 0.26) * 2.2, 0.13, 0.87),
        y: 0.12,
        radius: kind === "boss" ? 0.085 : kind === "brute" ? 0.068 : 0.052,
        hp: kind === "boss" ? 3 : kind === "brute" ? 2 : 1,
        speed: diff.enemySpeed * (kind === "boss" ? 0.55 : kind === "brute" ? 0.75 : 1),
        kind,
      },
    ].slice(-6);
    lastEnemyAtRef.current = performance.now();
  }, []);

  const castFireball = useCallback(
    (body: BodyFrame, kind: "small" | "mega") => {
      const now = performance.now();
      if (now - lastCastAtRef.current < (kind === "mega" ? 650 : 480)) return;
      lastCastAtRef.current = now;
      fireballSerialRef.current += 1;
      const origin = {
        x: body.shoulderMid.x,
        y: body.shoulderMid.y + body.torsoLength * 0.12,
      };
      fireballsRef.current = [
        ...fireballsRef.current,
        {
          id: fireballSerialRef.current,
          x: origin.x,
          y: origin.y,
          vx: 0,
          vy: kind === "mega" ? -0.018 : -0.014,
          radius: kind === "mega" ? body.shoulderWidth * 0.34 : body.shoulderWidth * 0.2,
          power: kind === "mega" ? 2 : 1,
          createdAt: now,
          kind,
        },
      ];
      playSound(kind);
      showResult(kind === "mega" ? "MEGA BLAST" : "FIREBALL", "good");
      setFeedback(kind === "mega" ? "Epic two-hand blast!" : "Fireball launched!");
      commitMetrics((current) => ({
        ...current,
        blasts: current.blasts + 1,
        megaBlasts: current.megaBlasts + (kind === "mega" ? 1 : 0),
      }));
    },
    [commitMetrics, playSound, showResult]
  );

  const evaluateGesture = useCallback(
    (landmarks: Landmark[] | undefined, body: BodyFrame, now: number) => {
      const left = landmarks?.[15];
      const right = landmarks?.[16];
      const center = {
        x: body.shoulderMid.x,
        y: body.shoulderMid.y + body.torsoLength * 0.2,
      };
      if (!visible(left, 0.34) && !visible(right, 0.34)) {
        setChargeLabel("Show your hands");
        return;
      }

      const leftPoint = visible(left, 0.34) ? { x: left!.x, y: left!.y, z: left!.z ?? 0 } : undefined;
      const rightPoint = visible(right, 0.34) ? { x: right!.x, y: right!.y, z: right!.z ?? 0 } : undefined;
      const leftAngle = leftPoint ? Math.atan2(leftPoint.y - center.y, leftPoint.x - center.x) : undefined;
      const rightAngle = rightPoint ? Math.atan2(rightPoint.y - center.y, rightPoint.x - center.x) : undefined;
      const nextTrail = [
        ...wristTrailRef.current,
        { left: leftPoint, right: rightPoint, leftAngle, rightAngle, t: now },
      ].filter((sample) => now - sample.t <= 1450);
      wristTrailRef.current = nextTrail;

      let leftTravel = 0;
      let rightTravel = 0;
      for (let index = 1; index < nextTrail.length; index += 1) {
        const previous = nextTrail[index - 1];
        const current = nextTrail[index];
        if (previous.leftAngle !== undefined && current.leftAngle !== undefined) {
          leftTravel += angleDelta(previous.leftAngle, current.leftAngle);
        }
        if (previous.rightAngle !== undefined && current.rightAngle !== undefined) {
          rightTravel += angleDelta(previous.rightAngle, current.rightAngle);
        }
      }

      const diff = DIFFICULTIES[difficultyRef.current];
      const handsClose =
        leftPoint &&
        rightPoint &&
        distance(leftPoint, rightPoint) <= body.shoulderWidth * diff.close &&
        distance({ x: (leftPoint.x + rightPoint.x) / 2, y: (leftPoint.y + rightPoint.y) / 2 }, center) <= body.shoulderWidth * 1.05;
      const oneHandCharged = Math.max(leftTravel, rightTravel) >= diff.charge;
      const twoHandCharged = handsClose && leftTravel + rightTravel >= diff.charge * 1.6;

      if (twoHandCharged) {
        castFireball(body, "mega");
        wristTrailRef.current = [];
      } else if (oneHandCharged) {
        castFireball(body, "small");
        wristTrailRef.current = [];
      } else {
        const pct = clamp(Math.round((Math.max(leftTravel, rightTravel) / diff.charge) * 100), 0, 99);
        setChargeLabel(handsClose ? `Mega charge ${pct}%` : `Charge ${pct}%`);
      }
    },
    [castFireball]
  );

  const updateGameObjects = useCallback(
    (body: BodyFrame | null, now: number) => {
      const diff = DIFFICULTIES[difficultyRef.current];
      if (phaseRef.current === "active" && now - lastEnemyAtRef.current > diff.enemyMs) {
        spawnEnemy(body);
      }

      fireballsRef.current = fireballsRef.current
        .map((fireball) => ({ ...fireball, x: fireball.x + fireball.vx, y: fireball.y + fireball.vy }))
        .filter((fireball) => fireball.y > -0.2 && now - fireball.createdAt < 2600);

      enemiesRef.current = enemiesRef.current
        .map((enemy) => ({ ...enemy, y: enemy.y + enemy.speed * Math.max(16, now - lastDetectTimestampRef.current + 16) }))
        .filter((enemy) => enemy.y < 1.08);

      const fireballs = [...fireballsRef.current];
      let enemies = [...enemiesRef.current];
      const usedFireballs = new Set<number>();
      let defeated = 0;
      for (const fireball of fireballs) {
        for (const enemy of enemies) {
          if (usedFireballs.has(fireball.id)) continue;
          if (distance(fireball, enemy) <= fireball.radius + enemy.radius) {
            usedFireballs.add(fireball.id);
            enemy.hp -= fireball.power;
            if (enemy.hp <= 0) defeated += 1;
          }
        }
      }
      enemies = enemies.filter((enemy) => enemy.hp > 0);
      fireballsRef.current = fireballs.filter((fireball) => !usedFireballs.has(fireball.id));
      enemiesRef.current = enemies;

      if (defeated > 0) {
        playSound("hit");
        showResult(defeated > 1 ? "COMBO HIT" : "ENEMY DOWN", "good");
        commitMetrics((current) => {
          const streak = current.streak + defeated;
          return {
            ...current,
            score: current.score + defeated * 100 + Math.floor(streak / 3) * 25,
            enemiesDefeated: current.enemiesDefeated + defeated,
            streak,
            bestStreak: Math.max(current.bestStreak, streak),
          };
        });
      }

      const reachedHero = enemiesRef.current.filter((enemy) => enemy.y >= 0.94);
      if (reachedHero.length > 0) {
        enemiesRef.current = enemiesRef.current.filter((enemy) => enemy.y < 0.94);
        playSound("damage");
        showResult("HIT TAKEN", "bad");
        setFeedback("Enemy got through. Charge faster.");
        commitMetrics((current) => {
          const next = {
            ...current,
            hitsTaken: current.hitsTaken + reachedHero.length,
            streak: 0,
          };
          if (shouldEnd(next)) window.setTimeout(finishGame, 650);
          return next;
        });
      }
    },
    [commitMetrics, finishGame, playSound, shouldEnd, showResult, spawnEnemy]
  );

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

    const bg = ctx.createRadialGradient(width / 2, height * 0.65, 30, width / 2, height * 0.5, Math.max(width, height));
    bg.addColorStop(0, "rgba(20,184,166,0.18)");
    bg.addColorStop(0.48, "rgba(15,23,42,0.12)");
    bg.addColorStop(1, "rgba(15,23,42,0.34)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (landmarks) {
      ctx.lineCap = "round";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(15,23,42,0.56)";
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
        ctx.globalAlpha = [13, 14, 15, 16].includes(aIndex) || [13, 14, 15, 16].includes(bIndex) ? 1 : 0.36;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      const left = landmarks[15];
      const right = landmarks[16];
      [left, right].forEach((point) => {
        if (!visible(point, 0.34)) return;
        ctx.save();
        ctx.shadowColor = "rgba(251,146,60,0.95)";
        ctx.shadowBlur = 24;
        ctx.fillStyle = "rgba(251,146,60,0.96)";
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(point!.x * width, point!.y * height, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      if (body) {
        const chargeX = body.shoulderMid.x * width;
        const chargeY = (body.shoulderMid.y + body.torsoLength * 0.2) * height;
        ctx.save();
        ctx.strokeStyle = "rgba(251,146,60,0.38)";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 12]);
        ctx.beginPath();
        ctx.arc(chargeX, chargeY, body.shoulderWidth * width * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    enemiesRef.current.forEach((enemy) => {
      const x = enemy.x * width;
      const y = enemy.y * height;
      const r = enemy.radius * Math.min(width, height);
      ctx.save();
      ctx.shadowColor = enemy.kind === "boss" ? "rgba(168,85,247,0.9)" : "rgba(244,63,94,0.82)";
      ctx.shadowBlur = 26;
      ctx.fillStyle = enemy.kind === "boss" ? "rgba(168,85,247,0.9)" : enemy.kind === "brute" ? "rgba(244,63,94,0.9)" : "rgba(14,165,233,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = `${Math.max(12, r * 0.45)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(enemy.kind === "boss" ? "BOSS" : String(enemy.hp), x, y);
      ctx.restore();
    });

    fireballsRef.current.forEach((fireball) => {
      const x = fireball.x * width;
      const y = fireball.y * height;
      const r = fireball.radius * Math.min(width, height);
      const glow = fireball.kind === "mega" ? 44 : 28;
      ctx.save();
      const gradient = ctx.createRadialGradient(x, y, 2, x, y, r);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.28, "rgba(251,191,36,0.98)");
      gradient.addColorStop(0.72, "rgba(249,115,22,0.9)");
      gradient.addColorStop(1, "rgba(239,68,68,0.86)");
      ctx.shadowColor = fireball.kind === "mega" ? "rgba(251,191,36,1)" : "rgba(249,115,22,0.88)";
      ctx.shadowBlur = glow;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }, []);

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
        if (phaseRef.current === "active") {
          updateGameObjects(body, timestamp);
          if (body) evaluateGesture(landmarks, body, timestamp);
          else setFeedback("Step back so hands and upper body are visible.");
        }
        drawScene(landmarks, body);
        detectionErrorCountRef.current = 0;
      } catch {
        detectionErrorCountRef.current += 1;
        if (detectionErrorCountRef.current > 4) setFeedback("Camera is settling. Keep your hands visible.");
      }
      lastVideoTimeRef.current = video.currentTime;
    }
    animationRef.current = requestAnimationFrame(runDetectionLoop);
  }, [drawScene, evaluateGesture, updateGameObjects]);

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
    fireballsRef.current = [];
    enemiesRef.current = [];
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
      setFeedback("Ready. Roll one arm for fireball, both hands close for mega blast.");
      stopLoop();
      animationRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start hero camera.");
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
    fireballsRef.current = [];
    enemiesRef.current = [];
    wristTrailRef.current = [];
    lastEnemyAtRef.current = 0;
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
    fireballsRef.current = [];
    enemiesRef.current = [];
    wristTrailRef.current = [];
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
      if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
      landmarkerRef.current?.close?.();
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, [stopCamera]);

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Hero Blast</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Fireball Training</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedMode.description}</p>
          </div>
          <button type="button" onClick={() => setSoundEnabled((value) => !value)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm">
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
        {(phase === "setup" || phase === "summary") && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Mission</span>
              <span className="relative block">
                <select value={mode} onChange={(event) => setMode(event.target.value as ModeKey)} className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400">
                  {Object.entries(MODES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </span>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Difficulty</span>
              <span className="relative block">
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyKey)} className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400">
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
            <p className="text-xs text-white/72">{chargeLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-right text-white shadow-sm backdrop-blur-md">
              <p className="text-sm font-black">{selectedMode.seconds ? `${secondsRemaining}s` : `${metrics.hitsTaken}/5`}</p>
              <p className="text-xs text-white/72">{selectedMode.seconds ? "Timer" : "Damage"}</p>
            </div>
            <button type="button" onClick={toggleFullscreen} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/34 text-white backdrop-blur-md">
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {phase === "countdown" && <div className="absolute left-1/2 top-[46%] flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-orange-500/90 text-5xl font-black text-white shadow-2xl backdrop-blur-md">{countdown}</div>}
        {lastResult && <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/25 bg-white/94 px-6 py-5 text-center shadow-2xl backdrop-blur-md"><p className={cn("text-4xl font-black leading-none", lastResult.kind === "good" ? "text-orange-600" : "text-red-600")}>{lastResult.title}</p></div>}

        {(cameraStatus !== "ready" || phase === "setup") && (
          <div className="absolute inset-x-5 bottom-28 rounded-[24px] border border-white/18 bg-white/92 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><Flame className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-slate-950">Charge fireballs with your hands</p>
                <p className="mt-1 text-sm text-slate-600">Roll one wrist around your chest for a fireball. Keep both hands close and roll both arms for a mega blast.</p>
              </div>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}

        {phase === "summary" && (
          <div className="absolute inset-x-5 top-24 rounded-[24px] border border-white/18 bg-white/94 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600"><CheckCircle2 className="h-6 w-6" /></div>
              <div><p className="text-lg font-black text-slate-950">Mission complete</p><p className="text-sm text-slate-500">{metrics.enemiesDefeated} enemies defeated • {accuracy}% hit rate</p></div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-4 bottom-4 space-y-3">
          <div className="mx-auto w-fit max-w-full rounded-full border border-white/18 bg-black/38 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm backdrop-blur-md">{feedback}</div>
          <div className="rounded-[24px] border border-white/18 bg-white/94 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[11px] font-black uppercase tracking-wide text-orange-600">Score</p><p className="leading-none text-5xl font-black text-slate-950">{metrics.score}</p></div>
              <div className="grid grid-cols-4 gap-2 text-right text-sm">
                <div><p className="font-black text-slate-950">{metrics.enemiesDefeated}</p><p className="text-xs font-semibold text-slate-500">Enemies</p></div>
                <div><p className="font-black text-slate-950">{metrics.blasts}</p><p className="text-xs font-semibold text-slate-500">Blasts</p></div>
                <div><p className="font-black text-slate-950">{metrics.streak}</p><p className="text-xs font-semibold text-slate-500">Streak</p></div>
                <div><p className="font-black text-slate-950">{metrics.hitsTaken}</p><p className="text-xs font-semibold text-slate-500">Damage</p></div>
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
                  <button type="button" onClick={beginGame} disabled={phase === "countdown"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"><Play className="h-5 w-5" /> Start mission</button>
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
            <div className="rounded-2xl bg-slate-50 p-3"><Flame className="mb-2 h-4 w-4 text-orange-500" /><p className="text-2xl font-black text-slate-950">{metrics.blasts}</p><p className="text-xs font-semibold text-slate-500">Fireballs</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><Zap className="mb-2 h-4 w-4 text-orange-500" /><p className="text-2xl font-black text-slate-950">{metrics.megaBlasts}</p><p className="text-xs font-semibold text-slate-500">Mega blasts</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.enemiesDefeated}</p><p className="text-xs font-semibold text-slate-500">Enemies</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.bestStreak}</p><p className="text-xs font-semibold text-slate-500">Best streak</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
