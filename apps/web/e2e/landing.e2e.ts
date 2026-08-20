import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero section with title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Open Health");
  });

  test("has navigation links", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });

  test("has call-to-action button linking to diary", async ({ page }) => {
    await page.goto("/");
    const ctaLink = page.getByRole("link", { name: /Get Started/ }).first();
    await expect(ctaLink).toBeVisible();
    await expect(ctaLink).toHaveAttribute("href", "/hub");
  });

  test("has correct meta title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Open Health/);
  });
});
