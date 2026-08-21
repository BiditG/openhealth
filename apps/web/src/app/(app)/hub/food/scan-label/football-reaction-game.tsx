"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Goal,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
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
type FootballMode = "penalty" | "keeper";
type DifficultyKey = "easy" | "normal" | "hard";
type Point = { x: number; y: number; z?: number };
type BodyFrame = { shoulderMid: Point; hipMid: Point; shoulderWidth: number; torsoLength: number };
type LimbSnapshot = Record<"left" | "right", { x: number; y: number; z: number; t: number; visible: boolean }>;
type BallState = {
  id: number;
  x: number;
  y: number;
  radius: number;
  status: "waiting" | "incoming" | "flight" | "done";
  startAt: number;
  durationMs: number;
  start?: Point;
  target?: Point;
  flight?: Point;
};
type Metrics = {
  attempts: number;
  goals: number;
  saves: number;
  misses: number;
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

const DIFFICULTIES: Record<DifficultyKey, { label: string; tolerance: number; speed: number; duration: number }> = {
  easy: { label: "Easy", tolerance: 0.22, speed: 0.38, duration: 2100 },
  normal: { label: "Normal", tolerance: 0.17, speed: 0.52, duration: 1650 },
  hard: { label: "Hard", tolerance: 0.13, speed: 0.7, duration: 1250 },
};

const MODE_COPY: Record<FootballMode, { label: string; description: string }> = {
  penalty: {
    label: "Penalty Kick",
    description: "Kick the virtual ball with your foot and aim it into the goal.",
  },
  keeper: {
    label: "Keeper Save",
    description: "React to the incoming shot and save it with your hands.",
  },
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
  attempts: 0,
  goals: 0,
  saves: 0,
  misses: 0,
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

function getLimbs(landmarks: Landmark[] | undefined, leftIndex: number, rightIndex: number, now: number): LimbSnapshot {
  const left = landmarks?.[leftIndex];
  const right = landmarks?.[rightIndex];
  return {
    left: { x: left?.x ?? 0, y: left?.y ?? 0, z: left?.z ?? 0, t: now, visible: visible(left, 0.34) },
    right: { x: right?.x ?? 0, y: right?.y ?? 0, z: right?.z ?? 0, t: now, visible: visible(right, 0.34) },
  };
}

function speed(current: LimbSnapshot["left"], previous?: LimbSnapshot["left"]) {
  if (!previous || !current.visible || !previous.visible) return 0;
  const dt = Math.max(16, current.t - previous.t) / 1000;
  return distance(current, previous) / dt;
}

function getBallPosition(ball: BallState, now: number) {
  if (ball.status === "incoming" && ball.start && ball.target) {
    const progress = clamp((now - ball.startAt) / ball.durationMs, 0, 1.12);
    const eased = progress <= 1 ? progress * progress * (3 - 2 * progress) : progress;
    return {
      x: ball.start.x + (ball.target.x - ball.start.x) * eased,
      y: ball.start.y + (ball.target.y - ball.start.y) * eased,
      progress,
    };
  }
  if (ball.status === "flight" && ball.flight) {
    const progress = clamp((now - ball.startAt) / 760, 0, 1);
    return {
      x: ball.x + ball.flight.x * progress,
      y: ball.y + ball.flight.y * progress,
      progress,
    };
  }
  return { x: ball.x, y: ball.y, progress: 0 };
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

export function FootballReactionGame() {
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const ballRef = useRef<BallState | null>(null);
  const ballSerialRef = useRef(0);
  const previousFeetRef = useRef<LimbSnapshot | null>(null);
  const serveTimeoutRef = useRef<number | null>(null);
  const resultTimeoutRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectTimestampRef = useRef(0);
  const phaseRef = useRef<Phase>("setup");
  const modeRef = useRef<FootballMode>("penalty");
  const difficultyRef = useRef<DifficultyKey>("easy");
  const soundEnabledRef = useRef(true);
  const metricsRef = useRef<Metrics>(createMetrics());
  const audioContextRef = useRef<AudioContext | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [mode, setMode] = useState<FootballMode>("penalty");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("easy");
  const [metrics, setMetrics] = useState<Metrics>(() => createMetrics());
  const [countdown, setCountdown] = useState<number | "START" | null>(null);
  const [feedback, setFeedback] = useState("Start camera and stand far enough back.");
  const [lastResult, setLastResult] = useState<{ title: string; detail: string; kind: "good" | "bad" } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(() => MODE_COPY[mode], [mode]);

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
    (kind: "goal" | "save" | "miss" | "start") => {
      if (!soundEnabledRef.current) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const frequency = kind === "goal" ? 820 : kind === "save" ? 680 : kind === "miss" ? 180 : 420;
      osc.type = kind === "miss" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(frequency, now);
      if (kind === "goal" || kind === "save") osc.frequency.exponentialRampToValueAtTime(frequency * 1.28, now + 0.12);
      gain.gain.setValueAtTime(kind === "miss" ? 0.045 : 0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    },
    [getAudioContext]
  );

  const showResult = useCallback((result: { title: string; detail: string; kind: "good" | "bad" }) => {
    setLastResult(result);
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = window.setTimeout(() => setLastResult(null), 950);
  }, []);

  const scheduleResetBall = useCallback((delay = 900) => {
    if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
    serveTimeoutRef.current = window.setTimeout(() => {
      ballRef.current = null;
    }, delay);
  }, []);

  const finishGame = useCallback(() => {
    setPhase("summary");
    ballRef.current = null;
    if (serveTimeoutRef.current) window.clearTimeout(serveTimeoutRef.current);
    commitMetrics((current) => ({ ...current, endedAt: performance.now() }));
    setFeedback("Football drill complete.");
  }, [commitMetrics]);

  const spawnBall = useCallback((body: BodyFrame) => {
    ballSerialRef.current += 1;
    const diff = DIFFICULTIES[difficultyRef.current];
    if (modeRef.current === "penalty") {
      ballRef.current = {
        id: ballSerialRef.current,
        x: body.hipMid.x,
        y: clamp(body.hipMid.y + body.torsoLength * 0.7, 0.64, 0.9),
        radius: clamp(body.shoulderWidth * 0.13, 0.035, 0.072),
        status: "waiting",
        startAt: performance.now(),
        durationMs: 0,
      };
      setFeedback("Kick the ball toward the goal.");
    } else {
      const targetX = clamp(body.shoulderMid.x + (Math.random() - 0.5) * body.shoulderWidth * 1.75, 0.16, 0.84);
      const targetY = clamp(body.shoulderMid.y + body.torsoLength * (0.02 + Math.random() * 0.46), 0.2, 0.72);
      ballRef.current = {
        id: ballSerialRef.current,
        x: targetX,
        y: 0.08,
        radius: clamp(body.shoulderWidth * 0.115, 0.032, 0.066),
        status: "incoming",
        start: { x: clamp(targetX + (Math.random() - 0.5) * 0.24, 0.12, 0.88), y: 0.06 },
        target: { x: targetX, y: targetY },
        startAt: performance.now(),
        durationMs: diff.duration,
      };
      setFeedback("React and save it.");
    }
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
      const goalW = body.shoulderWidth * 2.2 * width;
      const goalH = body.torsoLength * 0.85 * height;
      const goalX = body.shoulderMid.x * width - goalW / 2;
      const goalY = Math.max(26, (body.shoulderMid.y - body.torsoLength * 0.72) * height);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(goalX, goalY + goalH);
      ctx.lineTo(goalX, goalY);
      ctx.lineTo(goalX + goalW, goalY);
      ctx.lineTo(goalX + goalW, goalY + goalH);
      ctx.stroke();
      ctx.strokeStyle = "rgba(20,184,166,0.32)";
      ctx.lineWidth = 2;
      for (let i = 1; i < 5; i += 1) {
        ctx.beginPath();
        ctx.moveTo(goalX + (goalW / 5) * i, goalY);
        ctx.lineTo(goalX + (goalW / 5) * i, goalY + goalH);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (landmarks) {
      ctx.lineCap = "round";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(15,23,42,0.54)";
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
      ctx.strokeStyle = "rgba(45,212,191,0.9)";
      CONNECTIONS.forEach(([aIndex, bIndex]) => {
        const a = landmarks[aIndex];
        const b = landmarks[bIndex];
        if (!visible(a) || !visible(b)) return;
        ctx.globalAlpha = [15, 16, 27, 28].includes(aIndex) || [15, 16, 27, 28].includes(bIndex) ? 1 : 0.34;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      [15, 16, 27, 28].forEach((index) => {
        const point = landmarks[index];
        if (!visible(point, 0.34)) return;
        ctx.beginPath();
        ctx.fillStyle = index >= 27 ? "rgba(251,191,36,0.96)" : "rgba(20,184,166,0.96)";
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 4;
        ctx.arc(point.x * width, point.y * height, index >= 27 ? 15 : 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    const ball = ballRef.current;
    if (ball) {
      const position = getBallPosition(ball, performance.now());
      const x = position.x * width;
      const y = position.y * height;
      const r = ball.radius * Math.min(width, height);
      ctx.save();
      if (ball.status === "incoming" && ball.start && ball.target) {
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ball.start.x * width, ball.start.y * height);
        ctx.lineTo(ball.target.x * width, ball.target.y * height);
        ctx.stroke();
      }
      ctx.shadowColor = "rgba(251,191,36,0.85)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "rgba(251,191,36,0.98)";
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

  const recordOutcome = useCallback(
    (kind: "goal" | "save" | "miss", detail: string, flight?: Point) => {
      playSound(kind === "goal" ? "goal" : kind === "save" ? "save" : "miss");
      const good = (modeRef.current === "penalty" && kind === "goal") || (modeRef.current === "keeper" && kind === "save");
      showResult({
        title: kind === "goal" ? "GOAL!" : kind === "save" ? "SAVE!" : "MISS",
        detail,
        kind: good ? "good" : "bad",
      });
      if (ballRef.current && flight) {
        ballRef.current = { ...ballRef.current, status: "flight", startAt: performance.now(), flight };
      }
      setFeedback(detail);
      commitMetrics((current) => {
        const streak = good ? current.streak + 1 : 0;
        return {
          ...current,
          attempts: current.attempts + 1,
          goals: current.goals + (kind === "goal" ? 1 : 0),
          saves: current.saves + (kind === "save" ? 1 : 0),
          misses: current.misses + (kind === "miss" ? 1 : 0),
          streak,
          bestStreak: Math.max(current.bestStreak, streak),
        };
      });
      scheduleResetBall(950);
    },
    [commitMetrics, playSound, scheduleResetBall, showResult]
  );

  const processPenalty = useCallback(
    (landmarks: Landmark[] | undefined, body: BodyFrame, ball: BallState, now: number) => {
      const feet = getLimbs(landmarks, 27, 28, now);
      const previousFeet = previousFeetRef.current;
      const diff = DIFFICULTIES[difficultyRef.current];
      const leftSpeed = speed(feet.left, previousFeet?.left);
      const rightSpeed = speed(feet.right, previousFeet?.right);
      const chosen = leftSpeed > rightSpeed ? feet.left : feet.right;
      const chosenPrevious = leftSpeed > rightSpeed ? previousFeet?.left : previousFeet?.right;
      if (chosen.visible && chosenPrevious) {
        const nearBall = distance(chosen, ball) <= ball.radius + body.shoulderWidth * diff.tolerance;
        const fastEnough = Math.max(leftSpeed, rightSpeed) >= diff.speed;
        if (nearBall && fastEnough) {
          const vx = clamp((chosen.x - chosenPrevious.x) * 2.3, -0.58, 0.58);
          const vy = clamp((chosen.y - chosenPrevious.y) * 1.8 - 0.52, -0.85, -0.2);
          const isOnTarget = Math.abs(vx) < 0.5 && vy < -0.28;
          recordOutcome(isOnTarget ? "goal" : "miss", isOnTarget ? "Clean strike into the net." : "Wide of the goal.", { x: vx, y: vy });
        } else if (nearBall) {
          setFeedback("Kick through the ball.");
        }
      }
      previousFeetRef.current = feet;
    },
    [recordOutcome]
  );

  const processKeeper = useCallback(
    (landmarks: Landmark[] | undefined, body: BodyFrame, ball: BallState, now: number) => {
      const position = getBallPosition(ball, now);
      const hands = getLimbs(landmarks, 15, 16, now);
      const diff = DIFFICULTIES[difficultyRef.current];
      const tolerance = ball.radius + body.shoulderWidth * diff.tolerance;
      const saved = [hands.left, hands.right].some((hand) => hand.visible && distance(hand, position) <= tolerance);
      if (saved && position.progress >= 0.35) {
        recordOutcome("save", "Strong keeper save.", { x: (Math.random() - 0.5) * 0.5, y: -0.45 });
      } else if (position.progress > 1.05) {
        recordOutcome("goal", "The shot got past you.", { x: 0, y: 0.25 });
      } else {
        setFeedback("Move your hands to the ball.");
      }
    },
    [recordOutcome]
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
          if (phaseRef.current === "active") setFeedback("Step back so your body, hands, and feet are visible.");
          lastVideoTimeRef.current = video.currentTime;
          animationRef.current = requestAnimationFrame(runDetectionLoop);
          return;
        }
        if (phaseRef.current === "active") {
          if (!ballRef.current) spawnBall(body);
          else if (modeRef.current === "penalty" && ballRef.current.status === "waiting") processPenalty(landmarks, body, ballRef.current, timestamp);
          else if (modeRef.current === "keeper" && ballRef.current.status === "incoming") processKeeper(landmarks, body, ballRef.current, timestamp);
        }
      } catch (err) {
        console.warn("Football detection skipped a frame.", err);
        setFeedback("Camera is settling. Stay in frame.");
      }
      lastVideoTimeRef.current = video.currentTime;
    }
    animationRef.current = requestAnimationFrame(runDetectionLoop);
  }, [drawScene, processKeeper, processPenalty, spawnBall]);

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
      previousFeetRef.current = null;
      setCameraStatus("ready");
      setFeedback("Ready. Keep hands and feet visible.");
      stopLoop();
      animationRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start football camera.");
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
    previousFeetRef.current = null;
    ballRef.current = null;
    setCountdown(3);
    setFeedback("Ready");
    setPhase("countdown");
    playSound("start");
  }, [cameraStatus, playSound, startCamera]);

  const resetGame = useCallback(() => {
    const fresh = createMetrics();
    metricsRef.current = fresh;
    setMetrics(fresh);
    setLastResult(null);
    previousFeetRef.current = null;
    ballRef.current = null;
    setCountdown(null);
    setFeedback("Start when ready.");
    setPhase("setup");
  }, []);

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
    const handler = () => setIsFullscreen(document.fullscreenElement === cameraShellRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

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

  const successRate = metrics.attempts > 0 ? Math.round(((mode === "penalty" ? metrics.goals : metrics.saves) / metrics.attempts) * 100) : 0;

  return (
    <div className="space-y-5 pb-28">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Football</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedMode.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedMode.description}</p>
          </div>
          <button type="button" onClick={() => setSoundEnabled((value) => !value)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm">
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
        {(phase === "setup" || phase === "summary") && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Football mode</span>
              <span className="relative block">
                <select value={mode} onChange={(event) => setMode(event.target.value as FootballMode)} className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400">
                  <option value="penalty">Penalty Kick</option>
                  <option value="keeper">Keeper Save</option>
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
            <p className="text-xs text-white/72">{mode === "penalty" ? "Feet are kick markers" : "Hands are save markers"}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/18 bg-black/34 px-4 py-2 text-right text-white shadow-sm backdrop-blur-md">
              <p className="text-sm font-black">{mode === "penalty" ? metrics.goals : metrics.saves}</p>
              <p className="text-xs text-white/72">{mode === "penalty" ? "Goals" : "Saves"}</p>
            </div>
            <button type="button" onClick={toggleFullscreen} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/34 text-white backdrop-blur-md">
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {phase === "countdown" && <div className="absolute left-1/2 top-[46%] flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-teal-500/88 text-5xl font-black text-white shadow-2xl backdrop-blur-md">{countdown}</div>}

        {lastResult && (
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/25 bg-white/94 px-6 py-5 text-center shadow-2xl backdrop-blur-md">
            <p className={cn("text-4xl font-black leading-none", lastResult.kind === "good" ? "text-emerald-700" : "text-red-600")}>{lastResult.title}</p>
            <p className="mt-2 text-sm font-bold text-slate-600">{lastResult.detail}</p>
          </div>
        )}

        {(cameraStatus !== "ready" || phase === "setup") && (
          <div className="absolute inset-x-5 bottom-28 rounded-[24px] border border-white/18 bg-white/92 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">{mode === "penalty" ? <Goal className="h-5 w-5" /> : <Shield className="h-5 w-5" />}</div>
              <div>
                <p className="font-bold text-slate-950">{mode === "penalty" ? "Stand back and kick forward" : "Stand back and get ready to save"}</p>
                <p className="mt-1 text-sm text-slate-600">Keep your full body visible so the game can track hands, feet, and torso.</p>
              </div>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}

        {phase === "summary" && (
          <div className="absolute inset-x-5 top-24 rounded-[24px] border border-white/18 bg-white/94 p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
              <div><p className="text-lg font-black text-slate-950">Football complete</p><p className="text-sm text-slate-500">{successRate}% success rate</p></div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-4 bottom-4 space-y-3">
          <div className="mx-auto w-fit max-w-full rounded-full border border-white/18 bg-black/38 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm backdrop-blur-md">{feedback}</div>
          <div className="rounded-[24px] border border-white/18 bg-white/94 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[11px] font-black uppercase tracking-wide text-teal-700">{mode === "penalty" ? "Goals" : "Saves"}</p><p className="leading-none text-5xl font-black text-slate-950">{mode === "penalty" ? metrics.goals : metrics.saves}</p></div>
              <div className="grid grid-cols-4 gap-2 text-right text-sm">
                <div><p className="font-black text-slate-950">{metrics.attempts}</p><p className="text-xs font-semibold text-slate-500">Tries</p></div>
                <div><p className="font-black text-slate-950">{metrics.misses}</p><p className="text-xs font-semibold text-slate-500">Miss</p></div>
                <div><p className="font-black text-slate-950">{metrics.streak}</p><p className="text-xs font-semibold text-slate-500">Streak</p></div>
                <div><p className="font-black text-slate-950">{successRate}%</p><p className="text-xs font-semibold text-slate-500">Rate</p></div>
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
                  <button type="button" onClick={beginGame} disabled={phase === "countdown"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-teal-600 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"><Play className="h-5 w-5" /> Start football</button>
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
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.goals}</p><p className="text-xs font-semibold text-slate-500">Goals</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.saves}</p><p className="text-xs font-semibold text-slate-500">Saves</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.misses}</p><p className="text-xs font-semibold text-slate-500">Misses</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{successRate}%</p><p className="text-xs font-semibold text-slate-500">Success</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black text-slate-950">{metrics.bestStreak}</p><p className="text-xs font-semibold text-slate-500">Best streak</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
