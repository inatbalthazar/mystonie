import { expect, test } from "@playwright/test";
import { canSeed, mailpitUp, mockSearch, navIsland, seedTitles, signUp, type SeedTitle } from "./helpers";

// The nav island (ADR 0050). Needs the local Supabase stack (sign-in via Mailpit); search is mocked and the title
// seeded, as in collection.spec.
const TITLE: SeedTitle = {
  kind: "movie",
  externalId: "496243",
  name: "Parasite",
  year: 2019,
  posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  runtimeMin: 133,
};

test("signed out: no island, the header's Sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(navIsland(page)).toBeHidden();
});

test("signed out: the back button only where it leads somewhere public", async ({ page }) => {
  // Opened from a link, an article goes up to the feed, which lists the articles for visitors too (ADR 0061, ADR 0062)...
  await page.goto("/journal/how-to-write");
  const banner = page.getByRole("banner");
  await banner.getByRole("link", { name: "Back to Feed" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  // ...a tab, so the logo is back.
  await expect(banner.getByRole("link", { name: "Mystonie home" })).toBeVisible();
  await expect(banner.getByRole("link", { name: /^Back/ })).toHaveCount(0);
  // A page whose parent is for signed-in people keeps the logo for a visitor.
  await page.goto("/reel");
  await expect(banner.getByRole("link", { name: "Mystonie home" })).toBeVisible();
  await expect(banner.getByRole("link", { name: /^Back/ })).toBeHidden();
  // A page with no parent shows the logo too.
  await page.goto("/privacy");
  await expect(banner.getByRole("link", { name: "Mystonie home" })).toBeVisible();
  await expect(banner.getByRole("link", { name: /^Back/ })).toHaveCount(0);
});

test("the nav island: the lit tab, ➕ from anywhere and in place on the collection, Feed, Me with its Stats tab, even when private", async ({
  page,
  request,
}) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, [TITLE]);
  await mockSearch(page, [TITLE]);
  await signUp(page, request, "island", "/home");

  // Home · Collection · ➕ · Feed · Me, with Home lit, and no Sign in.
  const island = navIsland(page);
  await expect(island.getByRole("link")).toHaveText(["Home", "Collection", "Add a title", "Feed", "Me"]);
  await expect(island.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeHidden();

  // ➕ from Home: the collection's quick add. Closing it drops `?add=1`.
  await island.getByRole("link", { name: "Add a title" }).click();
  await expect(page).toHaveURL(/\/collection\?add=1$/);
  const sheet = page.getByRole("dialog", { name: "Add a title" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Search movies, series, books, manga and games").fill("Parasite");
  await sheet
    .getByRole("button", { name: /^Parasite Movie/ })
    .first()
    .click();
  // The celebration outlives the refresh that follows the save (it used to remount the page once `?add=1` was gone).
  const refreshed = page.waitForResponse((r) => new URL(r.url()).pathname === "/collection" && new URL(r.url()).searchParams.has("_rsc"));
  await page.getByRole("button", { name: "Finished today", exact: true }).click();
  const celebration = page.getByRole("dialog", { name: "You finished Parasite!" });
  await expect(celebration).toBeVisible();
  await refreshed;
  await page.waitForTimeout(1000); // the refreshed page commits in a transition
  await expect(celebration).toBeVisible();
  await celebration.getByRole("button", { name: "Skip" }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(island.getByRole("link", { name: "Collection" })).toHaveAttribute("aria-current", "page");

  // On the collection, ➕ opens quick add in place: no trip to the server, the URL stays.
  const trips: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).searchParams.get("add") === "1") trips.push(r.url());
  });
  await island.getByRole("link", { name: "Add a title" }).click();
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/collection$/);
  expect(trips).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // Feed (ADR 0053). A new account has today's reel to play: Home has the dot while you're elsewhere (ADR 0078).
  await island.getByRole("link", { name: /^Feed/ }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Feed");
  await expect(island.getByRole("link", { name: "Feed", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(island.getByRole("link", { name: "Home, today's reel waits" })).toBeVisible();

  // The community pages are on Home, all five in sight, and keep Home lit (ADR 0078).
  await island.getByRole("link", { name: /^Home/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  const community = page.getByRole("navigation", { name: "Community" });
  await expect(community.getByRole("link")).toHaveText(["The board", "Challenges", "Clubs", "Reel", "Find people"]);
  for (const link of await community.getByRole("link").all()) await expect(link).toBeInViewport();
  await community.getByRole("link", { name: "The board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(island.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");

  // The back button (ADR 0061): "‹ Home" in place of the logo, back to the page before; none on a tab.
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "Mystonie home" })).toHaveCount(0);
  await banner.getByRole("link", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(banner.getByRole("link", { name: /^Back/ })).toHaveCount(0);
  await expect(banner.getByRole("link", { name: "Mystonie home" })).toBeVisible();

  // Me: your own page, with Share my collection and Settings, on its Album tab; Stats is its other tab.
  await island.getByRole("link", { name: "Me", exact: true }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page).toHaveTitle("Me · Mystonie");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^island_\d+$/);
  await expect(page.getByRole("group", { name: "Share my collection" })).toBeVisible();
  const meTabs = page.getByRole("navigation", { name: "Your album, stats and cards" });
  await expect(meTabs.getByRole("link", { name: "Album" })).toHaveAttribute("aria-current", "page");
  await meTabs.getByRole("link", { name: "Stats" }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page).toHaveTitle("Stats · Mystonie");
  // The same cover over both tabs, and Me still lit.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^island_\d+$/);
  await expect(meTabs.getByRole("link", { name: "Stats" })).toHaveAttribute("aria-current", "page");
  await expect(island.getByRole("link", { name: "Me", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").locator("dd").first()).toHaveText("2h 13m");
  await meTabs.getByRole("link", { name: "Album" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("main").getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(island.getByRole("link", { name: "Me", exact: true })).toHaveAttribute("aria-current", "page");
  await banner.getByRole("link", { name: "Back to Me" }).click();
  await expect(page).toHaveURL(/\/me$/);

  // A title from the collection: "‹ Collection" steps back to the very shelf.
  await page.goto("/collection?shelf=watch");
  await page.getByRole("button", { name: "Edit Parasite" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Where to watch" }).click();
  await expect(page).toHaveURL(/\/title\/movie\/496243$/);
  await banner.getByRole("link", { name: "Back to Collection" }).click();
  await expect(page).toHaveURL(/\/collection\?shelf=watch$/);
  // Opened from a link, a page goes up to its parent instead, in its place.
  await page.goto("/settings/warnings");
  await banner.getByRole("link", { name: "Back to Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(banner.getByRole("link", { name: "Back to Me" })).toBeVisible();

  // Private to everyone else, your page still opens under Me, saying so.
  const patched = await page.request.patch("/api/account", { data: { visibility: "private" } });
  expect(patched.status(), await patched.text()).toBe(200);
  await page.goto("/me");
  await expect(page.getByText("Only you see this note. Visitors see that your collection is private.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^island_\d+$/);
  await expect(page.getByRole("main")).toContainText("2h 13m");

  // Typing on a phone: the island steps aside for the keyboard.
  await page.goto("/settings");
  await page.getByRole("main").getByLabel("Username").focus();
  await expect(island).toBeHidden();
  await page.getByRole("main").getByLabel("Username").blur();
  await expect(island).toBeVisible();
});
