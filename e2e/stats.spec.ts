import { expect, test, type Page } from "@playwright/test";
import { canSeed, mailpitUp, mockSearch, navIsland, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack (sign-in via Mailpit); search is mocked and the title seeded, as in collection.spec.
const TITLE: SeedTitle = { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", runtimeMin: 133 };

/** The three headline numbers (watch time, titles finished, episodes) of a summary section. */
const numbers = (page: Page, section: string) => page.locator(section).locator("dd").allInnerTexts();

test("stats: empty state, then numbers that match the collection, and Share stats", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, [TITLE]);
  await mockSearch(page, [TITLE]);
  await signUp(page, request, "stats", "/stats");

  // Me's Stats tab (ADR 0053). Nothing logged yet: the page points to logging the first title.
  const meTabs = page.getByRole("navigation", { name: "Your album, stats and cards" });
  await expect(page).toHaveTitle("Stats · Mystonie");
  await expect(meTabs.getByRole("link", { name: "Stats" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Log your first title" }).click();
  await expect(page).toHaveURL(/\/collection\?add=1$/);

  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill("Parasite");
  await page.getByRole("dialog").getByRole("button", { name: /^Parasite Movie/ }).first().click();
  const added = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/entries" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Finished today", exact: true }).click();
  expect((await added).status()).toBe(201);
  await page.getByRole("button", { name: "Skip" }).click();
  const collection = await numbers(page, 'section[aria-labelledby="collection-summary"]');

  // Me, then its Stats tab, opens this month's stats; all time equals the collection's all-time summary.
  await navIsland(page).getByRole("link", { name: "Me", exact: true }).click();
  await meTabs.getByRole("link", { name: "Stats" }).click();
  await expect(page.getByRole("link", { name: "This month" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").locator("dd").first()).toHaveText("2h 13m");
  await page.getByRole("link", { name: "All time" }).click();
  await expect(page).toHaveURL(/period=all/);
  const stats = await numbers(page, "main section:has(> dl)");
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

  // Share my collection (stage 4): an all-time card per area (watched, read, played).
  await page.goto("/collection");
  // On the collection page, the open tab's card; on the profile, a button per area with something in it.
  await expect(page.getByRole("button", { name: "Watch", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Share all I've watched" }).click();
  const watched = page.getByRole("dialog", { name: /^Everything you've watched, / });
  await expect(watched.locator("[data-card]")).toContainText("All I've watched");
  const areaSaved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await watched.getByRole("button", { name: "Download" }).click({ timeout: 15_000 });
  expect((await areaSaved).request().postDataJSON()).toMatchObject({ kind: "stats", data: { recap: { period: "all", area: "watch", finished: 1 } } });
});

test("stats: favourite actor and director from the credits of finished titles, on the page and the card", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  // Made-up ids, so no other test's copy of these films (without credits) can race this one.
  const song = { role: "actor", id: "20738", name: "Song Kang-ho", image: null };
  const bong = { role: "director", id: "21684", name: "Bong Joon Ho", image: null };
  const films: SeedTitle[] = [
    { kind: "movie", externalId: "9900001", name: "Memories of Murder E2E", year: 2003, posterPath: null, runtimeMin: 131, credits: [song, bong] },
    { kind: "movie", externalId: "9900002", name: "The Host E2E", year: 2006, posterPath: null, runtimeMin: 120, credits: [song, bong, { role: "studio", id: "7036", name: "Showbox E2E", image: null }] },
  ];
  await seedTitles(request, films);
  await mockSearch(page, films);
  await signUp(page, request, "favourites");

  for (const film of films) {
    await page.goto("/collection?add=1");
    await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill(film.name);
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${film.name} Movie`) }).first().click();
    const added = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/entries" && r.request().method() === "POST");
    await page.getByRole("button", { name: "Finished today", exact: true }).click();
    expect((await added).status()).toBe(201);
    await page.getByRole("button", { name: "Skip" }).click();
  }

  // (Exact names: the cover's heading is the account's name, favourites_….)
  await page.goto("/stats?period=all");
  await expect(page.getByRole("heading", { name: "Favourites", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Actors", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Directors & creators", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Studios", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText("Song Kang-ho")).toBeVisible();
  await expect(page.getByRole("main").getByText("2 titles · 4h 11m").first()).toBeVisible();

  // The all-time card names the favourites that are in two titles (not the studio, in one).
  await page.getByRole("button", { name: "Share stats" }).click();
  const card = page.getByRole("dialog", { name: /^Your watching so far, / }).locator("[data-card]");
  await expect(card).toContainText("Favourite actor Song Kang-ho");
  await expect(card).toContainText("Favourite director Bong Joon Ho");
  await expect(card).not.toContainText("Showbox");
});
