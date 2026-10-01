import { expect, test, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { periodRange } from "../src/core/stats/period";
import { canSeed, lastEmail, mailpitUp, mockSearch, openQuickAdd, seedTitles, signUp, type SeedTitle } from "./helpers";

// S2 milestones & recaps (ADR 0031). Needs the local Supabase stack; titles are seeded and /api/search is mocked.
const ZONE = "Asia/Bangkok";
const MOVIES: SeedTitle[] = Array.from({ length: 10 }, (_, i) => ({
  kind: "movie",
  externalId: `97100${i}`,
  name: `Milestone Movie ${String.fromCharCode(65 + i)}`,
  year: 2020,
  posterPath: null,
  runtimeMin: 100,
}));

test.use({ timezoneId: ZONE });

/** Finishes a seeded movie through the API as the signed-in user (optionally on a past date). */
async function finish(page: Page, movie: SeedTitle, finishedAt?: string) {
  const res = await page.request.post("/api/entries", {
    data: { id: uuidv7(), title: { source: "tmdb", kind: "movie", externalId: movie.externalId }, status: "finished", ...(finishedAt ? { finishedAt } : {}) },
  });
  expect(res.status(), await res.text()).toBe(201);
}

test("the 10th title finished → its Milestone card after the Finish card → on the stats page, once", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, MOVIES);
  await mockSearch(page, MOVIES);
  await signUp(page, request, "milestone");

  // Nine finishes already in the collection (no celebration for those), then the tenth through quick add.
  for (const movie of MOVIES.slice(0, 9)) await finish(page, movie);
  await page.reload();
  await openQuickAdd(page);
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill("Milestone Movie J");
  await page.getByRole("dialog").getByRole("button", { name: /^Milestone Movie J Movie/ }).click();
  const checked = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/milestones");
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "You finished Milestone Movie J!" })).toBeVisible();
  expect((await (await checked).json()).milestones).toHaveLength(1);

  // The milestone waits for the Finish card, then opens on the Stone.
  await page.getByRole("button", { name: "Skip" }).click();
  const milestone = page.getByRole("dialog", { name: "That's your 10th title!" });
  await expect(milestone).toBeVisible();
  await expect(milestone.getByText("Stone · swipe for another style")).toBeVisible();
  await expect(milestone.locator("[data-card]")).toContainText("10");
  await expect(milestone.locator("[data-card]")).toContainText("Reached with Milestone Movie J");
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await milestone.getByRole("button", { name: "Download" }).click({ timeout: 15_000 });
  const save = await saved;
  expect(save.status()).toBe(201);
  expect(save.request().postDataJSON()).toMatchObject({ kind: "milestone", templateId: "stone", data: { milestone: { metric: "titles", value: 10 } } });
  await milestone.getByRole("button", { name: "Done" }).click();

  // Announced once; the stats page keeps it, one tap from its card.
  expect(await (await page.request.post("/api/milestones")).json()).toEqual({ milestones: [], badges: [], challenges: [] });
  await page.goto("/stats");
  const stone = page.getByRole("main").getByRole("button", { name: /^10\s*titles finished/ });
  await expect(stone).toContainText("Milestone Movie J");
  await stone.click();
  await expect(page.getByRole("dialog", { name: "That's your 10th title!" })).toBeVisible();
});

test("last month's finish → the 1st, 09:00 → Monthly Recap email → card; then the year in review", async ({ page, request, context }) => {
  const cronSecret = process.env.CRON_SECRET;
  test.skip(!(await mailpitUp(request)) || !canSeed() || !cronSecret || !process.env.UNSUBSCRIBE_SECRET, "needs local Supabase, CRON_SECRET and UNSUBSCRIBE_SECRET");
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true }));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seedTitles(request, MOVIES.slice(0, 1));
  const email = await signUp(page, request, "monthly");

  // A movie finished on the 2nd of last month (Bangkok), then the hourly job as this month's 1st, 10:00 Bangkok.
  const lastMonth = periodRange("month", { timeZone: ZONE, weekStart: 1, offset: -1 })!.from;
  const thisMonth = periodRange("month", { timeZone: ZONE, weekStart: 1 })!.from;
  await finish(page, MOVIES[0]!, new Date(lastMonth + 36 * 3_600_000).toISOString());
  const run = await request.post("/api/cron/weekly-recaps", {
    headers: { Authorization: `Bearer ${cronSecret}` },
    data: { now: new Date(thisMonth + 10 * 3_600_000).toISOString() },
  });
  expect(run.status()).toBe(200);

  const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: ZONE }).format(lastMonth + 36 * 3_600_000);
  const mail = await lastEmail(request, email);
  expect(mail.Subject).toBe(`Your month on Mystonie (${month})`);
  expect(mail.Text).toContain("100 min · 1 finished");
  await page.goto(new URL(mail.Text.match(/Open my recap card: (\S+)/)![1]!).pathname);
  const celebration = page.getByRole("dialog", { name: `Your month, ${month}` });
  await expect(celebration).toBeVisible();
  await expect(celebration.getByText("Collage · swipe for another style")).toBeVisible();
  await expect(celebration.locator("[data-card]")).toContainText(month);
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await celebration.getByRole("button", { name: "Copy card link" }).click({ timeout: 15_000 });
  const save = await saved;
  expect(save.status()).toBe(201);
  expect(save.request().postDataJSON()).toMatchObject({ kind: "monthly_recap", recapId: expect.stringMatching(/^[0-9a-f-]{36}$/), data: { recap: { period: "month" } } });

  // Year in Review for that year: the same numbers, and "Share my year" opens the Yearbook.
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: ZONE }).format(lastMonth + 36 * 3_600_000));
  await page.goto(`/review/${year}`);
  const main = page.getByRole("main");
  await expect(main.getByText(String(year), { exact: true })).toBeVisible();
  await expect(main.getByText("Titles finished", { exact: true }).locator("xpath=..")).toContainText("1");
  await expect(main.getByText("Milestone Movie A").first()).toBeVisible();
  await main.getByRole("button", { name: "Share my year" }).click();
  const review = page.getByRole("dialog", { name: `Your ${year} in review` });
  await expect(review.getByText("Yearbook · swipe for another style")).toBeVisible();
  const yearSaved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await review.getByRole("button", { name: "Copy card link" }).click({ timeout: 15_000 });
  expect((await yearSaved).request().postDataJSON()).toMatchObject({ kind: "year_review", templateId: "yearbook", data: { recap: { period: "year" } } });
  expect((await page.goto(`/review/${year + 1}`))?.status()).toBe(year + 1 > new Date().getFullYear() ? 404 : 200);
});
