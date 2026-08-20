export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // Skip migrations when schema is set up externally (e.g., drizzle-kit push in E2E/CI)
    if (!process.env.SKIP_MIGRATIONS) {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      const { db } = await import("./server/db");
      // Path is relative to CWD. Migration files are included in standalone build
      // via outputFileTracingIncludes in next.config.ts.
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await migrate(db, { migrationsFolder: "./node_modules/@open-health/db/src/migrations" });
          await seedPresetExercises(db);
          break;
        } catch (err) {
          console.error(`[migration] Attempt ${attempt}/${MAX_RETRIES} failed:`, err);
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, attempt * 1000));
          } else {
            const Sentry = await import("@sentry/nextjs");
            Sentry.captureException(err);
          }
        }
      }
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedPresetExercises(db: any) {
  const { exercises } = await import("./server/db/schema");
  const { eq, sql } = await import("drizzle-orm");

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(exercises)
    .where(eq(exercises.isCustom, false));

  const presetCount = countResult[0]?.count ?? 0;
  if (presetCount > 0) return; // Already seeded

  const PRESET_EXERCISES = [
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
    { name: "Weight training", category: "strength" as const, metValue: "6.0" },
    { name: "Push-up", category: "strength" as const, metValue: "3.8" },
    { name: "Squat", category: "strength" as const, metValue: "5.0" },
    { name: "Deadlift", category: "strength" as const, metValue: "6.0" },
    { name: "Bench press", category: "strength" as const, metValue: "3.5" },
    { name: "Pull-up", category: "strength" as const, metValue: "3.8" },
    { name: "Kettlebell training", category: "strength" as const, metValue: "6.0" },
    { name: "Yoga", category: "flexibility" as const, metValue: "3.0" },
    { name: "Stretching", category: "flexibility" as const, metValue: "2.5" },
    { name: "Pilates", category: "flexibility" as const, metValue: "3.0" },
    { name: "Mobility flow", category: "flexibility" as const, metValue: "3.0" },
    { name: "Basketball", category: "sport" as const, metValue: "6.5" },
    { name: "Badminton", category: "sport" as const, metValue: "5.5" },
    { name: "Tennis", category: "sport" as const, metValue: "7.3" },
    { name: "Football", category: "sport" as const, metValue: "7.0" },
    { name: "Table tennis", category: "sport" as const, metValue: "4.0" },
    { name: "Volleyball", category: "sport" as const, metValue: "4.0" },
    { name: "Baseball", category: "sport" as const, metValue: "5.0" },
    { name: "Golf", category: "sport" as const, metValue: "3.5" },
    { name: "Walking", category: "other" as const, metValue: "3.0" },
    { name: "Cleaning", category: "other" as const, metValue: "3.3" },
    { name: "Gardening", category: "other" as const, metValue: "3.5" },
  ];

  await db.insert(exercises).values(
    PRESET_EXERCISES.map((e) => ({
      name: e.name,
      category: e.category,
      metValue: e.metValue,
      isCustom: false,
      createdBy: null,
    }))
  );

  console.log(`[seed] Inserted ${PRESET_EXERCISES.length} preset exercises`);
}
