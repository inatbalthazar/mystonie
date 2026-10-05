import { expect, test, type Page } from "@playwright/test";
import { canSeed, mailpitUp, mockSearch, navIsland, openQuickAdd, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack (sign-in via Mailpit). TMDB isn't needed: search is mocked in the browser
// and the titles are seeded into the local cache, so adding them never calls TMDB.
const TITLES: SeedTitle[] = [
  { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", runtimeMin: 133 },
  { kind: "movie", externalId: "693134", name: "Dune: Part Two", year: 2024, posterPath: null, runtimeMin: 167 },
];
const rows = (page: Page) => page.getByRole("main").getByRole("listitem");

/** Resolves when the next write to /api/entries has been answered (the UI updates before that). */
const saved = (page: Page) =>
  page.waitForResponse((r) => new URL(r.url()).pathname.startsWith("/api/entries") && r.request().method() !== "GET");

async function pickResult(page: Page, query: string, name: string) {
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill(query);
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${name} Movie`) }).first().click();
}

test("quick add: a finished movie in 3 taps, shown at once, then edited and removed", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, TITLES);
  await mockSearch(page, TITLES);
  await signUp(page, request, "collect");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your collection");
  await expect(page.getByText("Your first page is waiting")).toBeVisible();

  // Want to watch, from the ➕ on the page.
  await openQuickAdd(page);
  await pickResult(page, "Parasite", "Parasite");
  await page.getByRole("button", { name: "Want to watch" }).click();
  await expect(rows(page).first()).toContainText("Parasite");
  await expect(rows(page).first()).toContainText("Want to watch");

  // From the home page: ➕ (1), a result (2), Finished (3). The row shows before the server answers.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/entries", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/");
  await navIsland(page).getByRole("link", { name: "Add a title" }).click(); // tap 1
  await pickResult(page, "Dune Part", "Dune: Part Two"); // tap 2
  await page.getByRole("button", { name: "Finished today", exact: true }).click(); // tap 3
  await expect(rows(page).first()).toContainText("Dune: Part Two");
  await expect(rows(page).first()).toContainText("Saving…");
  release();
  await expect(rows(page).first()).toContainText(/Finished \w{3} \d{1,2}, \d{4}/);
  await page.unroute("**/api/entries");

  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText("Dune: Part Two");

  // An earlier finish date moves it below the title added today.
  await page.getByRole("button", { name: "Edit Dune: Part Two" }).click();
  await page.getByLabel("Finished on").fill("2024-05-01");
  const edited = saved(page);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(rows(page).first()).toContainText("Parasite");
  expect((await edited).ok()).toBe(true);
  await page.reload();
  await expect(rows(page).last()).toContainText("Finished May 1, 2024");
  await expect(rows(page).last()).toContainText("2h 47m (167 min)");

  // Summary header: only the finished movie counts. The year filter follows the new finish date.
  const summary = page.getByRole("region", { name: "All time so far" });
  await expect(summary).toContainText("2h 47m");
  await expect(summary.getByRole("definition").nth(1)).toHaveText("1");
  // (The page streams after a reload: a choice made before it hydrates is lost, so it's made again.)
  await expect(async () => {
    await page.getByLabel("Year").selectOption("2024");
    await expect(page.getByRole("region", { name: "Your 2024" })).toContainText("2h 47m", { timeout: 1000 });
  }).toPass();
  await expect(rows(page)).toHaveCount(1);
  await page.getByLabel("Status", { exact: true }).selectOption("want");
  await expect(page.getByText("Nothing on this page yet")).toBeVisible();
  await page.getByRole("button", { name: "Show everything" }).click();
  await expect(rows(page)).toHaveCount(2);

  // Tiles/list is remembered across visits.
  await page.getByRole("button", { name: "Posters" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Posters" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "List" }).click();

  // Adding a title that's already there updates it instead of duplicating it.
  await openQuickAdd(page);
  await pickResult(page, "Dune Part", "Dune: Part Two");
  const rewatched = saved(page);
  await page.getByRole("button", { name: "Watching" }).click();
  expect((await rewatched).status()).toBe(201);
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Edit Dune: Part Two" })).toContainText("Watching");

  // Remove (soft delete) takes two taps.
  await page.getByRole("button", { name: "Edit Parasite" }).click();
  await page.getByRole("button", { name: "Remove from collection" }).click();
  const removed = saved(page);
  await page.getByRole("button", { name: "Tap again to remove" }).click();
  await expect(page.getByRole("status")).toHaveText("Removed “Parasite”.");
  expect((await removed).ok()).toBe(true);
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
});

test("quick add: filling in the past, one title after another without a celebration (ADR 0096)", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, TITLES);
  await mockSearch(page, TITLES);
  await signUp(page, request, "backfill");
  const sheet = page.getByRole("dialog", { name: "Add a title" });

  // The sheet says the past counts, and offers an import.
  await openQuickAdd(page);
  await expect(sheet.getByLabel("Search movies, series, books, manga and games")).toHaveAttribute("placeholder", "What have you finished?");
  await expect(sheet.getByRole("link", { name: "Coming from another app? Import your history" })).toBeVisible();

  // Earlier, no day needed: dated by the title's year.
  await pickResult(page, "Parasite", "Parasite");
  await expect(sheet.getByRole("button", { name: "Finished today", exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Earlier", exact: true }).click();
  await expect(sheet.getByLabel("Which day? (optional)")).toHaveValue("");
  let added = saved(page);
  await sheet.getByRole("button", { name: "Finished earlier", exact: true }).click();
  expect((await added).ok()).toBe(true);
  // No celebration: back to the search, counting.
  await expect(sheet.getByRole("status")).toContainText("1 pasted in");
  await expect(sheet.getByLabel("Search movies, series, books, manga and games")).toHaveValue("");
  await expect(page.getByRole("heading", { name: /You finished/ })).toHaveCount(0);

  // The next one keeps Earlier; a picked day shows on the button.
  await pickResult(page, "Dune Part", "Dune: Part Two");
  await expect(sheet.getByRole("button", { name: "Earlier", exact: true })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByLabel("Which day? (optional)").fill("2024-05-01");
  added = saved(page);
  await sheet.getByRole("button", { name: "Finished on May 1, 2024", exact: true }).click();
  expect((await added).ok()).toBe(true);
  await expect(sheet.getByRole("status")).toContainText("2 pasted in");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("heading", { name: /You finished/ })).toHaveCount(0);

  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Edit Dune: Part Two" })).toContainText("Finished May 1, 2024");
  await expect(page.getByRole("button", { name: "Edit Parasite" })).toContainText("Finished Jan 1, 2019");
});

test("the collection needs an account", async ({ page }) => {
  await page.goto("/th/collection");
  await expect(page).toHaveURL(/\/th\/auth\?next=%2Fth%2Fcollection$/);
});
