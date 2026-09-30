import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, mockSearch, seedTitles, signUp, type SeedTitle } from "./helpers";

// S2 content warnings (ADR 0035). Needs the local Supabase stack. DTDD's votes are seeded into the cache as fresh,
// so the title pages, badges and the Survived offer never call DTDD (the made-up counts below prove it: DTDD
// doesn't know these titles). Only the Settings topic list needs DTDD_API_KEY.
const TITLES: SeedTitle[] = [
  { kind: "movie", externalId: "973001", name: "Warn Test Doghouse", year: 2021, posterPath: null, runtimeMin: 101 },
  { kind: "movie", externalId: "973002", name: "Warn Test Nowhere", year: 2022, posterPath: null, runtimeMin: 90 },
];
const DOG = 153;
const SPIDERS = 165;

function rest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return { url: `${url}/rest/v1`, headers };
}

async function titleId(request: APIRequestContext, externalId: string): Promise<string> {
  const { url, headers } = rest();
  const [row] = await (await request.get(`${url}/titles?source=eq.tmdb&kind=eq.movie&external_id=eq.${externalId}&select=id`, { headers })).json();
  return row.id;
}

/** Marks the title as looked up just now: matched with these votes, or (no `topics`) not on DTDD. */
async function seedWarnings(request: APIRequestContext, externalId: string, topics?: Record<string, unknown>[]) {
  const { url, headers } = rest();
  const id = await titleId(request, externalId);
  const now = new Date().toISOString();
  await request.delete(`${url}/title_warnings?title_id=eq.${id}`, { headers });
  const patch = await request.patch(`${url}/titles?id=eq.${id}`, { headers, data: { dtdd_id: topics ? 9_973_001 : null, dtdd_checked_at: now } });
  expect(patch.ok(), await patch.text()).toBe(true);
  if (!topics) return;
  const res = await request.post(`${url}/title_warnings`, {
    headers,
    data: topics.map((t) => ({ title_id: id, fetched_at: now, spoiler: false, comment: null, ...t })),
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function checkedAt(request: APIRequestContext, externalId: string): Promise<string> {
  const { url, headers } = rest();
  const [row] = await (await request.get(`${url}/titles?source=eq.tmdb&kind=eq.movie&external_id=eq.${externalId}&select=dtdd_checked_at`, { headers })).json();
  return row.dtdd_checked_at;
}

const block = (page: Page) => page.getByRole("main").locator("section").filter({ has: page.getByRole("heading", { name: "Content warnings" }) });

/** Fails the test if the browser ever talks to DTDD itself (links on the page are fine; requests are not). */
function noBrowserDtdd(page: Page) {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("doesthedogdie.com")) calls.push(r.url());
  });
  return () => expect(calls).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, TITLES);
  await seedWarnings(request, "973001", [
    { topic_id: DOG, topic_name: "a dog dies", category: "Animal Death", yes_count: 142, no_count: 3, comment: "The dog dies early on, off screen." },
    { topic_id: 161, topic_name: "there are jump scares", category: "Fear", yes_count: 12, no_count: 2 },
    { topic_id: 222, topic_name: "the ending is sad", category: "Spoiler", spoiler: true, yes_count: 40, no_count: 2 },
    { topic_id: SPIDERS, topic_name: "there are spiders", category: "Animal Phobia", yes_count: 1, no_count: 30 },
  ]);
  await seedWarnings(request, "973002");
});

test("an avoided topic is flagged on the title page, in the collection and in search, from the cache", async ({ page, request }) => {
  const noDtdd = noBrowserDtdd(page);
  await mockSearch(page, TITLES);
  await signUp(page, request, "warn-flags", "/title/movie/973001");

  // No topics chosen yet: an invitation, and no lookup.
  await expect(block(page)).toContainText("Choose topics you'd rather avoid");
  await expect(block(page).getByRole("link", { name: "Choose topics" })).toHaveAttribute("href", "/settings/warnings");

  const saved = await page.request.put("/api/warnings/topics", { data: { topicIds: [DOG, SPIDERS] } });
  expect(saved.status(), await saved.text()).toBe(200);
  const before = await checkedAt(request, "973001");

  await page.reload();
  const warnings = block(page);
  await expect(warnings.getByRole("note")).toHaveText("Content warning: a dog dies");
  const dog = warnings.getByRole("listitem").filter({ hasText: "a dog dies" });
  await expect(dog).toContainText("Yes");
  await expect(dog).toContainText("142 yes · 3 no");
  // Comments wait behind a tap.
  await expect(dog.getByText("The dog dies early on, off screen.")).toBeHidden();
  await dog.getByText("Read a comment").click();
  await expect(dog.getByText("The dog dies early on, off screen.")).toBeVisible();
  await expect(warnings.getByRole("listitem").filter({ hasText: "there are spiders" })).toContainText("No");
  await expect(warnings.getByRole("link", { name: "DoesTheDogDie.com" })).toHaveAttribute("href", "https://www.doesthedogdie.com");
  // Everything else is folded away; a spoiler's answer needs one more tap.
  await warnings.getByText("See all topics (2)").click();
  const ending = warnings.getByRole("listitem").filter({ hasText: "the ending is sad" });
  await expect(ending.getByText("Spoiler: tap to show")).toBeVisible();
  await expect(ending.getByText("40 yes · 2 no")).toBeHidden();
  await ending.getByText("Spoiler: tap to show").click();
  await expect(ending.getByText("40 yes · 2 no")).toBeVisible();

  // A second view within 7 days is a cache hit: nothing was looked up again.
  await page.reload();
  await expect(block(page).getByRole("note")).toHaveText("Content warning: a dog dies");
  expect(await checkedAt(request, "973001")).toBe(before);

  // A title DTDD doesn't have: no data, no badge.
  await page.goto("/title/movie/973002");
  await expect(block(page)).toContainText("No warning data yet.");
  await expect(block(page).getByRole("note")).toHaveCount(0);

  // The collection: a badge on the flagged title only.
  for (const [externalId, status] of [["973001", "want"], ["973002", "watching"]]) {
    const res = await page.request.post("/api/entries", { data: { id: uuidv7(), title: { source: "tmdb", kind: "movie", externalId }, status } });
    expect(res.status(), await res.text()).toBe(201);
  }
  await page.goto("/collection");
  await expect(page.getByRole("button", { name: "Edit Warn Test Doghouse. Content warning: a dog dies" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Warn Test Nowhere", exact: true }).first()).toBeVisible();

  // Search results: the same badge.
  await page.getByRole("button", { name: "Add a title" }).click();
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill("Warn Test");
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Warn Test Doghouse Movie.*Content warning: a dog dies$/ })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Warn Test Nowhere Movie · 2022$/ })).toBeVisible();

  noDtdd();
});

test("finishing something with jump scares offers the Survived card", async ({ page, request }) => {
  const noDtdd = noBrowserDtdd(page);
  await mockSearch(page, TITLES);
  await signUp(page, request, "warn-survived");
  await expect(async () => {
    await page.getByRole("button", { name: "Add a title" }).click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill("Doghouse");
  await page.getByRole("dialog").getByRole("button", { name: /^Warn Test Doghouse Movie/ }).click();
  await page.getByRole("button", { name: "Finished", exact: true }).click();

  const offer = page.getByRole("button", { name: "You made it through the jump scares. Make it a Survived card" });
  await expect(offer).toBeVisible();
  await offer.click();
  await expect(page.getByText("Survived · swipe for another style")).toBeVisible();
  await expect(page.locator("[data-card]").first()).toContainText("Survived the jump scares");
  await expect(offer).toHaveCount(0);

  // Saved as a finish on the Survived template, with its scare (POST /api/cards validates both together).
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Download" }).click({ timeout: 15_000 });
  const res = await saved;
  expect(res.status(), await res.text()).toBe(201);
  expect(res.request().postDataJSON()).toMatchObject({ kind: "finish", templateId: "survived", data: { survived: "jumpScares" } });
  noDtdd();
});

test("Settings: choose topics to avoid", async ({ page, request }) => {
  test.skip(!process.env.DTDD_API_KEY, "the topic list comes from DTDD (DTDD_API_KEY)");
  await signUp(page, request, "warn-settings", "/settings");
  await expect(page.getByText("No topics chosen yet")).toBeVisible();
  await page.getByRole("link", { name: "Choose topics" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Topics to avoid");

  await page.getByLabel("Search topics").fill("dog");
  await page.getByLabel("a dog dies").check();
  await page.getByLabel("Search topics").fill("spiders");
  await page.getByLabel("there are spiders").check();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove a dog dies" })).toBeVisible();

  // "Saved" is already on screen from the ticks above, so wait for this save itself.
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/warnings/topics" && r.request().method() === "PUT");
  await page.getByRole("button", { name: "Remove a dog dies" }).click();
  expect((await saved).status()).toBe(200);
  await page.goto("/settings");
  await expect(page.getByText("1 topic chosen")).toBeVisible();
});
