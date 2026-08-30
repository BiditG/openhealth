"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Maximize2,
  Medal,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Sparkles,
  TimerReset,
  VideoOff,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import {
  MUSCLE_TRAINING_STORAGE_KEY,
  getDecayedMuscleScore,
  getMusclesForExercise,
  type MuscleTrainingProfile,
} from "@/lib/exercise-media";

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type ExerciseKey =
  | "squat"
  | "pushup"
  | "plank"
  | "gluteBridge"
  | "reverseLunge"
  | "forwardLunge"
  | "jumpingJacks"
  | "highKnees"
  | "mountainClimbers"
  | "crunch"
  | "situp"
  | "burpee"
  | "calfRaise"
  | "wallSit"
  | "sidePlank"
  | "legRaise"
  | "shoulderTaps"
  | "squatJump"
  | "bicepCurl"
  | "overheadPress"
  | "pullup";
type RepPhase = "ready" | "top" | "bottom" | "curl" | "hang" | "hold" | "open" | "closed" | "up" | "down";
type AnalyzerStatus = "idle" | "loading" | "ready" | "countdown" | "running" | "rest" | "paused" | "error";
type ProgramKey = "free" | "custom";
type RoutinePhase = "idle" | "work" | "timed" | "rest" | "summary" | "complete";
type AnalyzerTab = "quick" | "programs";
type WorkoutFlowStep = "activity" | "setup" | "active";
type TrackingMode = "camera" | "motion" | "interactive" | "trust";
type InteractiveMode = "tap" | "audio";
type ProofSource = "analyzer" | "motion" | "tempo" | "tap" | "audio" | "trust";
type SetEffort = "easy" | "moderate" | "challenging" | "limit";
type CoachSuggestion =
  | { type: "extra"; reps: number; message: string }
  | { type: "rest"; seconds: number; message: string }
  | { type: "same"; message: string };

type ExerciseDefinition = {
  key: ExerciseKey;
  label: string;
  hint: string;
  target: string;
};

type ExerciseTrackingProfile = {
  recommended: TrackingMode;
  motion: boolean;
  motionHint: string;
};

type AnalyzerMetrics = {
  repCount: number;
  phase: RepPhase;
  confidence: number;
  angle: number | null;
  repProgress: number;
  phaseStartedAt: number | null;
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

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
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
  tagline: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  durationMin: number;
  goal: string;
  equipment: string;
  muscles: string[];
  calories: number;
  compatibility: string;
  thumbnail: string;
  pointsReward: number;
  tags: string[];
  completed?: boolean;
  bestScore?: number;
  streak?: number;
  recommended?: boolean;
  exercises: PresetExercise[];
};

type SetSummary = {
  id: string;
  label: string;
  setNumber: number;
  reps: number;
  seconds: number;
  effort?: SetEffort;
  coachNote?: string;
};

type RewardPopup = {
  title: string;
  message: string;
  points: number;
  totalPoints?: number;
  rankTitle?: string;
};

type WorkoutProgram = {
  key: ProgramKey;
  label: string;
  description: string;
  steps: RoutineStep[];
};

type WorkoutAnalyzerExperience = "combined" | "quick" | "programs";

type WorkoutAnalyzerModeProps = {
  experience?: WorkoutAnalyzerExperience;
};

const EXERCISES: ExerciseDefinition[] = [
  {
    key: "squat",
    label: "Squat",
    hint: "Stand side-on or three-quarter view with hips, knees, and ankles visible.",
    target: "Standing tall after reaching depth counts one rep.",
  },
  {
    key: "pushup",
    label: "Push-up",
    hint: "Side view works best. Keep shoulders, elbows, wrists, and hips visible.",
    target: "Elbow extension after a controlled bottom position counts one rep.",
  },
  {
    key: "plank",
    label: "Plank",
    hint: "Use a side view with shoulders, hips, knees, and ankles visible.",
    target: "Hold a straight body line for the target time. This is tracked as a timer set.",
  },
  {
    key: "gluteBridge",
    label: "Glute bridge",
    hint: "Stand side-on or three-quarter view with hips, knees, and ankles visible.",
    target: "Hips lifted from the floor into a straight shoulder-hip-knee line counts one rep.",
  },
  {
    key: "reverseLunge",
    label: "Reverse lunge",
    hint: "Side or three-quarter view works best. Keep hips, knees, and ankles visible.",
    target: "Return to standing after the back knee drops counts one rep.",
  },
  {
    key: "forwardLunge",
    label: "Forward lunge",
    hint: "Side or three-quarter view works best. Keep hips, knees, and ankles visible.",
    target: "Return to standing after the front knee bends deeply counts one rep.",
  },
  {
    key: "jumpingJacks",
    label: "Jumping jacks",
    hint: "Face the camera with wrists, shoulders, hips, knees, and ankles visible.",
    target: "Arms and legs open, then return closed for one rep.",
  },
  {
    key: "highKnees",
    label: "High knees",
    hint: "Face the camera or stand at a slight angle with hips and knees visible.",
    target: "Each knee lift above hip level counts one rep.",
  },
  {
    key: "mountainClimbers",
    label: "Mountain climbers",
    hint: "Use a side view in a plank position with shoulders, hips, knees, and ankles visible.",
    target: "Each knee drive toward the chest counts one rep.",
  },
  {
    key: "crunch",
    label: "Crunch",
    hint: "Use a side view on the floor with shoulders, hips, and knees visible.",
    target: "Shoulders lifting toward the knees, then lowering, counts one rep.",
  },
  {
    key: "situp",
    label: "Sit-up",
    hint: "Use a side view on the floor with shoulders, hips, and knees visible.",
    target: "Torso rises toward the knees, then returns to the floor for one rep.",
  },
  {
    key: "burpee",
    label: "Burpee",
    hint: "Stand far enough back for full body tracking from floor to jump.",
    target: "A floor phase followed by a standing jump counts one rep.",
  },
  {
    key: "calfRaise",
    label: "Calf raise",
    hint: "Use a side view with knees, ankles, heels, and toes visible.",
    target: "Rising onto the toes, then lowering the heels, counts one rep.",
  },
  {
    key: "wallSit",
    label: "Wall sit",
    hint: "Use a side view with hips, knees, and ankles visible.",
    target: "Hold a deep seated knee angle for the target time. This is tracked as a timer set.",
  },
  {
    key: "sidePlank",
    label: "Side plank",
    hint: "Use a side view with shoulder, hip, knee, and ankle visible.",
    target: "Hold a straight side body line for the target time. This is tracked as a timer set.",
  },
  {
    key: "legRaise",
    label: "Leg raise",
    hint: "Use a side view on the floor with hips, knees, ankles, and shoulders visible.",
    target: "Legs lift up and return with control for one rep.",
  },
  {
    key: "shoulderTaps",
    label: "Shoulder taps",
    hint: "Face the camera in a plank with shoulders, wrists, hips, and knees visible.",
    target: "Each hand crossing to tap the opposite shoulder counts one rep.",
  },
  {
    key: "squatJump",
    label: "Squat jump",
    hint: "Stand side-on or three-quarter view with the full body visible.",
    target: "Reach squat depth, then jump and land tall for one rep.",
  },
  {
    key: "bicepCurl",
    label: "Bicep curl",
    hint: "Face the camera or stand at a slight angle with one full arm visible.",
    target: "A full curl from extended arm to tight elbow flexion counts one rep.",
  },
  {
    key: "overheadPress",
    label: "Overhead press",
    hint: "Face the camera with shoulders, elbows, and wrists visible.",
    target: "Press from shoulder height to overhead lockout for one rep.",
  },
  {
    key: "pullup",
    label: "Pull-up",
    hint: "Keep wrists, elbows, shoulders, and head visible near the top of frame.",
    target: "A pull from hang to chin-over-hands position counts one rep.",
  },
];

const TIMED_EXERCISES = new Set<ExerciseKey>(["plank", "wallSit", "sidePlank"]);

const TRACKING_PROFILES: Record<ExerciseKey, ExerciseTrackingProfile> = {
  squat: { recommended: "camera", motion: true, motionHint: "Phone in pocket or waistband; count the down-up rhythm." },
  pushup: { recommended: "camera", motion: false, motionHint: "Motion is less reliable for push-ups; use tap, audio, or Manual Mode if camera is weak." },
  plank: { recommended: "interactive", motion: false, motionHint: "Use Voice Assisted Mode or Manual Mode for timer-based hold work." },
  gluteBridge: { recommended: "camera", motion: true, motionHint: "Phone at waistband; count hip lift rhythm." },
  reverseLunge: { recommended: "camera", motion: true, motionHint: "Phone in pocket; count each return to standing." },
  forwardLunge: { recommended: "camera", motion: true, motionHint: "Phone in pocket; count each return to standing." },
  jumpingJacks: { recommended: "motion", motion: true, motionHint: "Phone in pocket; impact rhythm counts each jack." },
  highKnees: { recommended: "motion", motion: true, motionHint: "Phone in pocket; repeated knee-drive impacts count." },
  mountainClimbers: { recommended: "camera", motion: true, motionHint: "Phone secured at waistband; count alternating drives." },
  crunch: { recommended: "camera", motion: true, motionHint: "Phone near torso or waistband; count curl rhythm." },
  situp: { recommended: "camera", motion: true, motionHint: "Phone near torso or waistband; count sit-up rhythm." },
  burpee: { recommended: "motion", motion: true, motionHint: "Phone secure in pocket; large motion and impact count burpees." },
  calfRaise: { recommended: "camera", motion: true, motionHint: "Phone in pocket; count rise-lower rhythm." },
  wallSit: { recommended: "interactive", motion: false, motionHint: "Use Voice Assisted Mode or Manual Mode for timer-based hold work." },
  sidePlank: { recommended: "interactive", motion: false, motionHint: "Use Voice Assisted Mode or Manual Mode for timer-based hold work." },
  legRaise: { recommended: "camera", motion: true, motionHint: "Phone near waistband; count controlled raise rhythm." },
  shoulderTaps: { recommended: "camera", motion: true, motionHint: "Phone secured near torso; count tap rhythm." },
  squatJump: { recommended: "motion", motion: true, motionHint: "Phone in pocket; impact rhythm counts each jump." },
  bicepCurl: { recommended: "camera", motion: true, motionHint: "Phone strapped or held in working hand; count curl rhythm." },
  overheadPress: { recommended: "camera", motion: true, motionHint: "Phone held or strapped near arm; count press rhythm." },
  pullup: { recommended: "camera", motion: false, motionHint: "Motion is less reliable for pull-ups; use tap, audio, or trust if camera is weak." },
};

const TRACKING_OPTIONS: Array<{
  mode: TrackingMode;
  title: string;
  description: string;
  proof: string;
}> = [
  { mode: "camera", title: "Camera Mode", description: "Pose tracking with the strongest proof.", proof: "4x points" },
  { mode: "motion", title: "Motion Mode", description: "Pocket accelerometer/gyroscope rhythm counting.", proof: "4x points" },
  { mode: "interactive", title: "Interactive Mode", description: "Tap or audio reps without camera.", proof: "2x points" },
  { mode: "trust", title: "Manual Mode", description: "Complete the timer and self-confirm.", proof: "1x points" },
];

const INTERACTIVE_OPTIONS: Array<{
  mode: InteractiveMode;
  title: string;
  description: string;
}> = [
  { mode: "tap", title: "Tap-to-Rep", description: "Tap the big button, space, enter, or supported volume keys after each rep." },
  { mode: "audio", title: "Voice Assisted Mode", description: "Say each rep or make a clear breath/impact rhythm for the microphone." },
];

const PROOF_LABELS: Record<ProofSource, string> = {
  analyzer: "Camera proof • 4x",
  motion: "Motion proof • 4x",
  tempo: "Tempo proof",
  tap: "Tap proof • 2x",
  audio: "Audio proof • 2x",
  trust: "Trust proof • 1x",
};

function getProofSource(mode: TrackingMode, interactive: InteractiveMode): ProofSource {
  if (mode === "camera") return "analyzer";
  if (mode === "motion") return "motion";
  if (mode === "trust") return "trust";
  return interactive;
}

function getTrackingModeLabel(mode: TrackingMode, interactive: InteractiveMode) {
  if (mode === "interactive") {
    return INTERACTIVE_OPTIONS.find((item) => item.mode === interactive)?.title ?? "Interactive Mode";
  }
  return TRACKING_OPTIONS.find((item) => item.mode === mode)?.title ?? "Camera Mode";
}

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
  "For You",
  "High Points",
  "Beginner",
  "Strength",
  "Core",
  "Cardio",
  "Mobility",
  "No Equipment",
];

const WORKOUT_PRESETS: WorkoutPreset[] = [
  {
    id: "five-minute-burner",
    name: "The 5-Minute Burner",
    displayName: "The 5-Minute Burner",
    tagline: "Fast heat when you only have a pocket of time.",
    difficulty: "Beginner",
    durationMin: 5,
    goal: "Cardio spark",
    equipment: "No Equipment",
    muscles: ["Full body", "Core", "Legs"],
    calories: 55,
    compatibility: "Audio-first",
    thumbnail: "5M",
    pointsReward: 80,
    tags: ["Beginner", "5-10 min", "Cardio", "No Equipment"],
    recommended: true,
    completed: true,
    bestScore: 156,
    streak: 2,
    exercises: [
      { label: "Squats", exercise: "squat", sets: 1, reps: 12, restSeconds: 15, tracking: "camera" },
      { label: "Mountain Climbers", exercise: "mountainClimbers", sets: 1, reps: 20, restSeconds: 15, tracking: "camera" },
      { label: "Push-ups", exercise: "pushup", sets: 1, reps: 8, restSeconds: 15, tracking: "camera" },
      { label: "Plank", exercise: "plank", sets: 1, seconds: 30, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "core-lock",
    name: "Core Lock",
    displayName: "Core Lock",
    tagline: "Brace, hold, and build a steadier center.",
    difficulty: "Intermediate",
    durationMin: 12,
    goal: "Core stability",
    equipment: "No Equipment",
    muscles: ["Core", "Abs", "Shoulders"],
    calories: 95,
    compatibility: "Timer guided",
    thumbnail: "CL",
    pointsReward: 120,
    tags: ["15-20 min", "Core", "No Equipment", "High Points"],
    recommended: true,
    bestScore: 220,
    exercises: [
      { label: "Plank", exercise: "plank", sets: 3, seconds: 35, restSeconds: 20, tracking: "timer" },
      { label: "Mountain Climbers", exercise: "mountainClimbers", sets: 3, reps: 20, restSeconds: 20, tracking: "camera" },
      { label: "Shoulder Taps", exercise: "shoulderTaps", sets: 2, reps: 16, restSeconds: 20, tracking: "camera" },
      { label: "Leg Raises", exercise: "legRaise", sets: 2, reps: 10, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "push-up-rush",
    name: "Push-Up Rush",
    displayName: "Push-Up Rush",
    tagline: "Upper-body pressure with short rests.",
    difficulty: "Intermediate",
    durationMin: 10,
    goal: "Upper-body strength",
    equipment: "No Equipment",
    muscles: ["Chest", "Arms", "Core"],
    calories: 115,
    compatibility: "Audio-first",
    thumbnail: "PR",
    pointsReward: 110,
    tags: ["5-10 min", "Strength", "No Equipment"],
    streak: 1,
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 4, reps: 10, restSeconds: 20, tracking: "camera" },
      { label: "Plank Shoulder Taps", exercise: "shoulderTaps", sets: 3, reps: 16, restSeconds: 20, tracking: "camera" },
      { label: "Plank", exercise: "plank", sets: 2, seconds: 30, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "morning-ignition",
    name: "Morning Ignition",
    displayName: "Morning Ignition",
    tagline: "Wake up your joints and get moving clean.",
    difficulty: "Beginner",
    durationMin: 8,
    goal: "Mobility warm-up",
    equipment: "No Equipment",
    muscles: ["Mobility", "Legs", "Core"],
    calories: 65,
    compatibility: "Timer guided",
    thumbnail: "MI",
    pointsReward: 90,
    tags: ["Beginner", "5-10 min", "Mobility", "No Equipment"],
    recommended: true,
    exercises: [
      { label: "Standing March", exercise: "highKnees", sets: 2, reps: 20, restSeconds: 15, tracking: "camera" },
      { label: "Bodyweight Squats", exercise: "squat", sets: 2, reps: 10, restSeconds: 15, tracking: "camera" },
      { label: "Reverse Lunges", exercise: "reverseLunge", sets: 2, reps: 10, restSeconds: 15, tracking: "camera" },
      { label: "Calf Raises", exercise: "calfRaise", sets: 2, reps: 14, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "full-body-blitz",
    name: "Full-Body Blitz",
    displayName: "Full-Body Blitz",
    tagline: "A compact circuit that hits everything.",
    difficulty: "Advanced",
    durationMin: 20,
    goal: "Total-body power",
    equipment: "No Equipment",
    muscles: ["Full body", "Chest", "Legs", "Core"],
    calories: 230,
    compatibility: "Mixed tracking",
    thumbnail: "FB",
    pointsReward: 180,
    tags: ["15-20 min", "Strength", "Cardio", "No Equipment", "High Points"],
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 4, reps: 12, restSeconds: 30, tracking: "camera" },
      { label: "Squats", exercise: "squat", sets: 4, reps: 18, restSeconds: 25, tracking: "camera" },
      { label: "Burpees", exercise: "burpee", sets: 3, reps: 8, restSeconds: 35, tracking: "camera" },
      { label: "Mountain Climbers", exercise: "mountainClimbers", sets: 3, reps: 24, restSeconds: 30, tracking: "camera" },
      { label: "Plank", exercise: "plank", sets: 3, seconds: 45, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "iron-minute",
    name: "Iron Minute",
    displayName: "Iron Minute",
    tagline: "One-minute blocks for controlled strength.",
    difficulty: "Intermediate",
    durationMin: 16,
    goal: "Chest + Shoulders",
    equipment: "Dumbbells optional",
    muscles: ["Upper body", "Shoulders", "Arms"],
    calories: 150,
    compatibility: "High tracking",
    thumbnail: "IM",
    pointsReward: 140,
    tags: ["15-20 min", "Strength", "High Points"],
    exercises: [
      { label: "Bicep Curls", exercise: "bicepCurl", sets: 3, reps: 14, restSeconds: 25, tracking: "camera" },
      { label: "Overhead Press", exercise: "overheadPress", sets: 3, reps: 12, restSeconds: 25, tracking: "camera" },
      { label: "Push-ups", exercise: "pushup", sets: 3, reps: 12, restSeconds: 30, tracking: "camera" },
      { label: "Plank", exercise: "plank", sets: 2, seconds: 35, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "no-excuse-10",
    name: "No-Excuse 10",
    displayName: "No-Excuse 10",
    tagline: "Simple, sharp, and hard to skip.",
    difficulty: "Beginner",
    durationMin: 10,
    goal: "Foundation",
    equipment: "No Equipment",
    muscles: ["Full body", "Core"],
    calories: 85,
    compatibility: "Audio-first",
    thumbnail: "10",
    pointsReward: 100,
    tags: ["Beginner", "5-10 min", "Strength", "No Equipment"],
    exercises: [
      { label: "Squats", exercise: "squat", sets: 2, reps: 12, restSeconds: 20, tracking: "camera" },
      { label: "Push-ups", exercise: "pushup", sets: 2, reps: 8, restSeconds: 20, tracking: "camera" },
      { label: "Reverse Lunges", exercise: "reverseLunge", sets: 2, reps: 10, restSeconds: 20, tracking: "camera" },
      { label: "Plank", exercise: "plank", sets: 2, seconds: 30, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "upper-body-charge",
    name: "Upper Body Charge",
    displayName: "Upper Body Charge",
    tagline: "Build pressing strength and arm endurance.",
    difficulty: "Intermediate",
    durationMin: 16,
    goal: "Chest + Arms",
    equipment: "Dumbbells optional",
    muscles: ["Upper body", "Chest", "Arms"],
    calories: 140,
    compatibility: "High tracking",
    thumbnail: "UC",
    pointsReward: 135,
    tags: ["15-20 min", "Strength", "High Points"],
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 3, reps: 12, restSeconds: 30, tracking: "camera" },
      { label: "Bicep Curls", exercise: "bicepCurl", sets: 3, reps: 15, restSeconds: 30, tracking: "camera" },
      { label: "Pull-ups", exercise: "pullup", sets: 3, reps: 6, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "leg-day-lite",
    name: "Leg Day Lite",
    displayName: "Leg Day Lite",
    tagline: "Leg strength without wrecking tomorrow.",
    difficulty: "Beginner",
    durationMin: 14,
    goal: "Leg strength",
    equipment: "No Equipment",
    muscles: ["Lower body", "Legs"],
    calories: 130,
    compatibility: "Mixed tracking",
    thumbnail: "LL",
    pointsReward: 115,
    tags: ["Beginner", "15-20 min", "Strength", "No Equipment"],
    exercises: [
      { label: "Squats", exercise: "squat", sets: 4, reps: 15, restSeconds: 25, tracking: "camera" },
      { label: "Reverse Lunges", exercise: "reverseLunge", sets: 3, reps: 12, restSeconds: 25, tracking: "camera" },
      { label: "Wall Sit", exercise: "wallSit", sets: 2, seconds: 45, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "sweat-sprint",
    name: "Sweat Sprint",
    displayName: "Sweat Sprint",
    tagline: "Short cardio bursts with no room to drift.",
    difficulty: "Intermediate",
    durationMin: 15,
    goal: "Conditioning",
    equipment: "No Equipment",
    muscles: ["Cardio", "Core", "Legs"],
    calories: 190,
    compatibility: "Motion ready",
    thumbnail: "SS",
    pointsReward: 150,
    tags: ["15-20 min", "Cardio", "No Equipment", "High Points"],
    exercises: [
      { label: "Jumping Jacks", exercise: "jumpingJacks", sets: 3, reps: 30, restSeconds: 20, tracking: "camera" },
      { label: "High Knees", exercise: "highKnees", sets: 3, reps: 30, restSeconds: 20, tracking: "camera" },
      { label: "Burpees", exercise: "burpee", sets: 3, reps: 8, restSeconds: 25, tracking: "camera" },
      { label: "Mountain Climbers", exercise: "mountainClimbers", sets: 3, reps: 24, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "desk-escape",
    name: "Desk Escape",
    displayName: "Desk Escape",
    tagline: "Reset your posture and shake off stiffness.",
    difficulty: "Beginner",
    durationMin: 7,
    goal: "Mobility reset",
    equipment: "No Equipment",
    muscles: ["Mobility", "Core", "Legs"],
    calories: 45,
    compatibility: "Timer guided",
    thumbnail: "DE",
    pointsReward: 70,
    tags: ["Beginner", "5-10 min", "Mobility", "No Equipment"],
    exercises: [
      { label: "Bodyweight Squats", exercise: "squat", sets: 2, reps: 10, restSeconds: 15, tracking: "camera" },
      { label: "Standing March", exercise: "highKnees", sets: 2, reps: 20, restSeconds: 15, tracking: "camera" },
      { label: "Calf Raises", exercise: "calfRaise", sets: 2, reps: 14, restSeconds: 0, tracking: "camera" },
    ],
  },
  {
    id: "final-rep",
    name: "Final Rep",
    displayName: "Final Rep",
    tagline: "A tougher finish for days you want the extra badge.",
    difficulty: "Intermediate",
    durationMin: 18,
    goal: "Strength endurance",
    equipment: "No Equipment",
    muscles: ["Full body", "Chest", "Core"],
    calories: 220,
    compatibility: "Mixed tracking",
    thumbnail: "FR",
    pointsReward: 200,
    tags: ["15-20 min", "Strength", "Cardio", "No Equipment", "High Points"],
    exercises: [
      { label: "Push-ups", exercise: "pushup", sets: 4, reps: 12, restSeconds: 25, tracking: "camera" },
      { label: "Squats", exercise: "squat", sets: 4, reps: 18, restSeconds: 25, tracking: "camera" },
      { label: "Burpees", exercise: "burpee", sets: 3, reps: 8, restSeconds: 25, tracking: "camera" },
      { label: "Plank", exercise: "plank", sets: 3, seconds: 45, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "beginner-boost",
    name: "Beginner Boost",
    displayName: "Beginner Boost",
    tagline: "A confidence-building starter challenge.",
    difficulty: "Beginner",
    durationMin: 10,
    goal: "Foundation",
    equipment: "No Equipment",
    muscles: ["Full body"],
    calories: 80,
    compatibility: "Audio-first",
    thumbnail: "BB",
    pointsReward: 95,
    tags: ["Beginner", "5-10 min", "Strength", "No Equipment"],
    exercises: [
      { label: "Squats", exercise: "squat", sets: 2, reps: 10, restSeconds: 25, tracking: "camera" },
      { label: "Push-ups", exercise: "pushup", sets: 2, reps: 8, restSeconds: 25, tracking: "camera" },
      { label: "Plank", exercise: "plank", sets: 2, seconds: 25, restSeconds: 0, tracking: "timer" },
    ],
  },
  {
    id: "blue-flow",
    name: "Blue Flow",
    displayName: "Blue Flow",
    tagline: "Calm control, smooth reps, clean breathing.",
    difficulty: "Beginner",
    durationMin: 12,
    goal: "Control + mobility",
    equipment: "No Equipment",
    muscles: ["Mobility", "Core", "Legs"],
    calories: 75,
    compatibility: "Timer guided",
    thumbnail: "BF",
    pointsReward: 105,
    tags: ["Beginner", "15-20 min", "Mobility", "Core", "No Equipment"],
    exercises: [
      { label: "Glute Bridges", exercise: "gluteBridge", sets: 3, reps: 12, restSeconds: 20, tracking: "camera" },
      { label: "Side Plank", exercise: "sidePlank", sets: 2, seconds: 25, restSeconds: 20, tracking: "timer" },
      { label: "Calf Raises", exercise: "calfRaise", sets: 3, reps: 14, restSeconds: 0, tracking: "camera" },
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
  squat: [11, 12, 23, 24, 25, 26, 27, 28],
  pushup: [11, 12, 13, 14, 15, 16, 23, 24],
  plank: [11, 12, 23, 24, 27, 28],
  gluteBridge: [11, 12, 23, 24, 25, 26],
  reverseLunge: [11, 12, 23, 24, 25, 26, 27, 28],
  forwardLunge: [11, 12, 23, 24, 25, 26, 27, 28],
  jumpingJacks: [11, 12, 15, 16, 23, 24, 27, 28],
  highKnees: [23, 24, 25, 26, 27, 28],
  mountainClimbers: [11, 12, 23, 24, 25, 26, 27, 28],
  crunch: [11, 12, 23, 24, 25, 26],
  situp: [11, 12, 23, 24, 25, 26],
  burpee: [11, 12, 15, 16, 23, 24, 25, 26, 27, 28],
  calfRaise: [27, 28, 29, 30, 31, 32],
  wallSit: [11, 12, 23, 24, 25, 26, 27, 28],
  sidePlank: [11, 12, 23, 24, 27, 28],
  legRaise: [11, 12, 23, 24, 27, 28],
  shoulderTaps: [11, 12, 15, 16, 23, 24],
  squatJump: [11, 12, 15, 16, 23, 24, 25, 26, 27, 28],
  bicepCurl: [11, 12, 13, 14, 15, 16],
  overheadPress: [11, 12, 13, 14, 15, 16],
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
const CDN_VERSION = "0.10.22-rc.20250304";
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CDN_VERSION}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

function getWorkoutCoachVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    "microsoft david",
    "microsoft guy",
    "google uk english male",
    "google us english male",
    "daniel",
    "alex",
    "english male",
    "male",
  ];
  return (
    preferred
      .map((needle) => voices.find((voice) => voice.name.toLowerCase().includes(needle)))
      .find(Boolean) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en") && /david|guy|daniel|alex|male/i.test(voice.name)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

function buildWorkoutUtterance(message: string) {
  const utterance = new SpeechSynthesisUtterance(message);
  const voice = getWorkoutCoachVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  utterance.pitch = 0.72;
  utterance.volume = 1;
  return utterance;
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

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function progressFromRange(value: number, start: number, end: number) {
  if (start === end) return 0;
  return clamp(((value - start) / (end - start)) * 100);
}

function centerOf(points: Array<Landmark | undefined>) {
  const visible = points.filter((point): point is Landmark => isVisible(point));
  if (!visible.length) return null;
  return {
    x: visible.reduce((sum, point) => sum + point.x, 0) / visible.length,
    y: visible.reduce((sum, point) => sum + point.y, 0) / visible.length,
  };
}

function distance(a: Landmark | { x: number; y: number } | null, b: Landmark | { x: number; y: number } | null) {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getRepProgress(exercise: ExerciseKey, angle: number | null, phase: RepPhase, fallbackProgress = 0) {
  if (fallbackProgress > 0) return clamp(fallbackProgress);
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

function formatPresetPreview(exercise: PresetExercise) {
  const label = exercise.label.replace("Mountain Climbers", "Climbers");
  if (exercise.reps) return `${exercise.reps} ${label}`;
  return `${exercise.seconds ?? 30}s ${label}`;
}

function getPresetTrackingModes(preset: WorkoutPreset) {
  const hasMotion = preset.exercises.some((item) => item.exercise && TRACKING_PROFILES[item.exercise].motion);
  const modes = ["Audio Coach"];
  if (hasMotion) modes.push("Motion");
  if (preset.exercises.some((item) => item.exercise)) modes.push("Camera");
  modes.push("Simple");
  return Array.from(new Set(modes));
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
      repProgress: 0,
      phaseStartedAt: null,
      feedback: "Step into frame so your full body is visible.",
      quality: "warning",
    };
  }

  const now = performance.now();
  const cooldownReady = now - lastCountAt > 520;
  const holdReady = previous.phase === "hold" && previous.phaseStartedAt != null && now - previous.phaseStartedAt > 5000;
  let repCount = previous.repCount;
  let phase = previous.phase;
  let angle: number | null = null;
  let repProgress = 0;
  let resetPhaseTimer = false;
  let confidence = 0;
  let feedback = "Tracking. Move through a full range.";
  let quality: AnalyzerMetrics["quality"] = "tracking";
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
  const leftHeel = landmarks[29];
  const rightHeel = landmarks[30];
  const leftToe = landmarks[31];
  const rightToe = landmarks[32];
  const nose = landmarks[0];

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
      repProgress = getRepProgress(exercise, angle, phase);
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
      repProgress = getRepProgress(exercise, angle, phase);
    } else {
      repProgress = getRepProgress(exercise, angle, phase);
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
      repProgress = getRepProgress(exercise, angle, phase);
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
      repProgress = getRepProgress(exercise, angle, phase);
    } else {
      repProgress = getRepProgress(exercise, angle, phase);
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
      repProgress = getRepProgress(exercise, angle, phase);
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
      repProgress = getRepProgress(exercise, angle, phase);
    } else {
      repProgress = getRepProgress(exercise, angle, phase);
      feedback = angle < 138 ? "Drive knees out and rise." : "Sink lower for a full rep.";
    }
  }

  if (exercise === "reverseLunge" || exercise === "forwardLunge") {
    const leftAngle =
      isVisible(leftHip) && isVisible(leftKnee) && isVisible(leftAnkle)
        ? angleBetween(leftHip, leftKnee, leftAnkle)
        : null;
    const rightAngle =
      isVisible(rightHip) && isVisible(rightKnee) && isVisible(rightAnkle)
        ? angleBetween(rightHip, rightKnee, rightAnkle)
        : null;
    angle = Math.min(leftAngle ?? 180, rightAngle ?? 180);
    confidence = averageVisibility([leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle]);
    repProgress = angle == null ? 0 : progressFromRange(angle, 165, 96);
    if (!leftAngle && !rightAngle) {
      feedback = "Keep both hips, knees, and ankles visible for lunge tracking.";
      quality = "warning";
    } else if (angle < 108) {
      phase = "bottom";
      feedback = "Lunge depth reached. Push back to standing.";
      quality = "good";
    } else if (angle > 152) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Stand tall between lunges.";
        quality = "good";
      } else {
        feedback = "Standing position. Step into the next lunge.";
      }
      phase = "top";
    } else {
      feedback = "Lower until the front knee bends clearly, then stand tall.";
    }
  }

  if (exercise === "gluteBridge") {
    const [shoulder, hip, knee] = chooseSideWithExtras(landmarks, [11, 23, 25], [12, 24, 26]);
    angle = isVisible(shoulder) && isVisible(hip) && isVisible(knee) ? angleBetween(shoulder, hip, knee) : null;
    confidence = angle == null ? 0 : averageVisibility([shoulder, hip, knee]);
    repProgress = angle == null ? 0 : progressFromRange(angle, 100, 165);
    if (!angle) {
      feedback = "Use a side view so shoulders, hips, and knees stay visible.";
      quality = "warning";
    } else if (angle < 122) {
      phase = "bottom";
      feedback = "Hips lowered. Drive through the heels.";
    } else if (angle > 154) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Strong bridge lockout.";
        quality = "good";
      } else {
        feedback = "Top position. Squeeze, then lower with control.";
        quality = "good";
      }
      phase = "top";
    } else {
      feedback = "Lift hips until shoulders, hips, and knees line up.";
    }
  }

  if (exercise === "overheadPress") {
    const [shoulder, elbow, wrist] = chooseSide(landmarks, [11, 13, 15], [12, 14, 16]);
    angle = isVisible(shoulder) && isVisible(elbow) && isVisible(wrist) ? angleBetween(shoulder, elbow, wrist) : null;
    confidence = angle == null ? 0 : averageVisibility([shoulder, elbow, wrist]);
    const overhead = isVisible(wrist) && isVisible(shoulder) && wrist.y < shoulder.y - 0.12;
    repProgress = angle == null ? 0 : Math.max(progressFromRange(angle, 82, 164), overhead ? 94 : 0);
    if (!angle) {
      feedback = "Keep shoulder, elbow, and wrist visible.";
      quality = "warning";
    } else if (angle < 105 && !overhead) {
      phase = "bottom";
      feedback = "Rack position. Press overhead.";
    } else if (angle > 150 && overhead) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Full overhead lockout.";
        quality = "good";
      } else {
        feedback = "Overhead. Lower to shoulder height.";
        quality = "good";
      }
      phase = "top";
    } else {
      feedback = "Press until the wrist finishes above the shoulder.";
    }
  }

  if (exercise === "pullup") {
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
      repProgress = getRepProgress(exercise, angle, phase);
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
      repProgress = getRepProgress(exercise, angle, phase);
    } else {
      repProgress = getRepProgress(exercise, angle, phase);
      feedback = shoulderY - wristY > 0.12 ? "Pull higher toward the bar." : "Lower fully before the next rep.";
    }
  }

  if (exercise === "jumpingJacks") {
    const shoulderWidth = distance(leftShoulder, rightShoulder) ?? 0;
    const hipWidth = distance(leftHip, rightHip) ?? shoulderWidth * 0.8;
    const ankleWidth = distance(leftAnkle, rightAnkle) ?? 0;
    const wristsOverShoulders =
      isVisible(leftWrist) &&
      isVisible(rightWrist) &&
      isVisible(leftShoulder) &&
      isVisible(rightShoulder) &&
      leftWrist.y < leftShoulder.y &&
      rightWrist.y < rightShoulder.y;
    const legsOpen = hipWidth > 0 && ankleWidth > hipWidth * 1.45;
    const armsDown = isVisible(leftWrist) && isVisible(rightWrist) && isVisible(leftHip) && isVisible(rightHip) && leftWrist.y > leftHip.y && rightWrist.y > rightHip.y;
    confidence = averageVisibility([leftWrist, rightWrist, leftShoulder, rightShoulder, leftHip, rightHip, leftAnkle, rightAnkle]);
    repProgress = Math.max(wristsOverShoulders ? 92 : 35, progressFromRange(ankleWidth, hipWidth, hipWidth * 1.65));
    angle = Math.round(repProgress);
    if (confidence < 0.45 || !shoulderWidth || !hipWidth) {
      feedback = "Face the camera and keep wrists, shoulders, hips, and ankles visible.";
      quality = "warning";
    } else if (wristsOverShoulders && legsOpen) {
      if (previous.phase === "closed" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Good open position.";
        quality = "good";
      } else {
        feedback = "Open position. Snap back closed.";
        quality = "good";
      }
      phase = "open";
    } else if (armsDown && ankleWidth < hipWidth * 1.15) {
      phase = "closed";
      repProgress = 8;
      feedback = "Closed position. Jump open.";
    } else {
      feedback = "Open arms overhead and jump feet wider.";
    }
  }

  if (exercise === "highKnees") {
    const leftLift = isVisible(leftHip) && isVisible(leftKnee) ? leftHip.y - leftKnee.y : null;
    const rightLift = isVisible(rightHip) && isVisible(rightKnee) ? rightHip.y - rightKnee.y : null;
    const lift = Math.max(leftLift ?? -1, rightLift ?? -1);
    confidence = averageVisibility([leftHip, rightHip, leftKnee, rightKnee]);
    repProgress = progressFromRange(lift, -0.02, 0.16);
    angle = Math.round(repProgress);
    if (confidence < 0.45) {
      feedback = "Keep hips and knees visible.";
      quality = "warning";
    } else if (lift > 0.12) {
      if (previous.phase === "down" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Knee drove high.";
        quality = "good";
      } else {
        feedback = "Knee up. Switch legs fast.";
        quality = "good";
      }
      phase = "up";
    } else if (lift < 0.04) {
      phase = "down";
      feedback = "Drive one knee above hip height.";
    } else {
      feedback = "Lift the knee higher.";
    }
  }

  if (exercise === "mountainClimbers") {
    const leftGap = isVisible(leftKnee) && isVisible(leftHip) ? Math.hypot(leftKnee.x - leftHip.x, leftKnee.y - leftHip.y) : null;
    const rightGap = isVisible(rightKnee) && isVisible(rightHip) ? Math.hypot(rightKnee.x - rightHip.x, rightKnee.y - rightHip.y) : null;
    const gap = Math.min(leftGap ?? 1, rightGap ?? 1);
    confidence = averageVisibility([leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle]);
    repProgress = progressFromRange(gap, 0.34, 0.12);
    angle = Math.round(repProgress);
    if (confidence < 0.45) {
      feedback = "Use a side view and keep plank line plus knees visible.";
      quality = "warning";
    } else if (gap < 0.16) {
      if (previous.phase === "top" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Knee drove in.";
        quality = "good";
      } else {
        feedback = "Knee in. Switch legs.";
        quality = "good";
      }
      phase = "bottom";
    } else if (gap > 0.26) {
      phase = "top";
      feedback = "Plank reset. Drive the next knee in.";
    } else {
      feedback = "Drive the knee closer to your chest.";
    }
  }

  if (exercise === "crunch" || exercise === "situp") {
    const [shoulder, hip, knee] = chooseSideWithExtras(landmarks, [11, 23, 25], [12, 24, 26]);
    angle = isVisible(shoulder) && isVisible(hip) && isVisible(knee) ? angleBetween(shoulder, hip, knee) : null;
    confidence = angle == null ? 0 : averageVisibility([shoulder, hip, knee]);
    const topThreshold = exercise === "situp" ? 76 : 96;
    repProgress = angle == null ? 0 : progressFromRange(angle, 134, topThreshold);
    if (!angle) {
      feedback = "Use a side view so shoulders, hips, and knees stay visible.";
      quality = "warning";
    } else if (angle > 126) {
      phase = "bottom";
      feedback = "Shoulders down. Brace and curl up.";
    } else if (angle < topThreshold) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Controlled core contraction.";
        quality = "good";
      } else {
        feedback = "Top position. Lower slowly.";
        quality = "good";
      }
      phase = "top";
    } else {
      feedback = exercise === "situp" ? "Sit taller toward the knees." : "Lift shoulders higher.";
    }
  }

  if (exercise === "legRaise") {
    const hipCenter = centerOf([leftHip, rightHip]);
    const ankleCenter = centerOf([leftAnkle, rightAnkle]);
    const shoulderCenter = centerOf([leftShoulder, rightShoulder]);
    const lift = hipCenter && ankleCenter ? hipCenter.y - ankleCenter.y : null;
    confidence = averageVisibility([leftHip, rightHip, leftAnkle, rightAnkle, leftShoulder, rightShoulder]);
    repProgress = lift == null ? 0 : progressFromRange(lift, -0.12, 0.22);
    angle = Math.round(repProgress);
    if (lift == null || !shoulderCenter) {
      feedback = "Keep shoulders, hips, knees, and ankles visible from the side.";
      quality = "warning";
    } else if (lift < -0.04) {
      phase = "bottom";
      feedback = "Legs lowered. Lift with control.";
    } else if (lift > 0.16) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Legs raised with control.";
        quality = "good";
      } else {
        feedback = "Top position. Lower slowly.";
        quality = "good";
      }
      phase = "top";
    } else {
      feedback = "Lift legs higher without losing control.";
    }
  }

  if (exercise === "calfRaise") {
    const [ankle, heel, toe] = chooseSideWithExtras(landmarks, [27, 29, 31], [28, 30, 32]);
    const raise = isVisible(heel) && isVisible(toe) ? toe.y - heel.y : null;
    confidence = averageVisibility([ankle, heel, toe]);
    repProgress = raise == null ? 0 : progressFromRange(raise, -0.01, 0.045);
    angle = Math.round(repProgress);
    if (raise == null) {
      feedback = "Keep ankle, heel, and toe visible from the side.";
      quality = "warning";
    } else if (raise < 0.01) {
      phase = "bottom";
      feedback = "Heels lowered. Rise onto the toes.";
    } else if (raise > 0.035) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Full calf raise.";
        quality = "good";
      } else {
        feedback = "Top position. Lower the heels.";
        quality = "good";
      }
      phase = "top";
    } else {
      feedback = "Rise higher onto the balls of your feet.";
    }
  }

  if (exercise === "shoulderTaps") {
    const shoulderCenter = centerOf([leftShoulder, rightShoulder]);
    const leftTap = shoulderCenter && isVisible(leftWrist) && isVisible(rightShoulder) && leftWrist.x > shoulderCenter.x && distance(leftWrist, rightShoulder)! < 0.18;
    const rightTap = shoulderCenter && isVisible(rightWrist) && isVisible(leftShoulder) && rightWrist.x < shoulderCenter.x && distance(rightWrist, leftShoulder)! < 0.18;
    const bothDown = isVisible(leftWrist) && isVisible(rightWrist) && isVisible(leftShoulder) && isVisible(rightShoulder) && leftWrist.y > leftShoulder.y + 0.12 && rightWrist.y > rightShoulder.y + 0.12;
    confidence = averageVisibility([leftShoulder, rightShoulder, leftWrist, rightWrist, leftHip, rightHip]);
    repProgress = leftTap || rightTap ? 96 : bothDown ? 8 : 55;
    angle = Math.round(repProgress);
    if (confidence < 0.45 || !shoulderCenter) {
      feedback = "Face the camera in plank and keep shoulders and wrists visible.";
      quality = "warning";
    } else if (leftTap || rightTap) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Shoulder tap landed.";
        quality = "good";
      } else {
        feedback = "Tap position. Return hand to floor.";
        quality = "good";
      }
      phase = "top";
    } else if (bothDown) {
      phase = "bottom";
      feedback = "Hands planted. Tap the opposite shoulder.";
    } else {
      feedback = "Reach farther across to the opposite shoulder.";
    }
  }

  if (exercise === "squatJump" || exercise === "burpee") {
    const [hip, knee, ankle, shoulder] = chooseSideWithExtras(landmarks, [23, 25, 27, 11], [24, 26, 28, 12]);
    angle = isVisible(hip) && isVisible(knee) && isVisible(ankle) ? angleBetween(hip, knee, ankle) : null;
    const wristCenter = centerOf([leftWrist, rightWrist]);
    const shoulderCenter = centerOf([leftShoulder, rightShoulder]);
    const jumpReach = wristCenter && shoulderCenter ? shoulderCenter.y - wristCenter.y : 0;
    confidence = angle == null ? 0 : averageVisibility([hip, knee, ankle, shoulder, leftWrist, rightWrist]);
    repProgress = angle == null ? 0 : Math.max(progressFromRange(angle, 155, 105), jumpReach > 0.12 ? 96 : 0);
    if (!angle) {
      feedback = "Keep your full body visible for the jump pattern.";
      quality = "warning";
    } else if (angle < 116) {
      phase = "bottom";
      feedback = exercise === "burpee" ? "Floor/squat phase reached. Pop up and jump." : "Squat depth reached. Jump tall.";
    } else if (angle > 142 && jumpReach > 0.08) {
      if (previous.phase === "bottom" && cooldownReady) {
        repCount += 1;
        feedback = "Rep counted. Explosive finish.";
        quality = "good";
      } else {
        feedback = "Tall finish. Land soft and reset.";
        quality = "good";
      }
      phase = "top";
    } else {
      feedback = exercise === "burpee" ? "Move from floor phase to a tall jump." : "Jump and reach after the squat.";
    }
  }

  if (exercise === "plank" || exercise === "sidePlank") {
    const [shoulder, hip, ankle] = chooseSideWithExtras(landmarks, [11, 23, 27], [12, 24, 28]);
    angle = isVisible(shoulder) && isVisible(hip) && isVisible(ankle) ? angleBetween(shoulder, hip, ankle) : null;
    confidence = angle == null ? 0 : averageVisibility([shoulder, hip, ankle]);
    const deviation = angle == null ? 90 : Math.abs(180 - angle);
    repProgress = clamp(100 - deviation * 4);
    if (!angle) {
      feedback = "Keep shoulder, hip, and ankle visible in one line.";
      quality = "warning";
    } else if (deviation < 13) {
      phase = "hold";
      if (previous.phase === "hold" && holdReady) {
        repCount += 1;
        resetPhaseTimer = true;
        feedback = "Hold rep counted. Strong plank line.";
        quality = "good";
      } else {
        feedback = "Good hold. Keep ribs and hips steady.";
        quality = "good";
      }
    } else {
      phase = "ready";
      feedback = "Straighten the body line from shoulder through ankle.";
      quality = "warning";
    }
  }

  if (exercise === "wallSit") {
    const [hip, knee, ankle, shoulder] = chooseSideWithExtras(landmarks, [23, 25, 27, 11], [24, 26, 28, 12]);
    angle = isVisible(hip) && isVisible(knee) && isVisible(ankle) ? angleBetween(hip, knee, ankle) : null;
    confidence = angle == null ? 0 : averageVisibility([hip, knee, ankle, shoulder]);
    const depthScore = angle == null ? 0 : 100 - Math.abs(angle - 95) * 3;
    repProgress = clamp(depthScore);
    if (!angle) {
      feedback = "Use a side view with hips, knees, and ankles visible.";
      quality = "warning";
    } else if (angle >= 82 && angle <= 112) {
      phase = "hold";
      if (previous.phase === "hold" && holdReady) {
        repCount += 1;
        resetPhaseTimer = true;
        feedback = "Hold rep counted. Wall sit depth is solid.";
        quality = "good";
      } else {
        feedback = "Good wall sit depth. Hold steady.";
        quality = "good";
      }
    } else {
      phase = "ready";
      feedback = angle > 112 ? "Sit lower until knees are close to ninety degrees." : "Raise slightly to protect the knees.";
      quality = "warning";
    }
  }

  return {
    repCount,
    phase,
    confidence: Math.round(confidence * 100),
    angle: angle == null ? null : Math.round(angle),
    repProgress: repCount > previous.repCount ? 100 : Math.round(clamp(repProgress || getRepProgress(exercise, angle, phase))),
    phaseStartedAt: resetPhaseTimer ? now : previous.phase === phase ? previous.phaseStartedAt ?? now : now,
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

export function WorkoutAnalyzerMode({ experience = "combined" }: WorkoutAnalyzerModeProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const utils = trpc.useUtils();
  const isCombinedExperience = experience === "combined";
  const isProgramsExperience = experience === "programs";
  const analyzerShellRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const animationRef = useRef<number | null>(null);
  const exerciseRef = useRef<ExerciseKey>("pushup");
  const programRef = useRef<ProgramKey>("custom");
  const routinePhaseRef = useRef<RoutinePhase>("idle");
  const routineStepIndexRef = useRef(0);
  const setStartRepRef = useRef(0);
  const statusRef = useRef<AnalyzerStatus>("idle");
  const lastVideoTimeRef = useRef(-1);
  const lastCountAtRef = useRef(0);
  const lastSpokenRef = useRef("");
  const speechQueueRef = useRef<string[]>([]);
  const speechActiveRef = useRef(false);
  const lastGuidanceAtRef = useRef(0);
  const lastGuidanceMessageRef = useRef("");
  const halfwayMotivationKeyRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const smoothedLandmarksRef = useRef<Landmark[] | null>(null);
  const repFlashTimeoutRef = useRef<number | null>(null);
  const weakCameraStartedAtRef = useRef<number | null>(null);
  const motionLastRepAtRef = useRef(0);
  const motionBaselineRef = useRef<number | null>(null);
  const audioLastRepAtRef = useRef(0);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const audioContextModeRef = useRef<AudioContext | null>(null);
  const cueTimeoutRef = useRef<number | null>(null);
  const timedEndsAtRef = useRef<number | null>(null);
  const trackingModeRef = useRef<TrackingMode>("trust");
  const interactiveModeRef = useRef<InteractiveMode>("audio");
  const repTimestampsRef = useRef<number[]>([]);
  const rangeSamplesRef = useRef<number[]>([]);
  const confidenceSamplesRef = useRef<number[]>([]);
  const pauseSamplesRef = useRef<number[]>([]);
  const audioFatigueRef = useRef(0);
  const coachExtraRepsRef = useRef<number | null>(null);
  const finalRepPromptKeyRef = useRef<string | null>(null);
  const metricsRef = useRef<AnalyzerMetrics>({
    repCount: 0,
    phase: "ready",
    confidence: 0,
    angle: null,
    repProgress: 0,
    phaseStartedAt: null,
    feedback: "Start the camera, choose an exercise, then begin.",
    quality: "idle",
  });

  const [exercise, setExercise] = useState<ExerciseKey>("pushup");
  const [program, setProgram] = useState<ProgramKey>("custom");
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
  const [workoutFlowStep, setWorkoutFlowStep] = useState<WorkoutFlowStep>(
    isCombinedExperience ? "activity" : "setup"
  );
  const [activeTab, setActiveTab] = useState<AnalyzerTab>(
    isProgramsExperience ? "programs" : "quick"
  );
  const [selectedPreset, setSelectedPreset] = useState<WorkoutPreset | null>(null);
  const [activePreset, setActivePreset] = useState<WorkoutPreset | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("All Programs");
  const [showSettings, setShowSettings] = useState(false);
  const [showExerciseMenu, setShowExerciseMenu] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [showPoseOverlay, setShowPoseOverlay] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("trust");
  const [interactiveMode, setInteractiveMode] = useState<InteractiveMode>("audio");
  const [showTrackingPicker, setShowTrackingPicker] = useState(false);
  const [weakCameraPrompt, setWeakCameraPrompt] = useState(false);
  const [coachSuggestion, setCoachSuggestion] = useState<CoachSuggestion | null>(null);
  const [coachListening, setCoachListening] = useState(false);
  const [spokenCue, setSpokenCue] = useState("");
  const [tapPulse, setTapPulse] = useState(0);
  const [motionEnergy, setMotionEnergy] = useState(0.22);
  const [recentSets, setRecentSets] = useState<SetSummary[]>([]);
  const [lastSetSummary, setLastSetSummary] = useState<SetSummary | null>(null);
  const [timedRemaining, setTimedRemaining] = useState<number | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const shouldRestartCameraRef = useRef(false);
  const [favoritePresetIds, setFavoritePresetIds] = useState<Set<string>>(new Set(["core-lock"]));
  const [savedPresetIds, setSavedPresetIds] = useState<Set<string>>(new Set(["beginner-boost"]));
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [rewardPopup, setRewardPopup] = useState<RewardPopup | null>(null);

  const taskId = searchParams.get("taskId");
  const requestedExercise = searchParams.get("exercise");
  const requestedTracking = searchParams.get("tracking");
  const requestedMuscle = searchParams.get("muscle") ?? undefined;
  const requestedExerciseName = searchParams.get("exerciseName")?.trim() ?? "";
  const taskExercise = EXERCISES.some((item) => item.key === requestedExercise)
    ? (requestedExercise as ExerciseKey)
    : null;
  const requestedTarget = Number(searchParams.get("target"));
  const taskTarget = Number.isFinite(requestedTarget) && requestedTarget > 0 ? Math.round(requestedTarget) : null;
  const isTaskMode = Boolean(taskId && taskExercise && taskTarget);
  const completeTask = trpc.tasks.completeTask.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setRewardPopup({
        title: data.levelUp ? `Rank up: ${data.rankAfter.title}` : "Congratulations",
        message: data.levelUp ? "Your rank emblem has been upgraded." : "Task complete. Points added to your total.",
        points: data.pointsAwarded,
        totalPoints: data.points,
        rankTitle: data.rankAfter.title,
      });
      void utils.tasks.getMyStats.invalidate();
      void utils.tasks.getLeaderboard.invalidate();
    },
    onError: (error) => {
      setTaskCompleted(false);
      toast.error(error.message);
    },
  });
  const completeWorkoutSet = trpc.tasks.completeWorkoutSet.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setRewardPopup({
        title: "Congratulations",
        message: "Exercise complete. Points added.",
        points: data.points,
      });
      void utils.tasks.getMyStats.invalidate();
      void utils.tasks.getLeaderboard.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (isCombinedExperience) return;
    setWorkoutFlowStep("setup");
    setActiveTab(isProgramsExperience ? "programs" : "quick");
    if (!isProgramsExperience) {
      setActivePreset(null);
      setProgram("custom");
      programRef.current = "custom";
    }
  }, [isCombinedExperience, isProgramsExperience]);

  useEffect(() => {
    exerciseRef.current = exercise;
  }, [exercise]);

  useEffect(() => {
    if (!isTaskMode || !taskExercise || !taskTarget) return;
    setWorkoutFlowStep("setup");
    setActiveTab(isProgramsExperience ? "programs" : "quick");
    setActivePreset(null);
    setProgram("free");
    programRef.current = "free";
    setExercise(taskExercise);
    exerciseRef.current = taskExercise;
    setCustomReps(taskTarget);
    setCustomSets(1);
    setCustomRestSeconds(0);
    metricsRef.current = {
      ...metricsRef.current,
      feedback: `Task started: complete ${taskTarget} ${getExerciseLabel(taskExercise)} reps.`,
      quality: streamRef.current ? "tracking" : "idle",
    };
    setMetrics(metricsRef.current);
  }, [isTaskMode, taskExercise, taskTarget]);

  useEffect(() => {
    if (isTaskMode || !taskExercise) return;
    setWorkoutFlowStep("setup");
    setActiveTab(isProgramsExperience ? "programs" : "quick");
    setActivePreset(null);
    setProgram("custom");
    programRef.current = "custom";
    setExercise(taskExercise);
    exerciseRef.current = taskExercise;
    if (requestedTracking === "manual") {
      setTrackingMode("trust");
      trackingModeRef.current = "trust";
      stopCamera();
      setStatus("ready");
      metricsRef.current = {
        ...metricsRef.current,
        confidence: 55,
        feedback: "Manual Mode selected. Press Start set when ready.",
        quality: "tracking",
      };
      setMetrics(metricsRef.current);
      return;
    }
    if (requestedTracking === "audio") {
      setTrackingMode("interactive");
      trackingModeRef.current = "interactive";
      setInteractiveMode("audio");
      interactiveModeRef.current = "audio";
      stopCamera();
      setStatus("ready");
      metricsRef.current = {
        ...metricsRef.current,
        confidence: 70,
        feedback: "Voice Assisted Mode selected. Press Start set when ready.",
        quality: "tracking",
      };
      setMetrics(metricsRef.current);
    }
  }, [isTaskMode, requestedTracking, taskExercise]);

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

  useEffect(() => {
    trackingModeRef.current = trackingMode;
  }, [trackingMode]);

  useEffect(() => {
    interactiveModeRef.current = interactiveMode;
  }, [interactiveMode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === analyzerShellRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const selectedExercise = useMemo(
    () => EXERCISES.find((item) => item.key === exercise) ?? EXERCISES[0],
    [exercise]
  );
  const manualExerciseLaunch = !isTaskMode && taskExercise != null && requestedTracking === "manual";
  const selectedExerciseLabel = manualExerciseLaunch && requestedExerciseName ? requestedExerciseName : selectedExercise.label;
  const filteredExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    if (!query) return EXERCISES;
    return EXERCISES.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.hint.toLowerCase().includes(query) ||
        item.target.toLowerCase().includes(query)
    );
  }, [exerciseSearch]);

  const selectedProgram = useMemo(() => getProgram(program), [program]);
  const isTimedExercise = TIMED_EXERCISES.has(exercise);
  const customRoutineSteps = useMemo<RoutineStep[]>(() => {
    const steps: RoutineStep[] = [];
    for (let setIndex = 0; setIndex < customSets; setIndex += 1) {
      if (TIMED_EXERCISES.has(exercise)) {
        steps.push({ type: "timed", exercise, label: selectedExerciseLabel, seconds: customReps });
      } else {
        steps.push({ type: "work", exercise, label: selectedExerciseLabel, reps: customReps });
      }
      if (setIndex < customSets - 1 && customRestSeconds > 0) {
        steps.push({ type: "rest", seconds: customRestSeconds });
      }
    }
    return steps;
  }, [customReps, customRestSeconds, customSets, exercise, selectedExerciseLabel]);
  const presetRoutineSteps = useMemo(
    () => (activePreset ? buildPresetSteps(activePreset) : []),
    [activePreset]
  );
  const activeRoutineSteps = activePreset ? presetRoutineSteps : customRoutineSteps;
  const filteredPresets = useMemo(() => {
    if (activeFilter === "All Programs") return WORKOUT_PRESETS;
    if (activeFilter === "For You") return WORKOUT_PRESETS.filter((preset) => preset.recommended);
    return WORKOUT_PRESETS.filter((preset) => {
      const tags = [preset.difficulty, preset.equipment, preset.goal, ...preset.muscles, ...preset.tags].map((tag) =>
        tag.toLowerCase()
      );
      if (activeFilter === "High Points") return preset.pointsReward >= 120;
      return tags.includes(activeFilter.toLowerCase());
    });
  }, [activeFilter]);
  const recommendedPresets = WORKOUT_PRESETS.filter((preset) => preset.recommended).slice(0, 3);

  const speak = useCallback(
    (message: string, priority = false) => {
      if (!voiceEnabled || typeof window === "undefined") return;
      const normalizedMessage = message.trim();
      if (!normalizedMessage) return;
      if (priority && "speechSynthesis" in window) {
        speechQueueRef.current = [];
        speechActiveRef.current = false;
        window.speechSynthesis.cancel();
      }
      if (speechQueueRef.current.at(-1) === normalizedMessage) return;
      lastSpokenRef.current = normalizedMessage;
      speechQueueRef.current.push(normalizedMessage);
      if (speechQueueRef.current.length > 5) {
        speechQueueRef.current = speechQueueRef.current.slice(-5);
      }
      const speakNext = () => {
        if (speechActiveRef.current) return;
        const nextMessage = speechQueueRef.current.shift();
        if (!nextMessage || !("speechSynthesis" in window)) return;
        speechActiveRef.current = true;
        const utterance = buildWorkoutUtterance(nextMessage);
        utterance.onend = () => {
          speechActiveRef.current = false;
          speakNext();
        };
        utterance.onerror = () => {
          speechActiveRef.current = false;
          speakNext();
        };
        window.speechSynthesis.speak(utterance);
      };
      setSpokenCue(normalizedMessage);
      if (cueTimeoutRef.current) window.clearTimeout(cueTimeoutRef.current);
      cueTimeoutRef.current = window.setTimeout(() => setSpokenCue(""), 4200);

      speakNext();
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

  const resetCoachSignals = useCallback(() => {
    repTimestampsRef.current = [];
    rangeSamplesRef.current = [];
    confidenceSamplesRef.current = [];
    pauseSamplesRef.current = [];
    audioFatigueRef.current = 0;
    finalRepPromptKeyRef.current = null;
    setCoachSuggestion(null);
  }, []);

  const recordRepSignal = useCallback((range: number, confidence: number) => {
    const now = performance.now();
    const previous = repTimestampsRef.current.at(-1);
    if (previous != null) {
      pauseSamplesRef.current.push((now - previous) / 1000);
    }
    repTimestampsRef.current.push(now);
    rangeSamplesRef.current.push(clamp(range, 0, 100));
    confidenceSamplesRef.current.push(clamp(confidence, 0, 100));
  }, []);

  const evaluateSetEffort = useCallback((reps: number, seconds: number): { effort: SetEffort; suggestion: CoachSuggestion; note: string } => {
    const pauses = pauseSamplesRef.current;
    const ranges = rangeSamplesRef.current;
    const confidences = confidenceSamplesRef.current;
    const avg = (values: number[], fallback: number) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
    const firstPauses = pauses.slice(0, Math.max(1, Math.floor(pauses.length / 2)));
    const finalPauses = pauses.slice(Math.max(0, Math.floor(pauses.length / 2)));
    const earlyPace = avg(firstPauses, reps > 0 ? seconds / reps : seconds);
    const finalPace = avg(finalPauses, earlyPace);
    const slowdown = earlyPace > 0 ? finalPace / earlyPace : 1;
    const longPauses = pauses.filter((pause) => pause > 4).length;
    const avgRange = avg(ranges, trackingModeRef.current === "camera" ? 70 : 82);
    const avgConfidence = avg(confidences, trackingModeRef.current === "trust" ? 55 : 75);
    const fatigueScore =
      slowdown * 28 +
      Math.max(0, 70 - avgRange) * 0.45 +
      Math.max(0, 65 - avgConfidence) * 0.28 +
      longPauses * 8 +
      audioFatigueRef.current * 18;

    const effort: SetEffort =
      fatigueScore < 38 && reps >= 5
        ? "easy"
        : fatigueScore < 58
          ? "moderate"
          : fatigueScore < 82
            ? "challenging"
            : "limit";

    const suggestion: CoachSuggestion =
      effort === "easy"
        ? { type: "same", message: "Strong set. Keep this rhythm for the next round." }
        : effort === "moderate"
          ? { type: "same", message: "Solid set. Keep this workload for the next round." }
          : effort === "challenging"
            ? { type: "rest", seconds: Math.max(customRestSeconds + 15, 45), message: "That looked challenging. Take a longer rest before the next set." }
            : { type: "rest", seconds: Math.max(customRestSeconds + 30, 60), message: "You are near your limit. Rest longer and keep the next set lighter." };

    const note = `${suggestion.message} Pace ${slowdown > 1.25 ? "slowed" : "stayed steady"}, range ${Math.round(avgRange)}%, confidence ${Math.round(avgConfidence)}%.`;
    return { effort, suggestion, note };
  }, [customRestSeconds]);

  const saveCoachLearning = useCallback((exerciseKey: ExerciseKey, reps: number, effort: SetEffort) => {
    if (typeof window === "undefined" || reps <= 0) return;
    const key = "openhealth-workout-coach-profile";
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, { easyReps: number; hardReps: number; samples: number }>;
      const current = parsed[exerciseKey] ?? { easyReps: reps, hardReps: reps, samples: 0 };
      const next = {
        easyReps: effort === "easy" ? Math.round(current.easyReps * 0.7 + reps * 0.3) : current.easyReps,
        hardReps: effort === "challenging" || effort === "limit" ? Math.round(current.hardReps * 0.7 + reps * 0.3) : current.hardReps,
        samples: current.samples + 1,
      };
      window.localStorage.setItem(key, JSON.stringify({ ...parsed, [exerciseKey]: next }));
    } catch {
      // Local learning is helpful, but workouts should never depend on storage.
    }
  }, []);

  const saveMuscleTraining = useCallback((exerciseKey: ExerciseKey, reps: number, seconds: number) => {
    if (typeof window === "undefined") return;
    const trainedMuscles = getMusclesForExercise(exerciseKey, requestedMuscle);
    if (!trainedMuscles.length) return;

    try {
      const parsed = JSON.parse(window.localStorage.getItem(MUSCLE_TRAINING_STORAGE_KEY) ?? "{}") as MuscleTrainingProfile;
      const now = Date.now();
      const effortPoints = Math.max(4, Math.min(24, reps > 0 ? reps * 1.35 : seconds / 3));
      const nextProfile = { ...parsed };

      trainedMuscles.forEach((muscle, index) => {
        const current = nextProfile[muscle] ?? { score: 0, lastTrainedAt: now, volume: 0 };
        const currentScore = getDecayedMuscleScore(current);
        const multiplier = index === 0 ? 1 : 0.58;
        nextProfile[muscle] = {
          score: Math.min(100, Math.round(currentScore + effortPoints * multiplier)),
          lastTrainedAt: now,
          volume: Math.round((current.volume ?? 0) + Math.max(reps, seconds / 10) * multiplier),
        };
      });

      window.localStorage.setItem(MUSCLE_TRAINING_STORAGE_KEY, JSON.stringify(nextProfile));
      window.dispatchEvent(new Event("openhealth:muscle-training-updated"));
    } catch {
      // Muscle map progress is a convenience layer; workouts should continue even if storage is unavailable.
    }
  }, [requestedMuscle]);

  const recordSetSummary = useCallback(
    (label: string, reps: number, seconds: number, exerciseKey = exerciseRef.current) => {
      const coachResult = evaluateSetEffort(reps, seconds);
      const summary: SetSummary = {
        id: `${Date.now()}-${recentSets.length}`,
        label,
        setNumber: recentSets.length + 1,
        reps,
        seconds,
        effort: coachResult.effort,
        coachNote: coachResult.note,
      };
      setLastSetSummary(summary);
      setCoachSuggestion(coachResult.suggestion);
      saveCoachLearning(exerciseKey, reps, coachResult.effort);
      saveMuscleTraining(exerciseKey, reps, seconds);
      setRecentSets((sets) => [summary, ...sets].slice(0, 5));
      if (!isTaskMode && (reps > 0 || seconds > 0)) {
        const proofSource = getProofSource(trackingMode, interactiveMode);
        completeWorkoutSet.mutate({
          exerciseKey,
          exerciseLabel: label,
          countedReps: reps > 0 ? reps : Math.max(1, Math.floor(seconds / 5)),
          seconds: Math.round(seconds),
          source: proofSource,
        });
      }
      return summary;
    },
    [completeWorkoutSet, evaluateSetEffort, interactiveMode, isTaskMode, recentSets.length, saveCoachLearning, saveMuscleTraining, trackingMode]
  );

  const finishWorkoutSession = useCallback(
    (message = "Workout finished.") => {
      setActivePreset(null);
      setProgram("custom");
      programRef.current = "custom";
      setRoutinePhase("complete");
      routinePhaseRef.current = "complete";
      setStatus(streamRef.current ? "ready" : "idle");
      setWorkoutFlowStep("activity");
      playSound("finish");
      speak(message);
    },
    [playSound, speak]
  );

  const enterRoutineStep = useCallback(
    (index: number, delayMs = 0) => {
      const routine =
        programRef.current === "custom"
          ? { ...getProgram("custom"), steps: activeRoutineSteps }
          : getProgram(programRef.current);
      const step = routine.steps[index];

      if (!step) {
        setRoutineRemaining(null);
        window.setTimeout(() => {
          finishWorkoutSession("Workout finished. Great job.");
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
          feedback: `Now ${step.seconds} seconds break.`,
          quality: "good",
        }));
        window.setTimeout(() => {
          playSound("setComplete");
          speak(`Now ${step.seconds} seconds break.`, true);
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
        timedEndsAtRef.current = null;
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
        speak(`${index > 0 ? "Continue doing" : "Do"} ${step.label} for ${step.seconds} seconds. Three.`, true);
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
      coachExtraRepsRef.current = null;
      resetCoachSignals();
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
        speak(`${index > 0 ? "Continue doing" : "Do"} ${step.reps} ${getExerciseLabel(step.exercise)} reps. Three.`, true);
      }, delayMs);
    },
    [activeRoutineSteps, finishWorkoutSession, playSound, resetCoachSignals, speak]
  );

  const advanceAfterCompletedSet = useCallback(
    (delayMs = 400) => {
      const nextIndex = routineStepIndexRef.current + 1;
      const nextStep = activeRoutineSteps[nextIndex];
      if (programRef.current === "custom" && nextStep) {
        enterRoutineStep(nextIndex, delayMs);
        return true;
      }
      if (programRef.current === "custom") {
        window.setTimeout(() => finishWorkoutSession("Workout finished. Great job."), delayMs);
        return true;
      }
      return false;
    },
    [activeRoutineSteps, enterRoutineStep, finishWorkoutSession]
  );

  const registerFallbackRep = useCallback(
    (source: ProofSource, feedback?: string) => {
      if (statusRef.current !== "running") return;
      const nextRepCount = metricsRef.current.repCount + 1;
      const proofLabel = PROOF_LABELS[source];
      const next: AnalyzerMetrics = {
        ...metricsRef.current,
        repCount: nextRepCount,
        phase: "top",
        confidence: source === "motion" ? 82 : source === "trust" ? 55 : 70,
        angle: null,
        repProgress: 100,
        phaseStartedAt: performance.now(),
        feedback: feedback ?? `${proofLabel}. Rep ${nextRepCount} counted.`,
        quality: source === "trust" ? "tracking" : "good",
      };

      lastCountAtRef.current = performance.now();
      recordRepSignal(100, next.confidence);
      playSound("rep");
      speak(String(nextRepCount));
      setRepFlash(nextRepCount);
      if (repFlashTimeoutRef.current) {
        window.clearTimeout(repFlashTimeoutRef.current);
      }
      repFlashTimeoutRef.current = window.setTimeout(() => setRepFlash(null), 720);

      const routine =
        programRef.current === "custom"
          ? { ...getProgram("custom"), steps: activeRoutineSteps }
          : getProgram(programRef.current);
      const step = routine.steps[routineStepIndexRef.current];
      if (routine.key !== "free" && routinePhaseRef.current === "work" && step?.type === "work") {
        const setReps = nextRepCount - setStartRepRef.current;
        const targetRepsForSet = coachExtraRepsRef.current ?? step.reps;
        const halfwayRep = Math.ceil(targetRepsForSet / 2);
        const halfwayKey = `${routine.key}-${routineStepIndexRef.current}-${targetRepsForSet}`;
        if (setReps >= halfwayRep && setReps < targetRepsForSet && halfwayMotivationKeyRef.current !== halfwayKey) {
          halfwayMotivationKeyRef.current = halfwayKey;
          speak("Halfway there.");
        }
        if (setReps >= targetRepsForSet) {
          next.feedback = `Set complete. ${setReps} reps counted with ${proofLabel.toLowerCase()}.`;
          recordSetSummary(
            coachExtraRepsRef.current ? `${step.label ?? getExerciseLabel(step.exercise)} bonus` : step.label ?? getExerciseLabel(step.exercise),
            setReps,
            sessionSeconds,
            step.exercise
          );
          coachExtraRepsRef.current = null;
          metricsRef.current = next;
          setMetrics(next);
          if (activePreset && advanceAfterCompletedSet()) return;
          routinePhaseRef.current = "summary";
          setRoutinePhase("summary");
          setStatus("paused");
        }
      }

      metricsRef.current = next;
      setMetrics(next);
    },
    [activePreset, activeRoutineSteps, advanceAfterCompletedSet, playSound, recordRepSignal, recordSetSummary, sessionSeconds, speak]
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
        if (trackingModeRef.current === "camera" && next.confidence < 35) {
          const now = performance.now();
          weakCameraStartedAtRef.current ??= now;
          if (now - weakCameraStartedAtRef.current > 6000) {
            setWeakCameraPrompt(true);
          }
        } else {
          weakCameraStartedAtRef.current = null;
          setWeakCameraPrompt(false);
        }
        if (next.repCount > metricsRef.current.repCount) {
          lastCountAtRef.current = performance.now();
          recordRepSignal(next.repProgress, next.confidence);
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
            const targetRepsForSet = coachExtraRepsRef.current ?? step.reps;
            const halfwayRep = Math.ceil(targetRepsForSet / 2);
            const halfwayKey = `${routine.key}-${routineStepIndexRef.current}-${targetRepsForSet}`;
            if (
              setReps >= halfwayRep &&
              setReps < targetRepsForSet &&
              halfwayMotivationKeyRef.current !== halfwayKey
            ) {
              halfwayMotivationKeyRef.current = halfwayKey;
              speak("Halfway there.");
            }
            if (setReps >= targetRepsForSet) {
              next.feedback = `Set complete. ${setReps} reps locked in.`;
              recordSetSummary(
                coachExtraRepsRef.current ? `${step.label ?? getExerciseLabel(step.exercise)} bonus` : step.label ?? getExerciseLabel(step.exercise),
                setReps,
                sessionSeconds,
                step.exercise
              );
              coachExtraRepsRef.current = null;
              metricsRef.current = next;
              setMetrics(next);
              if (activePreset) {
                advanceAfterCompletedSet();
              } else {
                routinePhaseRef.current = "summary";
                setRoutinePhase("summary");
                setStatus("paused");
              }
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
  }, [activePreset, activeRoutineSteps, advanceAfterCompletedSet, drawPose, playSound, recordRepSignal, recordSetSummary, sessionSeconds, speak]);

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

      const videoConstraints: MediaTrackConstraints =
        cameraFacingMode === "environment"
          ? {
              facingMode: { exact: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              aspectRatio: { ideal: 16 / 9 },
            }
          : {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch (cameraErr) {
        if (cameraFacingMode !== "environment") throw cameraErr;
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 16 / 9 },
          },
          audio: false,
        });
      }

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

  useEffect(() => {
    if (!shouldRestartCameraRef.current) return;
    shouldRestartCameraRef.current = false;
    stopCamera();
    void startCamera();
  }, [cameraFacingMode, startCamera, stopCamera]);

  const resetSession = useCallback(() => {
    metricsRef.current = {
      repCount: 0,
      phase: "ready",
      confidence: 0,
      angle: null,
      repProgress: 0,
      phaseStartedAt: null,
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
    timedEndsAtRef.current = null;
    setSessionSeconds(0);
    setCountdown(null);
    setRoutinePhase("idle");
    setRoutineStepIndex(0);
    setSetStartRep(0);
    setRoutineRemaining(null);
    setMetrics(metricsRef.current);
    setStatus(streamRef.current ? "ready" : "idle");
    resetCoachSignals();
  }, [resetCoachSignals]);

  const beginCountdown = useCallback(() => {
    const activeTrackingMode = trackingModeRef.current;
    const activeInteractiveMode = interactiveModeRef.current;
    if (activeTrackingMode === "camera" && !streamRef.current) return;
    const proofSource = getProofSource(activeTrackingMode, activeInteractiveMode);
    const methodLabel = getTrackingModeLabel(activeTrackingMode, activeInteractiveMode);
    if (programRef.current !== "free" && routinePhaseRef.current !== "work") {
      metricsRef.current = {
        ...metricsRef.current,
        repCount: 0,
        phase: "ready",
        angle: null,
        feedback: `Starting custom routine in ${methodLabel}.`,
        quality: "tracking",
      };
      setSessionSeconds(0);
      setMetrics(metricsRef.current);
      resetCoachSignals();
      enterRoutineStep(0);
      return;
    }

    resetCoachSignals();
    metricsRef.current = {
      repCount: metricsRef.current.repCount,
      phase: "ready",
      confidence: metricsRef.current.confidence,
      angle: null,
      repProgress: 0,
      phaseStartedAt: null,
      feedback: `Get set. ${PROOF_LABELS[proofSource]} active.`,
      quality: "tracking",
    };
    setMetrics(metricsRef.current);
    setStatus("countdown");
    setCountdown(3);
    playSound("start");
    speak("Three.");
  }, [enterRoutineStep, playSound, resetCoachSignals, speak]);

  useEffect(() => {
    if (status !== "countdown" || countdown == null) return;
    if (countdown === 0) {
      setCountdown(null);
      const activeStep = activeRoutineSteps[routineStepIndexRef.current];
      if (activeStep?.type === "timed") {
        routinePhaseRef.current = "timed";
        setRoutinePhase("timed");
        setTimedRemaining((remaining) => remaining ?? activeStep.seconds);
        timedEndsAtRef.current = Date.now() + (timedRemaining ?? activeStep.seconds) * 1000;
      }
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
  }, [activeRoutineSteps, countdown, playSound, speak, status, timedRemaining]);

  useEffect(() => {
    if (status !== "rest" || routineRemaining == null) return;
    if (routineRemaining <= 0) {
      setRoutineRemaining(null);
      enterRoutineStep(routineStepIndexRef.current + 1, 200);
      return;
    }

    const timeout = window.setTimeout(() => {
      const next = routineRemaining - 1;
      setRoutineRemaining(next);
      if (next === 10) {
        speak("10 seconds left.", true);
      }
      if (next > 0 && next <= 5) {
        playSound("rest");
        speak(String(next), true);
      }
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [enterRoutineStep, playSound, routineRemaining, speak, status]);

  useEffect(() => {
    if (status !== "running" || routinePhase !== "timed" || timedRemaining == null) return;
    const step = activeRoutineSteps[routineStepIndexRef.current];
    const finishTimedSet = () => {
      if (step?.type === "timed") {
        recordSetSummary(step.label, 0, step.seconds);
      }
      setTimedRemaining(null);
      timedEndsAtRef.current = null;
      if (advanceAfterCompletedSet()) return;
      playSound("setComplete");
      speak("Set complete. Good job.", true);
      setStatus("paused");
      routinePhaseRef.current = "summary";
      setRoutinePhase("summary");
    };

    const announced = new Set<number>();
    const interval = window.setInterval(() => {
      const endsAt = timedEndsAtRef.current;
      if (!endsAt) return;
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimedRemaining((current) => (current === next ? current : next));
      if (next <= 0) {
        window.clearInterval(interval);
        finishTimedSet();
        return;
      }
      if ([40, 30, 20, 10].includes(next) && !announced.has(next)) {
        announced.add(next);
        speak(`${next} seconds left.`, true);
      } else if (next <= 5 && !announced.has(next)) {
        announced.add(next);
        playSound("rest");
        speak(String(next), true);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [
    activeRoutineSteps,
    playSound,
    recordSetSummary,
    routinePhase,
    speak,
    advanceAfterCompletedSet,
    status,
  ]);

  useEffect(() => {
    if (trackingMode !== "motion" || status !== "running") return;
    const profile = TRACKING_PROFILES[exerciseRef.current];
    if (!profile.motion) {
      setError(`${getExerciseLabel(exerciseRef.current)} is not reliable in Motion Mode. Try Interactive or Manual Mode.`);
      return;
    }

    setError(null);
    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
      if (!acceleration) return;
      const x = acceleration.x ?? 0;
      const y = acceleration.y ?? 0;
      const z = acceleration.z ?? 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const baseline = motionBaselineRef.current ?? magnitude;
      motionBaselineRef.current = baseline * 0.92 + magnitude * 0.08;
      const delta = Math.abs(magnitude - motionBaselineRef.current);
      setMotionEnergy((current) => current * 0.78 + Math.min(1, delta / 8) * 0.22);
      const now = performance.now();
      const fastPattern = ["jumpingJacks", "highKnees", "mountainClimbers", "squatJump"].includes(exerciseRef.current);
      const cadence = fastPattern ? 520 : 760;
      if (delta > 4.2 && now - motionLastRepAtRef.current > cadence) {
        motionLastRepAtRef.current = now;
        registerFallbackRep("motion", "Motion rhythm detected. Rep counted.");
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [registerFallbackRep, status, trackingMode]);

  useEffect(() => {
    if (trackingMode !== "interactive" || interactiveMode !== "tap" || status !== "running") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ([" ", "Enter", "AudioVolumeUp", "AudioVolumeDown"].includes(event.key)) {
        event.preventDefault();
        registerFallbackRep("tap", "Manual rep confirmed.");
        setTapPulse((value) => value + 1);
        navigator.vibrate?.(42);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interactiveMode, registerFallbackRep, status, trackingMode]);

  useEffect(() => {
    if (trackingMode !== "interactive" || interactiveMode !== "audio" || status !== "running") return;
    let cancelled = false;

    const startAudioRepMode = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Microphone access is not supported. Use Tap-to-Rep.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        audioStreamRef.current = stream;
        const AudioContextCtor =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        const context = new AudioContextCtor();
        audioContextModeRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);

        const readAudio = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          data.forEach((value) => {
            const centered = value - 128;
            sum += centered * centered;
          });
          const rms = Math.sqrt(sum / data.length);
          const now = performance.now();
          if (rms > 10 && now - audioLastRepAtRef.current > 1800) {
            audioFatigueRef.current = Math.min(1, audioFatigueRef.current + 0.025);
          }
          if (rms > 18 && now - audioLastRepAtRef.current > 650) {
            audioLastRepAtRef.current = now;
            registerFallbackRep("audio", "Audio rep detected.");
          }
          audioAnimationRef.current = requestAnimationFrame(readAudio);
        };
        readAudio();
      } catch {
        setError("Microphone permission was blocked. Use Tap-to-Rep.");
      }
    };

    void startAudioRepMode();
    return () => {
      cancelled = true;
      if (audioAnimationRef.current) cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      void audioContextModeRef.current?.close();
      audioContextModeRef.current = null;
    };
  }, [interactiveMode, registerFallbackRep, status, trackingMode]);

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
        speechQueueRef.current = [];
        speechActiveRef.current = false;
        window.speechSynthesis.cancel();
      }
      if (repFlashTimeoutRef.current) {
        window.clearTimeout(repFlashTimeoutRef.current);
      }
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!voiceEnabled || typeof window === "undefined") return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [voiceEnabled]);

  const canStartSession = status === "idle" || status === "ready" || status === "paused";
  const isCameraActive =
    status === "ready" ||
    status === "running" ||
    status === "rest" ||
    status === "paused" ||
    status === "countdown";
  const isWorkoutSurfaceActive = trackingMode !== "camera" || isCameraActive;
  const repProgress = metrics.repProgress;
  const activeRoutineStep = program === "custom" ? activeRoutineSteps[routineStepIndex] : selectedProgram.steps[routineStepIndex];
  const activeStep = program === "custom" ? activeRoutineStep : null;
  const targetReps = activeRoutineStep?.type === "work" ? activeRoutineStep.reps : null;
  const targetSeconds = activeRoutineStep?.type === "timed" ? activeRoutineStep.seconds : null;
  const displayTargetReps = coachExtraRepsRef.current ?? (isTaskMode ? taskTarget : targetReps);
  const activeTrackingProfile = TRACKING_PROFILES[exercise];
  const activeProofSource = getProofSource(trackingMode, interactiveMode);
  const activeTrackingLabel = getTrackingModeLabel(trackingMode, interactiveMode);
  const hasActiveTracking = trackingMode !== "camera" || !!streamRef.current;
  const currentSetReps = program === "free" ? metrics.repCount : Math.max(0, metrics.repCount - setStartRep);
  const routineProgress = displayTargetReps
    ? Math.min(100, (currentSetReps / displayTargetReps) * 100)
    : targetSeconds && timedRemaining != null
      ? Math.min(100, ((targetSeconds - timedRemaining) / targetSeconds) * 100)
      : repProgress;
  const modeLocked = isTaskMode || Boolean(activePreset) || (program !== "free" && routinePhase !== "idle" && routinePhase !== "complete");
  const customDescription = activePreset
    ? `${activePreset.name}: ${activePreset.exercises.length} guided moves, ${activePreset.durationMin} min estimate.`
    : isTimedExercise
      ? `${customSets} set${customSets === 1 ? "" : "s"} x ${customReps}s ${selectedExerciseLabel}, ${customRestSeconds}s rest.`
      : `${customSets} set${customSets === 1 ? "" : "s"} x ${customReps} ${selectedExerciseLabel} reps, ${customRestSeconds}s rest.`;
  const stageLabel =
    status === "rest"
      ? `${routineRemaining ?? 0}s rest`
      : routinePhase === "timed" && timedRemaining != null
        ? `${timedRemaining}s`
      : targetSeconds && timedRemaining != null
        ? `${timedRemaining}s hold`
      : displayTargetReps
        ? `${currentSetReps}/${displayTargetReps} reps`
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
          : "Start set";
  const primaryActionIcon =
    status === "running" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : status === "rest" || status === "countdown" ? (
      <Pause className="h-4 w-4" />
    ) : (
      <Play className="h-4 w-4" />
    );

  const toggleFullscreen = async () => {
    const shell = analyzerShellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await shell.requestFullscreen();
  };

  useEffect(() => {
    if (!isTaskMode || !taskId || !taskTarget || taskCompleted) return;
    if (metrics.repCount < taskTarget) return;
    setTaskCompleted(true);
    metricsRef.current = {
      ...metricsRef.current,
      feedback: "Task completed. Medal unlocked.",
      quality: "good",
    };
    setMetrics(metricsRef.current);
    playSound("finish");
    speak("Task completed. Medal unlocked.");
    completeTask.mutate({
      taskKey: taskId,
      countedReps: metrics.repCount,
      source: getProofSource(trackingMode, interactiveMode),
    });
  }, [completeTask, interactiveMode, isTaskMode, metrics.repCount, playSound, speak, taskCompleted, taskId, taskTarget, trackingMode]);

  const endCurrentSet = (confirmedReps?: number, feedback = "Set complete") => {
    const label =
      activeStep?.type === "work"
        ? activeStep.label ?? getExerciseLabel(activeStep.exercise)
        : activeStep?.type === "timed"
          ? activeStep.label
          : selectedExerciseLabel;
    const reps = routinePhase === "timed" ? 0 : confirmedReps ?? currentSetReps;
    const elapsed =
      activeStep?.type === "timed"
        ? activeStep.seconds - (timedRemaining ?? 0)
        : sessionSeconds;
    if (confirmedReps != null) {
      const nextRepCount = setStartRepRef.current + confirmedReps;
      metricsRef.current = {
        ...metricsRef.current,
        repCount: nextRepCount,
        repProgress: displayTargetReps ? 100 : metricsRef.current.repProgress,
        feedback: `${feedback}.`,
        confidence: Math.max(metricsRef.current.confidence, 55),
        quality: "good",
      };
      setMetrics(metricsRef.current);
    }
    const summary = recordSetSummary(label, reps, Math.max(0, elapsed));
    metricsRef.current = {
      ...metricsRef.current,
      feedback: `${feedback} - ${reps ? `${reps} reps` : label} • ${formatSessionTime(summary.seconds)}`,
      quality: "good",
    };
    setMetrics(metricsRef.current);
    setLastSetSummary(summary);
    if (activePreset && advanceAfterCompletedSet()) return;
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

    if (!document.fullscreenElement && analyzerShellRef.current) {
      void analyzerShellRef.current.requestFullscreen().catch(() => undefined);
    }
    setWorkoutFlowStep("active");
    beginCountdown();
  };

  const chooseTrackingMode = async (mode: TrackingMode, interactive: InteractiveMode = interactiveMode) => {
    if (manualExerciseLaunch && (mode === "camera" || mode === "motion")) return;
    const wasRunning = statusRef.current === "running";
    setTrackingMode(mode);
    setInteractiveMode(interactive);
    trackingModeRef.current = mode;
    interactiveModeRef.current = interactive;
    setShowTrackingPicker(false);
    setWeakCameraPrompt(false);
    setError(null);

    if (!document.fullscreenElement && analyzerShellRef.current) {
      void analyzerShellRef.current.requestFullscreen().catch(() => undefined);
    }
    setWorkoutFlowStep("active");

    if (mode === "camera") {
      if (!streamRef.current) {
        await startCamera();
      }
      if (wasRunning) {
        setStatus("running");
        speak("Switched to Camera Mode.");
        return;
      }
      window.setTimeout(() => beginCountdown(), 80);
      return;
    }

    stopCamera();
    metricsRef.current = {
      ...metricsRef.current,
      confidence: mode === "motion" ? 82 : mode === "trust" ? 55 : 70,
      feedback: `${getTrackingModeLabel(mode, interactive)} ready. ${PROOF_LABELS[getProofSource(mode, interactive)]} active.`,
      quality: "tracking",
    };
    setMetrics(metricsRef.current);
    if (wasRunning) {
      setStatus("running");
      speak(`Switched to ${getTrackingModeLabel(mode, interactive)}.`);
      return;
    }
    beginCountdown();
  };

  const updateTrackingModeSelection = (value: string) => {
    const [modeValue, interactiveValue] = value.split(":") as [TrackingMode, InteractiveMode | undefined];
    if (manualExerciseLaunch && (modeValue === "camera" || modeValue === "motion")) return;
    const nextInteractive = interactiveValue ?? interactiveMode;
    if (statusRef.current === "running") {
      void chooseTrackingMode(modeValue, nextInteractive);
      return;
    }
    setTrackingMode(modeValue);
    setInteractiveMode(nextInteractive);
    trackingModeRef.current = modeValue;
    interactiveModeRef.current = nextInteractive;
    setWeakCameraPrompt(false);
    setError(null);
    if (modeValue !== "camera") {
      stopCamera();
      setStatus("ready");
    } else if (streamRef.current) {
      setStatus("ready");
    }
    metricsRef.current = {
      ...metricsRef.current,
      confidence: modeValue === "motion" ? 82 : modeValue === "trust" ? 55 : modeValue === "camera" ? metricsRef.current.confidence : 70,
      feedback: `${getTrackingModeLabel(modeValue, nextInteractive)} selected. Press Start set when ready.`,
      quality: "tracking",
    };
    setMetrics(metricsRef.current);
  };

  const takeShortBreak = (seconds = 10) => {
    setCoachSuggestion(null);
    routinePhaseRef.current = "rest";
    setRoutinePhase("rest");
    setRoutineRemaining(seconds);
    setStatus("rest");
    playSound("rest");
    speak(`Take ${seconds} seconds. Recover.`);
  };

  const startNextSet = () => {
    setWorkoutFlowStep("active");
    if (program === "custom") {
      enterRoutineStep(routineStepIndexRef.current + 1);
      return;
    }
    beginCountdown();
  };

  const handleSetButtonClick = () => {
    if (
      status === "ready" ||
      status === "running" ||
      status === "rest" ||
      status === "countdown" ||
      status === "paused" ||
      (status === "idle" && trackingMode !== "camera")
    ) {
      handlePrimaryAction();
      return;
    }
    setShowTrackingPicker(true);
  };

  const confirmTrustSet = () => {
    if (status !== "running") return;
    const confirmedReps = displayTargetReps ?? currentSetReps;
    endCurrentSet(Math.max(0, confirmedReps), "Self-confirmed set complete");
  };

  const nudgeRepCount = (delta: 1 | -1, source: ProofSource = "tap") => {
    const nextRepCount = Math.max(0, metricsRef.current.repCount + delta);
    const next: AnalyzerMetrics = {
      ...metricsRef.current,
      repCount: nextRepCount,
      repProgress: displayTargetReps ? Math.min(100, (Math.max(0, nextRepCount - setStartRepRef.current) / displayTargetReps) * 100) : metricsRef.current.repProgress,
      feedback: delta > 0 ? "Manual rep added." : "Manual rep corrected.",
      confidence: Math.max(metricsRef.current.confidence, source === "trust" ? 55 : 70),
      quality: "tracking",
    };
    metricsRef.current = next;
    setMetrics(next);
    setTapPulse((value) => value + 1);
    if (delta > 0) {
      recordRepSignal(next.repProgress, next.confidence);
      playSound("rep");
      speak(String(nextRepCount));
    }
    navigator.vibrate?.(delta > 0 ? 38 : 18);
  };

  const handleTapRep = () => {
    registerFallbackRep("tap", "Manual rep confirmed.");
    setTapPulse((value) => value + 1);
    navigator.vibrate?.(42);
  };

  const startCoachExtension = (reps: number) => {
    const step = activeStep?.type === "work" ? activeStep : null;
    if (!step || reps <= 0) return;
    coachExtraRepsRef.current = reps;
    resetCoachSignals();
    setStartRepRef.current = metricsRef.current.repCount;
    setSetStartRep(metricsRef.current.repCount);
    routinePhaseRef.current = "work";
    setRoutinePhase("work");
    setCoachSuggestion(null);
    setCountdown(3);
    setStatus("countdown");
    metricsRef.current = {
      ...metricsRef.current,
      phase: "ready",
      repProgress: 0,
      feedback: `Bonus round: ${reps} more ${getExerciseLabel(step.exercise)} reps.`,
      quality: "tracking",
    };
    setMetrics(metricsRef.current);
    playSound("start");
    speak(`Bonus round. ${reps} more.`);
  };

  const applyCoachResponse = (response: "yes" | "no" | "three" | "harder" | "done" | "next" | "break") => {
    if (response === "yes") {
      startCoachExtension(coachSuggestion?.type === "extra" ? coachSuggestion.reps : 5);
      return;
    }
    if (response === "three") {
      startCoachExtension(3);
      return;
    }
    if (response === "harder") {
      startCoachExtension(5);
      return;
    }
    if (response === "no") {
      setCoachSuggestion({ type: "same", message: "Got it. Keep the next set steady." });
      startNextSet();
      return;
    }
    if (response === "next") {
      startNextSet();
      return;
    }
    if (response === "break") {
      takeShortBreak(10);
      return;
    }
    finishWorkout();
  };

  const parseCoachResponse = (transcript: string) => {
    const normalized = transcript.toLowerCase();
    if (normalized.includes("only 3") || normalized.includes("only three") || normalized.includes("three")) return "three" as const;
    if (normalized.includes("make it harder") || normalized.includes("harder")) return "harder" as const;
    if (normalized.includes("start next") || normalized.includes("next set")) return "next" as const;
    if (normalized.includes("take") && normalized.includes("break")) return "break" as const;
    if (normalized.includes("10 second") || normalized.includes("ten second")) return "break" as const;
    if (normalized.includes("i'm done") || normalized.includes("im done") || normalized.includes("done")) return "done" as const;
    if (normalized.includes("no")) return "no" as const;
    if (normalized.includes("yes") || normalized.includes("yeah") || normalized.includes("sure")) return "yes" as const;
    return null;
  };

  const listenForCoachResponse = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor =
      (window as typeof window & {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).SpeechRecognition ??
      (window as typeof window & {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.info("Voice response is not supported here. Use the buttons.");
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    setCoachListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      const response = parseCoachResponse(transcript);
      setCoachListening(false);
      if (response) applyCoachResponse(response);
      else toast.info("I did not catch that. Try yes, no, only 3, make it harder, or I'm done.");
    };
    recognition.onerror = () => setCoachListening(false);
    recognition.onend = () => setCoachListening(false);
    recognition.start();
  };

  const finishWorkout = () => {
    finishWorkoutSession();
  };

  const startPresetWorkout = (preset: WorkoutPreset) => {
    const firstCameraExercise = preset.exercises.find((item) => item.exercise)?.exercise ?? "pushup";
    setActivePreset(preset);
    setSelectedPreset(null);
    setActiveTab("quick");
    setWorkoutFlowStep("setup");
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

  const programCard = (preset: WorkoutPreset, variant: "carousel" | "list" = "list") => {
    const preview = preset.exercises.slice(0, 4).map(formatPresetPreview);
    const goalText = preset.goal.toLowerCase();
    const MotifIcon = goalText.includes("core")
      ? Shield
      : goalText.includes("cardio") || goalText.includes("conditioning")
        ? Zap
        : goalText.includes("mobility")
          ? Activity
          : goalText.includes("strength") || goalText.includes("body")
            ? Dumbbell
            : Flame;
    const motifClass = goalText.includes("core")
      ? "from-[#EAF8F4] to-[#DCEBFF] text-[#15483F]"
      : goalText.includes("cardio") || goalText.includes("conditioning")
        ? "from-[#FFF4D7] to-[#EAF8F4] text-[#8B5B00]"
        : goalText.includes("mobility")
          ? "from-[#EAF8F4] to-[#F5F0FF] text-[#4C5F59]"
          : "from-[#FFECE7] to-[#EAF8F4] text-[#8A3324]";
    const progressLabel = preset.streak
      ? `${preset.streak}-day streak`
      : preset.bestScore
        ? `Best ${preset.bestScore} pts`
        : preset.completed
          ? "Completed"
          : "Not started";
    const actionLabel = preset.streak ? "Continue" : preset.bestScore ? "Beat Your Best" : "Start";
    return (
      <article
        key={preset.id}
        className={cn(
          "rounded-[22px] border border-[#DDE8E4] bg-white p-3.5 shadow-[0_10px_24px_rgba(21,72,63,0.06)] transition hover:-translate-y-0.5 hover:border-[#20C7A4]/50",
          variant === "carousel" ? "w-[276px] shrink-0" : "min-w-0"
        )}
      >
        <button type="button" onClick={() => setSelectedPreset(preset)} className="block w-full text-left">
          <div className="flex items-start gap-3">
            <div className={`relative flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br ${motifClass}`}>
              <MotifIcon className="h-7 w-7" strokeWidth={2.3} />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#20C7A4] shadow-sm">
                <Sparkles className="h-3 w-3" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[#17201E]">{preset.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-[#6B7773]">{preset.tagline}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#15483F] px-2.5 py-1 text-xs font-black text-white">
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  +{preset.pointsReward}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-hidden text-xs text-[#6B7773]">
                <span className="shrink-0 font-bold text-[#17201E]">{preset.durationMin}m</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-[#C7D4CF]" />
                <span className="shrink-0">{preset.exercises.length} moves</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-[#C7D4CF]" />
                <span className="truncate">{preset.goal}</span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-[#F1F7F4] px-2.5 py-1 text-[11px] font-bold text-[#4C5F59]">{preset.difficulty}</span>
                <span className="truncate text-[11px] font-bold text-[#20C7A4]">{progressLabel}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex min-h-[30px] items-center gap-2 overflow-x-auto whitespace-nowrap pb-0.5">
            {preview.map((item, index) => (
              <span key={`${preset.id}-${item}-${index}`} className="inline-flex items-center gap-2 text-[11px] font-bold text-[#4C5F59]">
                <span className="rounded-full bg-[#F7FAF9] px-2.5 py-1">{item}</span>
                {index < preview.length - 1 && <span className="text-[#20C7A4]">-&gt;</span>}
              </span>
            ))}
          </div>
        </button>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            aria-label={favoritePresetIds.has(preset.id) ? "Remove favorite" : "Favorite program"}
            onClick={() => toggleFavorite(preset.id)}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DDE8E4] transition",
              favoritePresetIds.has(preset.id) ? "bg-[#EAF8F4] text-[#15483F]" : "bg-white text-[#6B7773]"
            )}
          >
            <Heart className={cn("h-5 w-5", favoritePresetIds.has(preset.id) && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={() => startPresetWorkout(preset)}
            className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#20C7A4] px-4 text-sm font-black text-[#071512]"
          >
            {actionLabel}
          </button>
        </div>
      </article>
    );
  };

  const trackingState =
    trackingMode !== "camera"
      ? activeTrackingLabel
      : !streamRef.current
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
      : trackingMode !== "camera"
        ? metrics.feedback
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
  const setTotal = activePreset
    ? activePreset.exercises.length
    : program === "custom"
      ? customSets
      : 1;
  const stageRepLabel =
    targetSeconds && timedRemaining != null
      ? `${timedRemaining}s`
      : displayTargetReps
        ? `${currentSetReps} / ${displayTargetReps}`
        : String(currentSetReps);
  const stageUnitLabel = targetSeconds ? "Timer" : "Reps";
  const stageStatus =
    status === "rest"
      ? `Rest ${formatSessionTime(routineRemaining ?? 0)}`
      : routinePhase === "summary"
        ? "Set complete"
              : targetSeconds && timedRemaining != null
                ? timedRemaining <= 10
                  ? `${timedRemaining} seconds left`
                  : "Hold steady"
              : trackingMode === "interactive" && interactiveMode === "audio"
          ? currentSetReps > 0
            ? `Rep ${currentSetReps}`
            : "Listening"
            : trackingMode === "interactive" && interactiveMode === "tap"
              ? "Tap for rep"
              : trackingMode === "motion"
                ? motionEnergy > 0.55
                  ? "Good rhythm"
                  : motionEnergy > 0.26
                    ? "Movement detected"
                    : "Hold still... Ready"
                : trackingMode === "trust"
                  ? status === "running"
                    ? "We trust you - just train"
                    : "Self-verified"
                  : trackingState;
  const nextExerciseLabel =
    activeRoutineSteps.find((step, index) => index > routineStepIndex && step.type === "work")?.type === "work"
      ? getExerciseLabel((activeRoutineSteps.find((step, index) => index > routineStepIndex && step.type === "work") as Extract<RoutineStep, { type: "work" }>).exercise)
      : selectedExerciseLabel;
  const hasNextRoutineStep =
    program === "custom" && activeRoutineSteps.some((_, index) => index > routineStepIndex);
  const continueSetLabel = hasNextRoutineStep ? "Start next" : "Finish";
  const handleContinueAfterSet = () => {
    if (hasNextRoutineStep) {
      startNextSet();
      return;
    }
    finishWorkout();
  };
  const wholeWorkoutProgress =
    program === "custom" && activeRoutineSteps.length > 0
      ? Math.min(100, ((routineStepIndex + (status === "running" ? routineProgress / 100 : 0)) / activeRoutineSteps.length) * 100)
      : routineProgress;

  return (
    <div className="space-y-5 bg-background pb-8">
      {isTaskMode && taskExercise && taskTarget && (
        <div className="overflow-hidden rounded-[22px] border border-[#20C7A4]/30 bg-[#EAF8F4] p-4 text-[#123F37] shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#20C7A4]">
                {taskCompleted ? "Task completed" : "Task started"}
              </p>
              <p className="mt-2 text-lg font-black">
                {currentSetReps}/{taskTarget} {getExerciseLabel(taskExercise)} reps
              </p>
              <p className="mt-1 text-sm text-[#6B7773]">
                Track with camera, motion, interactive, or trust proof. Stronger proof earns stronger points.
              </p>
            </div>
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", taskCompleted ? "bg-[#123F37] text-white animate-medal-pop" : "bg-white text-[#123F37]")}>
              {taskCompleted ? <Medal className="h-6 w-6" /> : <Dumbbell className="h-6 w-6" />}
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#20C7A4] transition-all duration-500" style={{ width: `${routineProgress}%` }} />
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-[20px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isCombinedExperience && workoutFlowStep === "activity" && (
        <section className="space-y-4 rounded-[22px] border border-border bg-white p-4 shadow-sm dark:bg-card">
          <div>
            <h2 className="text-xl font-black text-[#17201E] dark:text-foreground">Choose workout activity</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Start with a custom set or pick a guided challenge.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("quick");
                setProgram("custom");
                programRef.current = "custom";
                setActivePreset(null);
                setWorkoutFlowStep("setup");
                resetSession();
              }}
              className="min-h-[148px] rounded-[20px] border border-[#DDE8E4] bg-[#F7FAF9] p-4 text-left transition hover:border-[#20C7A4]/60 hover:bg-white"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#EAF8F4] text-[#15483F]">
                <Dumbbell className="h-7 w-7" />
              </span>
              <span className="mt-4 block text-base font-black text-[#17201E]">Quick workout</span>
              <span className="mt-1 block text-sm leading-5 text-[#6B7773]">Choose exercise, reps, sets, rest, and tracking mode.</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("programs");
                setWorkoutFlowStep("setup");
              }}
              className="min-h-[148px] rounded-[20px] border border-[#DDE8E4] bg-[#F7FAF9] p-4 text-left transition hover:border-[#20C7A4]/60 hover:bg-white"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#FFF4D7] text-[#8B5B00]">
                <ListChecks className="h-7 w-7" />
              </span>
              <span className="mt-4 block text-base font-black text-[#17201E]">Programs</span>
              <span className="mt-1 block text-sm leading-5 text-[#6B7773]">Pick a guided routine with exercise order and rewards.</span>
            </button>
          </div>
        </section>
      )}

      {workoutFlowStep === "setup" && (
      <>
      {isCombinedExperience && (
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
      )}

      {activeTab === "programs" && !activePreset ? (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-black text-[#17201E]">Programs</h2>
            <p className="mt-1 text-sm leading-5 text-[#6B7773]">
              Pick a challenge, earn points, and build a streak.
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {["All Programs", ...FILTER_CHIPS].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setActiveFilter(chip)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-black transition",
                  activeFilter === chip
                    ? "border-[#20C7A4] bg-[#EAF8F4] text-[#15483F]"
                    : "border-[#DDE8E4] bg-white text-[#6B7773]"
                )}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#17201E]">Recommended for you</h3>
              <Sparkles className="h-4 w-4 text-[#20C7A4]" />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recommendedPresets.map((preset) => programCard(preset, "carousel"))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#17201E]">All Programs</h3>
                <p className="mt-0.5 text-xs text-[#6B7773]">{filteredPresets.length} challenges ready</p>
              </div>
              {activeFilter !== "All Programs" && (
                <button type="button" onClick={() => setActiveFilter("All Programs")} className="text-xs font-bold text-[#20C7A4]">
                  Clear
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredPresets.map((preset) => programCard(preset))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isCombinedExperience) {
                setActiveTab("quick");
                setProgram("custom");
                programRef.current = "custom";
                setActivePreset(null);
                resetSession();
                return;
              }
              router.push("/hub/workout/quick");
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
          <section className="rounded-[22px] border border-border bg-white p-4 shadow-sm dark:bg-card">
            <div className={cn("grid gap-4 lg:items-end", activePreset ? "lg:grid-cols-1" : "lg:grid-cols-[1.4fr_1fr]")}>
              <div className="relative">
                <label className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                  {activePreset ? "First program move" : "Exercise"}
                </label>
                <button
                  type="button"
                  disabled={modeLocked}
                  onClick={() => setShowExerciseMenu((value) => !value)}
                  className="mt-2 flex min-h-12 w-full items-center justify-between rounded-2xl border border-input bg-background px-4 text-left text-sm font-semibold disabled:opacity-70"
                >
                  <span className="truncate">{activeStep?.type === "timed" ? activeStep.label : selectedExerciseLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
                {showExerciseMenu && !modeLocked && (
                  <div className="absolute left-0 right-0 top-[76px] z-30 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-xl">
                    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-input bg-background px-3">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        value={exerciseSearch}
                        onChange={(event) => setExerciseSearch(event.target.value)}
                        placeholder="Search exercises"
                        className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                      />
                    </div>
                    <div className="mt-2 max-h-72 overflow-y-auto">
                      {filteredExercises.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setExercise(item.key);
                            exerciseRef.current = item.key;
                            setExerciseSearch("");
                            setShowExerciseMenu(false);
                            resetSession();
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-secondary"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{item.label}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.target}</span>
                          </span>
                          {exercise === item.key && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {activePreset ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[16px] bg-[#F7FAF9] p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6B7773]">Moves</p>
                    <p className="mt-1 text-lg font-black text-[#17201E]">{activePreset.exercises.length}</p>
                  </div>
                  <div className="rounded-[16px] bg-[#F7FAF9] p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6B7773]">Estimate</p>
                    <p className="mt-1 text-lg font-black text-[#17201E]">{activePreset.durationMin} min</p>
                  </div>
                  <div className="rounded-[16px] bg-[#F7FAF9] p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6B7773]">First target</p>
                    <p className="mt-1 text-lg font-black text-[#17201E]">
                      {activeRoutineStep?.type === "timed"
                        ? `${activeRoutineStep.seconds}s`
                        : activeRoutineStep?.type === "work"
                          ? `${activeRoutineStep.reps} reps`
                          : "Ready"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {([
                    [isTimedExercise ? "Seconds" : "Reps", customReps, setCustomReps, isTimedExercise ? 5 : 1, isTimedExercise ? 600 : 100],
                    ["Sets", customSets, setCustomSets, 1, 20],
                    ["Break", customRestSeconds, setCustomRestSeconds, 0, 300],
                  ] as Array<[string, number, (value: number) => void, number, number]>).map(([label, value, setter, min, max]) => (
                    <label key={String(label)} className="space-y-1">
                      <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
                      <input
                        type="number"
                        min={Number(min)}
                        max={Number(max)}
                        disabled={modeLocked || isTaskMode}
                        value={Number(value)}
                        onChange={(event) => setter(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
                        className="h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm font-semibold tabular-nums outline-none disabled:opacity-60"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">{customDescription}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-secondary px-3 py-1 font-semibold text-primary">
                {activeTrackingLabel}
              </span>
              <span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">
                {PROOF_LABELS[activeProofSource]}
              </span>
              <span className="text-muted-foreground">{activeTrackingProfile.motionHint}</span>
            </div>
          </section>

          <section className="rounded-[22px] border border-border bg-white p-4 shadow-sm dark:bg-card">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="space-y-2">
                <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Workout mode
                </span>
                <select
                  value={trackingMode === "interactive" ? `interactive:${interactiveMode}` : trackingMode}
                  onChange={(event) => updateTrackingModeSelection(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm font-semibold outline-none"
                >
                  <option value="trust">Manual Mode - 1x points</option>
                  <option value="interactive:tap">Tap Mode - 2x points</option>
                  <option value="interactive:audio">Voice Assisted Mode - 2x points</option>
                  <option value="camera" disabled={manualExerciseLaunch}>Camera Coach - 4x points</option>
                  <option value="motion" disabled={manualExerciseLaunch || !activeTrackingProfile.motion}>Phone Motion - 4x points</option>
                </select>
              </label>
            </div>
          </section>

          {activePreset && (
            <section className="rounded-[22px] border border-[#CFECE4] bg-[#F7FAF9] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#17201E]">{activePreset.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[#6B7773]">
                    {activePreset.exercises.length} exercises • {activePreset.durationMin} min • {activePreset.pointsReward} points
                  </p>
                </div>
                <Flame className="h-5 w-5 shrink-0 text-[#20C7A4]" />
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {activePreset.exercises.map((item, index) => (
                  <span key={`${item.label}-${index}`} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#4C5F59]">
                    {formatPresetLine(item)} {item.label}
                  </span>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <button
              type="button"
              onClick={() => {
                if (isCombinedExperience) {
                  setWorkoutFlowStep("activity");
                  return;
                }
                router.push("/hub/workout");
              }}
              className="min-h-12 rounded-full border border-border px-5 text-sm font-semibold text-muted-foreground"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSetButtonClick}
              disabled={status === "loading" || (hasActiveTracking && !canStartSession && status !== "running" && status !== "rest" && status !== "countdown")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground shadow-sm disabled:opacity-60"
            >
              {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              {activePreset ? "Start program" : "Start workout"}
            </button>
          </div>
        </>
      )}
      </>
      )}

      {workoutFlowStep === "active" && (
        <>

          <section
            ref={analyzerShellRef}
            className={cn(
              "overflow-hidden bg-neutral-900 shadow-sm",
              isFullscreen ? "h-screen w-screen rounded-none border-0" : "rounded-[24px] border border-border"
            )}
          >
            <div className={cn("relative w-full", isFullscreen ? "h-screen min-h-screen" : "h-[72vh] min-h-[560px] sm:h-[76vh] sm:min-h-[640px]")}>
              <video
                ref={videoRef}
                className={cn("h-full w-full object-cover", cameraFacingMode === "user" && "scale-x-[-1]")}
                muted
                playsInline
              />
              {showPoseOverlay && (
                <canvas
                  ref={canvasRef}
                  className={cn("absolute inset-0 h-full w-full object-cover", cameraFacingMode === "user" && "scale-x-[-1]")}
                />
              )}

              {trackingMode !== "camera" && isWorkoutSurfaceActive && (
                <div className="absolute inset-0 overflow-hidden bg-[#071512] text-white">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(32,199,164,0.22),transparent_34%),linear-gradient(180deg,#0B211D_0%,#06110F_58%,#030806_100%)]" />
                  <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-[#20C7A4]/10 blur-3xl" />
                  <div className="absolute -right-20 bottom-20 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />

                  <div className="relative z-10 flex h-full flex-col px-5 pb-5 pt-20">
                    <div className="text-center">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200/80">
                        {activeStep?.type === "timed" ? activeStep.label : selectedExerciseLabel}
                      </p>
                      <p className="mt-3 text-2xl font-black tracking-normal text-white">{stageStatus}</p>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-5">
                      {routinePhase === "summary" && lastSetSummary ? (
                        <div className="w-full max-w-md rounded-[28px] border border-emerald-100/20 bg-white/12 p-5 text-center shadow-[0_0_60px_rgba(32,199,164,0.18)] backdrop-blur">
                          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-200" />
                          <p className="mt-3 text-2xl font-black">Set complete</p>
                          <p className="mt-2 text-sm font-semibold text-emerald-50/80">
                            {lastSetSummary.reps ? `${lastSetSummary.reps} reps` : lastSetSummary.label} • {formatSessionTime(lastSetSummary.seconds)}
                          </p>
                          {lastSetSummary.effort && (
                            <p className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-emerald-50">
                              {coachSuggestion?.message ?? lastSetSummary.coachNote}
                            </p>
                          )}
                          <div className="mt-5 grid gap-2 sm:grid-cols-3">
                            <button type="button" onClick={handleContinueAfterSet} className="min-h-12 rounded-full bg-emerald-200 px-5 text-sm font-black text-[#071512] sm:col-span-1">
                              {continueSetLabel}
                            </button>
                            <button type="button" onClick={() => takeShortBreak(10)} className="min-h-12 rounded-full border border-white/15 bg-white/10 px-5 text-sm font-black text-white">
                              10s break
                            </button>
                            <button type="button" onClick={finishWorkout} className="min-h-12 rounded-full border border-white/15 bg-white/10 px-5 text-sm font-black text-white">
                              Finish
                            </button>
                          </div>
                        </div>
                      ) : status === "rest" ? (
                        <div className="text-center">
                          <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full border border-emerald-200/20 bg-white/8 shadow-[0_0_70px_rgba(32,199,164,0.22)] animate-pulse">
                            <span className="text-6xl font-black tabular-nums">{routineRemaining ?? 0}</span>
                          </div>
                          <p className="mt-5 text-lg font-black">Recover. Next: {nextExerciseLabel}.</p>
                        </div>
                      ) : (
                        <>
                          {trackingMode === "interactive" && interactiveMode === "audio" && (
                            <div className="flex h-24 items-end justify-center gap-1.5">
                              {[0.34, 0.62, 0.44, 0.82, 0.52, 1, 0.58, 0.76, 0.4, 0.66, 0.36].map((height, index) => (
                                <span
                                  key={`${height}-${index}`}
                                  className={cn(
                                    "w-2 rounded-full bg-emerald-200/80 shadow-[0_0_18px_rgba(110,231,183,0.55)] transition-all",
                                    status === "running" && "animate-pulse"
                                  )}
                                  style={{
                                    height: `${28 + height * 72}px`,
                                    animationDuration: `${Math.max(520, 1150 - currentSetReps * 18)}ms`,
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {trackingMode === "motion" && (
                            <div className="relative flex h-36 w-36 items-center justify-center">
                              <div
                                className="absolute rounded-full bg-emerald-300/20 blur-xl transition-all"
                                style={{
                                  inset: `${Math.max(4, 30 - motionEnergy * 22)}px`,
                                  opacity: 0.36 + motionEnergy * 0.46,
                                }}
                              />
                              <div
                                className="flex h-28 w-28 items-center justify-center rounded-full border border-emerald-100/30 bg-white/10 shadow-[0_0_52px_rgba(32,199,164,0.25)] transition-transform"
                                style={{ transform: `scale(${1 + motionEnergy * 0.18})` }}
                              >
                                <Activity className="h-11 w-11 text-emerald-100" />
                              </div>
                            </div>
                          )}

                          {trackingMode === "trust" && (
                            <div className="rounded-[28px] border border-emerald-100/20 bg-white/10 px-8 py-6 text-center shadow-[0_0_60px_rgba(32,199,164,0.18)]">
                              <p className="text-3xl font-black">{selectedExerciseLabel}</p>
                              <p className="mt-2 text-lg font-semibold text-emerald-100">
                                {targetSeconds ? `${targetSeconds} sec` : displayTargetReps ? `${displayTargetReps} reps` : formatSessionTime(sessionSeconds)}
                              </p>
                            </div>
                          )}

                          <div
                            className="relative flex h-56 w-56 items-center justify-center rounded-full"
                            style={{
                              background: `conic-gradient(#6EE7B7 ${routineProgress}%, rgba(255,255,255,0.16) ${routineProgress}% 100%)`,
                            }}
                          >
                            <div className="flex h-[13rem] w-[13rem] flex-col items-center justify-center rounded-full bg-[#071512] shadow-inner">
                              <p className="text-6xl font-black leading-none tabular-nums">{stageRepLabel}</p>
                              <p className="mt-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-100/80">{stageUnitLabel}</p>
                            </div>
                          </div>

                          {trackingMode === "interactive" && interactiveMode === "tap" && (
                            <button
                              type="button"
                              onClick={handleTapRep}
                              className={cn(
                                "min-h-28 w-full max-w-md rounded-[30px] border border-emerald-100/25 bg-emerald-300/14 text-2xl font-black text-emerald-50 shadow-[0_0_46px_rgba(32,199,164,0.18)] transition active:scale-[0.98]",
                                tapPulse % 2 === 1 && "ring-4 ring-emerald-200/30"
                              )}
                            >
                              TAP FOR REP
                            </button>
                          )}

                          {trackingMode === "trust" && status === "running" && (
                            <div className="grid w-full max-w-md grid-cols-2 gap-2">
                              <button type="button" onClick={confirmTrustSet} className="min-h-14 rounded-full bg-emerald-200 px-5 text-sm font-black text-[#071512]">
                                Completed
                              </button>
                              <button type="button" onClick={() => endCurrentSet()} className="min-h-14 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-black text-white">
                                Did fewer
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {spokenCue && (
                        <div className="flex max-w-md items-center gap-3 rounded-full border border-emerald-100/20 bg-white/12 px-4 py-3 shadow-[0_0_32px_rgba(32,199,164,0.18)] backdrop-blur">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-[#071512] shadow-[0_0_24px_rgba(110,231,183,0.7)] animate-pulse">
                            <Volume2 className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-semibold text-emerald-50">{spokenCue}</span>
                        </div>
                      )}

                    </div>

                    <div className="relative z-10 rounded-[24px] border border-white/10 bg-white/10 p-3 backdrop-blur">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-emerald-50/80">
                        <span>{activeSetLabel} of {setTotal}</span>
                        <span>{targetSeconds ? `${targetSeconds}s` : `Target ${displayTargetReps ?? "--"}`}</span>
                        <span>{status === "rest" ? `Rest ${formatSessionTime(routineRemaining ?? 0)}` : formatSessionTime(sessionSeconds)}</span>
                      </div>
                      {routinePhase !== "summary" && (
                        <div className="mt-3 grid grid-cols-[auto_1fr_auto] gap-2">
                          <button type="button" onClick={() => nudgeRepCount(-1, activeProofSource)} className="min-h-11 rounded-full border border-white/15 bg-white/10 px-5 text-lg font-black text-white">
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={handleSetButtonClick}
                            disabled={status === "loading" || (hasActiveTracking && !canStartSession && status !== "running" && status !== "rest" && status !== "countdown")}
                            className="min-h-11 rounded-full bg-emerald-200 px-5 text-sm font-black text-[#071512] disabled:opacity-50"
                          >
                            {hasActiveTracking ? primaryActionLabel : "Start set"}
                          </button>
                          <button type="button" onClick={() => nudgeRepCount(1, activeProofSource)} className="min-h-11 rounded-full border border-white/15 bg-white/10 px-5 text-lg font-black text-white">
                            +1
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-3">
                <div className="min-w-0 rounded-full bg-white/92 px-4 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur">
                  <span className="block max-w-[180px] truncate">{activeStep?.type === "timed" ? activeStep.label : selectedExerciseLabel}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {trackingMode === "camera" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (streamRef.current) shouldRestartCameraRef.current = true;
                        setCameraFacingMode((mode) => (mode === "user" ? "environment" : "user"));
                      }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/92 px-4 text-sm font-semibold text-foreground shadow-sm backdrop-blur"
                      title="Switch camera"
                    >
                      <Camera className="h-4 w-4" />
                      {cameraFacingMode === "user" ? "Front" : "Back wide"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-foreground shadow-sm backdrop-blur"
                    title="Workout settings"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-foreground shadow-sm backdrop-blur"
                    title={isFullscreen ? "Exit fullscreen" : "Fullscreen workout"}
                  >
                    {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {!isWorkoutSurfaceActive && (
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

              {weakCameraPrompt && (
                <div className="absolute left-4 right-4 top-32 z-20 rounded-[18px] border border-amber-200 bg-white/95 p-3 text-foreground shadow-lg backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Camera tracking is weak</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Continue this same mission with {activeTrackingProfile.motion ? "Motion Mode" : "Tap-to-Rep"} without restarting.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTrackingProfile.motion) void chooseTrackingMode("motion");
                        else void chooseTrackingMode("interactive", "tap");
                      }}
                      className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Switch
                    </button>
                  </div>
                </div>
              )}

              {trackingMode === "camera" && (
                <div className="absolute left-4 right-4 top-1/2 z-10 flex -translate-y-1/2 justify-center">
                  <div className="rounded-full bg-white/92 px-4 py-2 text-center text-sm font-semibold text-foreground shadow-sm backdrop-blur">
                    {coachingText}
                  </div>
                </div>
              )}

              {repFlash != null && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border border-white/40 bg-primary text-6xl font-black tabular-nums text-primary-foreground shadow-lg animate-in zoom-in-75 fade-in duration-150">
                    {repFlash}
                  </div>
                </div>
              )}

              {trackingMode === "camera" && (
              <div
                className={cn(
                  "absolute left-4 right-4 z-10 space-y-4",
                  routinePhase === "summary" && lastSetSummary
                    ? "top-1/2 -translate-y-1/2"
                    : "bottom-4"
                )}
              >
                {routinePhase === "summary" && lastSetSummary ? (
                  <div className="rounded-[22px] bg-white/94 p-4 text-foreground shadow-sm backdrop-blur">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                    <p className="mt-3 text-center text-lg font-black">Set complete</p>
                    <p className="mt-1 text-center text-sm font-semibold">
                      Set complete - {lastSetSummary.reps ? `${lastSetSummary.reps} reps` : lastSetSummary.label} • {formatSessionTime(lastSetSummary.seconds)}
                    </p>
                    {lastSetSummary.effort && (
                      <div className="mt-3 rounded-2xl bg-secondary/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                              Felt {lastSetSummary.effort}
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {coachSuggestion?.message ?? lastSetSummary.coachNote}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={listenForCoachResponse}
                            className={cn(
                              "min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold",
                              coachListening ? "bg-primary text-primary-foreground" : "bg-white text-foreground"
                            )}
                          >
                            {coachListening ? "Listening" : "Voice"}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button type="button" onClick={handleContinueAfterSet} className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">
                        {continueSetLabel}
                      </button>
                      <button type="button" onClick={() => takeShortBreak(10)} className="min-h-11 rounded-full border border-border bg-white px-4 text-sm font-semibold">
                        10s break
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
                    <div className="rounded-[18px] border border-white/25 bg-white/14 p-3 text-white shadow-sm backdrop-blur-md">
                      <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.16em]">
                        <span>Range</span>
                        <span className="tabular-nums">{Math.round(repProgress)}%</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/25">
                        <div
                          className={cn("h-full rounded-full transition-all duration-150", trackingTone)}
                          style={{ width: `${clamp(repProgress, 4, 100)}%` }}
                        />
                      </div>
                    </div>
                    {status === "running" && trackingMode !== "camera" && (
                      <div className="rounded-[18px] border border-white/25 bg-white/14 p-3 text-white shadow-sm backdrop-blur-md">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{activeTrackingLabel}</p>
                            <p className="mt-0.5 truncate text-xs text-white/70">{PROOF_LABELS[activeProofSource]}</p>
                          </div>
                          {trackingMode === "interactive" && interactiveMode === "tap" && (
                            <button
                              type="button"
                              onClick={() => registerFallbackRep("tap", "Manual rep confirmed.")}
                              className="min-h-12 shrink-0 rounded-full bg-white px-5 text-sm font-black text-neutral-950"
                            >
                              Count rep
                            </button>
                          )}
                          {trackingMode === "trust" && (
                            <button
                              type="button"
                              onClick={confirmTrustSet}
                              className="min-h-12 shrink-0 rounded-full bg-white px-5 text-sm font-black text-neutral-950"
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                        {trackingMode === "interactive" && interactiveMode === "audio" && (
                          <p className="mt-2 text-xs text-white/75">Say each rep or use a clear breath/impact rhythm.</p>
                        )}
                        {trackingMode === "motion" && (
                          <p className="mt-2 text-xs text-white/75">{activeTrackingProfile.motionHint}</p>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleSetButtonClick}
                      disabled={status === "loading" || (hasActiveTracking && !canStartSession && status !== "running" && status !== "rest" && status !== "countdown")}
                      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
                    >
                      {!hasActiveTracking && status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : hasActiveTracking ? primaryActionIcon : <Camera className="h-5 w-5" />}
                      {hasActiveTracking ? primaryActionLabel : "Start set"}
                    </button>
                  </>
                )}
              </div>
              )}
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

      {rewardPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-[26px] border border-[#CFECE4] bg-white p-5 text-center shadow-[0_24px_70px_rgba(7,21,18,0.22)] dark:bg-card">
            <button
              type="button"
              onClick={() => setRewardPopup(null)}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              aria-label="Close reward"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mx-auto mt-1 flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF8F4] text-[#15483F] animate-medal-pop">
              <Medal className="h-10 w-10" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-[#17201E]">{rewardPopup.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#6B7773]">{rewardPopup.message}</p>
            <div className="mx-auto mt-5 inline-flex items-center rounded-full bg-[#15483F] px-5 py-2 text-lg font-black text-white">
              +{rewardPopup.points} pts
            </div>
            {rewardPopup.totalPoints != null && (
              <p className="mt-3 text-xs font-bold text-[#6B7773]">
                Total: {rewardPopup.totalPoints.toLocaleString()} pts
                {rewardPopup.rankTitle ? ` • ${rewardPopup.rankTitle}` : ""}
              </p>
            )}
            <button
              type="button"
              onClick={() => setRewardPopup(null)}
              className="mt-5 min-h-11 w-full rounded-full bg-[#20C7A4] text-sm font-black text-[#071512]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {showTrackingPicker && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-[24px] bg-white p-5 shadow-xl sm:max-w-xl dark:bg-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold text-foreground">How do you want to track?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start simple first. You can switch to camera or sensors anytime.
                </p>
              </div>
              <button type="button" onClick={() => setShowTrackingPicker(false)} className="rounded-full p-2 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void chooseTrackingMode("trust")}
              className="mt-5 w-full rounded-[22px] border border-primary bg-secondary p-4 text-left shadow-sm transition hover:border-primary/80"
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-black text-foreground">Recommended: Manual Mode</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Works on every phone. No camera, microphone, or setup needed.
                  </span>
                </span>
                <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-foreground">
                  1x pts
                </span>
              </span>
              <span className="mt-3 block text-xs font-semibold text-primary">Self-confirm each set and keep training</span>
            </button>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={manualExerciseLaunch}
                onClick={() => void chooseTrackingMode("camera")}
                className={cn(
                  "min-h-[118px] rounded-[20px] border border-border bg-background p-4 text-left transition hover:border-primary/50",
                  manualExerciseLaunch && "cursor-not-allowed opacity-50"
                )}
              >
                <span className="block text-sm font-black text-foreground">Camera Coach</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Automatic rep counting plus form guidance.</span>
                <span className="mt-3 block text-xs font-semibold text-primary">4x points multiplier</span>
              </button>

              <button
                type="button"
                disabled={manualExerciseLaunch || !activeTrackingProfile.motion}
                onClick={() => void chooseTrackingMode("motion")}
                className={cn(
                  "min-h-[118px] rounded-[20px] border border-border bg-background p-4 text-left transition hover:border-primary/50",
                  (manualExerciseLaunch || !activeTrackingProfile.motion) && "cursor-not-allowed opacity-50"
                )}
              >
                <span className="block text-sm font-black text-foreground">Phone Motion</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Uses your phone sensors to track movement.</span>
                <span className="mt-3 block text-xs font-semibold text-primary">
                  {activeTrackingProfile.motion ? "4x points multiplier" : "Not ideal for this exercise"}
                </span>
              </button>
            </div>

            <div className="mt-5 rounded-[20px] border border-border bg-background p-3">
              <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Interactive options
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {INTERACTIVE_OPTIONS.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => void chooseTrackingMode("interactive", option.mode)}
                    className={cn(
                      "min-h-[104px] rounded-[18px] border p-3 text-left transition",
                      interactiveMode === option.mode ? "border-primary bg-secondary" : "border-border bg-white dark:bg-card"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="block text-sm font-black text-foreground">{option.title}</span>
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-black text-primary">2x</span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void chooseTrackingMode("trust")}
                className="mt-3 min-h-11 w-full rounded-full border border-border bg-white px-4 text-sm font-semibold text-muted-foreground dark:bg-card"
              >
                Manual Mode
                <span className="ml-2 text-xs text-muted-foreground">1x</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPreset && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-[24px] bg-white p-5 shadow-xl sm:max-w-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-black text-[#17201E]">{selectedPreset.name}</p>
                <p className="mt-1 text-sm leading-5 text-[#6B7773]">{selectedPreset.tagline}</p>
              </div>
              <button type="button" onClick={() => setSelectedPreset(null)} className="rounded-full p-2 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 rounded-[20px] border border-[#CFECE4] bg-[#F7FAF9] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#15483F] px-3 py-1 text-xs font-black text-white">
                  Complete all {selectedPreset.exercises.length} moves to earn +{selectedPreset.pointsReward} points
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#15483F]">{selectedPreset.difficulty}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <span>
                  <span className="block font-black text-[#17201E]">{selectedPreset.durationMin} min</span>
                  <span className="text-[#6B7773]">Estimated</span>
                </span>
                <span>
                  <span className="block font-black text-[#17201E]">{selectedPreset.exercises.length}</span>
                  <span className="text-[#6B7773]">Exercises</span>
                </span>
                <span>
                  <span className="block truncate font-black text-[#17201E]">{selectedPreset.goal}</span>
                  <span className="text-[#6B7773]">Main goal</span>
                </span>
              </div>
              <p className="mt-3 text-xs font-bold text-[#6B7773]">
                {selectedPreset.calories} calories estimated • {selectedPreset.equipment}
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6B7773]">Workout order</p>
              {selectedPreset.exercises.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-2xl border border-[#DDE8E4] px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#17201E]">
                      {index + 1}. {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6B7773]">
                      {item.exercise ? getExerciseLabel(item.exercise) : "Timed movement"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-[#15483F]">{formatPresetLine(item)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] bg-[#F7FAF9] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6B7773]">Muscles trained</p>
                <p className="mt-2 text-sm font-bold leading-5 text-[#17201E]">{selectedPreset.muscles.join(" • ")}</p>
              </div>
              <div className="rounded-[18px] bg-[#F7FAF9] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6B7773]">Tracking modes</p>
                <p className="mt-2 text-sm font-bold leading-5 text-[#17201E]">{getPresetTrackingModes(selectedPreset).join(" • ")}</p>
              </div>
            </div>

            <div className="mt-3 rounded-[18px] bg-[#F7FAF9] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6B7773]">Bonus points</p>
              <p className="mt-2 text-sm leading-5 text-[#4C5F59]">
                Finish without skipping, complete every set, keep your streak, or beat your previous time.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => toggleFavorite(selectedPreset.id)} className="min-h-11 rounded-full border border-[#DDE8E4] text-sm font-bold">
                {favoritePresetIds.has(selectedPreset.id) ? "Favorited" : "Favorite"}
              </button>
              <button type="button" onClick={() => toggleSaved(selectedPreset.id)} className="min-h-11 rounded-full border border-[#DDE8E4] text-sm font-bold">
                {savedPresetIds.has(selectedPreset.id) ? "Saved" : "Save"}
              </button>
              <button type="button" onClick={() => startPresetWorkout(selectedPreset)} className="min-h-11 rounded-full bg-[#20C7A4] text-sm font-black text-[#071512]">
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
                onClick={() => {
                  if (streamRef.current) shouldRestartCameraRef.current = true;
                  setCameraFacingMode((mode) => (mode === "user" ? "environment" : "user"));
                }}
                className="flex min-h-12 items-center justify-between rounded-2xl border border-border px-4 text-left"
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <Camera className="h-4 w-4 text-primary" />
                  Camera
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{cameraFacingMode === "user" ? "Front" : "Back wide"}</span>
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
