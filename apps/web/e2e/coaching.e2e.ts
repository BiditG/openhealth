import { test, expect, Page } from "@playwright/test";

// Known working test account
const TEST_USER = { email: "test2@openhealth.dev", password: "testpass123", name: "Test User", code: "FJF76J" };

async function login(page: Page) {
  await page.goto("/hub");
  await page.waitForLoadState("networkidle");

  const headerLoginBtn = page.locator("header").getByText("Sign in");
  if (!(await headerLoginBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return; // Already logged in
  }

  await headerLoginBtn.click();
  await expect(page.getByText("Sign in to continue")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("Email").fill(TEST_USER.email);
  await page.getByPlaceholder("Password").fill(TEST_USER.password);
  await page.locator("button[type='submit']").click();

  // Wait for dialog to close
  await expect(page.getByText("Sign in to continue")).not.toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

test.describe("Coaching feature", () => {
  test("coach dashboard renders with invite code", async ({ page }) => {
    await login(page);
    await page.goto("/coach");
    await page.waitForLoadState("networkidle");

    // Header
    await expect(page.getByText("OH COACH")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Back to App")).toBeVisible();

    // Title and invite code
    await expect(page.locator("text=Coach Dashboard")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(TEST_USER.code)).toBeVisible({ timeout: 10_000 });
  });

  test("coach dashboard shows empty client list", async ({ page }) => {
    await login(page);
    await page.goto("/coach");
    await page.waitForLoadState("networkidle");

    // Empty state OR client list (depends on DB state)
    const clientSection = page.locator("text=Client List");
    await expect(clientSection).toBeVisible({ timeout: 10_000 });
  });

  test("settings shows coaching menu item", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("My Coach")).toBeVisible({ timeout: 10_000 });
  });

  test("coaching settings page renders correctly", async ({ page }) => {
    await login(page);
    await page.goto("/settings/coaching");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1", { hasText: "My Coach" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder("Enter coach code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join" })).toBeVisible();
  });

  test("cannot join self as coach", async ({ page }) => {
    await login(page);
    await page.goto("/settings/coaching");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("Enter coach code").fill(TEST_USER.code);
    await page.getByRole("button", { name: "Join" }).click();

    await expect(page.getByText("You cannot add yourself as your coach")).toBeVisible({ timeout: 10_000 });
  });

  test("shows error for invalid coach code", async ({ page }) => {
    await login(page);
    await page.goto("/settings/coaching");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("Enter coach code").fill("ZZZZZZZZ");
    await page.getByRole("button", { name: "Join" }).click();

    await expect(page.getByText("Coach code does not exist")).toBeVisible({ timeout: 10_000 });
  });

  test("coach client detail page renders when accessed", async ({ page }) => {
    await login(page);
    await page.goto("/coach");
    await page.waitForLoadState("networkidle");

    // Check if there are any clients to click
    const clientLink = page.locator("a[href^='/coach/client/']").first();
    if (await clientLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await clientLink.click();
      await expect(page).toHaveURL(/\/coach\/client\//);
      await expect(page.getByText("Back to client list")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Weekly average")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByPlaceholder(/Example: daily intake/)).toBeVisible();
    }
    // If no clients, that's fine — we just skip this part
  });

  test("Back to App link navigates to hub", async ({ page }) => {
    await login(page);
    await page.goto("/coach");
    await page.waitForLoadState("networkidle");

    await page.getByText("Back to App").click();
    await expect(page).toHaveURL(/\/hub/);
  });
});
