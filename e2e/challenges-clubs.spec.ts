import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, mockSearch, openQuickAdd, seedTitles, signUp, uniqueEmail, type SeedTitle } from "./helpers";

// S3 challenges & clubs (ADR 0040). Needs the local Supabase stack (Mailpit for sign-in, the service role to seed
// titles, other collectors and their finishes). Titles are seeded and /api/search is mocked.

const rest = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

async function titleId(request: APIRequestContext, kind: string, externalId: string): Promise<string> {
  const { url, headers } = rest();
  const res = await request.get(`${url}/rest/v1/titles?select=id&source=eq.tmdb&kind=eq.${kind}&external_id=eq.${externalId}`, { headers });
  return ((await res.json()) as { id: string }[])[0]!.id;
}

async function profileId(request: APIRequestContext, username: string): Promise<string> {
  const { url, headers } = rest();
  const res = await request.get(`${url}/rest/v1/profiles?select=id&username=eq.${username}`, { headers });
  return ((await res.json()) as { id: string }[])[0]!.id;
}

async function createUser(request: APIRequestContext, tag: string, username: string, displayName: string): Promise<string> {
  const { url, headers } = rest();
  const res = await request.post(`${url}/auth/v1/admin/users`, { headers, data: { email: uniqueEmail(tag), email_confirm: true } });
  expect(res.ok(), await res.text()).toBe(true);
  const id = ((await res.json()) as { id: string }).id;
  const named = await request.patch(`${url}/rest/v1/profiles?id=eq.${id}`, { headers, data: { username, display_name: displayName } });
  expect(named.ok(), await named.text()).toBe(true);
  return id;
}

async function insert(request: APIRequestContext, table: string, rows: object[]): Promise<void> {
  const { url, headers } = rest();
  const res = await request.post(`${url}/rest/v1/${table}`, { headers, data: rows });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Opens quick add on the collection page and marks the title Finished. */
async function finishThroughQuickAdd(page: Page, name: string) {
  await page.goto("/collection");
  await openQuickAdd(page);
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${name} Movie`) }).click();
  await page.getByRole("button", { name: "Finished today", exact: true }).click();
}

test("monthly challenges: joining counts the whole month, a finish completes it, the Challenge card and the patch", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(150_000);
  const stamp = Date.now().toString(36);
  const films: SeedTitle[] = Array.from({ length: 4 }, (_, i) => ({
    kind: "movie",
    externalId: String(960_000_000 + ((Date.now() + i) % 10_000_000)),
    name: `Four Square ${stamp} ${"ABCD"[i]}`,
    year: 2024,
    posterPath: null,
    runtimeMin: 100,
  }));
  await seedTitles(request, films);
  const ids = await Promise.all(films.map((f) => titleId(request, "movie", f.externalId)));

  await mockSearch(page, films);
  await signUp(page, request, "challenges", "/home");
  const username = `ch_${stamp}`;
  const renamed = await page.request.patch("/api/account", { data: { username, displayName: "Chal Tester" } });
  expect(renamed.ok(), await renamed.text()).toBe(true);
  const me = await profileId(request, username);

  // Home invites to this month's lineup.
  const main = page.getByRole("main");
  await page.reload();
  await expect(main.getByRole("heading", { name: "This month's challenges" })).toBeVisible();
  await expect(main.getByText("Finish Four")).toBeVisible();

  // Three finishes earlier this month, before joining: they count.
  await insert(
    request,
    "entries",
    ids.slice(0, 3).map((title) => ({ id: uuidv7(), user_id: me, title_id: title, status: "finished", finished_at: new Date().toISOString() })),
  );
  await page.goto("/challenges");
  await expect(main.getByRole("heading", { name: "Challenges", level: 1 })).toBeVisible();
  const four = main.getByRole("article").filter({ has: page.getByRole("heading", { name: "Finish Four" }) });
  await expect(four.getByText("3 of 4 titles")).toBeVisible();
  await four.getByRole("button", { name: "Join", exact: true }).click();
  await expect(four.getByText("Joined", { exact: true })).toBeVisible();

  // Leaving works while it isn't complete.
  const days = main.getByRole("article").filter({ has: page.getByRole("heading", { name: "Twelve Days" }) });
  await days.getByRole("button", { name: "Join", exact: true }).click();
  await expect(days.getByText("Joined", { exact: true })).toBeVisible();
  await days.getByRole("button", { name: "Leave" }).click();
  await expect(days.getByRole("button", { name: "Join", exact: true })).toBeVisible();

  // The fourth finish: the Finish card first, then the challenge's own celebration with the Calendar card.
  await finishThroughQuickAdd(page, films[3]!.name);
  await page.getByRole("dialog", { name: `You finished ${films[3]!.name}!` }).getByRole("button", { name: "Skip" }).click();
  const done = page.getByRole("dialog", { name: "You completed Finish Four!" });
  await expect(done).toBeVisible();
  await expect(done.locator("[data-card]").first()).toContainText("Challenge complete", { ignoreCase: true });
  await expect(done.getByText("Calendar · swipe for another style")).toBeVisible();
  await done.getByRole("button", { name: "Skip" }).click();

  // Recorded by the server, and the patch is sewn in.
  const { url, headers } = rest();
  const joins = (await (
    await request.get(`${url}/rest/v1/challenge_joins?select=slug,progress,completed_at&user_id=eq.${me}&deleted_at=is.null&slug=eq.finish-four`, { headers })
  ).json()) as { progress: number; completed_at: string | null }[];
  expect(joins).toHaveLength(1);
  expect(joins[0]).toMatchObject({ progress: 4 });
  expect(joins[0]!.completed_at).not.toBeNull();
  await page.goto("/challenges");
  await expect(four.getByText("Completed", { exact: true }).first()).toBeVisible();
  await expect(four.getByRole("button", { name: "Make the card" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Your patches" })).toBeVisible();
  await expect(main.getByRole("listitem").filter({ hasText: "Finish Four" })).toBeVisible();

  // A Challenge card saves only for a challenge the user completed. Challenges run by the local month (the browser's
  // zone is this machine's), which isn't the UTC one in the hours around midnight on the 1st.
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const card = (slug: string, target: number) => ({
    id: uuidv7(),
    kind: "challenge",
    templateId: "calendar",
    size: "story",
    data: { kind: "movie", name: films[3]!.name, finishedOn: `${month}-01`, challenge: { slug, month, target, days: [1] } },
    share: false,
  });
  expect((await page.request.post("/api/cards", { data: card("twelve-days", 12) })).status()).toBe(404);
  expect((await page.request.post("/api/cards", { data: card("finish-four", 4) })).status()).toBe(201);

  // The public profile shows the patch.
  await page.goto(`/u/${username}`);
  await expect(main.getByRole("heading", { name: "Challenge patches" })).toBeVisible();
});

test("fandom clubs: members, what's big in the club, the club feed, joining, and clubs on titles and profiles", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(150_000);
  const stamp = Date.now().toString(36);
  // "Big in the club" breaks ties by name: a stamp that counts down keeps this run's show ahead of earlier runs' ones.
  const countdown = (Number.MAX_SAFE_INTEGER - Date.now()).toString(36);
  const show: SeedTitle = { kind: "series", externalId: String(950_000_000 + (Date.now() % 10_000_000)), name: `Seoul Nights ${countdown}`, year: 2025, posterPath: null, runtimeMin: 60 };
  await seedTitles(request, [show]);
  const { url, headers } = rest();
  const patched = await request.patch(`${url}/rest/v1/titles?source=eq.tmdb&kind=eq.series&external_id=eq.${show.externalId}`, {
    headers,
    data: { original_language: "ko", genres: ["Drama", "Romance"] },
  });
  expect(patched.ok(), await patched.text()).toBe(true);
  const title = await titleId(request, "series", show.externalId);

  // Three members finished it; Kim is the one the viewer will follow.
  const kimName = `Kim ${stamp}`;
  const people = await Promise.all([
    createUser(request, "club-kim", `kim_${stamp}`, kimName),
    createUser(request, "club-lee", `lee_${stamp}`, `Lee ${stamp}`),
    createUser(request, "club-park", `park_${stamp}`, `Park ${stamp}`),
  ]);
  await insert(request, "club_members", people.map((user_id) => ({ id: uuidv7(), user_id, club: "kdrama" })));
  await insert(
    request,
    "entries",
    people.map((user_id) => ({ id: uuidv7(), user_id, title_id: title, status: "finished", finished_at: new Date().toISOString() })),
  );

  await signUp(page, request, "clubs", "/home");
  const username = `cl_${stamp}`;
  expect((await page.request.patch("/api/account", { data: { username, displayName: "Club Tester" } })).ok()).toBe(true);
  expect((await page.request.post("/api/follows", { data: { userId: people[0], follow: true } })).ok()).toBe(true);

  // The clubs page: the K-drama Club with its members.
  const main = page.getByRole("main");
  await page.goto("/clubs");
  await expect(main.getByRole("heading", { name: "Fandom clubs" })).toBeVisible();
  await main.getByRole("link", { name: /K-drama Club/ }).click();
  await expect(main.getByRole("heading", { name: "K-drama Club", level: 1 })).toBeVisible();
  const members = main.locator("header").getByText(/^\d+ members?$/);
  const before = Number((await members.textContent())!.match(/\d+/)![0]);
  expect(before).toBeGreaterThanOrEqual(3);

  // Who you follow, what's big (3 members on it), and the club feed.
  await expect(main.getByRole("region", { name: "People you follow here" }).getByRole("link", { name: kimName })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Big in the club lately" })).toBeVisible();
  await expect(main.getByRole("link", { name: new RegExp(`3 members ${show.name}`) })).toBeVisible();
  await expect(main.getByRole("article").filter({ hasText: kimName })).toContainText(show.name);

  // Joining.
  await main.getByRole("button", { name: "Join the club" }).click();
  await expect(main.getByText("You're in")).toBeVisible();
  await expect(main.locator("header").getByText(`${before + 1} members`)).toBeVisible();

  // The title page points at its clubs; the profile lists yours.
  await page.goto(`/title/series/${show.externalId}`);
  await expect(main.getByRole("heading", { name: "Clubs for this" })).toBeVisible();
  await expect(main.getByRole("link", { name: "K-drama Club" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Romance Club" })).toBeVisible();
  await page.goto(`/u/${username}`);
  await expect(main.getByRole("link", { name: "K-drama Club" })).toBeVisible();

  // Signed out: the club is readable, joining asks to sign in, Stamps are counts only.
  const visitor = await browser.newPage();
  await visitor.goto("/clubs/kdrama");
  await expect(visitor.getByRole("main").getByRole("link", { name: "Sign in to join" })).toBeVisible();
  await expect(visitor.getByRole("main").getByRole("article").filter({ hasText: kimName })).toBeVisible();
  await expect(visitor.getByRole("main").getByRole("button", { name: /Stamp/ })).toHaveCount(0);
  await visitor.close();
});
