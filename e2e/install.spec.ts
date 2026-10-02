import { devices, expect, test, type Page } from "@playwright/test";

// The visitors' install sheet (ADR 0085). It never asks automation (navigator.webdriver), so these tests pretend to be
// a person. It waits 6 seconds before asking.
async function asPerson(page: Page) {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
}

const sheet = (page: Page) => page.getByRole("dialog", { name: "Put Mystonie on your home screen" });

test("an Android visitor is shown the browser menu's steps, and Not now holds", async ({ page }) => {
  await asPerson(page);
  await page.goto("/");
  await expect(sheet(page)).toBeVisible({ timeout: 15_000 });
  await expect(sheet(page)).toContainText("Install app");
  await sheet(page).getByRole("button", { name: "Got it" }).click();
  await expect(sheet(page)).toBeHidden();

  await page.reload();
  await page.waitForTimeout(8000);
  await expect(sheet(page)).toBeHidden();
});

test.describe("on an iPhone", () => {
  test.use({ userAgent: devices["iPhone 15"].userAgent });

  test("Safari gets the Share steps", async ({ page }) => {
    await asPerson(page);
    await page.goto("/");
    await expect(sheet(page)).toContainText("Add to Home Screen", { timeout: 15_000 });
  });
});

test.describe("in Instagram's browser", () => {
  test.use({ userAgent: `${devices["iPhone 15"].userAgent} Instagram 350.0.0.0` });

  test("the visitor is sent to the real browser first", async ({ page }) => {
    await asPerson(page);
    await page.goto("/");
    await expect(sheet(page)).toContainText("Open in browser", { timeout: 15_000 });
    await expect(sheet(page).getByRole("button", { name: "Copy the link" })).toBeVisible();
  });
});

test("nobody is asked while signing in", async ({ page }) => {
  await asPerson(page);
  await page.goto("/auth");
  await page.waitForTimeout(8000);
  await expect(sheet(page)).toBeHidden();
});
