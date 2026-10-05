import { expect, test, type Page } from "@playwright/test";
import { BADGES } from "../src/core/badges";
import { uuidv7 } from "../src/core/ids";
import { signTip } from "../src/data/support";
import { canSeed, mailpitUp, mockSearch, openQuickAdd, seedTitles, signUp, type SeedReadingTitle, type SeedTitle } from "./helpers";

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
  await openQuickAdd(page);
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill("Badge Movie");
  await page.getByRole("dialog").getByRole("button", { name: /^Badge Movie Movie/ }).click();
  const checked = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/milestones");
  await page.getByRole("button", { name: "Finished today", exact: true }).click();
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
  await expect(album.getByText(`3 of ${BADGES.length} stuck in`)).toBeVisible();
  // Two rows at first (earned first, then the closest), the rest behind Show all.
  await album.getByRole("button", { name: `Show all (${BADGES.length})` }).click();
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
  await expect(main.getByText(`3 of ${BADGES.length}`)).toBeVisible();
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

test("a tip with the account's email sticks in the Supporter sticker (ADR 0063)", async ({ page, request }) => {
  const secret = process.env.BMC_WEBHOOK_SECRET;
  test.skip(
    !secret || secret.length < 16 || !(await mailpitUp(request)) || !canSeed(),
    "needs pnpm dev and this test started with the same BMC_WEBHOOK_SECRET, and the local Supabase stack",
  );
  const email = await signUp(page, request, "tipper", "/home");
  const send = (body: object, signature?: string) => {
    const raw = JSON.stringify(body);
    return request.post("/api/support/webhook", { data: raw, headers: { "Content-Type": "application/json", "X-Signature-Sha256": signature ?? signTip(raw, secret!) } });
  };
  const tip = { event_id: 1, type: "donation.created", live_mode: false, created: Math.floor(Date.now() / 1000), attempt: 1, data: { supporter_email: email.toUpperCase(), amount: 5 } };

  // Only Buy Me a Coffee's signature counts; a tip from an email with no account changes nothing.
  expect((await send(tip, "0".repeat(64))).status()).toBe(400);
  expect(await (await send(tip)).json()).toEqual({ received: true, matched: true });
  expect(await (await send({ ...tip, data: { supporter_email: `nobody.${Date.now()}@example.com` } })).json()).toEqual({ received: true, matched: false });
  expect(await (await send({ ...tip, type: "donation.refunded" })).json()).toEqual({ received: true, ignored: true });

  // The album shows it, even with nothing finished yet.
  await page.goto("/stats");
  const album = page.locator("#stickers");
  await expect(album.getByText(`1 of ${BADGES.length} stuck in`)).toBeVisible();
  await album.getByRole("button", { name: /^Supporter$/ }).click();
  const sheet = page.getByRole("dialog", { name: "Supporter" });
  await expect(sheet.getByText("Support Mystonie with Pro or a coffee.")).toBeVisible();
  await expect(sheet.getByText(/^Earned /)).toBeVisible();
});
