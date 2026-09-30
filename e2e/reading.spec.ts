import { expect, test } from "@playwright/test";
import { canSeed, mailpitUp, seedTitles, signUp, type SeedReadingTitle, type SeedTitle } from "./helpers";

// Needs the local Supabase stack. Titles are seeded and /api/search is mocked, so neither TMDB, AniList nor Google
// Books is called (the merge itself is unit-tested with real AniList fixtures in src/core/catalog).
const MANGA: SeedReadingTitle = {
  kind: "manga",
  externalId: "30013",
  name: "One Piece",
  year: 1997,
  posterPath: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg",
  chapterCount: null,
  volumeCount: null,
};
const SERIES: SeedTitle = { kind: "series", externalId: "37854", name: "One Piece", year: 1999, posterPath: null, runtimeMin: 24 };

test("one piece: manga and series side by side → log chapter 1100 → Progress card → the same numbers on Collection and Stats", async ({
  page,
  request,
  context,
}) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true }));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seedTitles(request, [MANGA, SERIES]);
  const types: string[] = [];
  await page.route(
    (url) => url.pathname === "/api/search",
    (route) => {
      const params = new URL(route.request().url()).searchParams;
      types.push(params.get("type") ?? "");
      const series = { source: "tmdb", kind: "series", externalId: SERIES.externalId, name: SERIES.name, year: SERIES.year };
      const manga = { source: "anilist", kind: "manga", externalId: MANGA.externalId, name: MANGA.name, year: MANGA.year, imageUrl: MANGA.posterPath };
      const results = params.get("type") === "manga" ? [manga] : params.get("type") === "screen" ? [series] : [series, manga];
      return route.fulfill({ json: { results } });
    },
  );
  await signUp(page, request, "reading");

  // Search "one piece" in All: the series and the manga, each labelled.
  await expect(async () => {
    await page.getByRole("button", { name: "Add your first title" }).click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  const sheet = page.getByRole("dialog", { name: "Add a title" });
  await expect(sheet.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByLabel("Search movies, series, books, manga and games").fill("one piece");
  await expect(sheet.getByRole("button", { name: /^One Piece Series · 1999/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^One Piece Manga · 1997/ })).toBeVisible();
  expect(types).toContain("all");
  await sheet.getByRole("button", { name: "Manga", exact: true }).click();
  await expect(sheet.getByRole("button", { name: /^One Piece Series/ })).toHaveCount(0);
  expect(types).toContain("manga");

  // Add the manga as "Reading": it lands on the Read tab.
  await sheet.getByRole("button", { name: /^One Piece Manga · 1997/ }).click();
  const added = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/entries" && r.request().method() === "POST");
  await sheet.getByRole("button", { name: "Reading", exact: true }).click();
  expect((await added).status()).toBe(201);
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Read", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(main.getByRole("button", { name: "Edit One Piece" })).toContainText("Reading");

  // Catch up to chapter 1100 in one log.
  await main.getByRole("button", { name: "Edit One Piece" }).click();
  await page.getByRole("link", { name: "Reading progress" }).click();
  await expect(page).toHaveURL(/\/title\/manga\/30013$/);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("One Piece");
  await expect(main).toContainText("Still running");
  await main.getByLabel("Which chapter did you just read?").fill("1100");
  const logged = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/reading");
  await main.getByRole("button", { name: "Log it" }).click();
  expect((await logged).status()).toBe(201);
  await expect(main).toContainText("You're at Chapter 1,100.");
  await expect(main.getByRole("button", { name: "Log chapter 1,101" })).toBeVisible();

  // …which offers a Progress card.
  await expect(main.getByText("Logged Chapter 1,100. Want a card?")).toBeVisible();
  await main.getByRole("button", { name: "Make a card" }).click();
  const celebration = page.getByRole("dialog", { name: "Chapter 1,100 of One Piece" });
  await expect(celebration).toBeVisible();
  // Manga open on the Manga Panel template (the speech bubble says where the reader is).
  await expect(celebration.getByText("Manga Panel · swipe for another style")).toBeVisible();
  await expect(celebration.locator("[data-card]")).toContainText("Chapter 1,100");
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await celebration.getByRole("button", { name: "Copy card link" }).click({ timeout: 15_000 });
  const save = await saved;
  expect(save.status()).toBe(201);
  const body = save.request().postDataJSON() as { kind: string; templateId: string; readingLogId: string | null; data: { reading: { position: number } } };
  expect(body).toMatchObject({ kind: "progress", templateId: "mangaPanel", data: { reading: { position: 1100 } } });
  expect(body.readingLogId).toMatch(/^[0-9a-f-]{36}$/);
  await celebration.getByRole("button", { name: "Done" }).click();

  // The Read tab's header and the stats page agree: 1,100 chapters at 5 minutes each.
  await page.goto("/collection");
  const summary = main.getByRole("region", { name: "All time so far" });
  await expect(main.getByRole("button", { name: "Read", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(summary).toContainText("Chapters1,100");
  const readTime = (await summary.locator("dd").first().textContent())!;
  expect(readTime).toMatch(/^91h/);
  await expect(main.getByRole("button", { name: "Edit One Piece" })).toContainText("Chapter 1,100");
  // The Watch tab stays for movies and series.
  await main.getByRole("button", { name: "Watch", exact: true }).click();
  await expect(main.getByText("No movies or series yet")).toBeVisible();

  await page.goto("/stats?period=all");
  await expect(main).toContainText("Chapters read1,100");
  await expect(main.getByText("Reading time", { exact: true }).locator("xpath=..")).toContainText(readTime);
  await expect(main).toContainText("Books & manga");
});
