import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { canSeed, mailpitUp, mockSearch, seedSeries, seedTitles, signUp, type SeedTitle } from "./helpers";

// S2 Letterboxd import (ADR 0033) and S3 import & export (ADR 0041). Needs the local Supabase stack. Titles are seeded
// and the match route is mocked (except for Mystonie's own CSV export, matched by id from the cache), so no catalog
// is called; saving goes through the real commit route.
const MOVIES: SeedTitle[] = [
  { kind: "movie", externalId: "973001", name: "Import Test Alpha", year: 2021, posterPath: null, runtimeMin: 110 },
  { kind: "movie", externalId: "973002", name: "Import Test Beta", year: 2019, posterPath: null, runtimeMin: 95 },
  { kind: "movie", externalId: "973003", name: "Import Test Twin", year: 2020, posterPath: null, runtimeMin: 100 },
  { kind: "movie", externalId: "973004", name: "Import Test Twin", year: 2020, posterPath: null, runtimeMin: 12 },
  { kind: "movie", externalId: "973005", name: "Import Test Gamma", year: 2018, posterPath: null, runtimeMin: 120 },
  { kind: "movie", externalId: "973006", name: "Import Test Delta", year: 2022, posterPath: null, runtimeMin: 90 },
];
const result = (m: SeedTitle) => ({ source: "tmdb", externalId: m.externalId, kind: "movie", name: m.name, year: m.year });
const ANSWERS: Record<string, unknown> = {
  "Import Test Alpha": { state: "matched", match: result(MOVIES[0]!) },
  "Import Test Beta": { state: "matched", match: result(MOVIES[1]!) },
  "Import Test Twin": { state: "ambiguous", candidates: [result(MOVIES[2]!), result(MOVIES[3]!)] },
  "Import Test Delta": { state: "matched", match: result(MOVIES[5]!) },
};

const EXPORT = [
  {
    name: "diary.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date",
        "2024-03-01,Import Test Alpha,2021,https://boxd.it/a,4.5,,,2024-03-01",
        "2024-04-02,Import Test Beta,2019,https://boxd.it/b,,,,2024-04-02",
        "2024-05-03,Import Test Twin,2020,https://boxd.it/c,3,,,2024-05-03",
        "2024-06-04,Import Test Gamma Original,2018,https://boxd.it/d,5,,,2024-06-04",
      ].join("\r\n"),
    ),
  },
  {
    name: "watchlist.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Name,Year,Letterboxd URI\r\n2024-07-01,Import Test Delta,2022,https://boxd.it/e\r\n"),
  },
];

async function mockMatch(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/import/match",
    (route) => {
      const { items } = route.request().postDataJSON() as { items: { name: string }[] };
      return route.fulfill({ json: { matches: items.map((f) => ANSWERS[f.name] ?? { state: "missing" }), have: {} } });
    },
  );
}

const row = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });

const rest = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

/** Gives the signed-in account a known username and returns its id. */
async function me(page: Page, request: APIRequestContext, username: string): Promise<string> {
  expect((await page.request.patch("/api/account", { data: { username } })).ok()).toBe(true);
  const { url, headers } = rest();
  const res = await request.get(`${url}/rest/v1/profiles?select=id&username=eq.${username}`, { headers });
  return ((await res.json()) as { id: string }[])[0]!.id;
}

type Saved = { status: string; finished_at: string | null; rating: number | null; title: { external_id: string } };

/** The account's live entries (by external id) and how many live episode logs it has. */
async function collection(request: APIRequestContext, userId: string): Promise<{ entries: Record<string, Saved>; episodes: number }> {
  const { url, headers } = rest();
  const select = "status,finished_at,rating,title:titles(external_id)";
  const entries = (await (await request.get(`${url}/rest/v1/entries?select=${select}&user_id=eq.${userId}&deleted_at=is.null`, { headers })).json()) as Saved[];
  const logs = (await (await request.get(`${url}/rest/v1/episode_logs?select=id&user_id=eq.${userId}&deleted_at=is.null`, { headers })).json()) as unknown[];
  return { entries: Object.fromEntries(entries.map((e) => [e.title.external_id, e])), episodes: logs.length };
}

test.beforeEach(async ({ request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, MOVIES);
});

test("imports an export after fixing the preview, and importing it again adds nothing", async ({ page, request }) => {
  await signUp(page, request, "import", "/settings");
  await mockMatch(page);
  await mockSearch(page, MOVIES);
  await page.getByRole("link", { name: "Import your history" }).click();
  await expect(page.getByRole("heading", { name: "Import your history" })).toBeVisible();

  // Not an export: a clear message, and the picker stays.
  await page.locator("input[type=file]").setInputFiles({ name: "notes.csv", mimeType: "text/csv", buffer: Buffer.from("a,b\n1,2\n") });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("doesn't look like an export we know");

  await page.locator("input[type=file]").setInputFiles(EXPORT);
  await expect(page.getByRole("heading", { name: "5 films in your export" })).toBeVisible();
  const importButton = page.getByRole("button", { name: /^Import \d+ films?$|^Pick films to import$/ });
  await expect(importButton).toHaveText("Import 3 films");

  // A namesake to pick, and a film found by another name.
  await row(page, "Import Test Twin (2020)").getByRole("button", { name: /Import Test Twin/ }).first().click();
  await row(page, "Import Test Gamma Original").getByRole("button", { name: "Find it" }).click();
  const sheet = page.getByRole("dialog", { name: "Find “Import Test Gamma Original”" });
  await sheet.getByRole("searchbox").fill("Import Test Gamma");
  await sheet.getByRole("button", { name: /^Import Test Gamma/ }).click();
  await expect(sheet).toBeHidden();
  await expect(row(page, "Import Test Gamma Original")).toContainText("Import Test Gamma (2018)");
  await expect(importButton).toHaveText("Import 5 films");

  // Saved, then one "Imported N films" celebration for the four watched ones (the watchlist film isn't "finished").
  await importButton.click();
  const celebration = page.getByRole("dialog").filter({ hasText: "4 films imported" });
  await expect(celebration).toBeVisible({ timeout: 20_000 });
  await celebration.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("5 films added")).toBeVisible();

  await page.getByRole("link", { name: "See your collection" }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByText("Import Test Alpha").first()).toBeVisible();

  // The same export again: everything is already there, nothing is added, no celebration.
  await page.goto("/settings/import");
  await page.locator("input[type=file]").setInputFiles(EXPORT);
  await expect(page.getByRole("heading", { name: "5 films in your export" })).toBeVisible();
  await page.getByRole("button", { name: "Import 3 films" }).click();
  await expect(page.getByText("3 films were already there")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/films? added/)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("TV Time: episodes come with their dates, a show seen to the end is finished, and the CSV export restores it all in another account", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(150_000);
  const stamp = Date.now().toString(36);
  const done = { externalId: String(940_000_000 + (Date.now() % 10_000_000)), name: `Import Done Show ${stamp}`, seasons: [3, 2] };
  const going = { externalId: String(930_000_000 + (Date.now() % 10_000_000)), name: `Import Going Show ${stamp}`, seasons: [2] };
  await seedSeries(request, done);
  await seedSeries(request, going);
  const result = (kind: string, externalId: string, name: string, year: number) => ({ state: "matched", match: { source: "tmdb", externalId, kind, name, year } });
  const answers: Record<string, unknown> = {
    [done.name]: result("series", done.externalId, done.name, 2020),
    [going.name]: result("series", going.externalId, going.name, 2020),
    "Import Test Alpha": result("movie", "973001", "Import Test Alpha", 2021),
  };
  await page.route(
    (url) => url.pathname === "/api/import/match",
    (route) => {
      const { items } = route.request().postDataJSON() as { items: { name: string }[] };
      return route.fulfill({ json: { matches: items.map((i) => answers[i.name] ?? { state: "missing" }), have: {} } });
    },
  );

  await signUp(page, request, "import-tvtime", "/settings");
  await page.goto("/settings/import?from=tvtime");
  const first = await me(page, request, `tt_${stamp}`);
  await expect(page.getByRole("heading", { name: "Get your TV Time export" })).toBeVisible();

  // Every episode of one show (the last on 5 February 2021), one episode of another, a movie, and a followed show nobody finds.
  const seen = [
    "episode_id,tv_show_name,episode_season_number,episode_number,created_at",
    ...[[1, 1], [1, 2], [1, 3], [2, 1], [2, 2]].map(([s, e], i) => `${i},${done.name},${s},${e},2021-02-0${i + 1} 20:00:00`),
    `9,${going.name},1,1,2022-03-03 21:00:00`,
  ].join("\n");
  await page.locator("input[type=file]").setInputFiles([
    { name: "seen_episode.csv", mimeType: "text/csv", buffer: Buffer.from(seen) },
    {
      name: "tracking-prod-records-v2.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("uuid,movie_name,type,created_at,release_date\nm1,Import Test Alpha,watch,2023-06-07 18:30:00,2021-01-01\n"),
    },
    { name: "followed_tv_show.csv", mimeType: "text/csv", buffer: Buffer.from(`tv_show_id,tv_show_name,created_at\n1,Nobody Knows ${stamp},2020-01-01 00:00:00\n`) },
  ]);
  await expect(page.getByRole("heading", { name: "4 titles in your export" })).toBeVisible();
  await page.getByRole("button", { name: "Import 3 titles" }).click();
  const celebration = page.getByRole("dialog").filter({ hasText: "3 titles imported" });
  await expect(celebration).toBeVisible({ timeout: 30_000 });
  await celebration.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("3 titles added")).toBeVisible();
  await expect(page.getByText("6 episodes logged")).toBeVisible();

  const saved = await collection(request, first);
  expect(saved.episodes).toBe(6);
  expect(saved.entries[done.externalId]).toMatchObject({ status: "finished", finished_at: "2021-02-05T20:00:00+00:00" });
  expect(saved.entries[going.externalId]).toMatchObject({ status: "watching", finished_at: null });
  expect(saved.entries["973001"]).toMatchObject({ status: "finished", finished_at: "2023-06-07T18:30:00+00:00" });

  // The CSV export: a ZIP of spreadsheets.
  const exported = await page.request.get("/api/account/export/csv");
  expect(exported.ok()).toBe(true);
  expect(exported.headers()["content-type"]).toBe("application/zip");
  expect(exported.headers()["content-disposition"]).toMatch(/filename="mystonie-tt_[a-z0-9]+-\d{4}-\d{2}-\d{2}-csv\.zip"/);
  const zip = await exported.body();

  // Another account imports it: found by id (no matching), and everything comes back as it was.
  const context = await browser.newContext();
  const other = await context.newPage();
  await signUp(other, request, "import-restore", "/settings");
  await other.goto("/settings/import?from=mystonie");
  const second = await me(other, request, `tr_${stamp}`);
  const pick = () => other.locator("input[type=file]").setInputFiles({ name: "mystonie-export-csv.zip", mimeType: "application/zip", buffer: zip });
  await pick();
  await expect(other.getByRole("heading", { name: "3 titles in your export" })).toBeVisible({ timeout: 20_000 });
  await other.getByRole("button", { name: "Import 3 titles" }).click();
  await other.getByRole("dialog").filter({ hasText: "3 titles imported" }).getByRole("button", { name: "Skip" }).click({ timeout: 30_000 });
  await expect(other.getByText("3 titles added")).toBeVisible();
  const restored = await collection(request, second);
  expect(restored).toEqual(saved);

  // Importing it again adds nothing.
  await other.getByRole("button", { name: "Import another export" }).click();
  await pick();
  await other.getByRole("button", { name: "Import 3 titles" }).click();
  await expect(other.getByText("3 titles were already there")).toBeVisible({ timeout: 30_000 });
  await expect(other.getByText(/episodes? logged/)).toHaveCount(0);
  expect(await collection(request, second)).toEqual(saved);
  await context.close();
});

test("Goodreads: read books with their dates, current reads and the to-read shelf", async ({ page, request }) => {
  const stamp = Date.now().toString(36);
  const id = (tag: string) => `gr${tag}${stamp}`.padEnd(12, "x").slice(0, 12);
  const books = [
    { kind: "book" as const, externalId: id("a"), name: `Import Book One ${stamp}`, year: 2008, posterPath: null },
    { kind: "book" as const, externalId: id("b"), name: `Import Book Two ${stamp}`, year: 2020, posterPath: null },
  ];
  await seedTitles(request, books);
  await page.route(
    (url) => url.pathname === "/api/import/match",
    (route) => {
      const { items } = route.request().postDataJSON() as { items: { name: string }[] };
      const matches = items.map((i) => {
        const book = books.find((b) => b.name === i.name);
        return book ? { state: "matched", match: { source: "google_books", externalId: book.externalId, kind: "book", name: book.name, year: book.year } } : { state: "missing" };
      });
      return route.fulfill({ json: { matches, have: {} } });
    },
  );
  await signUp(page, request, "import-goodreads", "/settings");
  await page.goto("/settings/import?from=goodreads");
  await expect(page.getByRole("heading", { name: "Get your Goodreads export" })).toBeVisible();
  const csv = [
    "Book Id,Title,Author,ISBN,ISBN13,My Rating,Original Publication Year,Date Read,Date Added,Exclusive Shelf",
    `1,"${books[0]!.name} (Series, #1)",Ann Author,"=""0439023483""","=""9780439023481""",4,2008,2023/05/14,2023/01/01,read`,
    `2,${books[1]!.name},Ben Author,"=""""","=""""",0,2020,,2024/08/01,currently-reading`,
  ].join("\n");
  await page.locator("input[type=file]").setInputFiles({ name: "goodreads_library_export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("heading", { name: "2 books in your export" })).toBeVisible();
  await expect(row(page, books[0]!.name)).toContainText("Read May 14, 2023 · ★ 4");
  await expect(row(page, books[1]!.name)).toContainText("Reading");
  await page.getByRole("button", { name: "Import 2 books" }).click();
  const celebration = page.getByRole("dialog").filter({ hasText: "1 book imported" });
  await expect(celebration).toBeVisible({ timeout: 20_000 });
  await celebration.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("2 books added")).toBeVisible();
});
