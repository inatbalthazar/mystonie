import { expect, test, type Locator, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, mockSearch, seedTitles, signUp, type SeedTitle } from "./helpers";

// Rankings (ADR 0099): a Top 3 of anything, titles and places, and a tier list, made into cards and published. Needs the local Supabase
// stack (Mailpit, service role key); search is mocked and the titles seeded, so TMDB isn't needed.
const TITLES: SeedTitle[] = [
  { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", runtimeMin: 133 },
  { kind: "movie", externalId: "693134", name: "Dune: Part Two", year: 2024, posterPath: null, runtimeMin: 167 },
];

/** Drags `what` with the mouse onto `onto`: its top edge, or the right of its middle (clear of a tier row's label). */
async function drag(page: Page, what: Locator, onto: Locator, where: "top" | "middle") {
  const from = (await what.boundingBox())!;
  const to = (await onto.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(where === "top" ? from.x + from.width / 2 : to.x + to.width - 60, where === "top" ? to.y + 6 : to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}

test("a ranking of titles and a place, with ✓ from the collection, made into a card and seen in a follower's feed (ADR 0099)", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  await seedTitles(request, TITLES);
  await mockSearch(page, TITLES);
  await signUp(page, request, "rank", "/rank");
  // Parasite is in the collection, finished: its row gets a ✓.
  const logged = await page.request.post("/api/entries", {
    data: { id: uuidv7(), title: { source: "tmdb", kind: "movie", externalId: "496243" }, status: "finished" },
  });
  expect(logged.ok(), await logged.text()).toBe(true);
  await page.reload();

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Make a ranking" })).toBeVisible();
  await expect(async () => {
    await main.getByLabel("Name your list (optional)").fill("Test top");
    await expect(main.getByLabel("Name your list (optional)")).toHaveValue("Test top", { timeout: 1000 });
  }).toPass();

  const sheet = page.getByRole("dialog", { name: "Add #1" });
  await main.getByRole("button", { name: "Add #1" }).click();
  await sheet.getByLabel("Search films, series, books, manga and games").fill("Parasite");
  await sheet.getByRole("button", { name: /^Parasite Movie/ }).click();
  await expect(sheet).toBeHidden();

  await main.getByRole("button", { name: "Add #2" }).click();
  const places = page.getByRole("dialog", { name: "Add #2" });
  await places.getByRole("tab", { name: "Places" }).click();
  await places.getByLabel("Search countries").fill("Japan");
  await places.getByRole("button", { name: "Japan", exact: true }).click();

  await main.getByRole("button", { name: "Add #3" }).click();
  const third = page.getByRole("dialog", { name: "Add #3" });
  // The sheet stays on the tab used last (a list of places stays on Places).
  await third.getByRole("tab", { name: "Titles" }).click();
  await third.getByLabel("Search films, series, books, manga and games").fill("Dune");
  await third.getByRole("button", { name: /^Dune: Part Two Movie/ }).click();

  // Japan to the top, dragged by its grip (ADR 0100); Parasite carries its ✓.
  const rows = main.getByRole("listitem");
  await drag(page, main.getByRole("button", { name: /^Move Japan: drag/ }), rows.first(), "top");
  await expect(rows.first()).toContainText("Japan");
  await expect(rows.nth(1)).toContainText("You finished it");

  // The card: the free style first, the Pro one locked; published by Share (a link without a share sheet).
  await main.getByRole("button", { name: "Make the card" }).click();
  const card = page.getByRole("dialog", { name: "Test top" });
  await expect(card.locator("[data-card]")).toContainText("Top 3");
  await expect(card.locator("[data-card]")).toContainText("Japan");
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await card.getByRole("button", { name: /^(Share|Copy card link)$/ }).click({ timeout: 20_000 });
  expect((await saved).status()).toBe(201);

  // In the feed (step 3): a follower sees it among finishes, with "Rank these your way"; the filters keep or drop it.
  const exported = await page.request.get("/api/account/export");
  const makerId = ((await exported.json()) as { account: { id: string } }).account.id;
  const fanContext = await browser.newContext();
  const fan = await fanContext.newPage();
  await signUp(fan, request, "rank-fan", "/feed");
  const followed = await fan.request.post("/api/follows", { data: { userId: makerId, follow: true } });
  expect(followed.ok(), await followed.text()).toBe(true);
  await fan.reload();
  const feed = fan.getByRole("main");
  const post = feed.getByRole("article").filter({ hasText: "Test top" });
  await expect(post).toContainText("Top 3");
  await expect(post.getByRole("link", { name: "Rank these your way" })).toBeVisible();
  const show = feed.getByRole("navigation", { name: "Show" });
  await show.getByRole("link", { name: "Finishes" }).click();
  await expect(fan).toHaveURL(/show=finishes/);
  await expect(post).toHaveCount(0);
  await show.getByRole("link", { name: "Rankings" }).click();
  await expect(fan).toHaveURL(/show=rankings/);
  await expect(post).toBeVisible();
  await fanContext.close();

  // Its maker sees it too, without the remix link.
  await page.goto("/feed");
  const own = page.getByRole("main").getByRole("article").filter({ hasText: "Test top" });
  await expect(own).toBeVisible();
  await expect(own.getByRole("link", { name: "Rank these your way" })).toHaveCount(0);
});

test("a tier list: rows renamed, things moved between them, made into a card (ADR 0099, step 2)", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  await seedTitles(request, TITLES);
  await mockSearch(page, TITLES);
  await signUp(page, request, "tier", "/rank");

  const main = page.getByRole("main");
  await expect(async () => {
    await main.getByRole("button", { name: "Tier list" }).click();
    await expect(main.getByRole("button", { name: "Tier list" })).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
  await main.getByLabel("Name of row 1").fill("GOAT");

  await main.getByRole("button", { name: "Add to GOAT" }).click();
  const sheet = page.getByRole("dialog", { name: "Add to GOAT" });
  await sheet.getByLabel("Search films, series, books, manga and games").fill("Parasite");
  await sheet.getByRole("button", { name: /^Parasite Movie/ }).click();
  await expect(sheet).toBeHidden();

  await main.getByRole("button", { name: "Add to C" }).click();
  const places = page.getByRole("dialog", { name: "Add to C" });
  await places.getByRole("tab", { name: "Places" }).click();
  await places.getByLabel("Search countries").fill("Japan");
  await places.getByRole("button", { name: "Japan", exact: true }).click();
  await expect(places).toBeHidden();

  // Japan up to A, then the empty last row off.
  await main.getByRole("button", { name: "Japan", exact: true }).click();
  await main.getByRole("group", { name: "Move to" }).getByRole("button", { name: "A", exact: true }).click();
  await expect(main.getByRole("listitem").nth(1).getByRole("button", { name: "Japan", exact: true })).toBeVisible();
  // Then dragged down to B (ADR 0100), and back up to A.
  await drag(page, main.getByRole("button", { name: "Japan", exact: true }), main.getByRole("listitem").nth(2), "middle");
  await expect(main.getByRole("listitem").nth(2).getByRole("button", { name: "Japan", exact: true })).toBeVisible();
  await drag(page, main.getByRole("button", { name: "Japan", exact: true }), main.getByRole("listitem").nth(1), "middle");
  await expect(main.getByRole("listitem").nth(1).getByRole("button", { name: "Japan", exact: true })).toBeVisible();
  await main.getByRole("button", { name: "Remove row D" }).click();
  await expect(main.getByLabel("Name of row 5")).toHaveCount(0);

  await main.getByRole("button", { name: "Make the card" }).click();
  const card = page.getByRole("dialog", { name: "My tier list" });
  await expect(card.locator("[data-card]")).toContainText("Tier list");
  await expect(card.locator("[data-card]")).toContainText("GOAT");
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await card.getByRole("button", { name: /^(Share|Copy card link)$/ }).click({ timeout: 20_000 });
  const response = await saved;
  expect(response.status()).toBe(201);

  // Remix (step 4): the shared card starts a list of your own, rows and things, without its maker's ✓ marks.
  const { id } = response.request().postDataJSON() as { id: string };
  await page.goto(`/c/${id}`);
  await page.getByRole("link", { name: "Rank these your way" }).click();
  // The page drops `?from=` once the list is in the draft.
  await expect(page).toHaveURL(/\/rank$/);
  await expect(main.getByRole("button", { name: "Tier list" })).toHaveAttribute("aria-pressed", "true");
  await expect(main.getByLabel("Name of row 1")).toHaveValue("GOAT");
  await expect(main.getByRole("button", { name: "Parasite", exact: true })).toBeVisible();
});
