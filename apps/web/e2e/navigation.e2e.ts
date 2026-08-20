import { test, expect } from "@playwright/test";

test.describe("App navigation", () => {
  test("diary page loads with meal sections", async ({ page }) => {
    await page.goto("/hub/diary");
    await expect(page.getByText("Breakfast")).toBeVisible();
    await expect(page.getByText("Lunch")).toBeVisible();
    await expect(page.getByText("Dinner")).toBeVisible();
    await expect(page.getByText("Snack")).toBeVisible();
  });

  test("diary page has FAB button", async ({ page }) => {
    await page.goto("/hub/diary");
    await expect(page.getByTestId("add-entry-fab")).toBeVisible({ timeout: 15_000 });
  });

  test("food search page loads with search input", async ({ page }) => {
    await page.goto("/hub/food/search");
    await expect(
      page.getByPlaceholder(/Search/).or(page.getByRole("searchbox"))
    ).toBeVisible();
  });

  test("water tracking page loads", async ({ page }) => {
    await page.goto("/hub/water");
    // Water page shows daily target text
    await expect(page.getByText("/ 2500 ml")).toBeVisible({ timeout: 15_000 });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    // Settings page shows theme label
    await expect(page.getByText("Light")).toBeVisible({ timeout: 15_000 });
  });

  test("bottom nav is visible on app pages", async ({ page }) => {
    await page.goto("/hub/diary");
    await expect(page.getByTestId("bottom-nav")).toBeVisible();
  });
});
