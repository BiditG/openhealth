// Shared English-only i18n resources and configuration.

import enCommon from "./locales/en/common.json";
import enDiary from "./locales/en/diary.json";
import enFood from "./locales/en/food.json";
import enExercise from "./locales/en/exercise.json";
import enSleep from "./locales/en/sleep.json";
import enWater from "./locales/en/water.json";
import enWeight from "./locales/en/weight.json";
import enProgress from "./locales/en/progress.json";
import enSettings from "./locales/en/settings.json";
import enNutrients from "./locales/en/nutrients.json";
import enAi from "./locales/en/ai.json";
import enFasting from "./locales/en/fasting.json";
import enWorkout from "./locales/en/workout.json";
import enPosture from "./locales/en/posture.json";
import enLanding from "./locales/en/landing.json";
import enBlog from "./locales/en/blog.json";
import enDocs from "./locales/en/docs.json";
import enPrivacy from "./locales/en/privacy.json";
import enCoach from "./locales/en/coach.json";
import enPricing from "./locales/en/pricing.json";
import enMeditation from "./locales/en/meditation.json";
import enReminders from "./locales/en/reminders.json";
import enThroatExercise from "./locales/en/throat-exercise.json";
import enEyeExercise from "./locales/en/eye-exercise.json";
import enSteps from "./locales/en/steps.json";
import enDocuments from "./locales/en/documents.json";

export const supportedLngs = ["en"] as const;
export type SupportedLanguage = (typeof supportedLngs)[number];

export const fallbackLng = "en" as const;
export const defaultNS = "common" as const;

export const namespaces = [
  "common",
  "diary",
  "food",
  "exercise",
  "sleep",
  "water",
  "weight",
  "progress",
  "settings",
  "nutrients",
  "ai",
  "fasting",
  "workout",
  "posture",
  "landing",
  "blog",
  "docs",
  "privacy",
  "coach",
  "pricing",
  "meditation",
  "reminders",
  "throat-exercise",
  "eye-exercise",
  "steps",
  "documents",
] as const;

export type Namespace = (typeof namespaces)[number];

export const resources = {
  en: {
    common: enCommon,
    diary: enDiary,
    food: enFood,
    exercise: enExercise,
    sleep: enSleep,
    water: enWater,
    weight: enWeight,
    progress: enProgress,
    settings: enSettings,
    nutrients: enNutrients,
    ai: enAi,
    fasting: enFasting,
    workout: enWorkout,
    posture: enPosture,
    landing: enLanding,
    blog: enBlog,
    docs: enDocs,
    privacy: enPrivacy,
    coach: enCoach,
    pricing: enPricing,
    meditation: enMeditation,
    reminders: enReminders,
    "throat-exercise": enThroatExercise,
    "eye-exercise": enEyeExercise,
    steps: enSteps,
    documents: enDocuments,
  },
} as const;
