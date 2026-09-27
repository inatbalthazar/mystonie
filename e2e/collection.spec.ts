import { expect, test, type Page } from "@playwright/test";
import { canSeed, mailpitUp, mockSearch, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack (sign-in via Mailpit). TMDB isn't needed: search is mocked in the browser
// and the titles are seeded into the local cache, so adding them never calls TMDB.
const TITLES: SeedTitle[] = [
  { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", runtimeMin: 133 },
  { kind: "movie", externalId: "693134", name: "Dune: Part Two", year: 2024, posterPath: null, runtimeMin: 167 },
];
const rows = (page: Page) => page.getByRole("main").getByRole("listitem");

/** The page's ➕. Retries until the sheet opens (a first dev compile can take a moment to hydrate). */
async function openAdd(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Add a title" }).click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/** Resolves when the next write to /api/entries has been answered (the UI updates before that). */
const saved = (page: Page) =>
  page.waitForResponse((r) => new URL(r.url()).pathname.startsWith("/api/entries") && r.request().method() !== "GET");

async function pickResult(page: Page, query: string, name: string) {
  await page.getByRole("dialog").getByLabel("Search movies and series").fill(query);
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
  await openAdd(page);
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
  await page.getByRole("banner").getByRole("link", { name: "Add a title" }).click(); // tap 1
  await pickResult(page, "Dune Part", "Dune: Part Two"); // tap 2
  await page.getByRole("button", { name: "Finished", exact: true }).click(); // tap 3
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
  await page.getByLabel("Year").selectOption("2024");
  await expect(page.getByRole("region", { name: "Your 2024" })).toContainText("2h 47m");
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
  await openAdd(page);
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

test("the collection needs an account", async ({ page }) => {
  await page.goto("/th/collection");
  await expect(page).toHaveURL(/\/th\/auth\?next=%2Fth%2Fcollection$/);
});
