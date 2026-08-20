import { test, expect, Page } from "@playwright/test";

// Helper: login with test account via API, then set cookie
async function login(page: Page) {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "test2@openhealth.dev", password: "testpass123" },
  });
  expect(response.ok()).toBeTruthy();
}

test.describe("Water tracking page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/hub/water");
    await expect(page.locator("text=Water Tracking")).toBeVisible({ timeout: 10_000 });
  });

  test("renders water tracking page with progress ring", async ({ page }) => {
    // Progress ring SVG (specific class)
    await expect(page.locator("svg.h-40.w-40")).toBeVisible();
    // Goal text is clickable
    await expect(page.locator("button", { hasText: /\/ .* ml/ })).toBeVisible();
    // Quick add buttons
    await expect(page.locator("text=Quick Add")).toBeVisible();
    await expect(page.getByRole("button", { name: "150 ml", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "250 ml", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "350 ml", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "500 ml", exact: true })).toBeVisible();
    // Log history section
    await expect(page.locator("text=Today's Records")).toBeVisible();
  });

  test("quick add creates entry visible in log history", async ({ page }) => {
    await page.locator("button", { hasText: "250 ml" }).click();

    // Wait for log to appear in history — look for "250 ml" in the history section
    await expect(page.locator("text=250 ml").last()).toBeVisible({ timeout: 10_000 });

    // Progress ring total should be > 0
    const totalText = page.locator(".tabular-nums").first();
    await expect(totalText).not.toHaveText("0", { timeout: 5_000 });
  });

  test("undo removes last log entry", async ({ page }) => {
    // Add entry and wait for total to update
    const totalEl = page.locator(".font-extralight.tabular-nums");
    const totalBefore = Number(await totalEl.textContent());

    await page.locator("button", { hasText: "150 ml" }).click();

    // Wait for total to increase by 150
    await expect(async () => {
      const current = Number(await totalEl.textContent());
      expect(current).toBe(totalBefore + 150);
    }).toPass({ timeout: 10_000 });

    // Click undo
    await page.locator("button", { hasText: "Undo Last" }).click();

    // Wait for total to go back to original
    await expect(async () => {
      const current = Number(await totalEl.textContent());
      expect(current).toBe(totalBefore);
    }).toPass({ timeout: 10_000 });
  });

  test("goal setting dialog opens and validates input", async ({ page }) => {
    await page.locator("button", { hasText: /\/ .* ml/ }).click();

    await expect(page.locator("text=Set Daily Goal")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("input[type='number']")).toBeVisible();

    // Invalid value
    await page.locator("input[type='number']").fill("100");
    await expect(page.locator("text=Please enter a value between 500 and 10000")).toBeVisible();
    const saveBtn = page.locator("button", { hasText: "Save" });
    await expect(saveBtn).toBeDisabled();

    // Valid value
    await page.locator("input[type='number']").fill("3000");
    await expect(page.locator("text=Please enter a value between 500 and 10000")).not.toBeVisible();
    await expect(saveBtn).toBeEnabled();
  });

  test("can save a new goal", async ({ page }) => {
    await page.locator("button", { hasText: /\/ .* ml/ }).click();
    await expect(page.locator("text=Set Daily Goal")).toBeVisible({ timeout: 5_000 });

    // Set to 3000
    await page.locator("input[type='number']").fill("3000");
    await page.locator("button", { hasText: "Save" }).click();

    await expect(page.locator("text=Set Daily Goal")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator("button", { hasText: "/ 3000 ml" })).toBeVisible({ timeout: 5_000 });

    // Reset to 2500
    await page.locator("button", { hasText: "/ 3000 ml" }).click();
    await expect(page.locator("text=Set Daily Goal")).toBeVisible({ timeout: 5_000 });
    await page.locator("input[type='number']").fill("2500");
    await page.locator("button", { hasText: "Save" }).click();
    await expect(page.locator("button", { hasText: "/ 2500 ml" })).toBeVisible({ timeout: 5_000 });
  });
});
