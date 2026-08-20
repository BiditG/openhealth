import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { setupTestDb, teardownTestDb, getTestDb, cleanTables } from "@/test/setup-db";
import type { TestDb } from "@/test/setup-db";
import { foods, foodNutrients, nutrientDefinitions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Mock the DB module to use test DB
vi.mock("@/server/db", () => {
  return {
    get db() {
      return getTestDb();
    },
  };
});

import { calculateNutrition } from "./nutrition";

const NON_EXISTENT_FOOD_ID = "00000000-0000-0000-0000-000000000000";

let db: TestDb;

beforeAll(async () => {
  db = await setupTestDb();
}, 30_000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTables(db, ["food_nutrients", "foods"]);
});

async function insertTestFood(overrides?: { calories?: string }) {
  const [food] = await db
    .insert(foods)
    .values({
      name: "Chicken breast",
      source: "user",
      servingSize: "100",
      servingUnit: "g",
      calories: overrides?.calories ?? "165",
    })
    .returning();
  return food;
}

async function insertNutrient(foodId: string, nutrientName: string, amount: string) {
  const [nd] = await db
    .select({ id: nutrientDefinitions.id })
    .from(nutrientDefinitions)
    .where(eq(nutrientDefinitions.name, nutrientName))
    .limit(1);
  if (!nd) throw new Error(`Nutrient ${nutrientName} not found in definitions`);

  await db.insert(foodNutrients).values({
    foodId,
    nutrientId: nd.id,
    amount,
  });
}

describe("calculateNutrition (integration)", () => {
  it("calculates calories and macros for 1 serving", async () => {
    const food = await insertTestFood();
    await insertNutrient(food.id, "Protein", "31");
    await insertNutrient(food.id, "Total Fat", "3.6");
    await insertNutrient(food.id, "Total Carbohydrate", "0");
    await insertNutrient(food.id, "Dietary Fiber", "0");

    const result = await calculateNutrition(food.id, 1);

    expect(result).toEqual({
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 3.6,
      fiberG: 0,
    });
  });

  it("multiplies by serving quantity", async () => {
    const food = await insertTestFood({ calories: "200" });
    await insertNutrient(food.id, "Protein", "20");
    await insertNutrient(food.id, "Total Fat", "10");
    await insertNutrient(food.id, "Total Carbohydrate", "5");

    const result = await calculateNutrition(food.id, 2.5);

    expect(result.calories).toBe(500);
    expect(result.proteinG).toBe(50);
    expect(result.fatG).toBe(25);
    expect(result.carbsG).toBe(12.5);
  });

  it("returns 0 for missing macros", async () => {
    const food = await insertTestFood();
    // No nutrients inserted

    const result = await calculateNutrition(food.id, 1);

    expect(result.calories).toBe(165);
    expect(result.proteinG).toBe(0);
    expect(result.carbsG).toBe(0);
    expect(result.fatG).toBe(0);
    expect(result.fiberG).toBe(0);
  });

  it("throws for non-existent food", async () => {
    await expect(
      calculateNutrition(NON_EXISTENT_FOOD_ID, 1)
    ).rejects.toThrow("Food not found");
  });
});
