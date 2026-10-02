import { devices, expect, test, type Page } from "@playwright/test";

// The visitors' install sheet (ADR 0085). It never asks automation (navigator.webdriver), so these tests pretend to be
// a person. It waits 3 seconds before asking.
async function asPerson(page: Page) {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
}

const sheet = (page: Page) => page.getByRole("dialog", { name: "Put Mystonie on your home screen" });

test("an Android visitor is shown the browser menu's steps, and Not now holds", async ({ page }) => {
  await asPerson(page);
  await page.goto("/");
  await expect(sheet(page)).toBeVisible({ timeout: 15_000 });
  await expect(sheet(page)).toContainText("Install app");
  await sheet(page).getByRole("button", { name: "Not now" }).click();
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

// The getting-started checklist's Install step (ADR 0088). A stand-in session: the pre-paint hint only looks for
// Supabase's cookie, and the counts are mocked (everything else done), so this needs neither Mailpit nor an account.
async function withChecklist(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([{ name: "sb-e2e-auth-token", value: "x", url: baseURL ?? "http://localhost:3000" }]);
  await page.route("**/api/getting-started", (route) =>
    route.fulfill({ json: { facts: { entries: 1, cards: 1, avoidTopics: 1, following: 1, clubs: 0 } } }),
  );
  await page.goto("/privacy");
  await page.locator("[data-getting-started]").click();
  return page.getByRole("dialog", { name: "Getting started" });
}

test.describe("on a computer", () => {
  test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" });

  test("the checklist's Install step shows the computer's steps, and “It's installed” ticks it", async ({ page, baseURL }) => {
    const checklist = await withChecklist(page, baseURL);
    await checklist.locator("[data-install-step]").click();
    const desktop = page.getByRole("dialog", { name: "Install Mystonie on this computer" });
    await expect(desktop).toContainText("address bar");
    await desktop.getByRole("button", { name: "It's installed" }).click();
    await expect(desktop).toBeHidden();

    await page.locator("[data-getting-started]").click();
    await expect(page.getByRole("dialog", { name: "You're all set!" })).toBeVisible();
  });
});

test.describe("on an iPhone, signed in", () => {
  test.use({ userAgent: devices["iPhone 15"].userAgent });

  test("the Install step shows the Share steps, and Not now neither ticks it nor quiets Home's card", async ({ page, baseURL }) => {
    const checklist = await withChecklist(page, baseURL);
    await checklist.locator("[data-install-step]").click();
    await expect(sheet(page)).toContainText("Add to Home Screen");
    await expect(sheet(page).getByRole("button", { name: "It's on my home screen" })).toBeVisible();
    await sheet(page).getByRole("button", { name: "Not now" }).click();
    await expect(sheet(page)).toBeHidden();
    expect(await page.evaluate(() => window.localStorage.getItem("mystonie.install.dismissed"))).toBeNull();

    await page.locator("[data-getting-started]").click();
    await expect(page.locator("[data-install-step]")).toBeVisible();
  });
});

test("where the browser's dialog is ready, the Install step opens it at once and ticks", async ({ page, baseURL }) => {
  const checklist = await withChecklist(page, baseURL);
  // Chromium's beforeinstallprompt, answered "Install".
  await page.evaluate(() => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => {
        (window as Window & { prompted?: boolean }).prompted = true;
      },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  });
  await checklist.locator("[data-install-step]").click();
  await expect.poll(() => page.evaluate(() => (window as Window & { prompted?: boolean }).prompted)).toBe(true);
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByRole("dialog", { name: "You're all set!" })).toBeVisible();
});

test.describe("signed in, in an iPhone's Safari", () => {
  test.use({ userAgent: devices["iPhone 15"].userAgent });

  test("installing comes first: the sheet opens before the getting-started welcome, which follows on the next page", async ({ page, baseURL }) => {
    await asPerson(page);
    await page.context().addCookies([{ name: "sb-e2e-auth-token", value: "x", url: baseURL ?? "http://localhost:3000" }]);
    await page.route("**/api/getting-started", (route) =>
      route.fulfill({ json: { facts: { entries: 0, cards: 0, avoidTopics: 0, following: 0, clubs: 0 } } }),
    );
    await page.goto("/privacy");
    await expect(sheet(page)).toContainText("Open as Web App", { timeout: 8000 });
    await expect(sheet(page)).toContainText("sign in once more");
    await expect(page.getByRole("dialog", { name: "Getting started" })).toBeHidden();
    await sheet(page).getByRole("button", { name: "It's on my home screen" }).click();
    await expect(sheet(page)).toBeHidden();

    await page.goto("/terms");
    await expect(page.getByRole("dialog", { name: "Getting started" })).toBeVisible();
    await expect(page.locator("[data-install-step]")).toHaveCount(0);
  });
});

test("an out-of-date “installed” (Chrome offers to install again) neither silences the sheet nor ticks the step", async ({ page, baseURL }) => {
  await asPerson(page);
  await page.addInitScript(() => window.localStorage.setItem("mystonie.installed", "1"));
  await page.context().addCookies([{ name: "sb-e2e-auth-token", value: "x", url: baseURL ?? "http://localhost:3000" }]);
  await page.route("**/api/getting-started", (route) =>
    route.fulfill({ json: { facts: { entries: 1, cards: 1, avoidTopics: 1, following: 1, clubs: 0 } } }),
  );
  await page.goto("/privacy");
  // Chrome's offer, sent again until the page has hydrated and caught it.
  await expect(async () => {
    await page.evaluate(() => {
      const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(event);
    });
    await expect(sheet(page).getByRole("button", { name: "Install" })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  expect(await page.evaluate(() => window.localStorage.getItem("mystonie.installed"))).toBeNull();
  await sheet(page).getByRole("button", { name: "Not now" }).click();
  await page.locator("[data-getting-started]").click();
  await expect(page.locator("[data-install-step]")).toBeVisible();
});
