import { expect, test, type Page } from "@playwright/test";
import { canSeed, mailpitUp, mockSearch, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack (sign-in via Mailpit); search is mocked and the title seeded, as in collection.spec.
const TITLE: SeedTitle = { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", runtimeMin: 133 };

/** The three headline numbers (watch time, titles finished, episodes) of a summary section. */
const numbers = (page: Page, section: string) => page.locator(section).locator("dd").allInnerTexts();

test("stats: empty state, then numbers that match the collection, and Share stats", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, [TITLE]);
  await mockSearch(page, [TITLE]);
  await signUp(page, request, "stats", "/stats");

  // Nothing logged yet: the page points to logging the first title.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stats");
  await page.getByRole("link", { name: "Log your first title" }).click();
  await expect(page).toHaveURL(/\/collection\?add=1$/);

  await page.getByRole("dialog").getByLabel("Search movies and series").fill("Parasite");
  await page.getByRole("dialog").getByRole("button", { name: /^Parasite Movie/ }).first().click();
  const added = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/entries" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  expect((await added).status()).toBe(201);
  await page.getByRole("button", { name: "Skip" }).click();
  const collection = await numbers(page, 'section[aria-labelledby="collection-summary"]');

  // The header link opens this month's stats; all time equals the collection's all-time summary.
  await page.getByRole("link", { name: "Stats", exact: true }).click();
  await expect(page.getByRole("link", { name: "This month" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").locator("dd").first()).toHaveText("2h 13m");
  await page.getByRole("link", { name: "All time" }).click();
  await expect(page).toHaveURL(/period=all/);
  const stats = await numbers(page, "main > section:has(> dl)");
  expect(stats.slice(0, 3)).toEqual(collection);
  await expect(page.getByText("Longest movie")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Parasite");

  // Share stats: a Bold Stats card for the period, saved as a stats card.
  await page.getByRole("button", { name: "Share stats" }).click();
  const celebration = page.getByRole("dialog", { name: /^Your watching so far, / });
  await expect(celebration).toBeVisible();
  await expect(celebration.locator("[data-card]")).toContainText("1 title so far");
  await expect(celebration.getByText("Bold Stats · swipe for another style")).toBeVisible();
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await celebration.getByRole("button", { name: "Download" }).click({ timeout: 15_000 });
  const save = await saved;
  expect(save.status()).toBe(201);
  expect(save.request().postDataJSON()).toMatchObject({ kind: "stats", templateId: "boldStats", data: { recap: { period: "all", finished: 1 } } });
});
