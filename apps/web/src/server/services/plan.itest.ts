import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { setupTestDb, teardownTestDb, getTestDb, cleanTables } from "@/test/setup-db";
import type { TestDb } from "@/test/setup-db";
import { users } from "@/server/db/schema";

// Mock DB and date modules to use test DB
vi.mock("@/server/db", () => {
  return {
    get db() {
      return getTestDb();
    },
  };
});
vi.mock("@/lib/date", () => ({ getNepalDate: () => "2024-06-15" }));

import { checkAndIncrementAiUsage, getAiUsage } from "./plan";

let db: TestDb;
// Static ID is safe here — integration tests run sequentially (not parallelized)
const testUserId = "test-user-plan-001";

beforeAll(async () => {
  db = await setupTestDb();

  // Insert a test user (needed for FK)
  await db
    .insert(users)
    .values({
      id: testUserId,
      name: "Test User",
      email: "plan-test@openhealth.dev",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
}, 30_000);

afterAll(async () => {
  await cleanTables(db, ["ai_usage"]);
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTables(db, ["ai_usage"]);
});

describe("checkAndIncrementAiUsage (integration)", () => {
  it("allows first usage and increments count", async () => {
    const result = await checkAndIncrementAiUsage(testUserId, "ocr", "free");

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1);
    expect(result.limit).toBe(3);
  });

  it("allows up to the limit", async () => {
    // Use 3 times (free OCR limit = 3)
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");
    const third = await checkAndIncrementAiUsage(testUserId, "ocr", "free");

    expect(third.allowed).toBe(true);
    expect(third.used).toBe(3);
  });

  it("rejects when exceeding limit", async () => {
    // Use 3 times
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");

    // 4th should fail
    const fourth = await checkAndIncrementAiUsage(testUserId, "ocr", "free");

    expect(fourth.allowed).toBe(false);
    expect(fourth.used).toBe(3);
    expect(fourth.limit).toBe(3);
  });

  it("always allows pro plan with Infinity limit", async () => {
    const result = await checkAndIncrementAiUsage(testUserId, "ocr", "pro");

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Infinity);
  });

  it("tracks features independently", async () => {
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");

    const estimate = await checkAndIncrementAiUsage(testUserId, "estimate", "free");
    expect(estimate.used).toBe(1); // separate counter
  });
});

describe("getAiUsage (integration)", () => {
  it("returns 0 when no usage exists", async () => {
    const result = await getAiUsage(testUserId, "chat", "free");
    expect(result.used).toBe(0);
    expect(result.limit).toBe(10);
  });

  it("returns current usage count", async () => {
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");
    await checkAndIncrementAiUsage(testUserId, "ocr", "free");

    const result = await getAiUsage(testUserId, "ocr", "free");
    expect(result.used).toBe(2);
    expect(result.limit).toBe(3);
  });
});
