/**
 * Blog Screenshot Generator
 *
 * Generates high-resolution (2x retina) screenshots for the English blog post.
 * Seeds realistic demo data (food diary, water, weight, chat) before capturing.
 *
 * Usage:
 *   cd apps/web
 *   LOCALE=en pnpm exec playwright test e2e/screenshots.e2e.ts
 *
 * Prerequisites:
 *   - Dev server running on localhost:3001
 *   - Demo account exists (demo-en@openhealth.dev)
 *
 * Output:
 *   public/screenshots/{locale}/01-hub.png, 02-today.png, ...
 */
import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

// ── Config ──────────────────────────────────────────────────────────
const LOCALE = process.env.LOCALE ?? "en";

const ACCOUNTS: Record<string, { email: string; password: string }> = {
  en: { email: "demo-en@openhealth.dev", password: "demopass123" },
};

// iPhone 14 Pro — 2x scale for retina-quality screenshots
const VIEWPORT = { width: 430, height: 932 };
const DEVICE_SCALE_FACTOR = 3;

const OUT_DIR = path.resolve(__dirname, `../public/screenshots/${LOCALE}`);

// ── Helpers ─────────────────────────────────────────────────────────

async function login(page: Page) {
  const { email, password } = ACCOUNTS[LOCALE] ?? ACCOUNTS["en"];
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
}

/** Call a tRPC query endpoint */
async function trpcQuery(page: Page, path: string, input: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const encoded = encodeURIComponent(JSON.stringify(input));
      const resp = await fetch(`/api/trpc/${path}?input=${encoded}`);
      if (!resp.ok) throw new Error(`tRPC query ${path} failed: ${resp.status}`);
      return resp.json();
    },
    { path, input }
  );
}

/** Call a tRPC mutation endpoint */
async function trpcMutate(page: Page, path: string, input: unknown) {
  return page.evaluate(
    async ({ path, input }) => {
      const resp = await fetch(`/api/trpc/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!resp.ok) throw new Error(`tRPC mutate ${path} failed: ${resp.status}`);
      return resp.json();
    },
    { path, input }
  );
}

/** Hide Next.js dev indicator */
async function hideDevUI(page: Page) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-dialog-overlay],
      [data-nextjs-toast],
      #__next-build-indicator,
      [class*="nextjs-"],
      body > div:last-child > a[href*="nextjs"],
      body > div[style*="fixed"][style*="bottom"] {
        display: none !important;
      }
    `,
  });
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    document.getElementById("__next-build-indicator")?.remove();
  });
}

async function snap(page: Page, name: string) {
  await page.waitForTimeout(800);
  await hideDevUI(page);
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: false,
  });
  console.log(`  ✓ ${name}.png`);
}

async function waitForStable(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
}

// ── Data Cleanup & Seeding ───────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];

/** Remove all diary entries for today so seed is idempotent */
async function clearTodayDiary(page: Page) {
  try {
    const data = await trpcQuery(page, "diary.getDay", { date: TODAY });
    const entries = data?.result?.data?.entries ?? data?.result?.data?.json?.entries ?? [];
    for (const entry of entries) {
      try {
        await trpcMutate(page, "diary.removeEntry", { entryId: entry.id });
      } catch { /* ignore */ }
    }
    if (entries.length > 0) {
      console.log(`  Cleared ${entries.length} existing diary entries`);
    }
  } catch (err) {
    console.warn(`  ⚠ Could not clear diary: ${err}`);
  }
}

/** Undo water logs for today by calling undoLastLog repeatedly */
async function clearTodayWater(page: Page) {
  let cleared = 0;
  for (let i = 0; i < 30; i++) {
    try {
      const result = await trpcMutate(page, "water.undoLastLog", { date: TODAY });
      const success = result?.result?.data?.success ?? result?.result?.data?.json?.success;
      if (!success) break;
      cleared++;
    } catch {
      break;
    }
  }
  if (cleared > 0) {
    console.log(`  Cleared ${cleared} water logs`);
  }
}

// Chat sessions cleanup skipped — chat history in screenshot is acceptable

/** Search for food by name and return the first result */
async function searchFood(page: Page, query: string) {
  try {
    const data = await trpcQuery(page, "food.search", {
      query,
      limit: 5,
      offset: 0,
      cursor: 0,
    });
    const items =
      data?.result?.data?.json || data?.result?.data || [];
    if (!items.length) {
      console.warn(`  ⚠ No food found for "${query}"`);
      return null;
    }
    return items[0] as { id: string; name: string };
  } catch (err) {
    console.warn(`  ⚠ Search failed for "${query}": ${err}`);
    return null;
  }
}

/** Log a food item to the diary */
async function logFood(
  page: Page,
  foodId: string,
  mealType: string,
  servingQty: number
) {
  await trpcMutate(page, "diary.logFood", {
    date: TODAY,
    mealType,
    foodId,
    servingQty,
  });
}

/**
 * Seed a full day of realistic food diary entries.
 * Uses English food names commonly found in the USDA/OpenFoodFacts DB.
 */
async function seedDiaryData(page: Page) {
  console.log("\nSeeding diary data...");

  const meals = [
    // Breakfast
    { search: "Oatmeal", meal: "breakfast", qty: 1.5 },
    { search: "Egg", meal: "breakfast", qty: 2 },
    { search: "Banana", meal: "breakfast", qty: 1 },
    { search: "Coffee", meal: "breakfast", qty: 1 },
    // Lunch
    { search: "Chicken breast", meal: "lunch", qty: 1.5 },
    { search: "Brown rice", meal: "lunch", qty: 1 },
    { search: "Broccoli", meal: "lunch", qty: 1 },
    { search: "Apple", meal: "lunch", qty: 1 },
    // Dinner
    { search: "Salmon", meal: "dinner", qty: 1 },
    { search: "Sweet potato", meal: "dinner", qty: 1 },
    { search: "Salad", meal: "dinner", qty: 1.5 },
    // Snack
    { search: "Greek yogurt", meal: "snack", qty: 1 },
    { search: "Almonds", meal: "snack", qty: 1 },
    { search: "Protein bar", meal: "snack", qty: 1 },
  ];

  let logged = 0;
  for (const item of meals) {
    const food = await searchFood(page, item.search);
    if (food) {
      try {
        await logFood(page, food.id, item.meal, item.qty);
        console.log(`  ✓ ${item.meal}: ${food.name} x${item.qty}`);
        logged++;
      } catch (err) {
        console.warn(`  ⚠ Failed to log ${item.search}: ${err}`);
      }
    }
  }
  console.log(`  Logged ${logged}/${meals.length} items`);
}

/** Seed water intake (multiple entries throughout the day) */
async function seedWaterData(page: Page) {
  console.log("\nSeeding water data...");
  const amounts = [350, 250, 300, 250, 200, 350]; // ~1,700 ml total
  for (const amountMl of amounts) {
    try {
      await trpcMutate(page, "water.logWater", {
        date: TODAY,
        amountMl,
      });
    } catch {
      // may already exist or fail — continue
    }
  }
  console.log(`  ✓ Logged ${amounts.length} water entries`);
}

/** Seed weight log entries for the past 14 days */
async function seedWeightData(page: Page) {
  console.log("\nSeeding weight data...");
  // Simulate gradual weight loss: 74.2 → 72.8 over 2 weeks
  const baseWeight = 74.2;
  for (let i = 14; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    // Random daily fluctuation ± 0.3 kg, with downward trend
    const weight =
      baseWeight - (14 - i) * 0.1 + (Math.random() - 0.5) * 0.3;
    try {
      await trpcMutate(page, "progress.logWeight", {
        date: dateStr,
        weightKg: Math.round(weight * 10) / 10,
      });
    } catch {
      // may already exist — continue
    }
  }
  console.log(`  ✓ Logged 15 weight entries`);
}

/**
 * Capture the AI chat page.
 * Shows the clean landing state with quick-prompt buttons and chat history,
 * since the AI system prompt is hardcoded in English and we want a clean EN screenshot.
 */
async function captureChat(page: Page) {
  console.log("\nCapturing AI chat page...");
  await page.goto("/hub/chat");
  await waitForStable(page);
  await snap(page, "03-ai-chat");
}

// ── Setup ───────────────────────────────────────────────────────────

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: DEVICE_SCALE_FACTOR,
});

// Default timeout per test — 60s (some pages are slow on dev server)
test.setTimeout(60_000);

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.describe(`Blog screenshots [${LOCALE}]`, () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // Clean old data, then seed fresh demo data
  test("00-seed-data", async ({ page }) => {
    test.setTimeout(120_000);
    // Navigate to any page first to establish auth context
    await page.goto("/hub");
    await waitForStable(page);

    console.log("\nCleaning old data...");
    await clearTodayDiary(page);
    await clearTodayWater(page);

    await seedDiaryData(page);
    await seedWaterData(page);
    await seedWeightData(page);
  });

  // 01 — Hub page (feature overview — hero image)
  test("01-hub", async ({ page }) => {
    await page.goto("/hub");
    await waitForStable(page);
    await snap(page, "01-hub");
  });

  // 02 — Today page (main dashboard)
  test("02-today", async ({ page }) => {
    await page.goto("/today");
    await waitForStable(page);
    await expect(
      page.locator("text=CONSUMED").or(page.locator("text=CONSUMED"))
    ).toBeVisible({ timeout: 10_000 });
    // Wait for tRPC data to load (calorie/macro/water/weight)
    await page.waitForTimeout(3000);
    // Reload to ensure fresh data from DB after seed
    await page.reload();
    await waitForStable(page);
    await expect(
      page.locator("text=CONSUMED").or(page.locator("text=CONSUMED"))
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2000);
    await snap(page, "02-today");
  });

  // 03 — AI chat (landing page with quick prompts)
  test("03-ai-chat", async ({ page }) => {
    await captureChat(page);
  });

  // 04 — Food search page
  test("04-food-search", async ({ page }) => {
    await page.goto("/hub/food/search");
    await waitForStable(page);
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="earch"], input[placeholder*="Search"]'
    );
    if (await searchInput.isVisible()) {
      await searchInput.fill("chicken");
      await page.waitForTimeout(1500);
    }
    await snap(page, "04-food-search");
  });

  // 05 — Diary page (food log with seeded data)
  test("05-diary", async ({ page }) => {
    await page.goto("/hub/diary");
    await waitForStable(page);
    // Wait for meal entries to load
    await page.waitForTimeout(1000);
    await snap(page, "05-diary");
  });

  // 06 — Food detail page
  test("06-food-detail", async ({ page }) => {
    await page.goto("/hub/food/search");
    await waitForStable(page);
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="earch"], input[placeholder*="Search"]'
    );
    if (await searchInput.isVisible()) {
      await searchInput.fill("Chicken breast");
      await page.waitForTimeout(1500);
    }
    const firstResult = page
      .locator('[data-testid="food-item"], a[href*="/hub/food/"]')
      .first();
    if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstResult.click();
      await waitForStable(page);
    }
    await snap(page, "06-food-detail");
  });

  // 07 — Create food page
  test("07-food-create", async ({ page }) => {
    await page.goto("/hub/food/create");
    await waitForStable(page);
    await snap(page, "07-food-create");
  });

  // 08 — AI food recognition page
  test("08-ai-estimate", async ({ page }) => {
    await page.goto("/hub/food/estimate");
    await waitForStable(page);
    await snap(page, "08-ai-estimate");
  });

  // 09 — Progress / weight tracking (with seeded weight data)
  test("09-progress", async ({ page }) => {
    await page.goto("/hub/weight");
    await waitForStable(page);
    await page.waitForTimeout(1000); // extra time for chart rendering
    await snap(page, "09-progress");
  });

  // 10 — Water tracking (with seeded water data)
  test("10-water", async ({ page }) => {
    await page.goto("/hub/water");
    await waitForStable(page);
    await snap(page, "10-water");
  });

  // 11 — Exercise log
  test("11-exercise", async ({ page }) => {
    await page.goto("/hub/exercise");
    await waitForStable(page);
    await snap(page, "11-exercise");
  });

  // 12 — Intermittent fasting
  test("12-fasting", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/hub/fasting");
    // networkidle can hang on fasting page (timer updates), use domcontentloaded instead
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await snap(page, "12-fasting");
  });

  // 13 — Workout home
  test("13-workout-home", async ({ page }) => {
    await page.goto("/hub/workout");
    await waitForStable(page);
    await snap(page, "13-workout-home");
  });
});
