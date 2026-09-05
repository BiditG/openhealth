// Extracted from Drizzle schema enums — single source of truth

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export const FOOD_SOURCES = [
  "usda",
  "openfoodfacts",
  "user",
  "verified",
  "family",
  "seven",
] as const;

export const NUTRIENT_CATEGORIES = [
  "macro",
  "vitamin",
  "mineral",
  "other",
] as const;

export const SEXES = ["male", "female", "other"] as const;

export const ACTIVITY_LEVELS = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extremely_active",
] as const;

export const GOAL_TYPES = ["lose", "maintain", "gain"] as const;

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;

export const TARGET_MODES = ["grams", "percentage"] as const;

// Nutrient IDs from seed data (serial order)
export const NUTRIENT_IDS = {
  protein: 1,
  totalFat: 2,
  totalCarbs: 3,
  fiber: 4,
  sugar: 5,
  saturatedFat: 7,
  transFat: 8,
  cholesterol: 11,
  vitaminA: 12,
  vitaminC: 13,
  vitaminD: 14,
  vitaminE: 15,
  vitaminK: 16,
  vitaminB1: 17,
  vitaminB2: 18,
  vitaminB3: 19,
  vitaminB5: 20,
  vitaminB6: 21,
  biotin: 22,
  folate: 23,
  vitaminB12: 24,
  choline: 25,
  calcium: 26,
  iron: 27,
  magnesium: 28,
  phosphorus: 29,
  potassium: 30,
  sodium: 31,
  zinc: 32,
  copper: 33,
  manganese: 34,
  selenium: 35,
  chromium: 36,
  molybdenum: 37,
  iodine: 38,
  water: 39,
} as const;

// Macro nutrient IDs already shown in the daily summary (protein, fat, carbs, fiber)
export const MACRO_NUTRIENT_IDS: readonly number[] = [
  NUTRIENT_IDS.protein,
  NUTRIENT_IDS.totalFat,
  NUTRIENT_IDS.totalCarbs,
  NUTRIENT_IDS.fiber,
];

export const NUTRIENT_CATEGORY_LABELS: Record<string, string> = {
  macro: "Macros",
  vitamin: "Vitamins",
  mineral: "Minerals",
  other: "Other",
};

// DB nutrient name → i18n key mapping (for use with nutrients.json translations)
export const NUTRIENT_I18N_KEY: Record<string, string> = {
  Protein: "protein",
  "Total Fat": "totalFat",
  "Total Carbohydrate": "totalCarbohydrate",
  "Dietary Fiber": "dietaryFiber",
  "Total Sugars": "totalSugars",
  "Added Sugars": "addedSugars",
  "Saturated Fat": "saturatedFat",
  "Trans Fat": "transFat",
  "Monounsaturated Fat": "monounsaturatedFat",
  "Polyunsaturated Fat": "polyunsaturatedFat",
  Cholesterol: "cholesterol",
  "Vitamin A": "vitaminA",
  "Vitamin C": "vitaminC",
  "Vitamin D": "vitaminD",
  "Vitamin E": "vitaminE",
  "Vitamin K": "vitaminK",
  "Thiamin (B1)": "vitaminB1",
  "Riboflavin (B2)": "vitaminB2",
  "Niacin (B3)": "vitaminB3",
  "Pantothenic Acid (B5)": "vitaminB5",
  "Vitamin B6": "vitaminB6",
  "Biotin (B7)": "vitaminB7",
  "Folate (B9)": "vitaminB9",
  "Vitamin B12": "vitaminB12",
  Choline: "choline",
  Calcium: "calcium",
  Iron: "iron",
  Magnesium: "magnesium",
  Phosphorus: "phosphorus",
  Potassium: "potassium",
  Sodium: "sodium",
  Zinc: "zinc",
  Copper: "copper",
  Manganese: "manganese",
  Selenium: "selenium",
  Chromium: "chromium",
  Molybdenum: "molybdenum",
  Iodine: "iodine",
  Water: "water",
  Caffeine: "caffeine",
  Alcohol: "alcohol",
};

export const DEFAULT_SERVING_SIZE = 100;

export const PLANS = ["free", "pro"] as const;
export const AI_FEATURES = ["ocr", "estimate", "chat"] as const;

export const PLAN_LIMITS = {
  free: {
    ai: { ocr: 3, estimate: 3, chat: 10 },
    micronutrients: false,
    exercise: false,
    fasting: false,
    progressPhotos: false,
    exportData: false,
    savedMealsLimit: 0,
  },
  pro: {
    ai: { ocr: Infinity, estimate: Infinity, chat: 100 },
    micronutrients: true,
    exercise: true,
    fasting: true,
    progressPhotos: true,
    exportData: true,
    savedMealsLimit: Infinity,
  },
} as const;

export const CHAT_DAILY_LIMIT = 100;
export const CHAT_CONVERSATION_LIMIT = 5;

export const DEFAULT_CALORIE_TARGET = 2000;
export const DEFAULT_PROTEIN_G = 150;
export const DEFAULT_CARBS_G = 250;
export const DEFAULT_FAT_G = 67;
export const DEFAULT_FIBER_G = 28;

export const DEFAULT_WATER_GOAL_ML = 2500;
export const MAX_STEPS = 200000;

export const EXERCISE_CATEGORIES = ["cardio", "strength", "flexibility", "sport", "other"] as const;
export const EXERCISE_INTENSITIES = ["low", "moderate", "high"] as const;
export const DEFAULT_EXERCISE_CALORIE_GOAL = 300;
export const DEFAULT_WEIGHT_KG = 70;

export const EXERCISE_CATEGORY_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  flexibility: "Flexibility",
  sport: "Sport",
  other: "Other",
};

export const EXERCISE_INTENSITY_LABELS: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

// Workout tracking
export const REST_TIMER_OPTIONS = [30, 60, 90, 120, 180] as const;
export const PR_TYPES = ["weight", "1rm", "volume", "reps"] as const;
export const SET_TYPES = ["normal", "warmup", "dropset"] as const;

export const SET_TYPE_LABELS: Record<string, string> = {
  normal: "Working set",
  warmup: "Warmup",
  dropset: "Drop set",
};

export const APP_NAME = "FitNMove";
export const THEME_COLOR = "#16a34a";
export const DANGER_COLOR = "#ef4444";

// Referral system
export const REFERRAL = {
  REFEREE_TRIAL_DAYS: 14,
  REFERRER_FREE_DAYS: 30,
  MAX_TRIAL_DAYS: 365,
  REVENUE_SHARE_PERCENTAGE: 0.25,
  REVENUE_SHARE_CONFIRM_DAYS: 90,
  MIN_PAYOUT_CENTS: 500, // $5
} as const;

export const PAYOUT_METHODS = [
  "subscription_credit",
  "bank_transfer",
] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number];
export type RefereeStatus = "paid" | "trial" | "registered";

export const REWARD_TYPES = {
  FREE_DAYS: "free_days",
  REVENUE_SHARE: "revenue_share",
} as const;

export type RewardType = (typeof REWARD_TYPES)[keyof typeof REWARD_TYPES];

export const REWARD_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PAID: "paid",
  CLAWED_BACK: "clawed_back",
} as const;

export type RewardStatus = (typeof REWARD_STATUSES)[keyof typeof REWARD_STATUSES];

// Fasting protocols
export const FASTING_PROTOCOLS = [
  { value: "16_8" as const, label: "16:8", fasting: 16, eating: 8, desc: "16 hours fasting / 8 hours eating" },
  { value: "18_6" as const, label: "18:6", fasting: 18, eating: 6, desc: "18 hours fasting / 6 hours eating" },
  { value: "20_4" as const, label: "20:4", fasting: 20, eating: 4, desc: "20 hours fasting / 4 hours eating" },
  { value: "omad" as const, label: "OMAD", fasting: 23, eating: 1, desc: "One meal a day" },
] as const;

export type FastingProtocol = (typeof FASTING_PROTOCOLS)[number]["value"];

// Sleep tracking
export const SLEEP_PHASES = ["awake", "light", "deep", "rem"] as const;
export const SLEEP_DETECTION_METHODS = ["accelerometer", "microphone", "both"] as const;

export const SLEEP_PHASE_LABELS: Record<string, string> = {
  awake: "Awake",
  light: "Light sleep",
  deep: "Deep sleep",
  rem: "REM",
};

export const SLEEP_PHASE_COLORS: Record<string, string> = {
  awake: "#ef4444",
  light: "#60a5fa",
  deep: "#1e40af",
  rem: "#a78bfa",
};

export const SLEEP_FACTORS = [
  { id: "caffeine", label: "Caffeine", icon: "\u2615" },
  { id: "alcohol", label: "Alcohol", icon: "\ud83c\udf77" },
  { id: "exercise", label: "Exercise", icon: "\ud83c\udfc3" },
  { id: "stress", label: "Stress", icon: "\ud83d\ude30" },
  { id: "late_meal", label: "Late meal", icon: "\ud83c\udf7d\ufe0f" },
  { id: "screen_time", label: "Screen time", icon: "\ud83d\udcf1" },
  { id: "reading", label: "Reading", icon: "\ud83d\udcd6" },
  { id: "meditation", label: "Meditation", icon: "\ud83e\uddd8" },
  { id: "medication", label: "Medication", icon: "\ud83d\udc8a" },
  { id: "sick", label: "Unwell", icon: "\ud83e\udd27" },
  { id: "travel", label: "Travel", icon: "\u2708\ufe0f" },
] as const;

export type SleepFactorId = (typeof SLEEP_FACTORS)[number]["id"];

// Activity sessions (shared exercise + meditation)
export const ACTIVITY_TYPES = ["exercise", "meditation", "throat_exercise", "eye_exercise"] as const;

// Meditation
export const MEDITATION_TYPES = [
  "mindfulness",
  "breathing",
  "body_scan",
] as const;

export const MEDITATION_TYPE_LABELS: Record<string, string> = {
  mindfulness: "Mindfulness",
  breathing: "Breathing",
  body_scan: "Body scan",
};

export const MEDITATION_SESSION_MODES = ["guided", "unguided", "timer"] as const;

export const MEDITATION_SESSION_MODE_LABELS: Record<string, string> = {
  guided: "Guided",
  unguided: "Unguided",
  timer: "Timer",
};

export const MOOD_LEVELS = [1, 2, 3, 4, 5] as const;
export const MOOD_LEVEL_LABELS: Record<number, string> = {
  1: "Very low",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Excellent",
};

export const FEELING_TAGS = [
  "anxious",
  "stressed",
  "sad",
  "angry",
  "tired",
  "restless",
  "scattered",
  "overwhelmed",
  "calm",
  "happy",
  "grateful",
  "focused",
  "energized",
  "peaceful",
  "hopeful",
  "content",
  "relaxed",
  "clear",
] as const;

export const FEELING_TAG_LABELS: Record<string, string> = {
  anxious: "Anxious",
  stressed: "Stressed",
  sad: "Sad",
  angry: "Angry",
  tired: "Tired",
  restless: "Restless",
  scattered: "Scattered",
  overwhelmed: "Overwhelmed",
  calm: "Calm",
  happy: "Happy",
  grateful: "Grateful",
  focused: "Focused",
  energized: "Energized",
  peaceful: "Peaceful",
  hopeful: "Hopeful",
  content: "Content",
  relaxed: "Relaxed",
  clear: "Clear",
};

export const MEDITATION_DURATION_PRESETS = [300, 600, 900, 1200, 1800] as const; // 5, 10, 15, 20, 30 min

// Throat Exercise (anti-snoring oropharyngeal training)
export const THROAT_EXERCISE_TARGETS = [
  "tongue",
  "soft_palate",
  "jaw",
  "cheek",
  "throat",
] as const;

export const THROAT_EXERCISE_TARGET_LABELS: Record<string, string> = {
  tongue: "Tongue",
  soft_palate: "Soft palate",
  jaw: "Jaw",
  cheek: "Cheek",
  throat: "Throat",
};

export interface ThroatExerciseDefinition {
  id: string;
  target: (typeof THROAT_EXERCISE_TARGETS)[number];
  durationSec: number;
  reps: number;
  emoji: string;
}

export const THROAT_EXERCISES: ThroatExerciseDefinition[] = [
  // Tongue exercises
  { id: "tongue_slide", target: "tongue", durationSec: 60, reps: 20, emoji: "👅" },
  { id: "tongue_push_up", target: "tongue", durationSec: 50, reps: 5, emoji: "⬆️" },
  { id: "tongue_push_down", target: "tongue", durationSec: 50, reps: 5, emoji: "⬇️" },
  { id: "tongue_stretch", target: "tongue", durationSec: 50, reps: 5, emoji: "😛" },
  { id: "tongue_curl", target: "tongue", durationSec: 50, reps: 10, emoji: "🌀" },
  // Soft palate exercises
  { id: "vowel_pronounce", target: "soft_palate", durationSec: 60, reps: 10, emoji: "🗣️" },
  { id: "say_ah", target: "soft_palate", durationSec: 50, reps: 10, emoji: "😮" },
  // Jaw exercises
  { id: "jaw_open_close", target: "jaw", durationSec: 40, reps: 10, emoji: "😯" },
  { id: "jaw_side_to_side", target: "jaw", durationSec: 40, reps: 10, emoji: "↔️" },
  // Cheek exercises
  { id: "cheek_hook", target: "cheek", durationSec: 40, reps: 10, emoji: "🤏" },
  { id: "lip_purse", target: "cheek", durationSec: 50, reps: 5, emoji: "😙" },
  // Throat exercises
  { id: "throat_humming", target: "throat", durationSec: 90, reps: 3, emoji: "🎵" },
  { id: "tiger_yell", target: "throat", durationSec: 50, reps: 5, emoji: "🐯" },
  { id: "balloon_breathing", target: "throat", durationSec: 40, reps: 10, emoji: "🎈" },
];

export const THROAT_EXERCISE_PRESETS = {
  quick: { durationMin: 5, exerciseCount: 5 },
  standard: { durationMin: 10, exerciseCount: 8 },
  full: { durationMin: 15, exerciseCount: 12 },
} as const;

export const THROAT_EXERCISE_PRESET_KEYS = ["quick", "standard", "full"] as const;
export const THROAT_EXERCISE_REST_SEC = 10;

// Eye Exercise (oculomotor training)
export const EYE_EXERCISE_TARGETS = [
  "extraocular",
  "ciliary",
  "convergence",
  "relaxation",
] as const;

export const EYE_EXERCISE_TARGET_LABELS: Record<string, string> = {
  extraocular: "Extraocular",
  ciliary: "Ciliary",
  convergence: "Convergence",
  relaxation: "Relaxation",
};

export interface EyeExerciseDefinition {
  id: string;
  target: (typeof EYE_EXERCISE_TARGETS)[number];
  durationSec: number;
  reps: number;
  emoji: string;
}

export const EYE_EXERCISES: EyeExerciseDefinition[] = [
  // Extraocular muscle exercises (saccades & smooth pursuit)
  { id: "horizontal_saccades", target: "extraocular", durationSec: 30, reps: 20, emoji: "↔️" },
  { id: "vertical_saccades", target: "extraocular", durationSec: 30, reps: 20, emoji: "↕️" },
  { id: "diagonal_saccades", target: "extraocular", durationSec: 30, reps: 20, emoji: "↗️" },
  { id: "smooth_pursuit_circle", target: "extraocular", durationSec: 60, reps: 5, emoji: "🔄" },
  { id: "smooth_pursuit_figure8", target: "extraocular", durationSec: 60, reps: 5, emoji: "♾️" },
  // Ciliary muscle exercises (accommodation / focusing)
  { id: "near_far_focus", target: "ciliary", durationSec: 120, reps: 20, emoji: "🔭" },
  { id: "focus_shift", target: "ciliary", durationSec: 60, reps: 15, emoji: "🎯" },
  // Convergence exercises
  { id: "pencil_pushup", target: "convergence", durationSec: 60, reps: 15, emoji: "✏️" },
  { id: "convergence_hold", target: "convergence", durationSec: 60, reps: 10, emoji: "👀" },
  // Relaxation exercises
  { id: "palming", target: "relaxation", durationSec: 120, reps: 1, emoji: "🤲" },
  { id: "slow_blink", target: "relaxation", durationSec: 60, reps: 20, emoji: "😌" },
  { id: "twenty_twenty", target: "relaxation", durationSec: 20, reps: 1, emoji: "🌳" },
];

export const EYE_EXERCISE_PRESETS = {
  quick: { durationMin: 5, exerciseCount: 4 },
  standard: { durationMin: 10, exerciseCount: 7 },
  full: { durationMin: 15, exerciseCount: 11 },
} as const;

export const EYE_EXERCISE_PRESET_KEYS = ["quick", "standard", "full"] as const;
export const EYE_EXERCISE_REST_SEC = 10;

export const DEFAULT_SLEEP_GOAL_HOURS = 8;
export const DEFAULT_ALARM_WINDOW_MINUTES = 30;
export const SLEEP_SAMPLE_INTERVAL_MS = 1000;
export const SLEEP_EPOCH_DURATION_MS = 60_000;

export const HEALTH_DOCUMENT_CATEGORIES = [
  "checkup",
  "blood_donation",
  "medical_visit",
  "prescription",
  "vaccination",
  "lab_report",
  "other",
] as const;

export type HealthDocumentCategory = (typeof HEALTH_DOCUMENT_CATEGORIES)[number];
