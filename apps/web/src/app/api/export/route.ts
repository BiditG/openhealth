import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import {
  diaryEntries,
  foods,
  foodServings,
  exerciseLogs,
  exercises,
  weightLogs,
  bodyMeasurements,
  stepLogs,
  waterLogs,
  fastingLogs,
  workouts,
  workoutExercises,
  workoutSets,
  postureSessions,
  postureDefinitions,
} from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";

const VALID_CATEGORIES = [
  "diary",
  "exercise",
  "workout",
  "weight",
  "body_measurements",
  "steps",
  "water",
  "fasting",
  "posture",
] as const;

type ExportCategory = (typeof VALID_CATEGORIES)[number];

function toCsv(headers: string[], rows: (string | null | undefined)[][]): string {
  const escape = (val: string | null | undefined) => {
    if (val == null) return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return "\ufeff" + lines.join("\n"); // BOM for Excel compatibility
}

async function exportDiary(userId: string) {
  const rows = await db
    .select({
      date: diaryEntries.date,
      mealType: diaryEntries.mealType,
      foodName: foods.name,
      brand: foods.brand,
      servingQty: diaryEntries.servingQty,
      servingLabel: foodServings.label,
      calories: diaryEntries.calories,
      proteinG: diaryEntries.proteinG,
      carbsG: diaryEntries.carbsG,
      fatG: diaryEntries.fatG,
      fiberG: diaryEntries.fiberG,
      loggedAt: diaryEntries.loggedAt,
    })
    .from(diaryEntries)
    .innerJoin(foods, eq(diaryEntries.foodId, foods.id))
    .leftJoin(foodServings, eq(diaryEntries.servingId, foodServings.id))
    .where(eq(diaryEntries.userId, userId))
    .orderBy(diaryEntries.date, diaryEntries.loggedAt);

  return toCsv(
    ["Date", "Meal Type", "Food Name", "Brand", "Serving Quantity", "Serving Unit", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Fiber (g)", "Logged At"],
    rows.map((r) => [
      r.date,
      r.mealType,
      r.foodName,
      r.brand,
      r.servingQty,
      r.servingLabel,
      r.calories,
      r.proteinG,
      r.carbsG,
      r.fatG,
      r.fiberG,
      r.loggedAt?.toISOString(),
    ])
  );
}

async function exportExercise(userId: string) {
  const rows = await db
    .select({
      date: exerciseLogs.date,
      exerciseName: exercises.name,
      category: exercises.category,
      durationMin: exerciseLogs.durationMin,
      caloriesBurned: exerciseLogs.caloriesBurned,
      intensity: exerciseLogs.intensity,
      note: exerciseLogs.note,
      createdAt: exerciseLogs.createdAt,
    })
    .from(exerciseLogs)
    .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
    .where(eq(exerciseLogs.userId, userId))
    .orderBy(exerciseLogs.date);

  return toCsv(
    ["Date", "Exercise Name", "Category", "Duration (min)", "Calories Burned (kcal)", "Intensity", "Note", "Created At"],
    rows.map((r) => [
      r.date,
      r.exerciseName,
      r.category,
      String(r.durationMin ?? ""),
      r.caloriesBurned,
      r.intensity,
      r.note,
      r.createdAt?.toISOString(),
    ])
  );
}

async function exportWorkout(userId: string) {
  // Get all workouts for user
  const userWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(workouts.startedAt);

  if (userWorkouts.length === 0) return toCsv(["Workout Name", "Date", "Exercise", "Set", "Weight (kg)", "Reps", "RPE", "Warmup", "Dropset", "PR", "Completed At"], []);

  const workoutIds = userWorkouts.map((w) => w.id);
  const wExercises = await db
    .select({
      workoutId: workoutExercises.workoutId,
      exerciseName: exercises.name,
      sortOrder: workoutExercises.sortOrder,
      weId: workoutExercises.id,
    })
    .from(workoutExercises)
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(inArray(workoutExercises.workoutId, workoutIds));

  const weIds = wExercises.map((we) => we.weId);
  const sets =
    weIds.length > 0
      ? await db
          .select()
          .from(workoutSets)
          .where(inArray(workoutSets.workoutExerciseId, weIds))
          .orderBy(workoutSets.setNumber)
      : [];

  // Build flat rows
  const csvRows: string[][] = [];
  for (const w of userWorkouts) {
    const wExs = wExercises
      .filter((we) => we.workoutId === w.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    for (const we of wExs) {
      const weSets = sets.filter((s) => s.workoutExerciseId === we.weId);
      if (weSets.length === 0) {
        csvRows.push([w.name, w.startedAt.toISOString().slice(0, 10), we.exerciseName, "", "", "", "", "", "", "", ""]);
      } else {
        for (const s of weSets) {
          csvRows.push([
            w.name,
            w.startedAt.toISOString().slice(0, 10),
            we.exerciseName,
            String(s.setNumber),
            s.weightKg ?? "",
            String(s.reps ?? ""),
            s.rpe ?? "",
            s.isWarmup ? "Y" : "",
            s.isDropset ? "Y" : "",
            s.isPersonalRecord ? "Y" : "",
            s.completedAt?.toISOString() ?? "",
          ]);
        }
      }
    }
  }

  return toCsv(
    ["Workout Name", "Date", "Exercise", "Set", "Weight (kg)", "Reps", "RPE", "Warmup", "Dropset", "PR", "Completed At"],
    csvRows
  );
}

async function exportWeight(userId: string) {
  const rows = await db
    .select()
    .from(weightLogs)
    .where(eq(weightLogs.userId, userId))
    .orderBy(weightLogs.date);

  return toCsv(
    ["Date", "Weight (kg)", "Note"],
    rows.map((r) => [r.date, r.weightKg, r.note])
  );
}

async function exportBodyMeasurements(userId: string) {
  const rows = await db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, userId))
    .orderBy(bodyMeasurements.date);

  return toCsv(
    ["Date", "Waist (cm)", "Hip (cm)", "Chest (cm)", "Arm (cm)", "Thigh (cm)", "Neck (cm)", "Body Fat (%)", "Note"],
    rows.map((r) => [
      r.date,
      r.waistCm,
      r.hipCm,
      r.chestCm,
      r.armCm,
      r.thighCm,
      r.neckCm,
      r.bodyFatPct,
      r.note,
    ])
  );
}

async function exportSteps(userId: string) {
  const rows = await db
    .select()
    .from(stepLogs)
    .where(eq(stepLogs.userId, userId))
    .orderBy(stepLogs.date);

  return toCsv(
    ["Date", "Steps", "Note"],
    rows.map((r) => [r.date, r.steps, r.note])
  );
}

async function exportWater(userId: string) {
  const rows = await db
    .select()
    .from(waterLogs)
    .where(eq(waterLogs.userId, userId))
    .orderBy(waterLogs.date, waterLogs.loggedAt);

  return toCsv(
    ["Date", "Water (ml)", "Logged At"],
    rows.map((r) => [r.date, String(r.amountMl), r.loggedAt.toISOString()])
  );
}

async function exportFasting(userId: string) {
  const rows = await db
    .select()
    .from(fastingLogs)
    .where(eq(fastingLogs.userId, userId))
    .orderBy(fastingLogs.startedAt);

  return toCsv(
    ["Started At", "Ended At", "Planned Hours", "Actual Hours", "Completed", "Note"],
    rows.map((r) => [
      r.startedAt.toISOString(),
      r.endedAt?.toISOString() ?? "",
      r.plannedHours,
      r.actualHours ?? "",
      r.completed ? "Y" : "N",
      r.note,
    ])
  );
}

async function exportPosture(userId: string) {
  const rows = await db
    .select({
      postureName: postureDefinitions.name,
      emoji: postureDefinitions.emoji,
      startedAt: postureSessions.startedAt,
      endedAt: postureSessions.endedAt,
      durationMinutes: postureSessions.durationMinutes,
      wasReminded: postureSessions.wasReminded,
    })
    .from(postureSessions)
    .innerJoin(
      postureDefinitions,
      eq(postureSessions.postureId, postureDefinitions.id)
    )
    .where(eq(postureSessions.userId, userId))
    .orderBy(postureSessions.startedAt);

  return toCsv(
    ["Posture", "Started At", "Ended At", "Duration (min)", "Reminded"],
    rows.map((r) => [
      `${r.emoji} ${r.postureName}`,
      r.startedAt.toISOString(),
      r.endedAt?.toISOString() ?? "",
      String(r.durationMinutes ?? ""),
      r.wasReminded ? "Y" : "N",
    ])
  );
}

const exporters: Record<ExportCategory, (userId: string) => Promise<string>> = {
  diary: exportDiary,
  exercise: exportExercise,
  workout: exportWorkout,
  weight: exportWeight,
  body_measurements: exportBodyMeasurements,
  steps: exportSteps,
  water: exportWater,
  fasting: exportFasting,
  posture: exportPosture,
};

const categoryFileNames: Record<ExportCategory, string> = {
  diary: "Food_Diary",
  exercise: "Exercise",
  workout: "Workout",
  weight: "Weight",
  body_measurements: "Body_Measurements",
  steps: "Steps",
  water: "Water",
  fasting: "Fasting",
  posture: "Posture",
};

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get("category");
  if (!category || !VALID_CATEGORIES.includes(category as ExportCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const cat = category as ExportCategory;

  try {
    const csv = await exporters[cat](session.user.id);
    const fileName = `FitNMove_${categoryFileNames[cat]}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export_${cat}.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
