import { z } from "zod";
import { MAX_STEPS } from "../constants";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date format must be YYYY-MM-DD");

export const logFoodSchema = z.object({
  date: dateString,
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  foodId: z.string().uuid(),
  servingQty: z.number().positive(),
  servingId: z.string().uuid().optional(),
});

export const createFoodSchema = z.object({
  name: z.string().min(1).max(500),
  brand: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  barcode: z.string().max(50).optional(),
  servingSize: z.number().positive(),
  servingUnit: z.string().min(1).max(50),
  householdServing: z.string().max(100).optional(),
  calories: z.number().min(0),
  nutrients: z
    .array(
      z.object({
        nutrientId: z.number(),
        amount: z.number().min(0),
      })
    )
    .optional(),
  alternateServings: z
    .array(
      z.object({
        label: z.string(),
        grams: z.number().positive(),
      })
    )
    .optional(),
});

export const updateFoodSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(500).optional(),
  brand: z.string().max(255).nullish(),
  description: z.string().max(2000).nullish(),
  servingSize: z.number().positive().optional(),
  servingUnit: z.string().min(1).max(50).optional(),
  householdServing: z.string().max(100).nullish(),
  calories: z.number().min(0).optional(),
  nutrients: z
    .array(
      z.object({
        nutrientId: z.number(),
        amount: z.number().min(0),
      })
    )
    .optional(),
  alternateServings: z
    .array(
      z.object({
        label: z.string(),
        grams: z.number().positive(),
      })
    )
    .optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
  sex: z.enum(["male", "female", "other"]).nullable(),
  heightCm: z.number().positive().max(300).nullable(),
  currentWeightKg: z.number().positive().max(500).nullable().optional(),
  dateOfBirth: z.string().nullable(),
  activityLevel: z
    .enum([
      "sedentary",
      "lightly_active",
      "moderately_active",
      "very_active",
      "extremely_active",
    ])
    .nullable(),
  medicalConditions: z.array(z.string().min(1).max(80)).max(20).optional(),
  medications: z.string().max(1000).nullable().optional(),
  allergies: z.string().max(1000).nullable().optional(),
  dietaryPreference: z.string().max(80).nullable().optional(),
  primaryGoal: z.string().max(80).nullable().optional(),
  teamColor: z.enum(["red", "blue"]).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const updateGoalsSchema = z.object({
  goalType: z.enum(["lose", "maintain", "gain"]).nullable().optional(),
  targetWeightKg: z.number().positive().max(500).nullable().optional(),
  weeklyRateKg: z.number().positive().max(5).nullable().optional(),
  calorieTarget: z.number().int().positive().max(20000).nullable(),
  proteinG: z.number().nonnegative().max(2000).nullable(),
  carbsG: z.number().nonnegative().max(2000).nullable(),
  fatG: z.number().nonnegative().max(2000).nullable(),
  fiberG: z.number().nonnegative().max(500).nullable(),
});

export const logWeightSchema = z.object({
  date: dateString,
  weightKg: z.number().positive().max(500),
  note: z.string().max(500).optional(),
});

export const logStepsSchema = z.object({
  date: dateString,
  steps: z.number().int().min(0).max(MAX_STEPS),
  note: z.string().max(500).optional(),
});

export const logStepsBatchSchema = z.object({
  entries: z.array(z.object({
    date: dateString,
    steps: z.number().int().min(0).max(MAX_STEPS),
    note: z.string().max(500).optional(),
  })).min(1).max(30),
});

export const logWeightBatchSchema = z.object({
  entries: z.array(z.object({
    date: dateString,
    weightKg: z.number().positive().max(500),
    note: z.string().max(500).optional(),
  })).min(1).max(30),
});

export const logMeasurementsSchema = z.object({
  date: dateString,
  waistCm: z.number().positive().optional(),
  hipCm: z.number().positive().optional(),
  chestCm: z.number().positive().optional(),
  armCm: z.number().positive().optional(),
  thighCm: z.number().positive().optional(),
  neckCm: z.number().positive().optional(),
  bodyFatPct: z.number().min(0).max(100).optional(),
  note: z.string().max(500).optional(),
});

export const createFoodFromBarcodeSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1).max(500),
  brand: z.string().max(255).optional(),
  servingSize: z.number().positive(),
  servingUnit: z.string().min(1).max(50),
  calories: z.number().min(0),
  protein: z.number().min(0),
  fat: z.number().min(0),
  carbs: z.number().min(0),
  fiber: z.number().min(0).optional(),
  sugar: z.number().min(0).optional(),
  saturatedFat: z.number().min(0).optional(),
  transFat: z.number().min(0).optional(),
  cholesterol: z.number().min(0).optional(),
  sodium: z.number().min(0).optional(),
  imageUrl: z.string().optional(),
});

export const copyMealSchema = z.object({
  fromDate: dateString,
  toDate: dateString,
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

export const removeEntrySchema = z.object({
  entryId: z.string().uuid(),
});

export const updateEntryServingsSchema = z.object({
  entryId: z.string().uuid(),
  servingQty: z.number().min(0.5).max(99),
});

export const applyReferralCodeSchema = z.object({
  code: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9]+$/i, "Referral code can only contain letters and numbers"),
});

export const customizeReferralCodeSchema = z.object({
  code: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9]+$/i, "Referral code can only contain letters and numbers"),
});

export const logExerciseSchema = z.object({
  date: dateString,
  exerciseId: z.string().uuid(),
  durationMin: z.number().int().min(1).max(1440),
  caloriesBurned: z.number().min(0).max(99999).optional(),
  intensity: z.enum(["low", "moderate", "high"]).optional(),
  note: z.string().max(500).optional(),
});

export const createCustomExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(["cardio", "strength", "flexibility", "sport", "other"]).optional(),
  metValue: z.number().min(0).max(30).optional(),
});

export const connectToCoachSchema = z.object({
  code: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9]+$/i, "Coach code can only contain letters and numbers"),
});

// Workout tracking schemas
export const startWorkoutSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  templateId: z.string().uuid().optional(),
});

export const addExerciseToWorkoutSchema = z.object({
  workoutId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
});

export const logSetSchema = z.object({
  workoutExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0).max(9999).optional(),
  reps: z.number().int().min(0).max(9999).optional(),
  durationSec: z.number().int().min(0).optional(),
  rpe: z.number().min(1).max(10).optional(),
  isWarmup: z.boolean().optional(),
  isDropset: z.boolean().optional(),
});

export const removeSetSchema = z.object({
  setId: z.string().uuid(),
});

export const finishWorkoutSchema = z.object({
  workoutId: z.string().uuid(),
});

export const discardWorkoutSchema = z.object({
  workoutId: z.string().uuid(),
});

export const removeExerciseFromWorkoutSchema = z.object({
  workoutExerciseId: z.string().uuid(),
});

export const createWorkoutTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  exercises: z.array(
    z.object({
      exerciseId: z.string().uuid(),
      defaultSets: z.number().int().min(1).max(20).optional(),
      defaultReps: z.number().int().min(1).max(100).optional(),
      defaultWeightKg: z.number().min(0).max(9999).optional(),
    })
  ),
});

export const saveWorkoutAsTemplateSchema = z.object({
  workoutId: z.string().uuid(),
  name: z.string().min(1).max(200),
});

export const deleteWorkoutTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

// Throat exercise metadata
export const throatExerciseMetadataSchema = z.object({
  preset: z.enum(["quick", "standard", "full"]),
  exerciseIds: z.array(z.string()),
  completedCount: z.number().int().min(0),
  totalCount: z.number().int().min(1),
  completed: z.boolean().optional(),
});

// Activity sessions (shared exercise + meditation)
export const meditationMetadataSchema = z.object({
  meditationType: z.enum(["mindfulness", "breathing", "body_scan"]),
  sessionMode: z.enum(["guided", "unguided", "timer"]).optional(),
  plannedDurationSec: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
  moodBefore: z.number().int().min(1).max(5).optional(),
  moodAfter: z.number().int().min(1).max(5).optional(),
  feelingsBefore: z.array(z.string()).optional(),
  feelingsAfter: z.array(z.string()).optional(),
});

export const startActivitySessionSchema = z.object({
  type: z.enum(["exercise", "meditation", "throat_exercise", "eye_exercise"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const completeActivitySessionSchema = z.object({
  sessionId: z.string().uuid(),
  note: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const discardActivitySessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const logActivitySessionSchema = z.object({
  type: z.enum(["exercise", "meditation", "throat_exercise", "eye_exercise"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  durationSec: z.number().int().min(1).max(86400),
  note: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateCoachNotesSchema = z.object({
  clientId: z.string(),
  coachNotes: z.string().max(2000).optional(),
  calorieTarget: z.number().int().positive().max(20000).nullable().optional(),
  proteinPct: z.number().min(0).max(100).nullable().optional(),
  carbsPct: z.number().min(0).max(100).nullable().optional(),
  fatPct: z.number().min(0).max(100).nullable().optional(),
});

export const sendCoachMessageSchema = z.object({
  clientId: z.string(),
  content: z.string().min(1).max(1000),
});

export const markCoachMessagesReadSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(100),
});

// Sleep tracking
export const saveSleepSessionSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  sleepOnset: z.string().datetime(),
  wakeTime: z.string().datetime(),
  durationMinutes: z.number().int().min(0).max(1440),
  quality: z.number().int().min(0).max(100),
  detectionMethod: z.enum(["accelerometer", "microphone", "both"]),
  phases: z.array(
    z.object({
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
      phase: z.enum(["awake", "light", "deep", "rem"]),
    })
  ),
  movementSamples: z
    .array(z.object({ timestamp: z.number(), intensity: z.number() }))
    .optional(),
  note: z.string().max(500).optional(),
  factors: z.array(z.string()).optional(),
  debugMeta: z.record(z.string(), z.unknown()).optional(),
});

export const updateSleepGoalSchema = z.object({
  goalHours: z.number().min(1).max(24),
  alarmWindowMinutes: z.number().int().min(5).max(60),
});

// Posture detection (AirPods)
export const savePostureDetectionSessionSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  baselinePitch: z.number(),
  thresholdDegrees: z.number(),
  totalDurationMinutes: z.number().int().min(0),
  goodPostureMinutes: z.number().int().min(0),
  badPostureMinutes: z.number().int().min(0),
  averageDeviation: z.number(),
  maxDeviation: z.number(),
  slouchCount: z.number().int().min(0),
  notificationCount: z.number().int().min(0),
  score: z.number().int().min(0).max(100),
});
