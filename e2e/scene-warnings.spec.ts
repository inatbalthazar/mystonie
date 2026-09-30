import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, seedSeries, seedTitles, signUp, uniqueEmail } from "./helpers";

// S3 warnings & quiz (ADR 0043). Needs the local Supabase stack: sign-in via Mailpit, and the service role for seeding
// titles, the other viewers and their votes. Titles are new each run (warnings stay in the database), and DTDD is
// marked as checked for them, so the pages never call DoesTheDogDie.

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

/** The `titles` row id of a seeded TMDB title, marked as looked up on DTDD just now (no match). */
async function titleId(request: APIRequestContext, kind: "movie" | "series", externalId: string): Promise<string> {
  const { url, headers } = rest();
  const res = await request.get(`${url}/rest/v1/titles?select=id&source=eq.tmdb&kind=eq.${kind}&external_id=eq.${externalId}`, { headers });
  const id = ((await res.json()) as { id: string }[])[0]!.id;
  const checked = await request.patch(`${url}/rest/v1/titles?id=eq.${id}`, { headers, data: { dtdd_id: null, dtdd_checked_at: new Date().toISOString() } });
  expect(checked.ok(), await checked.text()).toBe(true);
  return id;
}

/** Someone else who finished the title and confirms a warning (written straight into the database). */
async function confirmAs(request: APIRequestContext, userId: string, title: string, warningId: string) {
  const { url, headers } = rest();
  const entry = await request.post(`${url}/rest/v1/entries`, {
    headers,
    data: { id: uuidv7(), user_id: userId, title_id: title, status: "finished", finished_at: new Date().toISOString() },
  });
  expect(entry.ok(), await entry.text()).toBe(true);
  const vote = await request.post(`${url}/rest/v1/scene_warning_votes`, { headers, data: { id: uuidv7(), user_id: userId, warning_id: warningId, vote: 1 } });
  expect(vote.ok(), await vote.text()).toBe(true);
}

const block = (page: Page) => page.getByRole("main").locator("section").filter({ has: page.getByRole("heading", { name: "Scene warnings" }) });

test.beforeEach(async ({ request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
});

test("scene warnings: added with the episode and time, confirmed by people who watched it, and they flag the title", async ({ page, request, browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now().toString(36);
  const externalId = String(974_000_000 + (Date.now() % 1_000_000));
  const show = `Scene Test Show ${stamp}`;
  await seedSeries(request, { externalId, name: show, seasons: [3] });
  const title = await titleId(request, "series", externalId);
  const path = `/title/series/${externalId}`;

  // Someone who hasn't watched it can't add warnings yet.
  await signUp(page, request, "scene-ada", path);
  await expect(block(page)).toContainText("No scene warnings yet.");
  await expect(block(page)).toContainText("Mark it as watching or finished to add warnings and confirm them.");

  // Watching it: add "a dog dies" at S1 · E2 · 41:10–42:30.
  const watching = await page.request.post("/api/entries", { data: { id: uuidv7(), title: { source: "tmdb", kind: "series", externalId }, status: "watching" } });
  expect(watching.status(), await watching.text()).toBe(201);
  await page.reload();
  await expect(async () => {
    // Retried: a tap before hydration is lost.
    await block(page).getByRole("button", { name: "Add a warning" }).click({ timeout: 2000 });
    await expect(page.getByRole("dialog", { name: "Add a scene warning" })).toBeVisible({ timeout: 1000 });
  }).toPass();
  const sheet = page.getByRole("dialog", { name: "Add a scene warning" });
  await sheet.getByLabel("What happens").selectOption({ label: "A dog dies" });
  await sheet.getByLabel("Season").selectOption({ label: "Season 1" });
  await sheet.getByLabel("Episode").selectOption({ label: "Episode 2" });
  await sheet.getByLabel("From", { exact: true }).fill("41:10");
  await sheet.getByLabel("To", { exact: true }).fill("40:00");
  await sheet.getByRole("button", { name: "Add warning" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("The end comes before the start.");
  await sheet.getByLabel("To", { exact: true }).fill("42:30");
  await sheet.getByRole("button", { name: "Add warning" }).click();
  await expect(sheet).toBeHidden();
  const dog = block(page).getByRole("listitem").filter({ hasText: "a dog dies" });
  await expect(dog).toContainText("S1 · E2 · 41:10–42:30");
  await expect(dog).toContainText("Needs confirmation · 1 of 5");
  await expect(dog).toContainText("Added by you");
  await expect(block(page)).toContainText("Added. It's confirmed once 4 more people who saw it agree.");

  // A second one, "spiders" throughout, withdrawn again while it waits.
  await block(page).getByRole("button", { name: "Add a warning" }).click();
  await sheet.getByLabel("What happens").selectOption({ label: "Spiders" });
  await sheet.getByRole("button", { name: "Add warning" }).click();
  const spiders = block(page).getByRole("listitem").filter({ hasText: "spiders" });
  await expect(spiders).toContainText("Throughout");
  await spiders.getByRole("button", { name: "Withdraw" }).click();
  await expect(spiders).toHaveCount(0);

  // Someone who finished it confirms from the page…
  const { url, headers } = rest();
  const [{ id: warningId }] = (await (
    await request.get(`${url}/rest/v1/scene_warnings?select=id&title_id=eq.${title}&topic=eq.dog-dies`, { headers })
  ).json()) as { id: string }[];
  const other = await browser.newContext();
  const bo = await other.newPage();
  await signUp(bo, request, "scene-bo", "/collection");
  const finished = await bo.request.post("/api/entries", { data: { id: uuidv7(), title: { source: "tmdb", kind: "series", externalId }, status: "finished" } });
  expect(finished.status(), await finished.text()).toBe(201);
  await bo.goto(path);
  const seen = block(bo).getByRole("listitem").filter({ hasText: "a dog dies" });
  await expect(seen).not.toContainText("Added by you");
  await expect(async () => {
    await seen.getByRole("button", { name: "Saw it: a dog dies, S1 · E2 · 41:10–42:30" }).click({ timeout: 2000 });
    await expect(seen.getByRole("button", { name: /^Saw it/ })).toHaveAttribute("aria-pressed", "true", { timeout: 2000 });
  }).toPass();
  await expect(seen).toContainText("Needs confirmation · 2 of 5");
  await expect(block(bo).getByRole("link", { name: "Quiz me about this one" })).toHaveAttribute("href", `/quiz?title=${title}`);

  // …three more who watched it do too: the fifth confirmation confirms it.
  const people = await Promise.all(["scene-cy", "scene-di", "scene-ed"].map((tag) => createUser(request, tag)));
  for (const id of people) await confirmAs(request, id, title, warningId);
  await bo.reload();
  await expect(block(bo).getByRole("listitem").filter({ hasText: "a dog dies" })).toContainText("Confirmed by 5");
  await other.close();

  // Avoiding a dog dying now flags the show in the collection: our own confirmed warning (DTDD has nothing on it).
  const saved = await page.request.put("/api/warnings/topics", { data: { topicIds: [153] } });
  expect(saved.status(), await saved.text()).toBe(200);
  await page.goto("/collection");
  await expect(page.getByRole("button", { name: `Edit ${show}. Content warning: a dog dies` }).first()).toBeVisible();
  await page.goto(path);
  await expect(block(page).getByRole("listitem").filter({ hasText: "a dog dies" })).toContainText("One of your topics");
  // A confirmed warning stays: others rely on it.
  await expect(block(page).getByRole("button", { name: "Withdraw" })).toHaveCount(0);
});

test("the warnings quiz asks about finished titles, and only answers given time to read count", async ({ page, request }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const externalId = String(975_000_000 + (Date.now() % 1_000_000));
  const movie = `Quiz Test Movie ${stamp}`;
  await seedTitles(request, [{ kind: "movie", externalId, name: movie, year: 2024, posterPath: null, runtimeMin: 100 }]);
  await titleId(request, "movie", externalId);

  await signUp(page, request, "quiz", "/quiz");
  await expect(page.getByRole("heading", { name: "Finish something first" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to your collection" })).toHaveAttribute("href", "/collection");

  const finished = await page.request.post("/api/entries", { data: { id: uuidv7(), title: { source: "tmdb", kind: "movie", externalId }, status: "finished" } });
  expect(finished.status(), await finished.text()).toBe(201);
  await page.reload();

  // A question about the movie; the answers wake up once there's been time to read it.
  const question = page.getByRole("heading", { level: 2, name: new RegExp(` in ${movie}\\?$`) });
  await expect(question).toBeVisible();
  const first = await question.textContent();
  await expect(page.getByRole("button", { name: "Yes" })).toBeEnabled({ timeout: 5000 });
  await page.getByRole("button", { name: "Yes" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Thanks, that helps.");
  await expect(question).not.toHaveText(first!);
  await expect(page.getByText("1 answer this visit")).toBeVisible();

  // Answering the instant a question arrives (a script) counts for nothing, and the third time pauses the quiz.
  for (const expected of ["too_fast", "too_fast", "paused"]) {
    const served = (await (await page.request.get("/api/quiz")).json()) as { status: string; id: string };
    expect(served.status).toBe("question");
    const answer = await page.request.post("/api/quiz", { data: { id: served.id, choice: "no" } });
    expect(((await answer.json()) as { status: string }).status).toBe(expected);
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "The quiz is taking a break" })).toBeVisible();
});
