import { test, expect } from "@playwright/test";

// Helper: open login dialog by clicking the FAB (+ button) on diary page
async function openLoginDialog(page: import("@playwright/test").Page) {
  await page.goto("/hub/diary");
  const fab = page.getByTestId("add-entry-fab");
  await expect(fab).toBeVisible({ timeout: 15_000 });
  await fab.click();
  await expect(page.getByText("Sign in to continue")).toBeVisible({ timeout: 10_000 });
}

// The mode toggle button is a <button> inside a <p> at the bottom of the dialog
function modeToggle(page: import("@playwright/test").Page, parentText: string) {
  return page.locator("p").filter({ hasText: parentText }).locator("button");
}

test.describe("Authentication flow", () => {
  test("FAB click opens login dialog for unauthenticated users", async ({ page }) => {
    await openLoginDialog(page);
  });

  test("login dialog has email and password fields", async ({ page }) => {
    await openLoginDialog(page);

    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("can switch between login and register modes", async ({ page }) => {
    await openLoginDialog(page);

    // Switch to register
    await modeToggle(page, "No account yet").click();
    await expect(page.getByText("Create account")).toBeVisible();
    await expect(page.getByPlaceholder("Name")).toBeVisible();
    await expect(page.getByPlaceholder("Password (at least 8 characters)")).toBeVisible();

    // Switch back to login
    await modeToggle(page, "Already have an account").click();
    await expect(page.getByText("Sign in to continue")).toBeVisible();
  });

  test("shows Google and Apple OAuth buttons", async ({ page }) => {
    await openLoginDialog(page);

    await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Apple/ })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await openLoginDialog(page);

    await page.getByPlaceholder("Email").fill("nonexistent@test.com");
    await page.getByPlaceholder("Password").fill("wrongpassword123");
    await page.locator("button[type='submit']").click();

    // Better Auth returns error — dialog shows error div
    await expect(page.locator("[role='alert'], .rounded-md.p-3")).toBeVisible({ timeout: 10_000 });
  });

  test("register form has minlength validation on password", async ({ page }) => {
    await openLoginDialog(page);

    await modeToggle(page, "No account yet").click();

    const passwordInput = page.getByPlaceholder("Password (at least 8 characters)");
    await expect(passwordInput).toHaveAttribute("minlength", "8");
  });
});
