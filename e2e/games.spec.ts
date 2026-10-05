import { expect, test } from "@playwright/test";
import { canSeed, mailpitUp, seedTitles, signUp, type SeedGameTitle } from "./helpers";

// Needs the local Supabase stack. The games are seeded and /api/search is mocked, so RAWG (and its key) is never
// called; the RAWG normalizer is unit-tested with RAWG's own game objects (src/core/catalog/rawg.test.ts).
const id = 900_000_000 + (Date.now() % 99_000_000);
const GAME: SeedGameTitle = {
  kind: "game",
  externalId: String(id),
  name: "The Witcher 3: Wild Hunt",
  year: 2015,
  posterPath: "games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg",
  playtimeHours: 43,
  platforms: ["PC", "PlayStation", "Xbox"],
};
const OTHER: SeedGameTitle = { kind: "game", externalId: String(id + 1), name: "Hades", year: 2020, posterPath: null, playtimeHours: 22, platforms: ["PC", "Nintendo"] };

test("games: search Games, finish one with the hours it took → the Cartridge card → the Play tab, stats and the game's page", async ({
  page,
  request,
}) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, [GAME, OTHER]);
  const types: string[] = [];
  await page.route(
    (url) => url.pathname === "/api/search",
    (route) => {
      const params = new URL(route.request().url()).searchParams;
      types.push(params.get("type") ?? "");
      const q = (params.get("q") ?? "").toLowerCase();
      const results = [GAME, OTHER]
        .filter((g) => g.name.toLowerCase().includes(q))
        .map((g) => ({
          source: "rawg",
          kind: "game",
          externalId: g.externalId,
          name: g.name,
          year: g.year,
          platforms: g.platforms,
          ...(g.posterPath ? { imageUrl: `https://media.rawg.io/media/resize/420/-/${g.posterPath}` } : {}),
        }));
      return route.fulfill({ json: { results } });
    },
  );
  await signUp(page, request, "games");

  // The search sheet's Games switch: RAWG's games, labelled with their platforms.
  await expect(async () => {
    await page.getByRole("button", { name: "Add your first title" }).click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  const sheet = page.getByRole("dialog", { name: "Add a title" });
  await sheet.getByRole("button", { name: "Games", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Games", exact: true })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByLabel("Search movies, series, books, manga and games").fill("witcher");
  const result = sheet.getByRole("button", { name: /^The Witcher 3: Wild Hunt Game · 2015/ });
  await expect(result).toContainText("PC, PlayStation, Xbox");
  expect(types).toContain("game");

  // Played words on the status step; Finished opens the celebration on the Cartridge.
  await result.click();
  await expect(sheet.getByRole("button", { name: "Playing", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Want to play", exact: true })).toBeVisible();
  const added = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/entries" && r.request().method() === "POST");
  await sheet.getByRole("button", { name: "Finished today", exact: true }).click();
  expect((await added).status()).toBe(201);
  const celebration = page.getByRole("dialog", { name: "You finished The Witcher 3: Wild Hunt!" });
  await expect(celebration.getByText("Cartridge · swipe for another style")).toBeVisible();
  const card = celebration.locator("[data-card]");
  // RAWG's average until the player says otherwise.
  await expect(card).toContainText("43");
  await expect(card).toContainText("hours, on average");
  await celebration.getByLabel("Hours played").fill("187");
  await expect(card).toContainText("187");
  await expect(card).toContainText("hours played");
  const notes = page.waitForResponse((r) => /^\/api\/entries\/[\w-]+$/.test(new URL(r.url()).pathname) && r.request().method() === "PATCH");
  await celebration.getByRole("button", { name: "Skip" }).click();
  const patched = await notes;
  expect(patched.ok()).toBe(true);
  expect(patched.request().postDataJSON()).toMatchObject({ hoursPlayed: 187 });

  // The Play tab: its own header, with the player's hours.
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Play", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(main.getByRole("button", { name: "Play", exact: true })).toHaveAttribute("aria-pressed", "true");
  const summary = main.getByRole("region", { name: "All time so far" });
  await expect(summary).toContainText("Play time");
  await expect(summary.getByRole("definition").nth(0)).toHaveText("187h");
  await expect(summary.getByRole("definition").nth(1)).toHaveText("1");
  const row = main.getByRole("button", { name: "Edit The Witcher 3: Wild Hunt" });
  await expect(row).toContainText("187h played");
  await expect(row).toContainText("Finished");
  // The other tabs don't hold games.
  await main.getByRole("button", { name: "Watch", exact: true }).click();
  await expect(main.getByText("No movies or series yet")).toBeVisible();
  await main.getByRole("button", { name: "Play", exact: true }).click();

  // The game's page: art, platforms, RAWG's average, where it stands, and RAWG credited.
  await row.click();
  await page.getByRole("link", { name: "About this game" }).click();
  await expect(page).toHaveURL(new RegExp(`/title/game/${GAME.externalId}$`));
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("The Witcher 3: Wild Hunt");
  await expect(main).toContainText("Game · 2015");
  await expect(main).toContainText("PC, PlayStation, Xbox");
  await expect(main).toContainText("Average playtime: about 43h");
  await expect(main).toContainText(/Finished \w{3} \d{1,2}, \d{4} · 187h played/);
  await expect(main.getByRole("link", { name: "RAWG" })).toHaveAttribute("href", `https://rawg.io/games/${GAME.externalId}`);
  await expect(main.getByRole("heading", { name: "Scene warnings" })).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Game data and images from RAWG" })).toHaveAttribute("href", "https://rawg.io/");

  // Stats: play time on its own row, apart from watch time.
  await page.goto("/stats?period=all");
  await expect(main.getByText("Play time", { exact: true })).toBeVisible();
  await expect(main.locator("dl").filter({ hasText: "Games finished" }).first()).toContainText("187h");

  // A game not in the collection yet: its page adds it in one tap from the status step.
  await page.goto(`/title/game/${OTHER.externalId}`);
  await expect(main).toContainText("Not in your collection yet");
  await main.getByRole("link", { name: "Add it to your collection" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a title" });
  await expect(dialog).toContainText("Hades");
  await expect(dialog).toContainText("PC, Nintendo");
  const wanted = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/entries" && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Want to play", exact: true }).click();
  expect((await wanted).status()).toBe(201);
  const hades = main.getByRole("button", { name: "Edit Hades" });
  await expect(hades).toContainText("Want to play");
  await expect(hades).toContainText("About 22h on average");
});
