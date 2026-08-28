import { getMuscleName, type Muscle } from "@/lib/MuscleMapJS/src";

export type ExerciseMedia = {
  exerciseId: string;
  name: string;
  imageUrl?: string;
  imageUrls?: Partial<Record<"360p" | "480p" | "720p" | "1080p", string>>;
  videoUrl?: string;
  equipments?: string[];
  bodyParts?: string[];
  exerciseType?: string;
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  overview?: string;
  instructions?: string[];
  exerciseTips?: string[];
  variations?: string[];
  attribution?: string;
  source?: string;
};

export const muscleWorkoutMap: Partial<Record<Muscle, { exercise: string; label: string }>> = {
  abs: { exercise: "plank", label: "Plank" },
  "upper-abs": { exercise: "crunch", label: "Crunches" },
  "lower-abs": { exercise: "legRaise", label: "Leg raises" },
  obliques: { exercise: "sidePlank", label: "Side plank" },
  chest: { exercise: "pushup", label: "Push-ups" },
  "upper-chest": { exercise: "pushup", label: "Push-ups" },
  "lower-chest": { exercise: "pushup", label: "Push-ups" },
  biceps: { exercise: "bicepCurl", label: "Bicep curls" },
  triceps: { exercise: "pushup", label: "Close push-ups" },
  deltoids: { exercise: "overheadPress", label: "Overhead press" },
  "front-deltoid": { exercise: "overheadPress", label: "Overhead press" },
  "rear-deltoid": { exercise: "overheadPress", label: "Shoulder press" },
  forearm: { exercise: "bicepCurl", label: "Bicep curls" },
  quadriceps: { exercise: "squat", label: "Squats" },
  "inner-quad": { exercise: "squat", label: "Squats" },
  "outer-quad": { exercise: "squatJump", label: "Squat jumps" },
  "hip-flexors": { exercise: "highKnees", label: "High knees" },
  hamstring: { exercise: "reverseLunge", label: "Reverse lunges" },
  adductors: { exercise: "forwardLunge", label: "Forward lunges" },
  gluteal: { exercise: "gluteBridge", label: "Glute bridges" },
  calves: { exercise: "calfRaise", label: "Calf raises" },
  tibialis: { exercise: "highKnees", label: "High knees" },
  "upper-back": { exercise: "pullup", label: "Pull-ups" },
  "lower-back": { exercise: "gluteBridge", label: "Glute bridges" },
  trapezius: { exercise: "pullup", label: "Pull-ups" },
  "upper-trapezius": { exercise: "pullup", label: "Pull-ups" },
  "lower-trapezius": { exercise: "pullup", label: "Pull-ups" },
  rhomboids: { exercise: "pullup", label: "Pull-ups" },
  "rotator-cuff": { exercise: "overheadPress", label: "Overhead press" },
  serratus: { exercise: "pushup", label: "Push-ups" },
};

export function formatMuscleName(muscle: Muscle | string) {
  try {
    return getMuscleName(muscle as Muscle).replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return muscle.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export function getWorkoutForMuscle(muscle: string) {
  return muscleWorkoutMap[muscle as Muscle] ?? { exercise: "pushup", label: "Workout" };
}

export const exerciseMuscleMap: Record<string, Muscle[]> = {
  pushup: ["chest", "triceps", "serratus"],
  bicepCurl: ["biceps", "forearm"],
  squat: ["quadriceps", "gluteal"],
  pullup: ["upper-back", "biceps", "trapezius"],
  plank: ["abs", "obliques"],
  gluteBridge: ["gluteal", "lower-back", "hamstring"],
  reverseLunge: ["quadriceps", "hamstring", "gluteal"],
  forwardLunge: ["quadriceps", "adductors", "gluteal"],
  jumpingJacks: ["calves", "deltoids"],
  highKnees: ["hip-flexors", "abs", "tibialis"],
  mountainClimbers: ["abs", "hip-flexors", "deltoids"],
  crunch: ["abs", "upper-abs"],
  situp: ["abs", "hip-flexors"],
  burpee: ["chest", "quadriceps", "gluteal"],
  calfRaise: ["calves"],
  wallSit: ["quadriceps", "gluteal"],
  sidePlank: ["obliques", "abs"],
  legRaise: ["lower-abs", "hip-flexors"],
  shoulderTaps: ["abs", "deltoids", "triceps"],
  squatJump: ["quadriceps", "gluteal", "calves"],
  overheadPress: ["deltoids", "triceps", "trapezius"],
};

export type MuscleTrainingProfile = Record<string, { score: number; lastTrainedAt: number; volume: number }>;

export const MUSCLE_TRAINING_STORAGE_KEY = "openhealth-muscle-training-profile";

export function getDecayedMuscleScore(value: { score: number; lastTrainedAt: number }) {
  const daysIdle = Math.max(0, (Date.now() - value.lastTrainedAt) / 86_400_000);
  return Math.max(0, Math.round(value.score * Math.pow(0.92, daysIdle)));
}

export function getMuscleSuggestion(score: number, lastTrainedAt?: number) {
  if (lastTrainedAt && Date.now() - lastTrainedAt < 20 * 60 * 60 * 1000 && score >= 55) return "Needs recovery time";
  if (score < 30) return "Do more";
  if (score < 70) return "Good momentum";
  return "Well trained";
}

export function getMusclesForExercise(exerciseKey: string, fallbackMuscle?: string) {
  return exerciseMuscleMap[exerciseKey] ?? (fallbackMuscle ? [fallbackMuscle as Muscle] : []);
}

export function getLocalDatasetTerms(muscle: string) {
  const normalized = muscle.toLowerCase();
  const terms: Record<string, string[]> = {
    abs: ["abs", "waist", "core"],
    "upper-abs": ["abs", "waist"],
    "lower-abs": ["abs", "waist"],
    obliques: ["obliques", "waist"],
    chest: ["pectorals", "chest"],
    "upper-chest": ["pectorals", "chest"],
    "lower-chest": ["pectorals", "chest"],
    biceps: ["biceps", "upper arms"],
    triceps: ["triceps", "upper arms"],
    deltoids: ["delts", "shoulders"],
    "front-deltoid": ["delts", "shoulders"],
    "rear-deltoid": ["delts", "shoulders"],
    forearm: ["forearms", "lower arms"],
    quadriceps: ["quads", "upper legs"],
    "inner-quad": ["quads", "upper legs"],
    "outer-quad": ["quads", "upper legs"],
    "hip-flexors": ["hip flexors", "upper legs"],
    hamstring: ["hamstrings", "upper legs"],
    adductors: ["adductors", "upper legs"],
    gluteal: ["glutes", "upper legs"],
    calves: ["calves", "lower legs"],
    tibialis: ["lower legs", "calves"],
    "upper-back": ["lats", "back", "traps"],
    "lower-back": ["spine", "back"],
    trapezius: ["traps", "back"],
    "upper-trapezius": ["traps", "back"],
    "lower-trapezius": ["traps", "back"],
    rhomboids: ["upper back", "back"],
    "rotator-cuff": ["shoulders", "back"],
    serratus: ["serratus", "chest"],
  };
  return terms[normalized] ?? [normalized.replace(/-/g, " ")];
}
