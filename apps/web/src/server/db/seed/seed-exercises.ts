import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { exercises } from "../schema";
import { eq } from "drizzle-orm";

const PRESET_EXERCISES = [
  // Cardio
  { name: "Running", category: "cardio" as const, metValue: "8.0" },
  { name: "Brisk walking", category: "cardio" as const, metValue: "4.3" },
  { name: "Cycling", category: "cardio" as const, metValue: "7.5" },
  { name: "Swimming", category: "cardio" as const, metValue: "6.0" },
  { name: "Jump rope", category: "cardio" as const, metValue: "12.3" },
  { name: "Aerobic dance", category: "cardio" as const, metValue: "6.5" },
  { name: "Elliptical", category: "cardio" as const, metValue: "5.0" },
  { name: "Spin bike", category: "cardio" as const, metValue: "8.5" },
  { name: "Rowing machine", category: "cardio" as const, metValue: "6.0" },
  { name: "Stair climbing", category: "cardio" as const, metValue: "9.0" },
  { name: "Hiking", category: "cardio" as const, metValue: "6.5" },
  // Strength
  { name: "Weight training", category: "strength" as const, metValue: "6.0" },
  { name: "Push-up", category: "strength" as const, metValue: "3.8" },
  { name: "Squat", category: "strength" as const, metValue: "5.0" },
  { name: "Deadlift", category: "strength" as const, metValue: "6.0" },
  { name: "Bench press", category: "strength" as const, metValue: "3.5" },
  { name: "Pull-up", category: "strength" as const, metValue: "3.8" },
  { name: "Kettlebell training", category: "strength" as const, metValue: "6.0" },
  // Flexibility
  { name: "Yoga", category: "flexibility" as const, metValue: "3.0" },
  { name: "Stretching", category: "flexibility" as const, metValue: "2.5" },
  { name: "Pilates", category: "flexibility" as const, metValue: "3.0" },
  { name: "Mobility flow", category: "flexibility" as const, metValue: "3.0" },
  // Sport
  { name: "Basketball", category: "sport" as const, metValue: "6.5" },
  { name: "Badminton", category: "sport" as const, metValue: "5.5" },
  { name: "Tennis", category: "sport" as const, metValue: "7.3" },
  { name: "Football", category: "sport" as const, metValue: "7.0" },
  { name: "Table tennis", category: "sport" as const, metValue: "4.0" },
  { name: "Volleyball", category: "sport" as const, metValue: "4.0" },
  { name: "Baseball", category: "sport" as const, metValue: "5.0" },
  { name: "Golf", category: "sport" as const, metValue: "3.5" },
  // Other
  { name: "Walking", category: "other" as const, metValue: "3.0" },
  { name: "Cleaning", category: "other" as const, metValue: "3.3" },
  { name: "Gardening", category: "other" as const, metValue: "3.5" },
];

async function seedExercises() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required. Run: source .env.local && DATABASE_URL=$DATABASE_URL pnpm db:seed-exercises");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("Seeding preset exercises...");

  let inserted = 0;
  for (const exercise of PRESET_EXERCISES) {
    const existing = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.name, exercise.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(exercises).values({
        name: exercise.name,
        category: exercise.category,
        metValue: exercise.metValue,
        isCustom: false,
        createdBy: null,
      });
      inserted++;
    }
  }

  console.log(`  ${inserted} new exercises inserted (${PRESET_EXERCISES.length - inserted} already existed)`);
  console.log("Done!");
  await client.end();
  process.exit(0);
}

seedExercises().catch((err) => {
  console.error("Seed exercises failed:", err);
  process.exit(1);
});
