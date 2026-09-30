import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, seedTitles, signUp, type SeedTitle } from "./helpers";

// S2 where to watch (ADR 0032). Needs the local Supabase stack; provider data is seeded fresh, so TMDB isn't called.
const MOVIES: SeedTitle[] = [
  { kind: "movie", externalId: "972001", name: "Watch Test Everywhere", year: 2021, posterPath: null, runtimeMin: 110 },
  { kind: "movie", externalId: "972002", name: "Watch Test US Only", year: 2022, posterPath: null, runtimeMin: 95 },
];
const NETFLIX = { id: 8, name: "Netflix", logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png" };
const LOCAL = { id: 97201, name: "Stonie Stream", logo: "/stonie-stream.png" };
const STORE = { id: 2, name: "Apple TV Store", logo: "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png" };

async function seedProviders(request: APIRequestContext, externalId: string, providers: unknown) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [title] = await (await request.get(`${url}/rest/v1/titles?source=eq.tmdb&kind=eq.movie&external_id=eq.${externalId}&select=id`, { headers })).json();
  const res = await request.post(`${url}/rest/v1/title_providers?on_conflict=title_id`, {
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    data: { title_id: title.id, providers, fetched_at: new Date().toISOString() },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

const block = (page: Page) => page.getByRole("main").locator("section").filter({ has: page.getByRole("heading", { name: "Where to watch" }) });

test.beforeEach(async ({ request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, MOVIES);
  await seedProviders(request, "972001", { US: { stream: [NETFLIX], buy: [STORE] }, TH: { stream: [LOCAL] } });
  await seedProviders(request, "972002", { US: { free: [NETFLIX] } });
});

test("a US viewer and a TH viewer each see their own country's services, credited to JustWatch", async ({ page, request, browser }) => {
  // A browser set to US English: the country is guessed from the request, then saved to the profile.
  await signUp(page, request, "watch-us", "/title/movie/972001");
  const us = block(page);
  await expect(us.getByLabel("Country")).toHaveValue("US");
  const netflix = us.getByRole("link", { name: "Netflix: stream (opens TMDB)" });
  await expect(netflix).toHaveAttribute("href", "https://www.themoviedb.org/movie/972001/watch?locale=US");
  await expect(us.getByRole("link", { name: "Apple TV Store: rent or buy (opens TMDB)" })).toBeVisible();
  await expect(us.getByRole("link", { name: "Stonie Stream: stream (opens TMDB)" })).toHaveCount(0);
  await expect(us.getByRole("link", { name: "JustWatch" })).toHaveAttribute("href", "https://www.justwatch.com");
  await page.goto("/settings");
  await expect(page.getByLabel("Country")).toHaveValue("US");

  // Moving to Thailand from the block: its services, and it sticks.
  await page.goto("/title/movie/972001");
  await block(page).getByLabel("Country").selectOption("TH");
  await expect(block(page).getByRole("link", { name: "Stonie Stream: stream (opens TMDB)" })).toBeVisible();
  await expect(block(page).getByRole("link", { name: /^Netflix/ })).toHaveCount(0);
  await page.goto("/title/movie/972002");
  await expect(block(page)).toContainText("Not streaming, free or for sale in Thailand right now.");
  await expect(block(page).getByRole("link", { name: "JustWatch" })).toBeVisible();

  // A second person whose browser says Thai (Thailand) starts in Thailand, with the page still in English.
  const thai = await browser.newContext({ locale: "th-TH" });
  const other = await thai.newPage();
  await signUp(other, request, "watch-th", "/title/movie/972001");
  const th = block(other);
  await expect(th.getByRole("heading", { name: "Where to watch" })).toBeVisible();
  await expect(th.getByLabel("Country")).toHaveValue("TH");
  await expect(th.getByRole("link", { name: "Stonie Stream: stream (opens TMDB)" })).toHaveAttribute(
    "href",
    "https://www.themoviedb.org/movie/972001/watch?locale=TH",
  );
  await thai.close();
});

test("the collection sheet opens a movie's where to watch", async ({ page, request }) => {
  await signUp(page, request, "watch-sheet");
  const res = await page.request.post("/api/entries", {
    data: { id: uuidv7(), title: { source: "tmdb", kind: "movie", externalId: "972002" }, status: "want" },
  });
  expect(res.status(), await res.text()).toBe(201);
  await page.reload();
  await page.getByRole("button", { name: "Edit Watch Test US Only" }).first().click();
  await page.getByRole("link", { name: "Where to watch" }).click();
  await expect(page).toHaveURL(/\/title\/movie\/972002$/);
  await expect(block(page).getByRole("link", { name: "Netflix: watch free (opens TMDB)" })).toBeVisible();
});
