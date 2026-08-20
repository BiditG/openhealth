import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { nutrientDefinitions } from "../schema";
import { nutrientSeedData } from "./nutrients";
import { seedFoods, seedFoodsBulk } from "./seed-foods";

// --- Food dataset registry ---
import { sampleFoods } from "./sample-foods";

interface Dataset {
  items: Parameters<typeof seedFoods>[1];
  label: string;
  bulk?: boolean; // use batch insert for large datasets
}

const FOOD_DATASETS: Record<string, Dataset> = {
  sample: { items: sampleFoods, label: "Sample Foods" },
};

const connectionString = process.env.DATABASE_URL || "postgresql://lj@localhost:5432/food_record";

async function seed() {
  const client = postgres(connectionString);
  const db = drizzle(client);

  // 1. Always seed nutrient definitions (idempotent via onConflictDoNothing)
  console.log("Seeding nutrient definitions...");
  for (const nutrient of nutrientSeedData) {
    await db
      .insert(nutrientDefinitions)
      .values({
        name: nutrient.name,
        unit: nutrient.unit,
        category: nutrient.category,
        displayOrder: nutrient.displayOrder,
        dailyValue: nutrient.dailyValue ? String(nutrient.dailyValue) : null,
        usdaNutrientId: nutrient.usdaNutrientId,
      })
      .onConflictDoNothing({ target: nutrientDefinitions.name });
  }
  console.log(`  ${nutrientSeedData.length} nutrient definitions ready`);

  // 2. Determine which datasets to seed (filter out "--" separator from pnpm)
  const requestedKeys = process.argv.slice(2).filter((arg) => arg !== "--");
  const datasetsToRun =
    requestedKeys.length > 0
      ? requestedKeys.filter((key) => {
          if (!FOOD_DATASETS[key]) {
            console.error(`Unknown dataset: "${key}". Available: ${Object.keys(FOOD_DATASETS).join(", ")}`);
            return false;
          }
          return true;
        })
      : Object.keys(FOOD_DATASETS);

  if (datasetsToRun.length === 0) {
    console.log("No datasets to seed.");
    await client.end();
    process.exit(1);
  }

  // 3. Seed food datasets
  console.log(`\nSeeding ${datasetsToRun.length} food dataset(s)...`);
  for (const key of datasetsToRun) {
    const dataset = FOOD_DATASETS[key];
    if (dataset.bulk) {
      await seedFoodsBulk(db, dataset.items, dataset.label);
    } else {
      await seedFoods(db, dataset.items, dataset.label);
    }
  }

  console.log("\nSeed complete!");
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
