"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Landmark = {
  x: number;
  y: number;
  visibility?: number;
};

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: Landmark[][] };
  close?: () => void;
};

type StretchTarget =
  | "upperBody"
  | "neckShoulders"
  | "hamstring"
  | "hip"
  | "lowerBack"
  | "quad"
  | "calf"
  | "sideBody";

type StretchStep = {
  title: string;
  duration: number;
  sides?: boolean;
  target: StretchTarget;
  demo: string;
  setup: string;
  goal: string;
  cues: string[];
};

type BodyCalibration = {
  shoulderWidth: number;
  torsoLength: number;
  legLength: number;
};

type PoseEvaluation = {
  score: number;
  passed: boolean;
  feedback: string;
  calibration: "waiting" | "ready";
};

type StretchRoutine = {
  id: string;
  title: string;
  subtitle: string;
  durationMin: number;
  difficulty: "Easy" | "Gentle" | "Moderate";
  steps: StretchStep[];
};

type StretchPhase = "home" | "overview" | "position" | "hold" | "paused" | "complete";

const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const MATCH_SCORE = 72;
const NEAR_MATCH_SCORE = 58;
const DRIFT_GRACE_SECONDS = 3;
const GYM_AUDIO_BASE = "/Audiogym";
const LANDMARK_CONNECTIONS: Array<[number, number]> = [
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
const TARGET_LANDMARKS: Record<StretchTarget, number[]> = {
  upperBody: [11, 12, 13, 14, 15, 16, 23, 24],
  neckShoulders: [0, 11, 12, 23, 24],
  hamstring: [11, 12, 23, 24, 25, 26, 27, 28],
  hip: [11, 12, 23, 24, 25, 26, 27, 28],
  lowerBack: [11, 12, 13, 14, 15, 16, 23, 24],
  quad: [11, 12, 23, 24, 25, 26, 27, 28],
  calf: [23, 24, 25, 26, 27, 28],
  sideBody: [11, 12, 13, 14, 15, 16, 23, 24],
};

function getNumberClip(message: string) {
  const number = Number(message.trim());
  return Number.isInteger(number) && number >= 1 && number <= 23
    ? `${GYM_AUDIO_BASE}/${number}.wav`
    : null;
}

const STRETCH_LIBRARY: Record<string, StretchStep> = {
  neckRoll: {
    title: "Neck Release",
    duration: 20,
    sides: true,
    target: "neckShoulders",
    demo: "Sit tall and let one ear gently move toward the shoulder.",
    setup: "Sit tall with shoulders relaxed.",
    goal: "Ear gently angled toward the shoulder while both shoulders stay relaxed.",
    cues: ["Relax your shoulders.", "Keep your chest open.", "Move gently, never force it."],
  },
  shoulderOpen: {
    title: "Shoulder Opener",
    duration: 25,
    target: "upperBody",
    demo: "Open the chest and reach your arms comfortably behind or wide.",
    setup: "Keep your ribs soft and shoulders low.",
    goal: "Arms open wide with shoulders low and spine tall.",
    cues: ["Relax your shoulders.", "Keep your back straight.", "Hold here."],
  },
  hamstring: {
    title: "Hamstring Stretch",
    duration: 25,
    sides: true,
    target: "hamstring",
    demo: "Place one leg forward, keep the back long, and hinge gently.",
    setup: "Place one leg forward with toes up.",
    goal: "One leg long with a soft hip hinge and a long back.",
    cues: ["Keep your back long.", "Lean a little further only if it feels easy.", "Hold here."],
  },
  hipFlexor: {
    title: "Hip Flexor Stretch",
    duration: 25,
    sides: true,
    target: "hip",
    demo: "Step one foot forward and sink the hips gently.",
    setup: "Keep your front knee stacked over the foot.",
    goal: "Lunge shape with hips eased forward and torso upright.",
    cues: ["Keep your back straight.", "Ease the hips forward.", "Switch sides when prompted."],
  },
  childPose: {
    title: "Lower Back Release",
    duration: 30,
    target: "lowerBack",
    demo: "Fold forward with hips back and arms relaxed.",
    setup: "Let your back soften and breathe slowly.",
    goal: "Torso folded forward with shoulders softened down.",
    cues: ["Relax your shoulders.", "Come back into the stretch when ready.", "Hold here."],
  },
  quad: {
    title: "Quad Stretch",
    duration: 20,
    sides: true,
    target: "quad",
    demo: "Stand tall and bring one heel toward the glute.",
    setup: "Use a wall or chair if balance feels unsteady.",
    goal: "One knee bent comfortably behind you while the body stays tall.",
    cues: ["Keep knees close.", "Stand tall.", "Do not pull through pain."],
  },
  calf: {
    title: "Calf Stretch",
    duration: 20,
    sides: true,
    target: "calf",
    demo: "Step one foot back and press the heel gently down.",
    setup: "Keep the back heel heavy and chest lifted.",
    goal: "Back leg long, front knee softly bent, heel reaching down.",
    cues: ["Keep your back leg long.", "Lean a little further.", "Hold here."],
  },
  sideReach: {
    title: "Side Body Reach",
    duration: 20,
    sides: true,
    target: "sideBody",
    demo: "Reach one arm overhead and arc gently to the side.",
    setup: "Stand or sit tall before reaching.",
    goal: "One arm overhead with a gentle side bend and open chest.",
    cues: ["Keep your chest open.", "Relax your shoulders.", "Breathe into the side ribs."],
  },
  seatedTwist: {
    title: "Seated Twist",
    duration: 25,
    sides: true,
    target: "upperBody",
    demo: "Sit tall and rotate gently from the ribs.",
    setup: "Lengthen your spine before twisting.",
    goal: "Spine tall with shoulders gently rotated to one side.",
    cues: ["Keep your back straight.", "Twist gently.", "Never force the stretch."],
  },
};

const STRETCH_ROUTINES: StretchRoutine[] = [
  {
    id: "morning",
    title: "Morning Stretch",
    subtitle: "Wake up gently",
    durationMin: 6,
    difficulty: "Easy",
    steps: [STRETCH_LIBRARY.neckRoll, STRETCH_LIBRARY.shoulderOpen, STRETCH_LIBRARY.sideReach, STRETCH_LIBRARY.hamstring],
  },
  {
    id: "full-body",
    title: "Full Body Stretch",
    subtitle: "Head to toe mobility",
    durationMin: 12,
    difficulty: "Moderate",
    steps: [
      STRETCH_LIBRARY.neckRoll,
      STRETCH_LIBRARY.shoulderOpen,
      STRETCH_LIBRARY.hipFlexor,
      STRETCH_LIBRARY.hamstring,
      STRETCH_LIBRARY.quad,
      STRETCH_LIBRARY.calf,
    ],
  },
  {
    id: "neck-shoulder",
    title: "Neck & Shoulder Relief",
    subtitle: "Desk tension reset",
    durationMin: 5,
    difficulty: "Gentle",
    steps: [STRETCH_LIBRARY.neckRoll, STRETCH_LIBRARY.shoulderOpen, STRETCH_LIBRARY.sideReach],
  },
  {
    id: "lower-back",
    title: "Lower Back Relief",
    subtitle: "Easy decompression",
    durationMin: 7,
    difficulty: "Gentle",
    steps: [STRETCH_LIBRARY.childPose, STRETCH_LIBRARY.hipFlexor, STRETCH_LIBRARY.hamstring],
  },
  {
    id: "hip-mobility",
    title: "Hip Mobility",
    subtitle: "Open hips and glutes",
    durationMin: 8,
    difficulty: "Moderate",
    steps: [STRETCH_LIBRARY.hipFlexor, STRETCH_LIBRARY.hamstring, STRETCH_LIBRARY.sideReach],
  },
  {
    id: "hamstring",
    title: "Hamstring Stretch",
    subtitle: "Posterior chain",
    durationMin: 4,
    difficulty: "Gentle",
    steps: [STRETCH_LIBRARY.hamstring, STRETCH_LIBRARY.calf],
  },
  {
    id: "desk",
    title: "Office/Desk Stretch",
    subtitle: "Chair friendly",
    durationMin: 5,
    difficulty: "Easy",
    steps: [STRETCH_LIBRARY.neckRoll, STRETCH_LIBRARY.seatedTwist, STRETCH_LIBRARY.shoulderOpen],
  },
  {
    id: "cooldown",
    title: "Post-Workout Cooldown",
    subtitle: "Slow down safely",
    durationMin: 9,
    difficulty: "Gentle",
    steps: [STRETCH_LIBRARY.quad, STRETCH_LIBRARY.hipFlexor, STRETCH_LIBRARY.hamstring, STRETCH_LIBRARY.childPose],
  },
  {
    id: "bedtime",
    title: "Bedtime Stretch",
    subtitle: "Quiet wind-down",
    durationMin: 7,
    difficulty: "Gentle",
    steps: [STRETCH_LIBRARY.childPose, STRETCH_LIBRARY.neckRoll, STRETCH_LIBRARY.hamstring],
  },
  {
    id: "quick",
    title: "5-Minute Quick Stretch",
    subtitle: "Fast reset",
    durationMin: 5,
    difficulty: "Easy",
    steps: [STRETCH_LIBRARY.shoulderOpen, STRETCH_LIBRARY.hipFlexor, STRETCH_LIBRARY.hamstring],
  },
];

function visibility(point?: Landmark) {
  return point?.visibility ?? 0;
}

function midpoint(a?: Landmark, b?: Landmark) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a?: Landmark | null, b?: Landmark | null) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a?: Landmark, b?: Landmark, c?: Landmark) {
  if (!a || !b || !c) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magA = Math.hypot(ab.x, ab.y);
  const magC = Math.hypot(cb.x, cb.y);
  if (!magA || !magC) return null;
  return (Math.acos(Math.min(1, Math.max(-1, dot / (magA * magC)))) * 180) / Math.PI;
}

function averageVisibility(points: Array<Landmark | undefined>) {
  return points.reduce((sum, point) => sum + visibility(point), 0) / Math.max(1, points.length);
}

function getBodyCalibration(landmarks?: Landmark[]): BodyCalibration | null {
  if (!landmarks) return null;
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const shoulders = midpoint(leftShoulder, rightShoulder);
  const hips = midpoint(leftHip, rightHip);
  const confidence = averageVisibility([
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
  ]);
  if (!shoulders || !hips || confidence < 0.34) return null;

  const shoulderWidth = Math.max(0.08, distance(leftShoulder, rightShoulder));
  const torsoLength = Math.max(0.12, distance(shoulders, hips));
  const legLength = Math.max(
    0.18,
    Math.max(distance(leftHip, leftKnee) + distance(leftKnee, leftAnkle), distance(rightHip, rightKnee) + distance(rightKnee, rightAnkle))
  );
  return { shoulderWidth, torsoLength, legLength };
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreFrom(value: number, target: number, span: number) {
  return clampScore(((value - target) / span) * 100);
}

function evaluateStretchPose(
  target: StretchTarget,
  landmarks: Landmark[] | undefined,
  calibration: BodyCalibration | null
): PoseEvaluation {
  if (!landmarks) {
    return { score: 0, passed: false, feedback: "Come into view when ready.", calibration: "waiting" };
  }

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const shoulders = midpoint(leftShoulder, rightShoulder);
  const hips = midpoint(leftHip, rightHip);
  const body = calibration ?? getBodyCalibration(landmarks);

  const upperConfidence = averageVisibility([nose, leftShoulder, rightShoulder, leftHip, rightHip]);
  if (upperConfidence < 0.36 || !body) {
    return {
      score: 0,
      passed: false,
      feedback: "Move back so your body is visible for calibration.",
      calibration: "waiting",
    };
  }

  const straightPosture =
    shoulders && hips ? Math.abs(shoulders.x - hips.x) < body.shoulderWidth * 0.62 : false;
  const shoulderTilt = Math.abs((leftShoulder?.y ?? 0) - (rightShoulder?.y ?? 0));

  if (target === "neckShoulders") {
    const headOffset = shoulders ? Math.abs((nose?.x ?? shoulders.x) - shoulders.x) : 0;
    const score = Math.min(
      scoreFrom(headOffset, body.shoulderWidth * 0.18, body.shoulderWidth * 0.18),
      scoreFrom(body.shoulderWidth * 0.5 - shoulderTilt, body.shoulderWidth * 0.36, body.shoulderWidth * 0.14)
    );
    return {
      score,
      passed: score >= MATCH_SCORE,
      feedback: score >= MATCH_SCORE ? "Position matched. Hold steady." : shoulderTilt > 0.08 ? "Relax your shoulders." : "Tilt gently toward the shoulder.",
      calibration: "ready",
    };
  }

  if (target === "upperBody") {
    const armSpread = Math.max(distance(leftWrist, rightWrist), distance(leftElbow, rightElbow));
    if (averageVisibility([leftWrist, rightWrist, leftElbow, rightElbow]) < 0.28) {
      return { score: 20, passed: false, feedback: "Keep your arms visible.", calibration: "ready" };
    }
    const score = Math.min(
      scoreFrom(armSpread, body.shoulderWidth * 1.45, body.shoulderWidth * 0.55),
      straightPosture ? 100 : 62
    );
    return {
      score,
      passed: score >= MATCH_SCORE,
      feedback: score >= MATCH_SCORE ? "Position matched. Hold steady." : !straightPosture ? "Keep your back straight." : "Open your arms a little wider.",
      calibration: "ready",
    };
  }

  if (target === "hamstring") {
    const leftLeg = angle(leftHip, leftKnee, leftAnkle);
    const rightLeg = angle(rightHip, rightKnee, rightAnkle);
    const legAngle = Math.max(leftLeg ?? 0, rightLeg ?? 0);
    if (averageVisibility([leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle]) < 0.32) {
      return { score: 18, passed: false, feedback: "Move back so your legs are visible.", calibration: "ready" };
    }
    const hingeDepth = shoulders && hips ? hips.y - shoulders.y : 0;
    const score = Math.min(scoreFrom(legAngle, 148, 24), scoreFrom(body.torsoLength * 1.35 - hingeDepth, body.torsoLength * 0.78, body.torsoLength * 0.45));
    return {
      score,
      passed: score >= MATCH_SCORE,
      feedback: score >= MATCH_SCORE ? "Position matched. Keep your back long." : legAngle < 148 ? "Lengthen the front leg softly." : "Lean a little further only if comfortable.",
      calibration: "ready",
    };
  }

  if (target === "hip") {
    if (averageVisibility([leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle]) < 0.32) {
      return { score: 18, passed: false, feedback: "Move back so hips and knees are visible.", calibration: "ready" };
    }
    const leftKneeBend = angle(leftHip, leftKnee, leftAnkle) ?? 180;
    const rightKneeBend = angle(rightHip, rightKnee, rightAnkle) ?? 180;
    const lungeShape = Math.min(leftKneeBend, rightKneeBend);
    const ankleDistance = distance(leftAnkle, rightAnkle);
    const score = Math.min(scoreFrom(150 - lungeShape, 18, 34), scoreFrom(ankleDistance, body.shoulderWidth * 1.05, body.shoulderWidth * 0.8), straightPosture ? 100 : 66);
    return {
      score,
      passed: score >= MATCH_SCORE,
      feedback: score >= MATCH_SCORE ? "Position matched. Hold steady." : !straightPosture ? "Keep your back straight." : "Step longer and ease the hips forward.",
      calibration: "ready",
    };
  }

  if (target === "lowerBack") {
    const foldDepth = shoulders && hips ? shoulders.y - hips.y : 0;
    const score = scoreFrom(foldDepth, body.torsoLength * 0.1, body.torsoLength * 0.8);
    return {
      score,
      passed: score >= MATCH_SCORE,
      feedback: score >= MATCH_SCORE ? "Position matched. Breathe slowly." : "Let your chest soften down.",
      calibration: "ready",
    };
  }

  if (target === "quad") {
    if (averageVisibility([leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle]) < 0.32) {
      return { score: 18, passed: false, feedback: "Move back so your legs are visible.", calibration: "ready" };
    }
    const leftBend = angle(leftHip, leftKnee, leftAnkle) ?? 180;
    const rightBend = angle(rightHip, rightKnee, rightAnkle) ?? 180;
    const score = Math.min(scoreFrom(160 - Math.min(leftBend, rightBend), 42, 58), straightPosture ? 100 : 66);
    return {
      score,
      passed: score >= MATCH_SCORE,
      feedback: score >= MATCH_SCORE ? "Position matched. Stand tall and hold." : !straightPosture ? "Stand tall." : "Bring one heel gently closer.",
      calibration: "ready",
    };
  }

  if (target === "calf") {
    if (averageVisibility([leftKnee, rightKnee, leftAnkle, rightAnkle]) < 0.32) {
      return { score: 18, passed: false, feedback: "Keep both feet visible.", calibration: "ready" };
    }
    const straightLeg = Math.max(angle(leftHip, leftKnee, leftAnkle) ?? 0, angle(rightHip, rightKnee, rightAnkle) ?? 0);
    const bentLeg = Math.min(angle(leftHip, leftKnee, leftAnkle) ?? 180, angle(rightHip, rightKnee, rightAnkle) ?? 180);
    const stance = distance(leftAnkle, rightAnkle);
    const score = Math.min(scoreFrom(straightLeg, 150, 24), scoreFrom(170 - bentLeg, 18, 36), scoreFrom(stance, body.shoulderWidth * 1.05, body.shoulderWidth * 0.7));
    return {
      score,
      passed: score >= MATCH_SCORE,
      feedback: score >= MATCH_SCORE ? "Position matched. Hold steady." : "Lean a little further and keep the back leg long.",
      calibration: "ready",
    };
  }

  if (target === "sideBody") {
    if (averageVisibility([leftWrist, rightWrist, leftShoulder, rightShoulder]) < 0.3) {
      return { score: 18, passed: false, feedback: "Keep your reaching arm visible.", calibration: "ready" };
    }
    const highestWristY = Math.min(leftWrist?.y ?? 1, rightWrist?.y ?? 1);
    const shoulderY = shoulders?.y ?? 0.5;
    const lean = shoulders && hips ? Math.abs(shoulders.x - hips.x) : 0;
    const score = Math.min(scoreFrom(shoulderY - highestWristY, body.torsoLength * 0.2, body.torsoLength * 0.6), scoreFrom(lean, body.shoulderWidth * 0.14, body.shoulderWidth * 0.34));
    return {
      score,
      passed: score >= MATCH_SCORE,
      feedback: score >= MATCH_SCORE ? "Position matched. Breathe into the ribs." : "Reach overhead and arc gently to the side.",
      calibration: "ready",
    };
  }

  return { score: 0, passed: false, feedback: "Come back into the stretch when ready.", calibration: "ready" };
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

function getMatchLabel(evaluation: PoseEvaluation, phase: StretchPhase, driftSeconds: number) {
  if (phase === "complete") return "Hold complete";
  if (phase === "hold" && evaluation.passed) return "Position matched ✓";
  if (phase === "hold" && driftSeconds >= DRIFT_GRACE_SECONDS) return "Hold paused";
  if (evaluation.passed) return "Position ready";
  if (evaluation.score >= NEAR_MATCH_SCORE) return "Almost there";
  if (evaluation.score >= 35) return "Getting closer";
  return "Find position";
}

export function StretchingMode() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const currentTargetRef = useRef<StretchTarget>("upperBody");
  const calibrationRef = useRef<BodyCalibration | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectTimestampRef = useRef(0);
  const detectionErrorCountRef = useRef(0);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastSpokenRef = useRef("");
  const lastCountSpokenRef = useRef(0);
  const [phase, setPhase] = useState<StretchPhase>("home");
  const [selectedRoutine, setSelectedRoutine] = useState<StretchRoutine | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [sideIndex, setSideIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [cameraFeedback, setCameraFeedback] = useState("Start camera guidance when ready.");
  const [poseEvaluation, setPoseEvaluation] = useState<PoseEvaluation>({
    score: 0,
    passed: false,
    feedback: "Start camera guidance when ready.",
    calibration: "waiting",
  });
  const poseEvaluationRef = useRef(poseEvaluation);
  const [holdElapsedSeconds, setHoldElapsedSeconds] = useState(0);
  const [driftSeconds, setDriftSeconds] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStep = selectedRoutine?.steps[stepIndex] ?? null;
  const sideLabel = currentStep?.sides ? (sideIndex === 0 ? "Left side" : "Right side") : "Both sides";
  const currentHoldSeconds = currentStep?.duration ?? 20;
  useEffect(() => {
    poseEvaluationRef.current = poseEvaluation;
  }, [poseEvaluation]);

  useEffect(() => {
    if (!currentStep) return;
    currentTargetRef.current = currentStep.target;
    setHoldElapsedSeconds(0);
    setDriftSeconds(0);
    setRemaining((value) => (phase === "hold" ? currentStep.duration : value));
  }, [currentStep, phase, sideIndex]);
  const totalHolds = useMemo(
    () => selectedRoutine?.steps.reduce((sum, step) => sum + (step.sides ? 2 : 1), 0) ?? 0,
    [selectedRoutine]
  );
  const completedHolds = useMemo(() => {
    if (!selectedRoutine) return 0;
    const previous = selectedRoutine.steps
      .slice(0, stepIndex)
      .reduce((sum, step) => sum + (step.sides ? 2 : 1), 0);
    return previous + (currentStep?.sides ? sideIndex : 0);
  }, [currentStep?.sides, selectedRoutine, sideIndex, stepIndex]);
  const routineProgress = totalHolds > 0 ? (completedHolds / totalHolds) * 100 : 0;
  const holdProgress = Math.min(100, (holdElapsedSeconds / currentHoldSeconds) * 100);
  const matchLabel = getMatchLabel(poseEvaluation, phase, driftSeconds);

  const speak = useCallback(
    (message: string) => {
      if (!voiceEnabled || typeof window === "undefined") return;
      if (lastSpokenRef.current === message && !getNumberClip(message)) return;
      lastSpokenRef.current = message;

      const clip = getNumberClip(message);
      if (clip) {
        const audio = voiceAudioRef.current ?? new Audio();
        voiceAudioRef.current = audio;
        audio.pause();
        audio.currentTime = 0;
        audio.src = encodeURI(clip);
        void audio.play().catch(() => undefined);
        return;
      }

      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.02;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled]
  );

  const playSound = useCallback(
    (kind: "start" | "match" | "tick" | "complete" | "warning") => {
      if (!soundEnabled || typeof window === "undefined") return;
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const context = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = context;
      void context.resume?.();

      const notes: Record<typeof kind, Array<[number, number, number]>> = {
        start: [[440, 0, 0.1]],
        match: [
          [660, 0, 0.08],
          [880, 0.09, 0.12],
        ],
        tick: [[740, 0, 0.05]],
        complete: [
          [660, 0, 0.08],
          [880, 0.1, 0.1],
          [1046, 0.22, 0.14],
        ],
        warning: [
          [220, 0, 0.08],
          [180, 0.1, 0.1],
        ],
      };

      notes[kind].forEach(([frequency, offset, duration]) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = kind === "warning" ? "sawtooth" : "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + duration + 0.02);
      });
    },
    [soundEnabled]
  );

  const advanceAfterPosePass = useCallback(() => {
    setHoldElapsedSeconds(0);
    setDriftSeconds(0);
    setRemaining(currentHoldSeconds);
    playSound("complete");
    if (currentStep?.sides && sideIndex === 0) {
      speak("Great. Now switch sides.");
      setSideIndex(1);
      setPhase("position");
      setRemaining(0);
      return;
    }
    if (selectedRoutine && stepIndex < selectedRoutine.steps.length - 1) {
      const nextStep = selectedRoutine.steps[stepIndex + 1];
      speak(`Great. Now next stretch. ${nextStep?.title ?? ""}`);
      setStepIndex((index) => index + 1);
      setSideIndex(0);
      setPhase("position");
      setRemaining(0);
      return;
    }
    speak("Great. Stretch routine complete.");
    setPhase("complete");
    setRemaining(0);
  }, [currentHoldSeconds, currentStep?.sides, playSound, selectedRoutine, sideIndex, speak, stepIndex]);

  const drawPose = useCallback((landmarks?: Landmark[]) => {
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
    if (!landmarks) return;

    const activeLandmarks = new Set(TARGET_LANDMARKS[currentTargetRef.current]);
    const latestEvaluation = poseEvaluationRef.current;
    const lineColor = latestEvaluation.passed
      ? "rgba(20, 184, 166, 0.98)"
      : latestEvaluation.score >= NEAR_MATCH_SCORE
        ? "rgba(251, 191, 36, 0.96)"
        : "rgba(148, 163, 184, 0.86)";

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(15, 23, 42, 0.45)";
    ctx.shadowBlur = 10;

    LANDMARK_CONNECTIONS.forEach(([from, to]) => {
      const a = landmarks[from];
      const b = landmarks[to];
      if (!a || !b || visibility(a) < 0.42 || visibility(b) < 0.42) return;
      const active = activeLandmarks.has(from) || activeLandmarks.has(to);
      ctx.globalAlpha = active ? 1 : 0.28;
      ctx.lineWidth = active ? 7 : 4;
      ctx.strokeStyle = active ? lineColor : "rgba(226, 232, 240, 0.65)";
      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    });

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    landmarks.forEach((point, index) => {
      if (!point || visibility(point) < 0.42) return;
      const active = activeLandmarks.has(index);
      if (!active && ![0, 11, 12, 23, 24].includes(index)) return;
      ctx.beginPath();
      ctx.fillStyle = active ? lineColor : "rgba(255, 255, 255, 0.78)";
      ctx.strokeStyle = "rgba(15, 23, 42, 0.42)";
      ctx.lineWidth = active ? 3 : 2;
      ctx.arc(point.x * width, point.y * height, active ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }, []);

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
    drawPose(undefined);
    lastVideoTimeRef.current = -1;
    lastDetectTimestampRef.current = 0;
    detectionErrorCountRef.current = 0;
    setCameraReady(false);
  }, [drawPose, stopLoop]);

  const detectLoop = useCallback(() => {
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
        drawPose(landmarks);
        const nextCalibration = getBodyCalibration(landmarks);
        if (nextCalibration) {
          calibrationRef.current = nextCalibration;
        }
        const evaluation = evaluateStretchPose(currentTargetRef.current, landmarks, calibrationRef.current);
        poseEvaluationRef.current = evaluation;
        setPoseEvaluation(evaluation);
        setCameraFeedback(evaluation.feedback);
        detectionErrorCountRef.current = 0;
      } catch (err) {
        detectionErrorCountRef.current += 1;
        if (detectionErrorCountRef.current === 1) {
          console.warn("Stretching pose detection skipped a frame.", err);
        }
        if (detectionErrorCountRef.current > 4) {
          setCameraFeedback("Camera is settling. Stay in frame.");
        }
      }
      lastVideoTimeRef.current = video.currentTime;
    }
    animationRef.current = requestAnimationFrame(detectLoop);
  }, [drawPose]);

  const startCamera = useCallback(async () => {
    setError(null);
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
      setCameraReady(true);
      stopLoop();
      animationRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start stretching camera.");
      setCameraReady(false);
    }
  }, [detectLoop, stopLoop]);

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
    if (!["position", "hold"].includes(phase)) return;
    const timeout = window.setTimeout(() => {
      if (phase === "hold") {
        if (poseEvaluation.passed) {
          setDriftSeconds(0);
          setHoldElapsedSeconds((seconds) => {
            const next = seconds + 1;
            setRemaining(Math.max(0, currentHoldSeconds - next));
            if (next > lastCountSpokenRef.current) {
              lastCountSpokenRef.current = next;
              playSound("tick");
              speak(String(next));
            }
            if (next >= currentHoldSeconds) {
              advanceAfterPosePass();
            }
            return Math.min(currentHoldSeconds, next);
          });
          return;
        }
        if (poseEvaluation.score >= NEAR_MATCH_SCORE) {
          setDriftSeconds(0);
          setCameraFeedback("Hold your position.");
          return;
        }
        setDriftSeconds((seconds) => {
          const next = Math.min(DRIFT_GRACE_SECONDS, seconds + 1);
          setCameraFeedback(next >= DRIFT_GRACE_SECONDS ? "Hold paused. Return to the stretch position." : "Come back a little.");
          if (next === DRIFT_GRACE_SECONDS) {
            playSound("warning");
            speak("Hold paused. Return to the stretch position.");
          }
          return next;
        });
        return;
      }

      setRemaining((value) => {
        if (value > 1 && phase !== "position") return value - 1;
        if (phase === "position") {
          if (poseEvaluation.passed) {
            setPhase("hold");
            setHoldElapsedSeconds(0);
            setDriftSeconds(0);
            lastCountSpokenRef.current = 0;
            playSound("match");
            speak("Great. Hold it.");
            return currentHoldSeconds;
          }
          return 0;
        }
        return 0;
      });
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [advanceAfterPosePass, currentHoldSeconds, phase, playSound, poseEvaluation.passed, poseEvaluation.score, speak]);

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close?.();
      voiceAudioRef.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!voiceEnabled || typeof window === "undefined") return;
    const clips = Array.from({ length: 23 }, (_, index) => `${GYM_AUDIO_BASE}/${index + 1}.wav`);
    const audios = clips.map((clip) => {
      const audio = new Audio(encodeURI(clip));
      audio.preload = "auto";
      return audio;
    });
    return () => audios.forEach((audio) => audio.pause());
  }, [voiceEnabled]);

  const startRoutine = async () => {
    if (!selectedRoutine) return;
    setStepIndex(0);
    setSideIndex(0);
    setRemaining(0);
    calibrationRef.current = null;
    lastCountSpokenRef.current = 0;
    lastSpokenRef.current = "";
    setHoldElapsedSeconds(0);
    setDriftSeconds(0);
    setPoseEvaluation({
      score: 0,
      passed: false,
      feedback: "Stand where your full body is visible for calibration.",
      calibration: "waiting",
    });
    setCameraFeedback("Get into a comfortable position.");
    playSound("start");
    speak(`Start ${selectedRoutine.title}. Find the stretch position.`);
    setPhase("position");
    await startCamera();
  };

  const resetRoutine = () => {
    setPhase(selectedRoutine ? "overview" : "home");
    setStepIndex(0);
    setSideIndex(0);
    setRemaining(0);
    lastCountSpokenRef.current = 0;
    lastSpokenRef.current = "";
    setHoldElapsedSeconds(0);
    setDriftSeconds(0);
    setCameraFeedback("Start camera guidance when ready.");
  };

  if (phase === "home") {
    return (
      <div className="space-y-5 pb-8">
        <section className="rounded-[24px] border border-border bg-white p-5 shadow-sm dark:bg-card">
          <p className="text-sm font-semibold text-primary">Stretching</p>
          <h2 className="mt-1 text-3xl font-semibold text-foreground">Camera-guided mobility.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Choose a gentle routine. Stop if anything feels painful.
          </p>
        </section>
        <div className="grid gap-3">
          {STRETCH_ROUTINES.map((routine) => (
            <button
              key={routine.id}
              type="button"
              onClick={() => {
                setSelectedRoutine(routine);
                setPhase("overview");
              }}
              className="flex items-center justify-between rounded-[22px] border border-border bg-white p-4 text-left shadow-sm dark:bg-card"
            >
              <span>
                <span className="block text-sm font-semibold text-foreground">{routine.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {routine.durationMin} min - {routine.difficulty} - {routine.subtitle}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "overview" && selectedRoutine) {
    return (
      <div className="space-y-4 pb-8">
        <button type="button" onClick={() => setPhase("home")} className="text-sm font-semibold text-primary">
          Back
        </button>
        <section className="rounded-[24px] border border-border bg-white p-5 shadow-sm dark:bg-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">{selectedRoutine.difficulty}</p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">{selectedRoutine.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedRoutine.durationMin} min - {selectedRoutine.steps.length} stretches
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-5 space-y-2">
            {selectedRoutine.steps.map((step, index) => (
              <div key={`${step.title}-${index}`} className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
                <span className="text-sm font-semibold text-foreground">{step.title}</span>
                <span className="text-xs text-muted-foreground">
                  {step.sides ? "2 sides" : "1 hold"} - {step.duration}s
                </span>
              </div>
            ))}
          </div>
        </section>
        {error && <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        <button
          type="button"
          onClick={() => void startRoutine()}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground"
        >
          <Camera className="h-4 w-4" />
          Start guided stretch
        </button>
      </div>
    );
  }

  if ((phase === "position" || phase === "hold" || phase === "paused" || phase === "complete") && selectedRoutine && currentStep) {
    const phaseTitle =
      phase === "position"
          ? "Find the stretch position"
          : phase === "complete"
              ? "Routine complete"
              : "Match final position";
    const instruction =
      phase === "position"
          ? poseEvaluation.calibration === "ready"
            ? cameraFeedback
            : currentStep.setup
          : phase === "complete"
              ? "Nice work. Move slowly as you come out."
              : poseEvaluation.passed
                ? "Position matched ✓ Hold steady and breathe."
                : driftSeconds >= DRIFT_GRACE_SECONDS
                  ? "Hold paused. Return to the stretch position."
                  : cameraFeedback;

    return (
      <div className="space-y-4 pb-8">
        <section className="overflow-hidden rounded-[24px] border border-border bg-black shadow-sm">
          <div className="relative h-[72vh] min-h-[560px] w-full sm:h-[76vh] sm:min-h-[640px]">
            <video
              ref={videoRef}
              className={cn("h-full w-full scale-x-[-1] object-cover", !cameraReady && "opacity-20")}
              muted
              playsInline
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
                <div>
                  <Camera className="mx-auto h-9 w-9 opacity-80" />
                  <p className="mt-3 text-sm font-semibold">Camera guidance is starting.</p>
                </div>
              </div>
            )}
            <div className="absolute inset-x-4 top-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="w-fit rounded-full bg-white/92 px-4 py-2 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
                    Stretch {stepIndex + 1} of {selectedRoutine.steps.length} - {sideLabel}
                  </div>
                  <div
                    className={cn(
                      "w-fit rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur",
                      poseEvaluation.passed
                        ? "bg-primary text-primary-foreground"
                        : poseEvaluation.score >= NEAR_MATCH_SCORE
                          ? "bg-amber-100 text-amber-700"
                          : "bg-white/85 text-muted-foreground"
                    )}
                  >
                    {phase === "position" || phase === "hold"
                      ? matchLabel
                      : poseEvaluation.calibration === "ready"
                        ? "Body detected"
                        : "Looking for you"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceEnabled((enabled) => !enabled)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-foreground shadow-sm backdrop-blur"
                    title={voiceEnabled ? "Voice on" : "Voice off"}
                  >
                    {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled((enabled) => !enabled)}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full bg-white/92 shadow-sm backdrop-blur",
                      soundEnabled ? "text-primary" : "text-muted-foreground"
                    )}
                    title={soundEnabled ? "Sound effects on" : "Sound effects off"}
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute left-4 right-4 top-1/2 z-10 flex -translate-y-1/2 justify-center">
              <div className="max-w-[90%] rounded-full bg-white/92 px-4 py-2 text-center text-sm font-semibold text-foreground shadow-sm backdrop-blur">
                {instruction}
              </div>
            </div>

            <div className="absolute inset-x-4 bottom-4 rounded-[22px] bg-white/94 p-4 shadow-sm backdrop-blur">
              <div className="text-center">
                <p className="text-xs font-semibold uppercase text-primary">{phaseTitle}</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{currentStep.title}</h3>
                <div className="mt-3 text-primary">
                  {phase === "complete" ? (
                    <CheckCircle2 className="mx-auto h-12 w-12" />
                  ) : phase === "hold" ? (
                    <>
                      <p className="text-7xl font-black leading-none tabular-nums tracking-normal">{Math.max(0, remaining)}</p>
                      <p className="mt-1 text-xs font-black tracking-[0.18em] text-muted-foreground">SECONDS</p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-black tracking-normal">{matchLabel}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">Move into the stretch position</p>
                    </>
                  )}
                </div>
              </div>
              {phase === "hold" && (
                <div className="mt-4 rounded-2xl bg-secondary p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-left">
                    <span className="text-foreground">Hold progress</span>
                    <span className={poseEvaluation.passed ? "text-primary" : "text-muted-foreground"}>{matchLabel}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className={cn("h-full rounded-full transition-all", poseEvaluation.passed ? "bg-primary" : "bg-amber-400")}
                      style={{ width: `${poseEvaluation.score}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-left text-xs font-semibold text-muted-foreground">
                    <span>{poseEvaluation.passed ? "Hold steady to complete" : `Goal: ${currentStep.goal}`}</span>
                    <span>{holdElapsedSeconds}/{currentHoldSeconds}s</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${holdProgress}%` }} />
                  </div>
                </div>
              )}
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, routineProgress)}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-border bg-white p-4 shadow-sm dark:bg-card">
          <p className="text-sm font-semibold text-foreground">
            {phase === "hold" || phase === "position"
              ? poseEvaluation.feedback
              : currentStep.cues[remaining % currentStep.cues.length] ?? "Hold here."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Ease out if you feel sharp pain or numbness.</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          {phase === "paused" ? (
            <button
              type="button"
              onClick={() => setPhase("hold")}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPhase(phase === "complete" ? "home" : "paused")}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-white text-sm font-semibold"
            >
              {phase === "complete" ? <CheckCircle2 className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {phase === "complete" ? "Done" : "Pause"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (phase === "complete") {
                resetRoutine();
                return;
              }
              if (selectedRoutine && stepIndex < selectedRoutine.steps.length - 1) {
                setStepIndex((index) => index + 1);
                setSideIndex(0);
                setPhase("position");
                setRemaining(0);
              } else {
                setPhase("complete");
              }
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {phase === "complete" ? <RotateCcw className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            {phase === "complete" ? "Again" : "Next"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
