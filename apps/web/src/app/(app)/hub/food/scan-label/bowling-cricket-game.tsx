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
  Target,
  TimerReset,
  Trophy,
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
type ModeKey = "quick6" | "pace" | "wicketHunt";
type DifficultyKey = "easy" | "normal" | "hard";
type Point = { x: number; y: number; z?: number };
type BodyFrame = { shoulderMid: Point; hipMid: Point; shoulderWidth: number; torsoLength: number };
type WristSample = { left?: Point; right?: Point; t: number };
type BallState = {
  id: number;
  start: Point;
  target: Point;
  status: "bowled" | "wicket" | "smashed";
  startedAt: number;
  durationMs: number;
  flight?: Point;
};
type Metrics = {
  balls: number;
  wickets: number;
  smashed: number;
  goodLine: number;
  bestSpeed: number;
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

const MODES: Record<ModeKey, { label: string; description: string; ballLimit?: number; seconds?: number }> = {
  quick6: {
    label: "Quick Over",
    description: "Bowl six deliveries and hunt for wickets.",
    ballLimit: 6,
  },
  pace: {
    label: "Pace Challenge",
    description: "Bowl as fast and straight as you can for 45 seconds.",
    seconds: 45,
  },
  wicketHunt: {
    label: "Wicket Hunt",
    description: "Tighter line, stronger batsman, bigger wicket reward.",
    ballLimit: 12,
  },
};

const DIFFICULTIES: Record<DifficultyKey, { label: string; speed: number; line: number; action: number; recoveryMs: number }> = {
  easy: { label: "Easy", speed: 0.68, line: 0.36, action: 0.8, recoveryMs: 1150 },
  normal: { label: "Normal", speed: 0.86, line: 0.28, action: 0.95, recoveryMs: 900 },
  hard: { label: "Hard", speed: 1.05, line: 0.22, action: 1.12, recoveryMs: 720 },
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
  balls: 0,
  wickets: 0,
  smashed: 0,
  goodLine: 0,
  bestSpeed: 0,
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

function getBallPosition(ball: BallState, now: number) {
  const progress = clamp((now - ball.startedAt) / ball.durationMs, 0, 1.2);
  const eased = progress <= 1 ? progress * progress * (3 - 2 * progress) : progress;
  if (ball.status === "smashed" && ball.flight) {
    return {
      x: ball.target.x + ball.flight.x * eased,
      y: ball.target.y + ball.flight.y * eased,
      progress,
    };
  }
  return {
    x: ball.start.x + (ball.target.x - ball.start.x) * eased,
    y: ball.start.y + (ball.target.y - ball.start.y) * eased,
    progress,
  };
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

export function BowlingCricketGame() {
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectTimestampRef = useRef(0);
  const detectionErrorCountRef = useRef(0);
  const wristTrailRef = useRef<WristSample[]>([]);
  const lastReleaseAtRef = useRef(0);
  const ballRef = useRef<BallState | null>(null);
  const ballSerialRef = useRef(0);
  const resultTimeoutRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("setup");
  const modeRef = useRef<ModeKey>("quick6");
  const difficultyRef = useRef<DifficultyKey>("normal");
  const soundEnabledRef = useRef(true);
  const metricsRef = useRef<Metrics>(createMetrics());
  const audioContextRef = useRef<AudioContext | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [mode, setMode] = useState<ModeKey>("quick6");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("normal");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [countdown, setCountdown] = useState<number | "START" | null>(null);
  const [feedback, setFeedback] = useState("Stand back and keep your full bowling arm visible.");
  const [lastResult, setLastResult] = useState<{ title: string; detail: string; kind: "good" | "bad" } | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(() => createMetrics());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(() => MODES[mode], [mode]);
  const lineAccuracy = metrics.balls > 0 ? Math.round((metrics.goodLine / metrics.balls) * 100) : 0;

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
    (kind: "release" | "wicket" | "smash" | "start") => {
      if (!soundEnabledRef.current) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const frequency = kind === "wicket" ? 850 : kind === "release" ? 520 : kind === "smash" ? 180 : 430;
      oscillator.type = kind === "smash" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      if (kind !== "smash") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.28, now + 0.12);
      gain.gain.setValueAtTime(kind === "smash" ? 0.05 : 0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.24);
    },
    [getAudioContext]
  );

  const showResult = useCallback((result: { title: string; detail: string; kind: "good" | "bad" }) => {
    setLastResult(result);
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = window.setTimeout(() => setLastResult(null), 1050);
  }, []);

  const shouldFinish = useCallback((next: Metrics) => {
    const activeMode = MODES[modeRef.current];
    return Boolean(activeMode.ballLimit && next.balls >= activeMode.ballLimit);
  }, []);

  const finishGame = useCallback(() => {
    setPhase("summary");
    ballRef.current = null;
    commitMetrics((current) => ({ ...current, endedAt: performance.now() }));
    setFeedback("Bowling spell complete.");
  }, [commitMetrics]);

  const recordDelivery = useCallback(
    (body: BodyFrame, release: Point, vector: Point, speedScore: number, actionScore: number) => {
      const diff = DIFFICULTIES[difficultyRef.current];
      const lineError = Math.abs(vector.x) / Math.max(0.001, body.shoulderWidth);
      const straightEnough = lineError <= diff.line;
      const fastEnough = speedScore >= diff.speed;
      const completeEnough = actionScore >= diff.action;
      const wicket = straightEnough && fastEnough && completeEnough;
      const targetX = 0.5 + clamp(vector.x * 1.3, -0.22, 0.22);
      const targetY = 0.26;

      ballSerialRef.current += 1;
      ballRef.current = {
        id: ballSerialRef.current,
        start: { x: release.x, y: release.y },
        target: { x: targetX, y: targetY },
        status: wicket ? "wicket" : "smashed",
        startedAt: performance.now(),
        durationMs: wicket ? 760 : 620,
        flight: wicket ? undefined : { x: vector.x >= 0 ? 0.46 : -0.46, y: -0.38 },
      };

      playSound(wicket ? "wicket" : "smash");
      showResult({
        title: wicket ? "BOWLED!" : "SMASHED!",
        detail: wicket ? "Wicket hit clean." : fastEnough ? "Good pace, poor line." : "Too slow. Batsman attacks.",
        kind: wicket ? "good" : "bad",
      });
      setFeedback(wicket ? "Perfect line and pace." : straightEnough ? "Line was good. Add more pace." : "Aim straighter at the stumps.");

      commitMetrics((current) => {
        const streak = wicket ? current.streak + 1 : 0;
        const next = {
          ...current,
          balls: current.balls + 1,
          wickets: current.wickets + (wicket ? 1 : 0),
          smashed: current.smashed + (wicket ? 0 : 1),
          goodLine: current.goodLine + (straightEnough ? 1 : 0),
          bestSpeed: Math.max(current.bestSpeed, Math.round(speedScore * 100)),
          streak,
          bestStreak: Math.max(current.bestStreak, streak),
        };
        if (shouldFinish(next)) window.setTimeout(finishGame, 900);
        return next;
      });
    },
    [commitMetrics, finishGame, playSound, shouldFinish, showResult]
  );

  const evaluateBowlingAction = useCallback(
    (landmarks: Landmark[] | undefined, body: BodyFrame, now: number) => {
      const left = landmarks?.[15];
      const right = landmarks?.[16];
      const sample: WristSample = {
        left: visible(left, 0.34) ? { x: left!.x, y: left!.y, z: left!.z ?? 0 } : undefined,
        right: visible(right, 0.34) ? { x: right!.x, y: right!.y, z: right!.z ?? 0 } : undefined,
        t: now,
      };
      const trail = [...wristTrailRef.current, sample].filter((item) => now - item.t <= 1300);
      wristTrailRef.current = trail;
      if (trail.length < 5 || now - lastReleaseAtRef.current < DIFFICULTIES[difficultyRef.current].recoveryMs) return;

      const scoreHand = (hand: "left" | "right") => {
        const points = trail
          .map((item) => item[hand])
          .filter((point): point is Point => Boolean(point));
        if (points.length < 4) return null;
        const first = points[0];
        const last = points[points.length - 1];
        const highest = points.reduce((best, point) => (point.y < best.y ? point : best), points[0]);
        let travel = 0;
        for (let index = 1; index < points.length; index += 1) {
          travel += distance(points[index - 1], points[index]);
        }
        const overhead = highest.y < body.shoulderMid.y - body.torsoLength * 0.14;
        const releaseDrop = last.y - highest.y;
        const releaseForward = body.shoulderMid.y - last.y;
        const dt = Math.max(120, trail[trail.length - 1].t - trail[0].t) / 1000;
        const speedScore = travel / dt;
        const actionScore = (overhead ? 0.48 : 0) + releaseDrop / Math.max(0.001, body.torsoLength) + speedScore * 0.28;
        return {
          release: last,
          vector: { x: last.x - first.x, y: last.y - first.y },
          speedScore,
          actionScore: releaseForward > -body.torsoLength * 0.2 ? actionScore : actionScore * 0.75,
        };
      };

      const leftScore = scoreHand("left");
      const rightScore = scoreHand("right");
      const best =
        (leftScore?.speedScore ?? 0) > (rightScore?.speedScore ?? 0)
          ? leftScore
          : rightScore;
      if (!best) return;

      if (best.actionScore >= DIFFICULTIES[difficultyRef.current].action * 0.88 && best.speedScore >= DIFFICULTIES[difficultyRef.current].speed * 0.8) {
        lastReleaseAtRef.current = now;
        wristTrailRef.current = [];
        playSound("release");
        recordDelivery(body, best.release, best.vector, best.speedScore, best.actionScore);
      } else if (best.speedScore > 0.45) {
        setFeedback("Complete the arm rotation over the shoulder.");
      }
    },
    [playSound, recordDelivery]
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

    const creaseX = width * 0.5;
    const wicketY = height * 0.24;
    const wicketH = height * 0.13;
    const stumpGap = Math.max(10, width * 0.018);
    ctx.save();
    ctx.fillStyle = "rgba(20,184,166,0.08)";
    ctx.strokeStyle = "rgba(20,184,166,0.32)";
    ctx.lineWidth = 3;
    ctx.roundRect(width * 0.28, height * 0.12, width * 0.44, height * 0.26, 24);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.94)";
    ctx.lineWidth = 5;
    [-1, 0, 1].forEach((offset) => {
      ctx.beginPath();
      ctx.moveTo(creaseX + offset * stumpGap, wicketY);
      ctx.lineTo(creaseX + offset * stumpGap, wicketY + wicketH);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(creaseX - stumpGap * 1.25, wicketY);
    ctx.lineTo(creaseX + stumpGap * 1.25, wicketY);
    ctx.stroke();

    ctx.fillStyle = "rgba(15,23,42,0.62)";
    ctx.strokeStyle = "rgba(255,255,255,0.64)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width * 0.62, height * 0.3, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(width * 0.59, height * 0.325, 42, 82, 18);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(251,191,36,0.86)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(width * 0.59, height * 0.35);
    ctx.lineTo(width * 0.54, height * 0.43);
    ctx.stroke();
    ctx.restore();

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
        ctx.globalAlpha = [13, 14, 15, 16].includes(aIndex) || [13, 14, 15, 16].includes(bIndex) ? 1 : 0.34;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      [15, 16].forEach((index) => {
        const point = landmarks[index];
        if (!visible(point, 0.34)) return;
        ctx.beginPath();
        ctx.fillStyle = "rgba(20,184,166,0.96)";
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 4;
        ctx.arc(point.x * width, point.y * height, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    const ball = ballRef.current;
    if (ball) {
      const position = getBallPosition(ball, performance.now());
      const x = position.x * width;
      const y = position.y * height;
      const radius = Math.max(13, width * 0.025);
      ctx.save();
      ctx.shadowColor = ball.status === "wicket" ? "rgba(16,185,129,0.9)" : "rgba(251,191,36,0.9)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = ball.status === "wicket" ? "rgba(16,185,129,0.96)" : "rgba(251,191,36,0.98)";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
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
        drawScene(landmarks, body);
        if (phaseRef.current === "active") {
          if (body) evaluateBowlingAction(landmarks, body, timestamp);
          else setFeedback("Step back so your shoulders, hips, and bowling arm are visible.");
        }
        detectionErrorCountRef.current = 0;
      } catch {
        detectionErrorCountRef.current += 1;
        if (detectionErrorCountRef.current > 4) setFeedback("Camera is settling. Stay in frame.");
      }
      lastVideoTimeRef.current = video.currentTime;
    }
    animationRef.current = requestAnimationFrame(runDetectionLoop);
  }, [drawScene, evaluateBowlingAction]);

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
    wristTrailRef.current = [];
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
      setFeedback("Ready. Rotate your bowling arm over the shoulder and release toward the wicket.");
      stopLoop();
      animationRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start bowling camera.");
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
    wristTrailRef.current = [];
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
    setLastResult(null);
    wristTrailRef.current = [];
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

  const ballsLabel = selectedMode.ballLimit ? `${metrics.balls}/${selectedMode.ballLimit}` : String(metrics.balls);

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Cricket Bowling</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Wicket Attack</h2>
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
            <p className="text-xs text-white/72">Full arm action • aim at the stumps</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-right text-white shadow-sm backdrop-blur-md">
              <p className="text-sm font-black">{secondsRemaining > 0 ? `${secondsRemaining}s` : ballsLabel}</p>
              <p className="text-xs text-white/72">{secondsRemaining > 0 ? "Timer" : "Balls"}</p>
            </div>
            <button type="button" onClick={toggleFullscreen} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/34 text-white backdrop-blur-md">
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {phase === "countdown" && <div className="absolute left-1/2 top-[46%] flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-teal-500/88 text-5xl font-black text-white shadow-2xl backdrop-blur-md">{countdown}</div>}
        {lastResult && <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/25 bg-white/94 px-6 py-5 text-center shadow-2xl backdrop-blur-md"><p className={cn("text-4xl font-black leading-none", lastResult.kind === "good" ? "text-emerald-700" : "text-red-600")}>{lastResult.title}</p><p className="mt-2 text-sm font-bold text-slate-600">{lastResult.detail}</p></div>}

        {(cameraStatus !== "ready" || phase === "setup") && (
          <div className="absolute inset-x-5 bottom-28 rounded-[24px] border border-white/18 bg-white/92 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Target className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-slate-950">Bowl with a complete arm action</p>
                <p className="mt-1 text-sm text-slate-600">Bring your bowling arm high over the shoulder, swing through fast, and release toward the wicket.</p>
              </div>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}

        {phase === "summary" && (
          <div className="absolute inset-x-5 top-24 rounded-[24px] border border-white/18 bg-white/94 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
              <div><p className="text-lg font-black text-slate-950">Spell complete</p><p className="text-sm text-slate-500">{metrics.wickets} wickets • {lineAccuracy}% good line</p></div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-4 bottom-4 space-y-3">
          <div className="mx-auto w-fit max-w-full rounded-full border border-white/18 bg-black/38 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm backdrop-blur-md">{feedback}</div>
          <div className="rounded-[24px] border border-white/18 bg-white/94 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[11px] font-black uppercase tracking-wide text-teal-700">Wickets</p><p className="leading-none text-5xl font-black text-slate-950">{metrics.wickets}</p></div>
              <div className="grid grid-cols-4 gap-2 text-right text-sm">
                <div><p className="font-black text-slate-950">{ballsLabel}</p><p className="text-xs font-semibold text-slate-500">Balls</p></div>
                <div><p className="font-black text-slate-950">{metrics.smashed}</p><p className="text-xs font-semibold text-slate-500">Smashed</p></div>
                <div><p className="font-black text-slate-950">{metrics.bestSpeed}</p><p className="text-xs font-semibold text-slate-500">Pace</p></div>
                <div><p className="font-black text-slate-950">{metrics.streak}</p><p className="text-xs font-semibold text-slate-500">Streak</p></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {cameraStatus !== "ready" ? (
                <button type="button" onClick={startCamera} disabled={cameraStatus === "loading"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70">{cameraStatus === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} Start camera</button>
              ) : phase === "active" ? (
                <>
                  <button type="button" onClick={() => setPhase("paused")} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-sm"><Pause className="h-5 w-5" /> Pause</button>
                  <button type="button" onClick={finishGame} className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700">End</button>
                </>
              ) : phase === "paused" ? (
                <button type="button" onClick={() => setPhase("active")} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm"><Play className="h-5 w-5" /> Resume</button>
              ) : (
                <>
                  <button type="button" onClick={beginGame} disabled={phase === "countdown"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"><Play className="h-5 w-5" /> Start bowling</button>
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
            <div className="rounded-2xl bg-slate-50 p-3"><Trophy className="mb-2 h-4 w-4 text-teal-600" /><p className="text-2xl font-black text-slate-950">{metrics.wickets}</p><p className="text-xs font-semibold text-slate-500">Wickets</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><TimerReset className="mb-2 h-4 w-4 text-teal-600" /><p className="text-2xl font-black text-slate-950">{metrics.bestSpeed}</p><p className="text-xs font-semibold text-slate-500">Best pace</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.smashed}</p><p className="text-xs font-semibold text-slate-500">Smashed</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{lineAccuracy}%</p><p className="text-xs font-semibold text-slate-500">Line</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.bestStreak}</p><p className="text-xs font-semibold text-slate-500">Best streak</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
