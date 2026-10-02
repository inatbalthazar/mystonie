import { expect, test, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, navIsland, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack (sign-in via Mailpit, service role key for seeding). Titles are seeded, so TMDB
// isn't needed.
const ARRIVAL: SeedTitle = { kind: "movie", externalId: "329865", name: "Arrival", year: 2016, posterPath: null, runtimeMin: 116 };
const PAST_LIVES: SeedTitle = { kind: "movie", externalId: "666277", name: "Past Lives", year: 2023, posterPath: null, runtimeMin: 106 };

/** Names the signed-in account and logs a finished title through the API. */
async function setUp(page: Page, username: string, displayName: string, title: SeedTitle) {
  const named = await page.request.patch("/api/account", { data: { username, displayName } });
  expect(named.ok(), await named.text()).toBe(true);
  const logged = await page.request.post("/api/entries", {
    data: { id: uuidv7(), title: { source: "tmdb", kind: title.kind, externalId: title.externalId }, status: "finished" },
  });
  expect(logged.ok(), await logged.text()).toBe(true);
}

test("follow, the Following feed, Stamps and blocks", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  await seedTitles(request, [ARRIVAL, PAST_LIVES]);
  const stamp = Date.now().toString(36);
  const sam = `sam_${stamp}`;
  const kim = `kim_${stamp}`;

  // Two collectors, each with a finish.
  await signUp(page, request, "social-sam", "/home");
  await setUp(page, sam, "Sam Social", ARRIVAL);
  const kimContext = await browser.newContext();
  const kimPage = await kimContext.newPage();
  await signUp(kimPage, request, "social-kim", "/home");
  await setUp(kimPage, kim, "Kim Friend", PAST_LIVES);

  // Signed-out visitors see the Journal's articles there and a way to sign in, nobody's finishes (ADR 0062); the
  // people search still needs an account.
  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto("/feed");
  await expect(guest).toHaveURL(/\/feed$/);
  await expect(guest.getByRole("main").getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(guest.getByRole("main")).not.toContainText("Past Lives");
  await guest.goto("/people");
  await expect(guest).toHaveURL(/\/auth\?next=%2Fpeople$/);
  await visitor.close();

  // Sam's feed has only Sam's own finish, and an invitation to find people.
  const main = page.getByRole("main");
  await page.goto("/feed");
  await expect(main.getByText("Follow people to see what they finish, and give them a Stamp.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Arrival" }).first()).toBeVisible();

  // Sam finds Kim by name and follows.
  await page.goto("/people");
  await expect(async () => {
    // Retried: typing before hydration is lost.
    await main.getByLabel("Search people").fill(`@${kim}`);
    await expect(main.getByText(`@${kim}`)).toBeVisible({ timeout: 3000 });
  }).toPass();
  await main.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(main.getByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true");
  const events = () => page.evaluate(() => window.__mystonieEvents?.map(([name]) => name) ?? []);
  await expect.poll(events).toContain("followed");
  await page.reload();
  await expect(main.getByRole("heading", { name: "You follow 1" })).toBeVisible();

  // Kim's finish is in Sam's feed; Sam stamps it.
  await page.goto("/feed");
  await expect(main.getByRole("link", { name: "Past Lives" }).first()).toBeVisible();
  // Kim's finish (the feed also has the Journal's newest articles, with their own Stamps).
  const finish = main.getByRole("article").filter({ hasText: "Past Lives" });
  const stamped = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/stamps");
  await finish.getByRole("button", { name: "Stamp", exact: true }).click();
  expect((await stamped).ok()).toBe(true);
  await expect(finish.getByRole("button", { name: "Take back your Stamp" })).toHaveAttribute("aria-pressed", "true");
  await expect(finish.getByText("1 Stamp", { exact: true })).toBeVisible();
  await expect.poll(events).toContain("stamped");

  // Kim's Feed tab gets a dot (ADR 0054, ADR 0074): Sam's Stamp and follow came after Kim's device first asked. Kim
  // hasn't played today's Reel of the Day either: its note on Home has a dot, and so does Home elsewhere (ADR 0078).
  const kimIsland = navIsland(kimPage);
  await askAgain(kimPage);
  await kimPage.goto("/home");
  await expect(kimPage.getByRole("main").locator('a[href$="/reel"] [data-feed-dot="reel"]')).toBeVisible();
  await expect(kimIsland.getByRole("link", { name: "Feed, new activity" })).toBeVisible();
  await kimIsland.getByRole("link", { name: "Feed, new activity" }).click();
  await expect(kimPage).toHaveURL(/\/feed$/);
  await expect(kimIsland.getByRole("link", { name: "Feed", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(kimIsland.getByRole("link", { name: "Home, today's reel waits" })).toBeVisible();
  // Opening Following cleared its news; the reel still waits, so Home's dot stays until it's finished.
  await kimPage.goto("/collection");
  await expect(kimPage.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(kimIsland.getByRole("link", { name: "Home, today's reel waits" })).toBeVisible();
  await expect(kimIsland.getByRole("link", { name: "Feed", exact: true })).toBeVisible();
  await kimPage.evaluate(() => {
    const news = JSON.parse(localStorage.getItem("mystonie.feedNews") ?? "{}") as Record<string, unknown>;
    localStorage.setItem("mystonie.feedNews", JSON.stringify({ ...news, reelDoneOn: new Date().toISOString().slice(0, 10) }));
  });
  await kimPage.reload();
  await expect(kimPage.getByRole("heading", { level: 1 })).toBeVisible();
  await kimPage.waitForTimeout(1000); // the dot would show once the page is hydrated
  await expect(kimIsland.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(kimIsland.getByRole("link", { name: "Home, today's reel waits" })).toHaveCount(0);

  // Kim finishes something: Sam, who follows Kim, gets a dot on Feed and on its Following tab.
  await page.goto("/feed?tab=articles");
  await expect(main.getByRole("link", { name: "Following", exact: true })).toBeVisible();
  const logged = await kimPage.request.post("/api/entries", {
    data: { id: uuidv7(), title: { source: "tmdb", kind: ARRIVAL.kind, externalId: ARRIVAL.externalId }, status: "finished" },
  });
  expect(logged.ok(), await logged.text()).toBe(true);
  await askAgain(page);
  await page.reload();
  await expect(main.getByRole("link", { name: "Following", exact: true }).locator('[data-feed-dot="following"]')).toBeVisible();
  await expect(main.getByRole("link", { name: "Articles", exact: true }).locator("[data-feed-dot]")).toHaveCount(0);

  // Kim sees the Stamp and the new follower, and Sam's profile shows Kim's follow counts.
  const kimMain = kimPage.getByRole("main");
  await kimPage.goto("/feed");
  await expect(kimMain.getByText("stamped your finish of")).toBeVisible();
  await expect(kimMain.getByText("started following you")).toBeVisible();
  await expect(kimMain.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  await kimPage.goto(`/u/${kim}`);
  await expect(kimMain.getByText("1 follower")).toBeVisible();

  // Kim blocks Sam: Sam can no longer see Kim, and the follow and Stamp are gone.
  await kimPage.goto(`/u/${sam}`);
  await kimMain.getByRole("button", { name: "Block" }).click();
  await kimPage.getByRole("dialog").getByRole("button", { name: `Block @${sam}` }).click();
  await expect(kimMain.getByRole("heading", { name: `You blocked @${sam}` })).toBeVisible();

  await page.goto("/feed");
  await expect(main.getByRole("link", { name: "Arrival" }).first()).toBeVisible();
  await expect(main.getByRole("link", { name: "Past Lives" })).toHaveCount(0);
  await page.goto(`/u/${kim}`);
  await expect(main.getByRole("heading", { name: "This collection is private" })).toBeVisible();
  const refollow = await page.request.post("/api/follows", { data: { userId: await kimId(kimPage), follow: true } });
  expect(refollow.status()).toBe(404);

  // Unblocking from the blocked list on /people shows Sam's page again (the follow stays gone).
  await kimPage.goto("/people");
  await kimMain.getByRole("button", { name: "Unblock" }).click();
  await expect(kimMain.getByRole("heading", { name: "Blocked" })).toHaveCount(0);
  await page.goto(`/u/${kim}`);
  await expect(main.getByRole("heading", { name: "Kim Friend" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  await kimContext.close();
});

/** The feed's dots ask the server at most once a minute (ADR 0074): the next page asks again. */
async function askAgain(page: Page) {
  await page.evaluate(() => {
    const raw = localStorage.getItem("mystonie.feedNews");
    if (raw) localStorage.setItem("mystonie.feedNews", JSON.stringify({ ...(JSON.parse(raw) as object), checkedAt: 0 }));
  });
}

/** The signed-in account's id, from the data export. */
async function kimId(page: Page): Promise<string> {
  const exported = await page.request.get("/api/account/export");
  return ((await exported.json()) as { account: { id: string } }).account.id;
}
