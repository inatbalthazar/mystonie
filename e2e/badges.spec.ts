import { expect, test, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, mockSearch, seedTitles, signUp, type SeedReadingTitle, type SeedTitle } from "./helpers";

// S3 badges & shelf (ADR 0038). Needs the local Supabase stack (sign-in via Mailpit, the service role key that
// awards badges); titles are seeded and /api/search is mocked.
const BOOKS: SeedReadingTitle[] = Array.from({ length: 5 }, (_, i) => ({
  kind: "book",
  // Google Books volume ids are 12 characters.
  externalId: `badgeE2Ebk0${i}`,
  name: `Badge Book ${String.fromCharCode(65 + i)}`,
  year: 2021,
  posterPath: null,
  pageCount: 200,
}));
const MOVIE: SeedTitle = { kind: "movie", externalId: "972001", name: "Badge Movie", year: 2022, posterPath: null, runtimeMin: 100 };

async function finishBook(page: Page, book: SeedReadingTitle) {
  const res = await page.request.post("/api/entries", {
    data: { id: uuidv7(), title: { source: "google_books", kind: "book", externalId: book.externalId }, status: "finished" },
  });
  expect(res.status(), await res.text()).toBe(201);
}

const check = async (page: Page) => (await (await page.request.post("/api/milestones")).json()) as { badges: { id: string; titleName: string | null }[] };

test("the 5th book earns Rookie Bookworm once → the toast → the album → stickers and the shelf on the profile", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  await seedTitles(request, [...BOOKS, MOVIE]);
  await mockSearch(page, [MOVIE]);
  await signUp(page, request, "badges", "/home");
  const username = `badger_${Date.now().toString(36)}`;
  const named = await page.request.patch("/api/account", { data: { username, displayName: "Bea Badger" } });
  expect(named.ok(), await named.text()).toBe(true);

  // Four books: the first one is a sticker of its own.
  for (const book of BOOKS.slice(0, 4)) await finishBook(page, book);
  expect((await check(page)).badges).toEqual([{ id: "first-book", titleName: "Badge Book A" }]);

  // The fifth earns Rookie Bookworm, exactly once.
  await finishBook(page, BOOKS[4]!);
  expect((await check(page)).badges).toEqual([{ id: "rookie-bookworm", titleName: "Badge Book E" }]);
  expect((await check(page)).badges).toEqual([]);

  // A movie through quick add: its sticker shows in a toast once the Finish card closes.
  await page.goto("/collection");
  await expect(async () => {
    await page.getByRole("button", { name: /^Add (a|your first) title$/ }).first().click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill("Badge Movie");
  await page.getByRole("dialog").getByRole("button", { name: /^Badge Movie Movie/ }).click();
  const checked = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/milestones");
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "You finished Badge Movie!" })).toBeVisible();
  expect((await (await checked).json()).badges).toEqual([{ id: "first-movie", titleName: "Badge Movie" }]);
  await page.getByRole("button", { name: "Skip" }).click();
  const toast = page.getByRole("status").filter({ hasText: "New sticker!" });
  await expect(toast).toContainText("Opening Night");
  await expect(toast).toContainText("for finishing Badge Movie");
  await expect.poll(() => page.evaluate(() => window.__mystonieEvents?.map(([name]) => name) ?? [])).toContain("badge_earned");

  // The album on the stats page: three stuck in, the rest still to earn.
  await toast.getByRole("link", { name: "See your album" }).click();
  await expect(page).toHaveURL(/\/stats#stickers$/);
  const album = page.locator("#stickers");
  await expect(album.getByRole("heading", { name: "Sticker album" })).toBeVisible();
  await expect(album.getByText("3 of 20 stuck in")).toBeVisible();
  await expect(album.getByRole("button", { name: /^Bookworm\s*5 of 25$/ })).toBeVisible();
  await album.getByRole("button", { name: /^Rookie Bookworm$/ }).click();
  const sheet = page.getByRole("dialog", { name: "Rookie Bookworm" });
  await expect(sheet.getByText("Finish 5 books.")).toBeVisible();
  await expect(sheet.getByText(/with Badge Book E$/)).toBeVisible();

  // A visitor sees the stickers and the shelf on the public profile…
  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto(`/u/${username}`);
  const main = guest.getByRole("main");
  await expect(main.getByRole("heading", { name: "Stickers" })).toBeVisible();
  await expect(main.getByText("3 of 20")).toBeVisible();
  await expect(main.getByRole("button", { name: "Rookie Bookworm" })).toBeVisible();
  const shelf = main.getByRole("region", { name: "The shelf" });
  await expect(shelf.getByRole("listitem")).toHaveCount(6);
  await expect(shelf.getByText("Badge Movie (movie)")).toBeAttached();
  await expect(shelf.getByText("Badge Book E (book)")).toBeAttached();

  // …and neither once the collection is private.
  const hidden = await page.request.patch("/api/account", { data: { visibility: "private" } });
  expect(hidden.ok(), await hidden.text()).toBe(true);
  await guest.reload();
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("This collection is private");
  await expect(main.getByRole("heading", { name: "Stickers" })).toHaveCount(0);
  await expect(main.getByRole("region", { name: "The shelf" })).toHaveCount(0);
  await visitor.close();
});
