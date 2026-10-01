import { expect, test, type APIRequestContext } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, mockSearch, openQuickAdd, seedTitles, signUp, uniqueEmail, type SeedTitle } from "./helpers";

// S3 finishers & the board (ADR 0039). Needs the local Supabase stack: the service role creates the other collectors
// and their finishes; the signed-in flow also needs Mailpit. Titles are seeded and /api/search is mocked.

const rest = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

/** A new account made with the admin API (its profile comes from the sign-up trigger). */
async function createUser(request: APIRequestContext, tag: string): Promise<string> {
  const { url, headers } = rest();
  const res = await request.post(`${url}/auth/v1/admin/users`, { headers, data: { email: uniqueEmail(tag), email_confirm: true } });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

/** The `titles` row id of a seeded title. */
async function titleId(request: APIRequestContext, externalId: string): Promise<string> {
  const { url, headers } = rest();
  const res = await request.get(`${url}/rest/v1/titles?select=id&source=eq.tmdb&kind=eq.movie&external_id=eq.${externalId}`, { headers });
  return ((await res.json()) as { id: string }[])[0]!.id;
}

/** A finish written straight into the database (one request = one transaction), returning its number. */
async function finishAs(request: APIRequestContext, userId: string, title: string): Promise<number> {
  const { url, headers } = rest();
  const res = await request.post(`${url}/rest/v1/entries?select=finisher_no`, {
    headers: { ...headers, Prefer: "return=representation" },
    data: { id: uuidv7(), user_id: userId, title_id: title, status: "finished", finished_at: new Date().toISOString() },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { finisher_no: number }[])[0]!.finisher_no;
}

test("finisher numbers are race-free: many people finishing at once get 1…N, no repeats, no gaps", async ({ request }) => {
  test.skip(!canSeed(), "local Supabase (service role key) is not available");
  test.setTimeout(90_000);
  const movie: SeedTitle = { kind: "movie", externalId: String(980_000_000 + (Date.now() % 10_000_000)), name: "Race Day", year: 2024, posterPath: null, runtimeMin: 90 };
  await seedTitles(request, [movie]);
  const title = await titleId(request, movie.externalId);
  const people = await Promise.all(Array.from({ length: 12 }, (_, i) => createUser(request, `race${i}`)));

  const numbers = await Promise.all(people.map((id) => finishAs(request, id, title)));
  expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  const { url, headers } = rest();
  const counts = await request.get(`${url}/rest/v1/title_finish_counts?select=finishers&title_id=eq.${title}`, { headers });
  expect(await counts.json()).toEqual([{ finishers: 12 }]);
});

test("Finisher #N on the celebration, the saved card, the title page and the feed; the board; trending", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(150_000);
  const stamp = Date.now().toString(36);
  const movie: SeedTitle = { kind: "movie", externalId: String(970_000_000 + (Date.now() % 10_000_000)), name: `Finish Line ${stamp}`, year: 2025, posterPath: null, runtimeMin: 100 };
  await seedTitles(request, [movie]);
  const title = await titleId(request, movie.externalId);

  // Two people finished it before: a public one the viewer will follow (#1) and one more (#2).
  const [ada, bo] = await Promise.all([createUser(request, "fin-ada"), createUser(request, "fin-bo")]);
  const { url, headers } = rest();
  const adaName = `ada_${stamp}`;
  const named = await request.patch(`${url}/rest/v1/profiles?id=eq.${ada}`, { headers, data: { username: adaName, display_name: "Ada Finisher" } });
  expect(named.ok(), await named.text()).toBe(true);
  expect(await finishAs(request, ada, title)).toBe(1);
  expect(await finishAs(request, bo, title)).toBe(2);

  await mockSearch(page, [movie]);
  await signUp(page, request, "finishers", "/home");
  const renamed = await page.request.patch("/api/account", { data: { username: `fin_${stamp}`, displayName: "Fin Tester" } });
  expect(renamed.ok(), await renamed.text()).toBe(true);
  const followed = await page.request.post("/api/follows", { data: { userId: ada, follow: true } });
  expect(followed.ok(), await followed.text()).toBe(true);

  // Quick add → Finished: the celebration says #3, and the card carries the seal.
  await page.goto("/collection");
  await openQuickAdd(page);
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill(movie.name);
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${movie.name} Movie`) }).click();
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  const celebration = page.getByRole("dialog", { name: `You finished ${movie.name}!` });
  await expect(celebration.getByText("You're finisher #3 on Mystonie")).toBeVisible();
  await expect(celebration.locator("[data-finisher]").first()).toContainText("#3");

  // Downloading saves the card; the server writes the entry's number, whatever the browser claims.
  const mine = (await (
    await request.get(`${url}/rest/v1/entries?select=id,finisher_no,user_id&title_id=eq.${title}&finisher_no=eq.3`, { headers })
  ).json()) as { id: string }[];
  const cardId = uuidv7();
  const saved = await page.request.post("/api/cards", {
    data: {
      id: cardId,
      kind: "finish",
      templateId: "polaroid",
      size: "story",
      entryId: mine[0]!.id,
      data: { kind: "movie", name: movie.name, finishedOn: "2026-10-01", finisherNo: 1 },
      share: false,
    },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  const card = (await (await request.get(`${url}/rest/v1/cards?select=params&id=eq.${cardId}`, { headers })).json()) as { params: { finisherNo: number } }[];
  expect(card[0]!.params.finisherNo).toBe(3);
  await celebration.getByRole("button", { name: "Skip" }).click();

  // The title page: your number, the count, and Ada (#1) among the people you follow.
  const main = page.getByRole("main");
  await page.goto(`/title/movie/${movie.externalId}`);
  await expect(main.getByRole("heading", { name: "Finishers" })).toBeVisible();
  await expect(main.getByText("You're finisher #3")).toBeVisible();
  await expect(main.getByText("3 people finished this on Mystonie.")).toBeVisible();
  await expect(main.getByRole("listitem").filter({ hasText: "Ada Finisher" })).toContainText("#1");

  // The feed shows Ada's number on her finish.
  await page.goto("/feed");
  await expect(main.getByRole("article").filter({ hasText: "Ada Finisher" }).getByText("Finisher #1")).toBeVisible();

  // The board: Ada and you, both 100 minutes and one finish this week, so you share first place.
  await page.goto("/board");
  await expect(main.getByRole("heading", { name: "This week's board" })).toBeVisible();
  const rows = main.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Ada Finisher" })).toContainText("Number 1");
  await expect(rows.filter({ hasText: "You" })).toContainText("Number 1");
  await expect(rows.filter({ hasText: "You" })).toContainText("1.7 h");
  await main.getByRole("link", { name: "This month" }).click();
  await expect(main.getByRole("heading", { name: "This month's board" })).toBeVisible();

  // Home: the board note, and trending on Mystonie (3 people this week) with its tag.
  await page.goto("/home");
  await expect(main.getByRole("heading", { name: "This week's board" })).toBeVisible();
  await expect(main.getByText("You're #1 of 2 this week")).toBeVisible();
  const trending = await request.post(`${url}/rest/v1/rpc/trending_titles`, { headers, data: { p_days: 7, p_limit: 50 } });
  const own = (await trending.json()) as { title_id: string; people: number; finishers: number }[];
  expect(own.find((t) => t.title_id === title)).toMatchObject({ people: 3, finishers: 3 });
  await expect(main.getByText("First what people on Mystonie are finishing this week, then what the world is watching. Tap one to add it.")).toBeVisible();
});
