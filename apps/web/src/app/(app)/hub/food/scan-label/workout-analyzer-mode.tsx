"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bookmark,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Dumbbell,
  Flame,
  Heart,
  ListChecks,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  TimerReset,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type ExerciseKey = "pushup" | "bicepCurl" | "squat" | "pullup";
type RepPhase = "ready" | "top" | "bottom" | "curl" | "hang";
type AnalyzerStatus = "idle" | "loading" | "ready" | "countdown" | "running" | "rest" | "paused" | "error";
type ProgramKey = "free" | "custom";
type RoutinePhase = "idle" | "work" | "timed" | "rest" | "summary" | "complete";
type AnalyzerTab = "quick" | "programs";

type ExerciseDefinition = {
  key: ExerciseKey;
  label: string;
  hint: string;
  target: string;
};

type AnalyzerMetrics = {
  repCount: number;
  phase: RepPhase;
  confidence: number;
  angle: number | null;
  feedback: string;
  quality: "idle" | "tracking" | "good" | "warning";
};

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: Landmark[][] };
  close?: () => void;
};

type RoutineStep =
  | {
      type: "work";
      exercise: ExerciseKey;
      label?: string;
      reps: number;
    }
  | {
      type: "timed";
      exercise?: ExerciseKey;
      label: string;
      seconds: number;
    }
  | {
      type: "rest";
      seconds: number;
    };

type PresetExercise = {
  label: string;
  exercise?: ExerciseKey;
  sets: number;
  reps?: number;
  seconds?: number;
  restSeconds?: number;
  tracking: "camera" | "timer" | "manual";
};

type WorkoutPreset = {
  id: string;
  name: string;
  displayName: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  durationMin: number;
  goal: string;
  equipment: string;
  muscles: string[];
  calories: number;
  compatibility: string;
  thumbnail: string;
  recommended?: boolean;
  exercises: PresetExercise[];
};

type SetSummary = {
  id: string;
  label: string;
  setNumber: number;
  reps: number;
  seconds: number;
};

type WorkoutProgram = {
  key: ProgramKey;
  label: string;
  description: string;
  steps: RoutineStep[];
};

const EXERCISES: ExerciseDefinition[] = [
  {
    key: "pushup",
    label: "Push-up",
    hint: "Side view works best. Keep shoulders, elbows, wrists, and hips visible.",
    target: "Elbow extension after a controlled bottom position counts one rep.",
  },
  {
    key: "bicepCurl",
    label: "Bicep curl",
    hint: "Face the camera or stand at a slight angle with one full arm visible.",
    target: "A full curl from extended arm to tight elbow flexion counts one rep.",
  },
  {
    key: "squat",
    label: "Squat",
    hint: "Stand side-on or three-quarter view with hips, knees, and ankles visible.",
    target: "Standing tall after reaching depth counts one rep.",
  },
  {
    key: "pullup",
    label: "Pull-up",
    hint: "Keep wrists, elbows, shoulders, and head visible near the top of frame.",
    target: "A pull from hang to chin-over-hands position counts one rep.",
  },
];

const WORKOUT_PROGRAMS: WorkoutProgram[] = [
  {
    key: "free",
    label: "Free tracking",
    description: "Pick any movement and count reps at your own pace.",
    steps: [],
  },
  {
    key: "custom",
    label: "Custom routine",
    description: "Set your own exercise, reps, sets, and rest time.",
    steps: [
      { type: "work", exercise: "pushup", reps: 15 },
      { type: "rest", seconds: 20 },
      { type: "work", exercise: "pushup", reps: 15 },
    ],
  },
];

const FILTER_CHIPS = [
  "5-10 min",
  "15-20 min",
  "Beginner",
  "Intermediate",
  "No equipment",
  "Core",
  "Upper body",
  "Lower body",
  "Fat burn",
];

const WORKOUT_PRESETS: WorkoutPreset[] = [
  {
    id: "web-hero",
    name: "Spider-Man Workout",
    displayName: "Web Hero Workout",
    difficulty: "Intermediate",
    durationMin: 20,
    goal: "Mobility + Core",
    equipment: "No equipment",
    muscles: ["Core", "Agility", "Upper body"],
    calories: 170,
    compatibility: "Mixed tracking",
    thumbnail: "WH",
    recommended: true,
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 3, reps: 12, restSeconds: 30, tracking: "camera" },
      { label: "Mountain Climbers", sets: 3, seconds: 30, restSeconds: 25, tracking: "timer" },
      { label: "Squats", exercise: "squat", sets: 3, reps: 15, restSeconds: 30, tracking: "camera" },
      { label: "Plank Shoulder Taps", sets: 3, seconds: 30, restSeconds: 25, tracking: "timer" },
      { label: "Reverse Lunges", sets: 3, seconds: 40, restSeconds: 30, tracking: "timer" },
      { label: "Plank", sets: 3, seconds: 45, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "dark-knight",
    name: "Batman Workout",
    displayName: "Dark Knight Workout",
    difficulty: "Advanced",
    durationMin: 24,
    goal: "Strength + Endurance",
    equipment: "No equipment",
    muscles: ["Full body", "Chest", "Legs"],
    calories: 230,
    compatibility: "Mixed tracking",
    thumbnail: "DK",
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 4, reps: 12, restSeconds: 30, tracking: "camera" },
      { label: "Squats", exercise: "squat", sets: 4, reps: 18, restSeconds: 25, tracking: "camera" },
      { label: "Burpees", sets: 3, seconds: 35, restSeconds: 35, tracking: "timer" },
      { label: "Lunges", sets: 3, seconds: 45, restSeconds: 30, tracking: "timer" },
      { label: "Plank", sets: 3, seconds: 45, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "armored-hero",
    name: "Iron Man Workout",
    displayName: "Armored Hero Workout",
    difficulty: "Intermediate",
    durationMin: 18,
    goal: "Chest + Shoulders",
    equipment: "Dumbbells optional",
    muscles: ["Upper body", "Core", "Endurance"],
    calories: 185,
    compatibility: "High tracking",
    thumbnail: "AH",
    recommended: true,
    exercises: [
      { label: "Bicep Curls", exercise: "bicepCurl", sets: 3, reps: 14, restSeconds: 25, tracking: "camera" },
      { label: "Push-ups", exercise: "pushup", sets: 3, reps: 12, restSeconds: 30, tracking: "camera" },
      { label: "Plank", sets: 3, seconds: 40, restSeconds: 25, tracking: "timer" },
      { label: "Squats", exercise: "squat", sets: 3, reps: 15, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "abs-core",
    name: "Abs & Core",
    displayName: "Abs & Core",
    difficulty: "Beginner",
    durationMin: 12,
    goal: "Core stability",
    equipment: "No equipment",
    muscles: ["Core"],
    calories: 95,
    compatibility: "Timer guided",
    thumbnail: "AC",
    exercises: [
      { label: "Plank", sets: 3, seconds: 35, restSeconds: 20, tracking: "timer" },
      { label: "Mountain Climbers", sets: 3, seconds: 30, restSeconds: 20, tracking: "timer" },
      { label: "Squats", exercise: "squat", sets: 2, reps: 15, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "upper-body",
    name: "Upper Body",
    displayName: "Upper Body",
    difficulty: "Intermediate",
    durationMin: 16,
    goal: "Chest + Arms",
    equipment: "Dumbbells optional",
    muscles: ["Upper body", "Chest", "Arms"],
    calories: 140,
    compatibility: "High tracking",
    thumbnail: "UB",
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 3, reps: 12, restSeconds: 30, tracking: "camera" },
      { label: "Bicep Curls", exercise: "bicepCurl", sets: 3, reps: 15, restSeconds: 30, tracking: "camera" },
      { label: "Pull-ups", exercise: "pullup", sets: 3, reps: 6, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "lower-body",
    name: "Lower Body",
    displayName: "Lower Body",
    difficulty: "Beginner",
    durationMin: 14,
    goal: "Leg strength",
    equipment: "No equipment",
    muscles: ["Lower body", "Legs"],
    calories: 130,
    compatibility: "Mixed tracking",
    thumbnail: "LB",
    exercises: [
      { label: "Squats", exercise: "squat", sets: 4, reps: 15, restSeconds: 25, tracking: "camera" },
      { label: "Reverse Lunges", sets: 3, seconds: 40, restSeconds: 25, tracking: "timer" },
      { label: "Wall Sit", sets: 2, seconds: 45, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "full-body",
    name: "Full Body",
    displayName: "Full Body",
    difficulty: "Intermediate",
    durationMin: 20,
    goal: "Total body",
    equipment: "No equipment",
    muscles: ["Full body", "Core", "Legs"],
    calories: 210,
    compatibility: "Mixed tracking",
    thumbnail: "FB",
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 3, reps: 10, restSeconds: 25, tracking: "camera" },
      { label: "Squats", exercise: "squat", sets: 3, reps: 15, restSeconds: 25, tracking: "camera" },
      { label: "Mountain Climbers", sets: 3, seconds: 30, restSeconds: 25, tracking: "timer" },
      { label: "Plank", sets: 2, seconds: 45, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "fat-burn",
    name: "Fat Burn",
    displayName: "Fat Burn",
    difficulty: "Intermediate",
    durationMin: 15,
    goal: "Conditioning",
    equipment: "No equipment",
    muscles: ["Fat burn", "Full body"],
    calories: 220,
    compatibility: "Timer guided",
    thumbnail: "FB",
    exercises: [
      { label: "Burpees", sets: 4, seconds: 30, restSeconds: 20, tracking: "timer" },
      { label: "Mountain Climbers", sets: 4, seconds: 30, restSeconds: 20, tracking: "timer" },
      { label: "Squats", exercise: "squat", sets: 3, reps: 18, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "beginner-strength",
    name: "Beginner Strength",
    displayName: "Beginner Strength",
    difficulty: "Beginner",
    durationMin: 10,
    goal: "Foundation",
    equipment: "No equipment",
    muscles: ["Full body"],
    calories: 80,
    compatibility: "High tracking",
    thumbnail: "BS",
    exercises: [
      { label: "Squats", exercise: "squat", sets: 2, reps: 10, restSeconds: 25, tracking: "camera" },
      { label: "Push-ups", exercise: "pushup", sets: 2, reps: 8, restSeconds: 25, tracking: "camera" },
      { label: "Plank", sets: 2, seconds: 25, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "desk-break",
    name: "Desk Break Workout",
    displayName: "Desk Break Workout",
    difficulty: "Beginner",
    durationMin: 7,
    goal: "Mobility",
    equipment: "No equipment",
    muscles: ["Mobility", "Core"],
    calories: 45,
    compatibility: "Timer guided",
    thumbnail: "DB",
    exercises: [
      { label: "Bodyweight Squats", exercise: "squat", sets: 2, reps: 10, restSeconds: 15, tracking: "camera" },
      { label: "Standing March", sets: 2, seconds: 30, restSeconds: 15, tracking: "timer" },
      { label: "Shoulder Rolls", sets: 2, seconds: 30, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "no-equipment",
    name: "No Equipment",
    displayName: "No Equipment",
    difficulty: "Beginner",
    durationMin: 15,
    goal: "Simple strength",
    equipment: "No equipment",
    muscles: ["Full body"],
    calories: 120,
    compatibility: "Mixed tracking",
    thumbnail: "NE",
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 3, reps: 10, restSeconds: 25, tracking: "camera" },
      { label: "Squats", exercise: "squat", sets: 3, reps: 15, restSeconds: 25, tracking: "camera" },
      { label: "Plank", sets: 2, seconds: 35, restSeconds: 0, tracking: "timer" },
    ],
  },
];

const LANDMARK_CONNECTIONS = [
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

const ACTIVE_LANDMARKS: Record<ExerciseKey, number[]> = {
  pushup: [11, 12, 13, 14, 15, 16, 23, 24],
  bicepCurl: [11, 12, 13, 14, 15, 16],
  squat: [23, 24, 25, 26, 27, 28],
  pullup: [0, 11, 12, 13, 14, 15, 16],
};

const MOTIVATION = [
  "Strong rep. Keep the rhythm.",
  "Nice control. Stay steady.",
  "Good work. Own the next one.",
  "Breathe, brace, and move.",
  "Clean pace. Keep going.",
];

const SMOOTHING_ALPHA = 0.62;
const GYM_AUDIO_BASE = "/Audiogym";
const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  "twenty one": 21,
  "twenty two": 22,
  "twenty three": 23,
};

function getNumberClip(message: string) {
  const normalized = message.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const numericValue = Number(normalized);
  const number = Number.isFinite(numericValue) ? numericValue : NUMBER_WORDS[normalized];
  return Number.isInteger(number) && number >= 1 && number <= 23
    ? `${GYM_AUDIO_BASE}/${number}.wav`
    : null;
}

function getGymVoiceClip(message: string) {
  const numberClip = getNumberClip(message);
  if (numberClip) return numberClip;

  const normalized = message.toLowerCase();
  if (normalized.includes("camera ready")) return `${GYM_AUDIO_BASE}/Setup/camera_is_ready.mp3`;
  if (normalized.includes("get ready")) return `${GYM_AUDIO_BASE}/Setup/get_ready.mp3`;
  if (normalized.includes("looking for you")) return `${GYM_AUDIO_BASE}/Setup/looking_for_you.mp3`;
  if (
    normalized.includes("lost tracking") ||
    normalized.includes("step into frame") ||
    normalized.includes("step back into frame") ||
    normalized.includes("stay in frame")
  ) {
    return `${GYM_AUDIO_BASE}/Lost_tracking.wav`;
  }
  if (
    normalized.includes("cannot see you clearly") ||
    normalized.includes("camera view is unclear") ||
    normalized.includes("improve the lighting") ||
    normalized.includes("fix the camera")
  ) {
    return `${GYM_AUDIO_BASE}/Camera_unclear.wav`;
  }
  if (normalized.includes("halfway")) return `${GYM_AUDIO_BASE}/Halfway_motivation_nepali.wav`;

  if (normalized.includes("position") || normalized.includes("ready.")) {
    return `${GYM_AUDIO_BASE}/Setup/position_ready.mp3`;
  }
  if (normalized.includes("go.") || normalized === "go") return `${GYM_AUDIO_BASE}/Setup/lets_go.mp3`;
  if (normalized.includes("now do") || normalized.includes("start your set") || normalized.includes("starting")) {
    return `${GYM_AUDIO_BASE}/start_your_set.mp3`;
  }
  if (normalized.includes("rep counted") || normalized.includes("good rep")) {
    return `${GYM_AUDIO_BASE}/good_rep.mp3`;
  }
  if (normalized.includes("good form") || normalized.includes("nice lockout")) {
    return `${GYM_AUDIO_BASE}/good_form.mp3`;
  }
  if (normalized.includes("improve your form") || normalized.includes("fix your form")) {
    return `${GYM_AUDIO_BASE}/fix_your_from.mp3`;
  }
  if (normalized.includes("go lower") || normalized.includes("lower until") || normalized.includes("sink lower")) {
    return `${GYM_AUDIO_BASE}/go_lower.mp3`;
  }
  if (normalized.includes("come up") || normalized.includes("press up") || normalized.includes("drive up")) {
    return `${GYM_AUDIO_BASE}/come_up.mp3`;
  }
  if (normalized.includes("slow down") || normalized.includes("control")) {
    return `${GYM_AUDIO_BASE}/slow_down.mp3`;
  }

  return null;
}

function visibilityOf(point?: Landmark) {
  return point ? (point.visibility ?? 1) : 0;
}

function isVisible(point?: Landmark, min = 0.42) {
  return !!point && visibilityOf(point) >= min;
}

function averageVisibility(points: Array<Landmark | undefined>) {
  if (points.length === 0) return 0;
  return points.reduce((sum, point) => sum + visibilityOf(point), 0) / points.length;
}

function smoothLandmarks(previous: Landmark[] | null, next: Landmark[]) {
  if (!previous || previous.length !== next.length) return next;

  return next.map((point, index) => {
    const oldPoint = previous[index];
    if (!oldPoint || visibilityOf(point) < 0.25) return point;

    return {
      ...point,
      x: oldPoint.x * (1 - SMOOTHING_ALPHA) + point.x * SMOOTHING_ALPHA,
      y: oldPoint.y * (1 - SMOOTHING_ALPHA) + point.y * SMOOTHING_ALPHA,
      z:
        oldPoint.z == null || point.z == null
          ? point.z
          : oldPoint.z * (1 - SMOOTHING_ALPHA) + point.z * SMOOTHING_ALPHA,
      visibility: Math.max(visibilityOf(oldPoint) * 0.85, visibilityOf(point)),
    };
  });
}

function angleBetween(a: Landmark, b: Landmark, c: Landmark) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const abLength = Math.hypot(ab.x, ab.y);
  const cbLength = Math.hypot(cb.x, cb.y);
  if (abLength === 0 || cbLength === 0) return null;
  const cosine = Math.min(1, Math.max(-1, dot / (abLength * cbLength)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function chooseSide(
  landmarks: Landmark[],
  left: [number, number, number],
  right: [number, number, number]
) {
  const leftPoints = left.map((index) => landmarks[index]);
  const rightPoints = right.map((index) => landmarks[index]);
  return averageVisibility(leftPoints) >= averageVisibility(rightPoints)
    ? leftPoints
    : rightPoints;
}

function chooseSideWithExtras(
  landmarks: Landmark[],
  left: number[],
  right: number[]
) {
  const leftPoints = left.map((index) => landmarks[index]);
  const rightPoints = right.map((index) => landmarks[index]);
  return averageVisibility(leftPoints) >= averageVisibility(rightPoints)
    ? leftPoints
    : rightPoints;
}

function sideAngle(
  landmarks: Landmark[],
  left: [number, number, number],
  right: [number, number, number]
) {
  const [a, b, c] = chooseSide(landmarks, left, right);
  if (!isVisible(a) || !isVisible(b) || !isVisible(c)) return null;
  return angleBetween(a, b, c);
}

function getRepProgress(exercise: ExerciseKey, angle: number | null, phase: RepPhase) {
  if (angle == null) return phase === "ready" ? 0 : 8;

  if (exercise === "pushup") {
    return phase === "bottom"
      ? 75
      : Math.max(8, Math.min(96, ((170 - angle) / 80) * 100));
  }

  if (exercise === "bicepCurl") {
    return Math.max(8, Math.min(96, ((160 - angle) / 95) * 100));
  }

  if (exercise === "squat") {
    return phase === "bottom"
      ? 78
      : Math.max(8, Math.min(96, ((175 - angle) / 80) * 100));
  }

  return phase === "top"
    ? 94
    : Math.max(8, Math.min(96, ((145 - angle) / 65) * 100));
}

function getExerciseLabel(exercise: ExerciseKey) {
  return EXERCISES.find((item) => item.key === exercise)?.label ?? "Exercise";
}

function getProgram(program: ProgramKey) {
  return WORKOUT_PROGRAMS.find((item) => item.key === program) ?? WORKOUT_PROGRAMS[0];
}

function buildPresetSteps(preset: WorkoutPreset): RoutineStep[] {
  const steps: RoutineStep[] = [];
  preset.exercises.forEach((exerciseItem, exerciseIndex) => {
    for (let setIndex = 0; setIndex < exerciseItem.sets; setIndex += 1) {
      if (exerciseItem.tracking === "camera" && exerciseItem.exercise && exerciseItem.reps) {
        steps.push({
          type: "work",
          exercise: exerciseItem.exercise,
          label: exerciseItem.label,
          reps: exerciseItem.reps,
        });
      } else {
        steps.push({
          type: "timed",
          exercise: exerciseItem.exercise,
          label: exerciseItem.label,
          seconds: exerciseItem.seconds ?? 30,
        });
      }

      const shouldRest =
        (exerciseItem.restSeconds ?? 0) > 0 &&
        !(exerciseIndex === preset.exercises.length - 1 && setIndex === exerciseItem.sets - 1);
      if (shouldRest) {
        steps.push({ type: "rest", seconds: exerciseItem.restSeconds ?? 30 });
      }
    }
  });
  return steps;
}

function formatPresetLine(exercise: PresetExercise) {
  if (exercise.reps) return `${exercise.sets} x ${exercise.reps}`;
  return `${exercise.sets} x ${exercise.seconds ?? 30} sec`;
}

function getVisibilityGuidance(metrics: AnalyzerMetrics) {
  if (metrics.angle == null || metrics.confidence < 45) {
    return "I cannot see you clearly. Step back, improve the lighting, or fix the camera angle.";
  }

  if (metrics.quality === "warning") {
    return `Improve your form. ${metrics.feedback}`;
  }

  return null;
}

function analyzeExercise(
  exercise: ExerciseKey,
  landmarks: Landmark[] | undefined,
  previous: AnalyzerMetrics,
  lastCountAt: number
): AnalyzerMetrics {
  if (!landmarks) {
    return {
      ...previous,
      confidence: 0,
      angle: null,
      feedback: "Step into frame so your full body is visible.",
      quality: "warning",
    };
  }

  const now = performance.now();
  const cooldownReady = now - lastCountAt > 520;
  let repCount = previous.repCount;
  let phase = previous.phase;
  let angle: number | null = null;
  let confidence = 0;
  let feedback = "Tracking. Move through a full range.";
  let quality: AnalyzerMetrics["quality"] = "tracking";

  if (exercise === "pushup") {
    const [shoulder, elbow, wrist, hip] = chooseSideWithExtras(
      landmarks,
      [11, 13, 15, 23],
      [12, 14, 16, 24]
    );
    angle =
      isVisible(shoulder) && isVisible(elbow) && isVisible(wrist)
        ? angleBetween(shoulder, elbow, wrist)
        : null;
    confidence = angle == null ? 0 : averageVisibility([shoulder, elbow, wrist, hip]);
    const bodySlope = isVisible(shoulder) && isVisible(hip) ? Math.abs(shoulder.y - hip.y) : 0;
    if (!angle || !isVisible(shoulder) || !isVisible(hip)) {
      feedback = "Show your side profile: shoulder, elbow, wrist, and hip need to stay visible.";
      quality = "warning";
    } else if (bodySlope > 0.34) {
      feedback = "Keep shoulders and hips level so the rep is easier to track.";
      quality = "warning";
    } else if (angle < 112) {
      phase = "bottom";
      feedback = "Good depth. Press up strong.";
      quality = "good";
    } else if (angle > 146) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Nice lockout.";
        quality = "good";
      } else {
        feedback = "Top position. Lower with control.";
      }
      phase = "top";
    } else {
      feedback = angle < 128 ? "Almost there. Press through the floor." : "Lower until elbows are clearly bent.";
    }
  }

  if (exercise === "bicepCurl") {
    angle = sideAngle(landmarks, [11, 13, 15], [12, 14, 16]);
    confidence = angle == null ? 0 : averageVisibility(chooseSide(landmarks, [11, 13, 15], [12, 14, 16]));
    if (!angle) {
      feedback = "Keep one full arm visible from shoulder to wrist.";
      quality = "warning";
    } else if (angle > 135) {
      phase = "bottom";
      feedback = "Arm extended. Curl smoothly.";
    } else if (angle < 78) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Squeeze at the top.";
        quality = "good";
      } else {
        feedback = "Top of curl. Lower with control.";
      }
      phase = "curl";
    } else {
      feedback = angle < 105 ? "Finish the curl." : "Avoid swinging. Keep the elbow steady.";
    }
  }

  if (exercise === "squat") {
    const [hip, knee, ankle, shoulder] = chooseSideWithExtras(
      landmarks,
      [23, 25, 27, 11],
      [24, 26, 28, 12]
    );
    angle =
      isVisible(hip) && isVisible(knee) && isVisible(ankle)
        ? angleBetween(hip, knee, ankle)
        : null;
    confidence = angle == null ? 0 : averageVisibility([hip, knee, ankle, shoulder]);
    if (!angle) {
      feedback = "Keep hips, knees, and ankles in frame.";
      quality = "warning";
    } else if (angle < 118) {
      phase = "bottom";
      feedback = "Depth reached. Drive up.";
      quality = "good";
    } else if (angle > 148) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Stand tall.";
        quality = "good";
      } else {
        feedback = "Standing position. Sit back into the next rep.";
      }
      phase = "top";
    } else {
      feedback = angle < 138 ? "Drive knees out and rise." : "Sink lower for a full rep.";
    }
  }

  if (exercise === "pullup") {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const nose = landmarks[0];
    angle = sideAngle(landmarks, [11, 13, 15], [12, 14, 16]);
    const wristY =
      isVisible(leftWrist) && isVisible(rightWrist)
        ? (leftWrist.y + rightWrist.y) / 2
        : isVisible(leftWrist)
          ? leftWrist.y
          : rightWrist?.y;
    const shoulderY =
      isVisible(leftShoulder) && isVisible(rightShoulder)
        ? (leftShoulder.y + rightShoulder.y) / 2
        : isVisible(leftShoulder)
          ? leftShoulder.y
          : rightShoulder?.y;
    confidence = averageVisibility([leftWrist, rightWrist, leftShoulder, rightShoulder, nose]);

    if (wristY == null || shoulderY == null || !isVisible(nose) || !angle) {
      feedback = "Keep hands, shoulders, elbows, and head visible.";
      quality = "warning";
    } else if (shoulderY - wristY > 0.16 && angle > 112) {
      phase = "hang";
      feedback = "Full hang. Pull with control.";
    } else if (nose.y < wristY + 0.11 && angle < 108) {
      if (previous.phase === "hang" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Chin cleared.";
        quality = "good";
      } else {
        feedback = "Strong top. Lower to full hang.";
        quality = "good";
      }
      phase = "top";
    } else {
      feedback = shoulderY - wristY > 0.12 ? "Pull higher toward the bar." : "Lower fully before the next rep.";
    }
  }

  return {
    repCount,
    phase,
    confidence: Math.round(confidence * 100),
    angle: angle == null ? null : Math.round(angle),
    feedback,
    quality,
  };
}

function formatSessionTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

async function loadPoseLandmarker(): Promise<PoseLandmarkerLike> {
  const dynamicImport = new Function("url", "return import(url)") as (
    url: string
  ) => Promise<{
    FilesetResolver: {
      forVisionTasks: (path: string) => Promise<unknown>;
    };
    PoseLandmarker: {
      createFromOptions: (
        vision: unknown,
        options: Record<string, unknown>
      ) => Promise<PoseLandmarkerLike>;
    };
  }>;

  const visionTasks = await dynamicImport(TASKS_VISION_URL);
  const vision = await visionTasks.FilesetResolver.forVisionTasks(WASM_URL);

  const options = {
    baseOptions: {
      modelAssetPath: POSE_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  };

  try {
    return await visionTasks.PoseLandmarker.createFromOptions(vision, options);
  } catch {
    return visionTasks.PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
        delegate: "CPU",
      },
    });
  }
}

export function WorkoutAnalyzerMode() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const exerciseRef = useRef<ExerciseKey>("pushup");
  const programRef = useRef<ProgramKey>("free");
  const routinePhaseRef = useRef<RoutinePhase>("idle");
  const routineStepIndexRef = useRef(0);
  const setStartRepRef = useRef(0);
  const statusRef = useRef<AnalyzerStatus>("idle");
  const lastVideoTimeRef = useRef(-1);
  const lastCountAtRef = useRef(0);
  const lastSpokenRef = useRef("");
  const lastGuidanceAtRef = useRef(0);
  const lastGuidanceMessageRef = useRef("");
  const halfwayMotivationKeyRef = useRef<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const smoothedLandmarksRef = useRef<Landmark[] | null>(null);
  const repFlashTimeoutRef = useRef<number | null>(null);
  const metricsRef = useRef<AnalyzerMetrics>({
    repCount: 0,
    phase: "ready",
    confidence: 0,
    angle: null,
    feedback: "Start the camera, choose an exercise, then begin.",
    quality: "idle",
  });

  const [exercise, setExercise] = useState<ExerciseKey>("pushup");
  const [program, setProgram] = useState<ProgramKey>("free");
  const [routinePhase, setRoutinePhase] = useState<RoutinePhase>("idle");
  const [routineStepIndex, setRoutineStepIndex] = useState(0);
  const [setStartRep, setSetStartRep] = useState(0);
  const [routineRemaining, setRoutineRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState<AnalyzerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [metrics, setMetrics] = useState<AnalyzerMetrics>(metricsRef.current);
  const [repFlash, setRepFlash] = useState<number | null>(null);
  const [customReps, setCustomReps] = useState(15);
  const [customSets, setCustomSets] = useState(2);
  const [customRestSeconds, setCustomRestSeconds] = useState(20);
  const [activeTab, setActiveTab] = useState<AnalyzerTab>("quick");
  const [selectedPreset, setSelectedPreset] = useState<WorkoutPreset | null>(null);
  const [activePreset, setActivePreset] = useState<WorkoutPreset | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("Recommended for you");
  const [showSettings, setShowSettings] = useState(false);
  const [showExerciseMenu, setShowExerciseMenu] = useState(false);
  const [showPoseOverlay, setShowPoseOverlay] = useState(true);
  const [recentSets, setRecentSets] = useState<SetSummary[]>([]);
  const [lastSetSummary, setLastSetSummary] = useState<SetSummary | null>(null);
  const [timedRemaining, setTimedRemaining] = useState<number | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [favoritePresetIds, setFavoritePresetIds] = useState<Set<string>>(new Set(["web-hero"]));
  const [savedPresetIds, setSavedPresetIds] = useState<Set<string>>(new Set(["beginner-strength"]));

  useEffect(() => {
    exerciseRef.current = exercise;
  }, [exercise]);

  useEffect(() => {
    programRef.current = program;
  }, [program]);

  useEffect(() => {
    routinePhaseRef.current = routinePhase;
  }, [routinePhase]);

  useEffect(() => {
    routineStepIndexRef.current = routineStepIndex;
  }, [routineStepIndex]);

  useEffect(() => {
    setStartRepRef.current = setStartRep;
  }, [setStartRep]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const selectedExercise = useMemo(
    () => EXERCISES.find((item) => item.key === exercise) ?? EXERCISES[0],
    [exercise]
  );

  const selectedProgram = useMemo(() => getProgram(program), [program]);
  const customRoutineSteps = useMemo<RoutineStep[]>(() => {
    const steps: RoutineStep[] = [];
    for (let setIndex = 0; setIndex < customSets; setIndex += 1) {
      steps.push({ type: "work", exercise, reps: customReps });
      if (setIndex < customSets - 1 && customRestSeconds > 0) {
        steps.push({ type: "rest", seconds: customRestSeconds });
      }
    }
    return steps;
  }, [customReps, customRestSeconds, customSets, exercise]);
  const presetRoutineSteps = useMemo(
    () => (activePreset ? buildPresetSteps(activePreset) : []),
    [activePreset]
  );
  const activeRoutineSteps = activePreset ? presetRoutineSteps : customRoutineSteps;
  const filteredPresets = useMemo(() => {
    if (activeFilter === "Recommended for you") {
      return WORKOUT_PRESETS.filter((preset) => preset.recommended);
    }
    return WORKOUT_PRESETS.filter((preset) => {
      const tags = [
        preset.difficulty,
        preset.equipment,
        preset.goal,
        ...preset.muscles,
        preset.durationMin <= 10 ? "5-10 min" : "15-20 min",
      ].map((tag) => tag.toLowerCase());
      return tags.some((tag) => tag.includes(activeFilter.toLowerCase()));
    });
  }, [activeFilter]);
  const recommendedPresets = WORKOUT_PRESETS.filter((preset) => preset.recommended);

  const speak = useCallback(
    (message: string) => {
      if (!voiceEnabled || typeof window === "undefined") return;
      if (lastSpokenRef.current === message) return;
      lastSpokenRef.current = message;

      const clip = getGymVoiceClip(message);
      if (clip) {
        if (!voiceAudioRef.current) {
          voiceAudioRef.current = new Audio();
        }
        const audio = voiceAudioRef.current;
        audio.pause();
        audio.currentTime = 0;
        audio.src = encodeURI(clip);
        audio.play().catch(() => {
          if (!("speechSynthesis" in window)) return;
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.rate = 1.02;
          utterance.pitch = 1;
          window.speechSynthesis.speak(utterance);
        });
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
    (kind: "start" | "rep" | "rest" | "setComplete" | "finish" | "warning") => {
      if (!soundEnabled || typeof window === "undefined") return;
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const context = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = context;
      void context.resume?.();

      const notes: Record<typeof kind, Array<[number, number, number]>> = {
        start: [
          [440, 0, 0.1],
          [660, 0.1, 0.12],
        ],
        rep: [[880, 0, 0.09]],
        rest: [[420, 0, 0.06]],
        setComplete: [
          [660, 0, 0.1],
          [880, 0.1, 0.12],
          [1046, 0.22, 0.16],
        ],
        finish: [
          [523, 0, 0.12],
          [659, 0.12, 0.12],
          [784, 0.24, 0.2],
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
        gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + offset + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + duration + 0.02);
      });
    },
    [soundEnabled]
  );

  const recordSetSummary = useCallback(
    (label: string, reps: number, seconds: number) => {
      const summary: SetSummary = {
        id: `${Date.now()}-${recentSets.length}`,
        label,
        setNumber: recentSets.length + 1,
        reps,
        seconds,
      };
      setLastSetSummary(summary);
      setRecentSets((sets) => [summary, ...sets].slice(0, 5));
      return summary;
    },
    [recentSets.length]
  );

  const enterRoutineStep = useCallback(
    (index: number, delayMs = 0) => {
      const routine =
        programRef.current === "custom"
          ? { ...getProgram("custom"), steps: activeRoutineSteps }
          : getProgram(programRef.current);
      const step = routine.steps[index];

      if (!step) {
        routinePhaseRef.current = "complete";
        setRoutinePhase("complete");
        setRoutineRemaining(null);
        setStatus(streamRef.current ? "ready" : "idle");
        setMetrics((current) => ({
          ...current,
          feedback: "Routine complete. Nice work.",
          quality: "good",
        }));
        window.setTimeout(() => {
          playSound("finish");
          speak("Routine complete. Nice work.");
        }, delayMs);
        return;
      }

      routineStepIndexRef.current = index;
      halfwayMotivationKeyRef.current = null;
      setRoutineStepIndex(index);

      if (step.type === "rest") {
        routinePhaseRef.current = "rest";
        setRoutinePhase("rest");
        setRoutineRemaining(step.seconds);
        setStatus("rest");
        setMetrics((current) => ({
          ...current,
          feedback: `Set complete. Rest for ${step.seconds} seconds.`,
          quality: "good",
        }));
        window.setTimeout(() => {
          playSound("setComplete");
          speak(`Set complete. ${step.seconds} seconds rest. ${step.seconds}.`);
        }, delayMs);
        return;
      }

      if (step.type === "timed") {
        if (step.exercise) {
          exerciseRef.current = step.exercise;
          setExercise(step.exercise);
        }
        routinePhaseRef.current = "timed";
        setRoutinePhase("timed");
        setRoutineRemaining(null);
        setTimedRemaining(step.seconds);
        setCountdown(3);
        setStatus("countdown");
        setMetrics((current) => ({
          ...current,
          phase: "ready",
          feedback: `Get ready: ${step.label} for ${step.seconds} seconds.`,
          quality: "tracking",
        }));
        window.setTimeout(() => {
          playSound("start");
          speak(`Now do ${step.label} for ${step.seconds} seconds. Three.`);
        }, delayMs);
        return;
      }

      exerciseRef.current = step.exercise;
      setExercise(step.exercise);
      routinePhaseRef.current = "work";
      setRoutinePhase("work");
      setRoutineRemaining(null);
      setStartRepRef.current = metricsRef.current.repCount;
      setSetStartRep(metricsRef.current.repCount);
      setCountdown(3);
      setStatus("countdown");
      setMetrics((current) => ({
        ...current,
        phase: "ready",
        feedback: `Get ready: ${step.reps} ${getExerciseLabel(step.exercise)} reps.`,
        quality: "tracking",
      }));
      window.setTimeout(() => {
        playSound("start");
        speak(`Now do ${step.reps} ${getExerciseLabel(step.exercise)} reps. Three.`);
      }, delayMs);
    },
    [activeRoutineSteps, playSound, speak]
  );

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

    const quality = metricsRef.current.quality;
    const activeSet = new Set(ACTIVE_LANDMARKS[exerciseRef.current]);
    const lineColor =
      quality === "warning"
        ? "rgba(251, 191, 36, 0.95)"
        : quality === "good"
          ? "rgba(52, 211, 153, 0.98)"
          : "rgba(99, 179, 237, 0.92)";

    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(15, 23, 42, 0.72)";
    LANDMARK_CONNECTIONS.forEach(([aIndex, bIndex]) => {
      const a = landmarks[aIndex];
      const b = landmarks[bIndex];
      if (!isVisible(a, 0.45) || !isVisible(b, 0.45)) return;
      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    });

    ctx.lineWidth = 4;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = lineColor;
    LANDMARK_CONNECTIONS.forEach(([aIndex, bIndex]) => {
      const a = landmarks[aIndex];
      const b = landmarks[bIndex];
      if (!isVisible(a, 0.45) || !isVisible(b, 0.45)) return;
      ctx.globalAlpha = activeSet.has(aIndex) || activeSet.has(bIndex) ? 1 : 0.42;
      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    landmarks.forEach((point, index) => {
      if (index > 32 || !isVisible(point, 0.45)) return;
      const active = activeSet.has(index);
      const bodyAnchor = [11, 12, 23, 24, 25, 26].includes(index);
      if (!active && !bodyAnchor) return;
      ctx.beginPath();
      ctx.fillStyle = active ? lineColor : "rgba(255, 255, 255, 0.86)";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = active ? 3 : 2;
      ctx.arc(point.x * width, point.y * height, active ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }, []);

  const stopLoop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      const result = landmarker.detectForVideo(video, performance.now());
      const rawLandmarks = result.landmarks?.[0];
      const landmarks = rawLandmarks ? smoothLandmarks(smoothedLandmarksRef.current, rawLandmarks) : undefined;
      smoothedLandmarksRef.current = landmarks ?? null;
      drawPose(landmarks);

      if (statusRef.current === "running") {
        const next = analyzeExercise(exerciseRef.current, landmarks, metricsRef.current, lastCountAtRef.current);
        if (next.repCount > metricsRef.current.repCount) {
          lastCountAtRef.current = performance.now();
          playSound("rep");
          speak(String(next.repCount));
          setRepFlash(next.repCount);
          if (repFlashTimeoutRef.current) {
            window.clearTimeout(repFlashTimeoutRef.current);
          }
          repFlashTimeoutRef.current = window.setTimeout(() => {
            setRepFlash(null);
          }, 720);

          if (next.repCount % 5 === 0) {
            next.feedback = `${MOTIVATION[next.repCount % MOTIVATION.length]} ${next.repCount} reps down.`;
          }

          const routine =
            programRef.current === "custom"
              ? { ...getProgram("custom"), steps: activeRoutineSteps }
              : getProgram(programRef.current);
          const step = routine.steps[routineStepIndexRef.current];
          if (routine.key !== "free" && routinePhaseRef.current === "work" && step?.type === "work") {
            const setReps = next.repCount - setStartRepRef.current;
            const halfwayRep = Math.ceil(step.reps / 2);
            const halfwayKey = `${routine.key}-${routineStepIndexRef.current}-${step.reps}`;
            if (
              setReps >= halfwayRep &&
              setReps < step.reps &&
              halfwayMotivationKeyRef.current !== halfwayKey
            ) {
              halfwayMotivationKeyRef.current = halfwayKey;
              speak("Halfway there.");
            }
            if (setReps >= step.reps) {
              next.feedback = `Set complete. ${setReps} reps locked in.`;
              recordSetSummary(step.label ?? getExerciseLabel(step.exercise), setReps, sessionSeconds);
              const nextStepIndex = routineStepIndexRef.current + 1;
              routinePhaseRef.current = "idle";
              setRoutinePhase("idle");
              setStatus("paused");
              window.setTimeout(() => enterRoutineStep(nextStepIndex), 760);
            }
          }
        } else {
          const guidance = getVisibilityGuidance(next);
          const now = performance.now();
          if (
            guidance &&
            now - lastGuidanceAtRef.current > 4500 &&
            guidance !== lastGuidanceMessageRef.current
          ) {
            lastGuidanceAtRef.current = now;
            lastGuidanceMessageRef.current = guidance;
            playSound("warning");
            speak(guidance);
          }
        }
        if (
          programRef.current === "free" &&
          sessionSeconds >= 30 &&
          next.confidence >= 45 &&
          next.repCount > 0 &&
          halfwayMotivationKeyRef.current !== "free-time-30"
        ) {
          halfwayMotivationKeyRef.current = "free-time-30";
          speak("Halfway there.");
        }
        metricsRef.current = next;
        setMetrics(next);
      }

      lastVideoTimeRef.current = video.currentTime;
    }

    animationRef.current = requestAnimationFrame(runDetectionLoop);
  }, [activeRoutineSteps, drawPose, enterRoutineStep, playSound, recordSetSummary, sessionSeconds, speak]);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    smoothedLandmarksRef.current = null;
    drawPose(undefined);
  }, [drawPose, stopLoop]);

  const startCamera = useCallback(async () => {
    setError(null);
    setStatus("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported in this browser.");
      }

      if (!landmarkerRef.current) {
        landmarkerRef.current = await loadPoseLandmarker();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      lastVideoTimeRef.current = -1;
      smoothedLandmarksRef.current = null;
      setStatus("ready");
      speak("Camera ready.");
      stopLoop();
      animationRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not start the workout analyzer.";
      setError(message);
      setStatus("error");
      stopCamera();
    }
  }, [cameraFacingMode, runDetectionLoop, speak, stopCamera, stopLoop]);

  const resetSession = useCallback(() => {
    metricsRef.current = {
      repCount: 0,
      phase: "ready",
      confidence: 0,
      angle: null,
      feedback: "Session reset. Start when you are ready.",
      quality: streamRef.current ? "tracking" : "idle",
    };
    lastCountAtRef.current = 0;
    lastGuidanceAtRef.current = 0;
    lastGuidanceMessageRef.current = "";
    halfwayMotivationKeyRef.current = null;
    smoothedLandmarksRef.current = null;
    routinePhaseRef.current = "idle";
    routineStepIndexRef.current = 0;
    setStartRepRef.current = 0;
    setTimedRemaining(null);
    setSessionSeconds(0);
    setCountdown(null);
    setRoutinePhase("idle");
    setRoutineStepIndex(0);
    setSetStartRep(0);
    setRoutineRemaining(null);
    setMetrics(metricsRef.current);
    setStatus(streamRef.current ? "ready" : "idle");
  }, []);

  const beginCountdown = useCallback(() => {
    if (!streamRef.current) return;
    if (programRef.current !== "free" && routinePhaseRef.current !== "work") {
      metricsRef.current = {
        ...metricsRef.current,
        repCount: 0,
        phase: "ready",
        angle: null,
        feedback: "Starting custom routine.",
        quality: "tracking",
      };
      setSessionSeconds(0);
      setMetrics(metricsRef.current);
      enterRoutineStep(0);
      return;
    }

    metricsRef.current = {
      repCount: metricsRef.current.repCount,
      phase: "ready",
      confidence: metricsRef.current.confidence,
      angle: null,
      feedback: "Get set.",
      quality: "tracking",
    };
    setMetrics(metricsRef.current);
    setStatus("countdown");
    setCountdown(3);
    playSound("start");
    speak("Three.");
  }, [enterRoutineStep, playSound, speak]);

  useEffect(() => {
    if (status !== "countdown" || countdown == null) return;
    if (countdown === 0) {
      setCountdown(null);
      setStatus("running");
      playSound("start");
      speak("Go.");
      return;
    }

    const timeout = window.setTimeout(() => {
      const next = countdown - 1;
      setCountdown(next);
      if (next > 0) {
        playSound("rest");
        speak(String(next));
      }
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [countdown, playSound, speak, status]);

  useEffect(() => {
    if (status !== "rest" || routineRemaining == null) return;
    if (routineRemaining <= 0) {
      enterRoutineStep(routineStepIndexRef.current + 1);
      return;
    }

    const timeout = window.setTimeout(() => {
      const next = routineRemaining - 1;
      setRoutineRemaining(next);
      if (next > 0) {
        playSound("rest");
        speak(String(next));
      }
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [enterRoutineStep, playSound, routineRemaining, speak, status]);

  useEffect(() => {
    if (status !== "running" || routinePhase !== "timed" || timedRemaining == null) return;
    if (timedRemaining <= 0) {
      const step = activeRoutineSteps[routineStepIndexRef.current];
      if (step?.type === "timed") {
        recordSetSummary(step.label, 0, step.seconds);
      }
      playSound("setComplete");
      enterRoutineStep(routineStepIndexRef.current + 1);
      return;
    }

    const timeout = window.setTimeout(() => {
      const next = timedRemaining - 1;
      setTimedRemaining(next);
      if (next > 0 && next <= 5) {
        playSound("rest");
        speak(String(next));
      }
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [
    activeRoutineSteps,
    enterRoutineStep,
    playSound,
    recordSetSummary,
    routinePhase,
    speak,
    status,
    timedRemaining,
  ]);

  useEffect(() => {
    if (status !== "running" && status !== "rest") return;
    const interval = window.setInterval(() => {
      setSessionSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close?.();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      voiceAudioRef.current?.pause();
      if (repFlashTimeoutRef.current) {
        window.clearTimeout(repFlashTimeoutRef.current);
      }
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!voiceEnabled || typeof window === "undefined") return;
    const clips = [
      ...Array.from({ length: 23 }, (_, index) => `${GYM_AUDIO_BASE}/${index + 1}.wav`),
      `${GYM_AUDIO_BASE}/Setup/camera_is_ready.mp3`,
      `${GYM_AUDIO_BASE}/Setup/get_ready.mp3`,
      `${GYM_AUDIO_BASE}/Setup/lets_go.mp3`,
      `${GYM_AUDIO_BASE}/Setup/looking_for_you.mp3`,
      `${GYM_AUDIO_BASE}/Setup/position_ready.mp3`,
      `${GYM_AUDIO_BASE}/good_rep.mp3`,
      `${GYM_AUDIO_BASE}/good_form.mp3`,
      `${GYM_AUDIO_BASE}/fix_your_from.mp3`,
      `${GYM_AUDIO_BASE}/go_lower.mp3`,
      `${GYM_AUDIO_BASE}/come_up.mp3`,
      `${GYM_AUDIO_BASE}/slow_down.mp3`,
      `${GYM_AUDIO_BASE}/start_your_set.mp3`,
      `${GYM_AUDIO_BASE}/Lost_tracking.wav`,
      `${GYM_AUDIO_BASE}/Camera_unclear.wav`,
      `${GYM_AUDIO_BASE}/Halfway_motivation_nepali.wav`,
    ];
    const audios = clips.map((clip) => {
      const audio = new Audio(encodeURI(clip));
      audio.preload = "auto";
      return audio;
    });
    return () => audios.forEach((audio) => audio.pause());
  }, [voiceEnabled]);

  const canStartSession = status === "ready" || status === "paused";
  const isCameraActive =
    status === "ready" ||
    status === "running" ||
    status === "rest" ||
    status === "paused" ||
    status === "countdown";
  const repProgress = getRepProgress(exercise, metrics.angle, metrics.phase);
  const currentRoutineStep = selectedProgram.steps[routineStepIndex];
  const currentCustomStep = customRoutineSteps[routineStepIndex];
  const activeRoutineStep = program === "custom" ? currentCustomStep : currentRoutineStep;
  const activeStep = program === "custom" ? activeRoutineSteps[routineStepIndex] : null;
  const targetReps = activeRoutineStep?.type === "work" ? activeRoutineStep.reps : null;
  const currentSetReps = program === "free" ? metrics.repCount : Math.max(0, metrics.repCount - setStartRep);
  const routineProgress = targetReps
    ? Math.min(100, (currentSetReps / targetReps) * 100)
    : repProgress;
  const modeLocked = program !== "free" && routinePhase !== "idle" && routinePhase !== "complete";
  const customDescription = `${customSets} set${customSets === 1 ? "" : "s"} x ${customReps} ${getExerciseLabel(exercise)} reps, ${customRestSeconds}s rest.`;
  const stageLabel =
    status === "rest"
      ? `${routineRemaining ?? 0}s rest`
      : routinePhase === "timed" && timedRemaining != null
        ? `${timedRemaining}s`
      : targetReps
        ? `${currentSetReps}/${targetReps} reps`
        : status === "running"
          ? "Live set"
          : status === "paused"
            ? "Paused"
            : "Ready";
  const trackingTone =
    metrics.quality === "warning"
      ? "bg-amber-400"
      : metrics.quality === "good"
        ? "bg-emerald-400"
        : "bg-sky-400";
  const primaryActionLabel =
    status === "running"
      ? "End set"
      : status === "rest" || status === "countdown"
        ? "Pause"
      : status === "paused"
        ? "Resume"
        : program === "free"
          ? "Start set"
          : "Start routine";
  const primaryActionIcon =
    status === "running" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : status === "rest" || status === "countdown" ? (
      <Pause className="h-4 w-4" />
    ) : (
      <Play className="h-4 w-4" />
    );

  const endCurrentSet = () => {
    const label =
      activeStep?.type === "work"
        ? activeStep.label ?? getExerciseLabel(activeStep.exercise)
        : activeStep?.type === "timed"
          ? activeStep.label
          : selectedExercise.label;
    const reps = routinePhase === "timed" ? 0 : currentSetReps;
    const elapsed =
      activeStep?.type === "timed"
        ? activeStep.seconds - (timedRemaining ?? 0)
        : sessionSeconds;
    const summary = recordSetSummary(label, reps, Math.max(0, elapsed));
    metricsRef.current = {
      ...metricsRef.current,
      feedback: `Set complete - ${reps ? `${reps} reps` : label} • ${formatSessionTime(summary.seconds)}`,
      quality: "good",
    };
    setMetrics(metricsRef.current);
    setLastSetSummary(summary);
    setRoutinePhase("summary");
    routinePhaseRef.current = "summary";
    setStatus("paused");
    playSound("setComplete");
    speak(`Set complete. ${reps ? `${reps} reps` : label}.`);
  };

  const handlePrimaryAction = () => {
    if (status === "running") {
      endCurrentSet();
      return;
    }

    if (status === "rest" || status === "countdown") {
      setStatus("paused");
      speak("Paused.");
      return;
    }

    if (status === "paused" && routinePhase === "rest") {
      setStatus("rest");
      speak(`${routineRemaining ?? 0} seconds rest.`);
      return;
    }

    beginCountdown();
  };

  const startNextSet = () => {
    if (program === "custom") {
      enterRoutineStep(routineStepIndexRef.current + 1);
      return;
    }
    beginCountdown();
  };

  const finishWorkout = () => {
    setActivePreset(null);
    setProgram("free");
    programRef.current = "free";
    setRoutinePhase("complete");
    routinePhaseRef.current = "complete";
    setStatus(streamRef.current ? "ready" : "idle");
    playSound("finish");
    speak("Workout finished.");
  };

  const startPresetWorkout = (preset: WorkoutPreset) => {
    const firstCameraExercise = preset.exercises.find((item) => item.exercise)?.exercise ?? "pushup";
    setActivePreset(preset);
    setSelectedPreset(null);
    setActiveTab("quick");
    setProgram("custom");
    programRef.current = "custom";
    setExercise(firstCameraExercise);
    exerciseRef.current = firstCameraExercise;
    resetSession();
  };

  const toggleFavorite = (presetId: string) => {
    setFavoritePresetIds((current) => {
      const next = new Set(current);
      if (next.has(presetId)) next.delete(presetId);
      else next.add(presetId);
      return next;
    });
  };

  const toggleSaved = (presetId: string) => {
    setSavedPresetIds((current) => {
      const next = new Set(current);
      if (next.has(presetId)) next.delete(presetId);
      else next.add(presetId);
      return next;
    });
  };

  const presetCard = (preset: WorkoutPreset) => (
    <button
      key={preset.id}
      type="button"
      onClick={() => setSelectedPreset(preset)}
      className="w-[236px] shrink-0 rounded-[22px] border border-border bg-white p-4 text-left shadow-sm transition hover:border-primary/40 dark:bg-card"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-sm font-black text-primary">
          {preset.thumbnail}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{preset.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {preset.durationMin} min • {preset.difficulty}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold text-primary">{preset.goal}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {preset.exercises.length} exercises • {preset.muscles.slice(0, 3).join(" • ")}
      </p>
      <span className="mt-4 inline-flex min-h-9 items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground">
        Start
      </span>
    </button>
  );

  const trackingState =
    !streamRef.current
      ? "Looking for you..."
      : metrics.confidence < 35
        ? "Looking for you..."
        : metrics.quality === "warning"
          ? "Adjust position"
          : status === "ready"
            ? "Ready"
            : status === "running"
              ? "Tracking"
              : "Body detected";
  const coachingText =
    routinePhase === "summary" && lastSetSummary
      ? `Set complete - ${lastSetSummary.reps || lastSetSummary.label} • ${formatSessionTime(lastSetSummary.seconds)}`
      : !streamRef.current
        ? selectedExercise.hint
        : status === "ready"
          ? "You're in position. Start when ready."
          : metrics.angle == null
            ? selectedExercise.hint
            : metrics.feedback.replace("Rep counted. ", "").replace("Nice lockout.", "Good form.");
  const activeSetLabel =
    activePreset && activeStep
      ? `Exercise ${Math.max(1, Math.ceil((routineStepIndex + 1) / 2))} of ${activePreset.exercises.length}`
      : program === "custom"
        ? `Set ${Math.max(1, Math.min(customSets, Math.floor(routineStepIndex / 2) + 1))}`
        : "Set 1";
  const wholeWorkoutProgress =
    program === "custom" && activeRoutineSteps.length > 0
      ? Math.min(100, ((routineStepIndex + (status === "running" ? routineProgress / 100 : 0)) / activeRoutineSteps.length) * 100)
      : routineProgress;

  return (
    <div className="space-y-5 bg-background pb-8">
      {error && (
        <div className="rounded-[20px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-white p-1 shadow-sm dark:bg-card">
        {(["quick", "programs"] as AnalyzerTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "min-h-11 rounded-full text-sm font-semibold transition",
              activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {tab === "quick" ? "Quick workout" : "Programs"}
          </button>
        ))}
      </div>

      {activeTab === "programs" ? (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Choose a workout</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Unofficial themed inspiration plus simple goal-based routines.
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {["Recommended for you", ...FILTER_CHIPS].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setActiveFilter(chip)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold",
                  activeFilter === chip
                    ? "border-primary bg-secondary text-primary"
                    : "border-border bg-white text-muted-foreground dark:bg-card"
                )}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Recommended for you</h3>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recommendedPresets.map(presetCard)}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">All programs</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPreset(preset)}
                  className="rounded-[22px] border border-border bg-white p-4 text-left shadow-sm dark:bg-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-xs font-black text-primary">
                      {preset.thumbnail}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{preset.name}</p>
                        {favoritePresetIds.has(preset.id) && <Heart className="h-4 w-4 fill-primary text-primary" />}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {preset.durationMin} min • {preset.difficulty} • {preset.exercises.length} exercises
                      </p>
                      <p className="mt-2 text-xs font-medium text-primary">{preset.muscles.slice(0, 3).join(" • ")}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab("quick");
              setProgram("custom");
              programRef.current = "custom";
              setActivePreset(null);
              resetSession();
            }}
            className="flex w-full items-center justify-between rounded-[22px] border border-dashed border-primary/40 bg-white p-4 text-left dark:bg-card"
          >
            <span>
              <span className="block text-sm font-semibold">Create your own workout</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Choose exercise, reps, sets, rest, then save the routine.
              </span>
            </span>
            <ListChecks className="h-5 w-5 text-primary" />
          </button>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-[24px] border border-border bg-black shadow-sm">
            <div className="relative h-[72vh] min-h-[560px] w-full sm:h-[76vh] sm:min-h-[640px]">
              <video
                ref={videoRef}
                className="h-full w-full scale-x-[-1] object-cover"
                muted
                playsInline
              />
              {showPoseOverlay && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
                />
              )}

              <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-3">
                <div className="relative">
                  <button
                    type="button"
                    disabled={modeLocked}
                    onClick={() => setShowExerciseMenu((value) => !value)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/92 px-4 text-sm font-semibold text-foreground shadow-sm backdrop-blur disabled:opacity-70"
                  >
                    {activeStep?.type === "timed" ? activeStep.label : selectedExercise.label}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {showExerciseMenu && !modeLocked && (
                    <div className="absolute left-0 top-12 w-48 overflow-hidden rounded-2xl border border-border bg-white p-1 shadow-lg">
                      {EXERCISES.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setExercise(item.key);
                            exerciseRef.current = item.key;
                            setShowExerciseMenu(false);
                            resetSession();
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-secondary"
                        >
                          {item.label}
                          {exercise === item.key && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-foreground shadow-sm backdrop-blur"
                  title="Workout settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>

              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-950 text-white">
                  {status === "loading" ? (
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  ) : status === "error" ? (
                    <VideoOff className="h-10 w-10 text-destructive" />
                  ) : (
                    <Camera className="h-10 w-10 text-primary" />
                  )}
                  <p className="max-w-[260px] text-center text-sm text-white/75">
                    {status === "loading" ? "Loading camera." : "Position yourself in the frame."}
                  </p>
                  {status !== "loading" && (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
                    >
                      <Camera className="h-4 w-4" />
                      Start camera
                    </button>
                  )}
                </div>
              )}

              {countdown != null && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
                  <span className="text-8xl font-black tabular-nums text-white">
                    {countdown === 0 ? "GO" : countdown}
                  </span>
                </div>
              )}

              <div className="absolute left-4 top-20 z-10 rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
                {trackingState}
              </div>

              {program === "custom" && activeRoutineSteps.length > 0 && (
                <div className="absolute left-4 right-4 top-[118px] z-10 h-1.5 overflow-hidden rounded-full bg-white/30">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${wholeWorkoutProgress}%` }} />
                </div>
              )}

              <div className="absolute left-4 right-4 top-1/2 z-10 flex -translate-y-1/2 justify-center">
                <div className="rounded-full bg-white/92 px-4 py-2 text-center text-sm font-semibold text-foreground shadow-sm backdrop-blur">
                  {coachingText}
                </div>
              </div>

              {repFlash != null && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border border-white/40 bg-primary text-6xl font-black tabular-nums text-primary-foreground shadow-lg animate-in zoom-in-75 fade-in duration-150">
                    {repFlash}
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4 z-10 space-y-4">
                {routinePhase === "summary" && lastSetSummary ? (
                  <div className="rounded-[22px] bg-white/94 p-4 text-foreground shadow-sm backdrop-blur">
                    <p className="text-sm font-semibold">
                      Set complete - {lastSetSummary.reps ? `${lastSetSummary.reps} reps` : lastSetSummary.label} • {formatSessionTime(lastSetSummary.seconds)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={startNextSet} className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
                        Start next set
                      </button>
                      <button type="button" onClick={finishWorkout} className="min-h-11 rounded-full border border-border bg-white px-4 text-sm font-semibold">
                        Finish workout
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center text-white drop-shadow">
                      <p className="text-7xl font-black leading-none tabular-nums tracking-normal">{currentSetReps}</p>
                      <p className="mt-1 text-sm font-black tracking-[0.2em]">REPS</p>
                      <p className="mt-3 text-sm font-semibold">
                        {activeSetLabel} • {status === "rest" ? `Rest ${formatSessionTime(routineRemaining ?? 0)}` : formatSessionTime(sessionSeconds)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={streamRef.current ? handlePrimaryAction : startCamera}
                      disabled={status === "loading" || (!!streamRef.current && !canStartSession && status !== "running" && status !== "rest" && status !== "countdown")}
                      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
                    >
                      {!streamRef.current && status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : streamRef.current ? primaryActionIcon : <Camera className="h-5 w-5" />}
                      {streamRef.current ? primaryActionLabel : "Start set"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {activePreset && (
            <div className="rounded-[22px] border border-border bg-white p-4 shadow-sm dark:bg-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{activePreset.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stageLabel} • {activePreset.durationMin} min • {activePreset.exercises.length} exercises
                  </p>
                </div>
                <Flame className="h-5 w-5 text-primary" />
              </div>
            </div>
          )}

          {program === "custom" && !activePreset && routinePhase === "idle" && (
            <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-border bg-white p-3 dark:bg-card">
              {([
                ["Reps", customReps, setCustomReps, 1, 100],
                ["Sets", customSets, setCustomSets, 1, 20],
                ["Rest", customRestSeconds, setCustomRestSeconds, 0, 300],
              ] as Array<[string, number, (value: number) => void, number, number]>).map(([label, value, setter, min, max]) => (
                <label key={String(label)} className="space-y-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
                  <input
                    type="number"
                    min={Number(min)}
                    max={Number(max)}
                    value={Number(value)}
                    onChange={(event) => setter(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold tabular-nums outline-none"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="rounded-[22px] border border-border bg-white p-4 shadow-sm dark:bg-card">
            <div className="flex items-start gap-3">
              <CheckCircle2 className={cn("mt-0.5 h-5 w-5 shrink-0", metrics.quality === "warning" ? "text-accent" : "text-primary")} />
              <div>
                <p className="text-sm font-semibold">{coachingText}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {routinePhase === "summary" ? "Review your set or continue when ready." : trackingState}
                </p>
              </div>
            </div>
          </div>

          {routinePhase === "complete" && activePreset && (
            <div className="rounded-[24px] border border-border bg-white p-5 shadow-sm dark:bg-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">Workout complete</p>
                  <p className="mt-1 text-sm text-muted-foreground">{activePreset.name}</p>
                </div>
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary px-4 py-3">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-lg font-semibold tabular-nums">{formatSessionTime(sessionSeconds)}</p>
                </div>
                <div className="rounded-2xl bg-secondary px-4 py-3">
                  <p className="text-xs text-muted-foreground">Exercises</p>
                  <p className="text-lg font-semibold tabular-nums">{activePreset.exercises.length}</p>
                </div>
                <div className="rounded-2xl bg-secondary px-4 py-3">
                  <p className="text-xs text-muted-foreground">Total reps</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {recentSets.reduce((sum, item) => sum + item.reps, 0)}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary px-4 py-3">
                  <p className="text-xs text-muted-foreground">Calories est.</p>
                  <p className="text-lg font-semibold tabular-nums">{activePreset.calories}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={finishWorkout} className="min-h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  Done
                </button>
                <button type="button" onClick={() => startPresetWorkout(activePreset)} className="min-h-11 rounded-full border border-border text-sm font-semibold">
                  Repeat workout
                </button>
              </div>
            </div>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Recent sets</h3>
            {recentSets.length === 0 ? (
              <div className="rounded-[22px] border border-border bg-white px-4 py-5 text-sm text-muted-foreground dark:bg-card">
                Completed sets will appear here.
              </div>
            ) : (
              <div className="space-y-2">
                {recentSets.map((set) => (
                  <div key={set.id} className="flex items-center justify-between rounded-[20px] border border-border bg-white px-4 py-3 text-sm dark:bg-card">
                    <span className="font-semibold">{set.label}</span>
                    <span className="text-muted-foreground">
                      Set {set.setNumber} • {set.reps ? `${set.reps} reps` : "Timed"} • {formatSessionTime(set.seconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selectedPreset && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-[24px] bg-white p-5 shadow-xl sm:max-w-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold">{selectedPreset.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedPreset.durationMin} min • {selectedPreset.exercises.length} exercises • {selectedPreset.equipment}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedPreset(null)} className="rounded-full p-2 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[selectedPreset.difficulty, selectedPreset.goal, selectedPreset.compatibility, `${selectedPreset.calories} cal est.`].map((item) => (
                <span key={item} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {selectedPreset.exercises.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-sm font-semibold">{index + 1}. {item.label}</span>
                  <span className="text-xs text-muted-foreground">{formatPresetLine(item)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => toggleFavorite(selectedPreset.id)} className="min-h-11 rounded-full border border-border text-sm font-semibold">
                {favoritePresetIds.has(selectedPreset.id) ? "Favorited" : "Favorite"}
              </button>
              <button type="button" onClick={() => toggleSaved(selectedPreset.id)} className="min-h-11 rounded-full border border-border text-sm font-semibold">
                {savedPresetIds.has(selectedPreset.id) ? "Saved" : "Save"}
              </button>
              <button type="button" onClick={() => startPresetWorkout(selectedPreset)} className="min-h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3">
          <div className="w-full rounded-[24px] bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">Workout settings</p>
              <button type="button" onClick={() => setShowSettings(false)} className="rounded-full p-2 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                ["Voice cues", voiceEnabled, setVoiceEnabled, Mic],
                ["Sound effects", soundEnabled, setSoundEnabled, Volume2],
                ["Pose overlay", showPoseOverlay, setShowPoseOverlay, Activity],
              ].map(([label, value, setter, Icon]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => (setter as (value: boolean | ((value: boolean) => boolean)) => void)((current: boolean) => !current)}
                  className="flex min-h-12 items-center justify-between rounded-2xl border border-border px-4 text-left"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold">
                    {Icon && <Icon className="h-4 w-4 text-primary" />}
                    {String(label)}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">{value ? "On" : "Off"}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCameraFacingMode((mode) => (mode === "user" ? "environment" : "user"))}
                className="flex min-h-12 items-center justify-between rounded-2xl border border-border px-4 text-left"
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <Camera className="h-4 w-4 text-primary" />
                  Camera
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{cameraFacingMode === "user" ? "Front" : "Back"}</span>
              </button>
              <button type="button" onClick={resetSession} className="flex min-h-12 items-center gap-3 rounded-2xl border border-border px-4 text-sm font-semibold">
                <TimerReset className="h-4 w-4 text-primary" />
                Reset set
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  finishWorkout();
                  setShowSettings(false);
                }}
                className="flex min-h-12 items-center gap-3 rounded-2xl border border-border px-4 text-sm font-semibold text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                End workout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
