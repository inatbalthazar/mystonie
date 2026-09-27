import { expect, test } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, fakePushService, mailpitUp, seedSeries, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack. Titles and the series are seeded, so TMDB isn't needed (with a token, the
// trending section shows up too and is checked).
const SHOW = { externalId: "990002", name: "Stonie Home Show", seasons: [3] };
const MOVIE: SeedTitle = { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: null, runtimeMin: 133 };
const DUNE: SeedTitle = { kind: "movie", externalId: "693134", name: "Dune: Part Two", year: 2024, posterPath: null, runtimeMin: 167 };

const service = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { base: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

test("Home: up next, recent cards, trending into quick add, install prompt", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedSeries(request, SHOW);
  await seedTitles(request, [MOVIE, DUNE]);
  await signUp(page, request, "home", "/home");
  const main = page.getByRole("main");

  // A new account: a greeting, an empty card strip, and Home in the header.
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(/^Hi, \S+/);
  await expect(main.getByText("Finish something and your cards land here.")).toBeVisible();
  await expect(main.getByRole("region", { name: "Up next" })).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/home");

  // Watching a series: its next episode is one tap away on Home.
  const logged = await page.request.post("/api/episodes", {
    data: { externalId: SHOW.externalId, episodes: [{ id: uuidv7(), season: 1, episode: 1 }] },
  });
  expect(logged.status(), await logged.text()).toBe(201);
  const { id: userId } = (await (await page.request.get("/api/account/export")).json()).account as { id: string };
  // Two saved cards: one shared (it has a page), one only downloaded.
  const { base, headers } = service();
  const shared = uuidv7();
  const downloaded = uuidv7();
  for (const [id, title, sharedAt] of [[shared, MOVIE, new Date().toISOString()], [downloaded, DUNE, null]] as const) {
    const card = await request.post(`${base}/cards`, {
      headers,
      data: {
        id,
        user_id: userId,
        kind: "sticker",
        template_id: "sticker",
        size: "story",
        params: { kind: "movie", name: title.name, year: title.year, finishedOn: "2026-09-20" },
        shared_at: sharedAt,
      },
    });
    expect(card.ok(), await card.text()).toBe(true);
  }

  await page.goto("/home");
  const upNext = main.getByRole("region", { name: "Up next" });
  await expect(upNext).toContainText("S1 · E2");
  await upNext.getByRole("button", { name: `Log ${SHOW.name} S1 E2` }).click();
  await expect(upNext).toContainText("S1 · E3");

  const cards = main.getByRole("region", { name: "Your recent cards" });
  await expect(cards.getByRole("link", { name: "Card: Parasite" })).toHaveAttribute("href", `/c/${shared}`);
  await expect(cards.getByRole("img", { name: "Card: Dune: Part Two" })).toBeVisible();
  await expect(cards.getByRole("link", { name: "Card: Dune: Part Two" })).toHaveCount(0);
  await expect(cards.getByRole("link", { name: "See your page" })).toHaveAttribute("href", /^\/u\//);

  // Trending (needs TMDB): each title opens quick add on its status step.
  const trending = main.getByRole("region", { name: "Trending this week" });
  if (await trending.isVisible()) {
    await expect(trending.getByRole("link").first()).toHaveAttribute("href", /^\/collection\?add=1&pick=(movie|series)%3A\d+$/);
  }
  // Tap one (here: the seeded movie) → Finished: two taps to the celebration.
  await page.goto(`/collection?add=1&pick=movie:${MOVIE.externalId}`);
  const sheet = page.getByRole("dialog", { name: "Add a title" });
  await expect(sheet).toContainText("Parasite");
  const added = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/entries" && r.request().method() === "POST");
  await expect(async () => {
    await sheet.getByRole("button", { name: "Finished", exact: true }).click({ timeout: 2000 });
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible({ timeout: 2000 });
  }).toPass();
  expect((await added).status()).toBe(201);
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(main.getByRole("button", { name: "Edit Parasite" })).toContainText("Finished");

  // Install: Chromium's own prompt behind our button…
  await page.goto("/home");
  const install = main.getByRole("complementary", { name: "Keep Mystonie on your home screen" });
  await expect(install).toHaveCount(0);
  await expect(async () => {
    await page.evaluate(() => {
      const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: async () => {
          (window as unknown as { prompted: boolean }).prompted = true;
        },
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      window.dispatchEvent(event);
    });
    await expect(install).toBeVisible({ timeout: 1000 });
  }).toPass();
  await install.getByRole("button", { name: "Install" }).click();
  await expect(install).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);

  // …and the Share → Add to Home Screen steps on an iPhone, until "Not now".
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "userAgent", {
      get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    }),
  );
  await page.reload();
  await expect(install).toContainText("Tap Share in Safari's toolbar");
  await install.getByRole("button", { name: "Not now" }).click();
  await expect(install).toHaveCount(0);
  await page.reload();
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(install).toHaveCount(0);
});

test("installable: manifest, icons and the service worker", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = (await manifest.json()) as { start_url: string; display: string; icons: { src: string; purpose: string }[] };
  expect(body).toMatchObject({ start_url: "/home?source=pwa", display: "standalone" });
  expect(body.icons.map((i) => i.purpose)).toEqual(["any", "any", "maskable"]);
  for (const src of [...body.icons.map((i) => i.src), "/pwa/badge-96.png"]) {
    const icon = await request.get(src);
    expect(icon.headers()["content-type"], src).toBe("image/png");
  }
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  expect(await sw.text()).toContain('addEventListener("push"');

  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
});

test("push subscriptions: saved per device, only for real push services, dropped on sign-out", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.skip(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, "web push is not set up (pnpm push:keys → .env.local)");
  const push = await fakePushService();
  const { subscription } = push.device("ok");
  expect((await request.post("/api/push", { data: { subscription } })).status()).toBe(401);

  await signUp(page, request, "push", "/settings");
  // Only an installed app gets the switch; a browser tab explains how to install.
  await expect(page.getByText(/^Install Mystonie on this device/)).toBeVisible();

  const bad = { ...subscription, endpoint: "https://evil.example.com/steal" };
  expect((await page.request.post("/api/push", { data: { subscription: bad } })).status()).toBe(400);
  expect((await page.request.post("/api/push", { data: { subscription: { ...subscription, keys: { p256dh: "x", auth: "y" } } } })).status()).toBe(400);
  expect((await page.request.post("/api/push", { data: { subscription } })).status()).toBe(201);
  // The same device again is one row, not two.
  expect((await page.request.post("/api/push", { data: { subscription } })).status()).toBe(201);
  expect(await push.stored()).toEqual([subscription.endpoint]);

  // Signing out sends this device's endpoint along, so the next person on it gets nothing.
  await page.evaluate(async (sub) => {
    // Stands in for the browser's subscription (headless Chromium can't reach a real push service).
    Object.defineProperty(ServiceWorkerContainer.prototype, "getRegistration", {
      value: async () => ({ pushManager: { getSubscription: async () => ({ endpoint: sub.endpoint, unsubscribe: async () => true }) } }),
    });
  }, subscription);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await push.stored()).toEqual([]);
  await push.close();
});
