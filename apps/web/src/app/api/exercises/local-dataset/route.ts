import { NextResponse } from "next/server";
import exercisesDataset from "@/data/exercises-dataset/exercises.json";
import { getLocalDatasetTerms, type ExerciseMedia } from "@/lib/exercise-media";

type LocalDatasetExercise = {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  media_id: string;
  image: string;
  gif_url: string;
  attribution: string;
  created_at: string;
};

const LOCAL_DATASET_SOURCE = "Saved exercise library";
const RAW_MEDIA_BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main";

function includesAny(value: string | string[] | undefined, terms: string[]) {
  const haystack = Array.isArray(value) ? value.join(" ") : value ?? "";
  const normalized = haystack.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function mediaAllowed() {
  return process.env.EXERCISES_DATASET_MEDIA_ENABLED === "true";
}

function toExercise(record: LocalDatasetExercise): ExerciseMedia {
  const gifUrl = mediaAllowed() ? `${RAW_MEDIA_BASE}/${record.gif_url}` : undefined;
  const imageUrl = mediaAllowed() ? `${RAW_MEDIA_BASE}/${record.image}` : undefined;

  return {
    exerciseId: `local_${record.id}`,
    name: record.name,
    imageUrl: gifUrl ?? imageUrl,
    equipments: [record.equipment],
    bodyParts: [record.body_part],
    exerciseType: record.body_part === "cardio" ? "CARDIO" : "STRENGTH",
    targetMuscles: [record.target],
    secondaryMuscles: record.secondary_muscles,
    overview: record.instructions.en,
    instructions: record.instruction_steps.en,
    videoUrl: undefined,
    attribution: record.attribution,
    source: LOCAL_DATASET_SOURCE,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const muscle = searchParams.get("muscle") ?? "";
  const limit = Math.max(1, Math.min(24, Number(searchParams.get("limit")) || 12));
  const terms = getLocalDatasetTerms(muscle);
  const records = exercisesDataset as LocalDatasetExercise[];

  const matches = records
    .filter((record) =>
      includesAny(record.target, terms) ||
      includesAny(record.muscle_group, terms) ||
      includesAny(record.body_part, terms) ||
      includesAny(record.secondary_muscles, terms)
    )
    .slice(0, limit)
    .map(toExercise);

  return NextResponse.json(
    {
      success: true,
      data: matches,
      source: LOCAL_DATASET_SOURCE,
      query: terms.join(", "),
      mediaEnabled: mediaAllowed(),
      message: mediaAllowed()
        ? "Exercise demos are ready."
        : "Exercise demos are temporarily unavailable.",
    },
    {
      headers: {
        "Cache-Control": "private, max-age=3600",
      },
    }
  );
}
