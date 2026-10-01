import { expect, test, type APIRequestContext } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { reelDay, reelNumber } from "../src/core/reel";
import { addDays } from "../src/core/stats/recap";
import { canSeed, fakePushService, mailpitUp, mockSearch, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack: today's reel is seeded through the service role (so TMDB isn't asked to pick one),
// and search is mocked.
const ANSWER: SeedTitle = { kind: "movie", externalId: "9900603", name: "The Reel Answer E2E", year: 1999, posterPath: null, runtimeMin: 136 };
const WRONG: SeedTitle = { kind: "movie", externalId: "9900604", name: "A Wrong Reel E2E", year: 2001, posterPath: null, runtimeMin: 100 };

const serviceHeaders = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, Prefer: "resolution=merge-duplicates,return=representation" };
};

/** Makes ANSWER the reel of `days` (today, UTC, by default), with its genres, credits and tagline for the clues. */
async function seedTodaysReel(request: APIRequestContext, days = [reelDay(Date.now())]) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Prefer: "resolution=merge-duplicates,return=representation" };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const title = await request.post(`${base}/rest/v1/titles?on_conflict=source,kind,external_id`, {
    headers,
    data: {
      source: "tmdb",
      kind: "movie",
      external_id: ANSWER.externalId,
      name: ANSWER.name,
      year: ANSWER.year,
      runtime_min: ANSWER.runtimeMin,
      genres: ["Science Fiction", "Action"],
      credits: [
        { role: "actor", id: "6384", name: "Keanu Reeves", image: null },
        { role: "director", id: "9340", name: "Lana Wachowski", image: null },
      ],
      raw: { tagline: "Welcome to the Real World." },
      fetched_at: new Date().toISOString(),
    },
  });
  expect(title.ok(), await title.text()).toBe(true);
  const [{ id }] = (await title.json()) as { id: string }[];
  for (const day of days) {
    const reel = await request.post(`${base}/rest/v1/daily_reels?on_conflict=day`, { headers, data: { day, number: reelNumber(day), title_id: id } });
    expect(reel.ok(), await reel.text()).toBe(true);
  }
}

test("reel of the day: a guest's miss opens a clue, the hit reveals it and shares squares; signed in, a streak and a card", async ({
  page,
  request,
  context,
}) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTodaysReel(request);
  await mockSearch(page, [ANSWER, WRONG]);
  // The share button copies when there's no share sheet (headless Chrome on some systems has one).
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const number = reelNumber(reelDay(Date.now()));

  // A guest: nothing open yet but the blurred poster.
  await page.goto("/reel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reel of the Day");
  await expect(page.getByText(`#${number}`).first()).toBeVisible();
  await expect(page.getByText("6 guesses left")).toBeVisible();
  await expect(page.getByText("After miss 1")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Welcome to the Real World");

  // A miss: the year opens.
  await page.getByLabel(/Guess the movie/).fill("wrong reel");
  await page.getByRole("button", { name: /A Wrong Reel E2E/ }).click();
  await expect(page.getByText("5 guesses left")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "A Wrong Reel E2E" })).toContainText("Not it");
  await expect(page.getByRole("definition").filter({ hasText: "1999" })).toBeVisible();

  // The hit: the answer, and squares to share (never the name).
  await page.getByLabel(/Guess the movie/).fill("reel answer");
  await page.getByRole("button", { name: /The Reel Answer E2E/ }).click();
  await expect(page.getByRole("heading", { name: "Got it in 2 guesses!" })).toBeVisible();
  // (Today's answer, not yesterday's reel: a local run the day before seeded the same movie.)
  await expect(
    page.getByRole("paragraph").filter({ hasText: "Today's reel" }).getByRole("link", { name: "The Reel Answer E2E (1999)" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Welcome to the Real World.");
  await page.getByRole("button", { name: "Share result" }).click();
  await expect(page.getByText("Result copied: paste it anywhere.")).toBeVisible();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(shared).toContain(`Reel of the Day #${number} 2/6`);
  expect(shared).toContain("🟥🟩");
  expect(shared).not.toContain("Reel Answer");
  expect(shared).not.toContain("🔥");
  await expect(page.getByText("Sign in to keep your streak and make a card of your result.")).toBeVisible();
  // Reloading keeps the guest's play (this browser).
  await page.reload();
  await expect(page.getByRole("heading", { name: "Got it in 2 guesses!" })).toBeVisible();

  // Signed in: the server keeps the play, the streak and the stats; the card is saved as a reel card.
  await signUp(page, request, "reel", "/reel");
  await page.getByLabel(/Guess the movie/).fill("reel answer");
  await page.getByRole("button", { name: /The Reel Answer E2E/ }).click();
  await expect(page.getByRole("heading", { name: "Got it in one!" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your reels" })).toBeVisible();
  const stat = (label: string) =>
    page
      .getByRole("term")
      .filter({ hasText: new RegExp(`^${label}$`) })
      .locator("..")
      .getByRole("definition");
  await expect(stat("Played")).toHaveText("1");
  await expect(stat("Streak")).toHaveText("1");
  // Solved in one: the Reel Rookie and One Take stickers (ADR 0063).
  const stickers = page.getByRole("status").filter({ hasText: "2 new stickers!" });
  await expect(stickers).toContainText("Reel Rookie · One Take");
  await stickers.getByRole("button", { name: "Close" }).click();
  await expect(stickers).toHaveCount(0);

  await page.getByRole("button", { name: "Make a card" }).click();
  const celebration = page.getByRole("dialog", { name: `Reel of the Day #${number}` });
  await expect(celebration.locator("[data-card]")).toContainText(`#${number}`);
  await expect(celebration.locator("[data-card]")).not.toContainText("Reel Answer");
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await celebration.getByRole("button", { name: "Download" }).click({ timeout: 15_000 });
  const save = await saved;
  expect(save.status()).toBe(201);
  expect(save.request().postDataJSON()).toMatchObject({
    kind: "reel",
    templateId: "reel",
    data: { reel: { number, results: [true], solved: true, streak: 1 } },
  });

  // Home shows today's result.
  await page.goto("/home");
  await expect(page.getByRole("link", { name: new RegExp(`Reel of the Day #${number}`) })).toContainText("Solved in one");
});

test("streak reminders: one push on the day the reel would end a streak, at the player's evening hour", async ({ page, request }) => {
  const cronSecret = process.env.CRON_SECRET;
  const pushOn = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
  test.skip(!(await mailpitUp(request)) || !canSeed() || !cronSecret || !pushOn, "needs local Supabase, CRON_SECRET and VAPID keys");
  const username = `remind_${Date.now().toString(36)}`;
  await signUp(page, request, "reel-remind", "/home");
  // What the Settings switch saves (it shows only in the installed app, under notifications), in Bangkok.
  const saved = await page.request.patch("/api/account", { data: { username, timeZone: "Asia/Bangkok", reelReminders: true } });
  expect(saved.ok(), await saved.text()).toBe(true);
  expect(await saved.json()).toMatchObject({ reelReminders: true });
  const push = await fakePushService();
  expect((await page.request.post("/api/push", { data: { subscription: push.device("ok").subscription } })).status()).toBe(201);

  // Won the two days before a day of its own (a Wednesday far ahead, a new one each run, so no other run's plays count).
  const day = addDays("2040-01-04", 7 * (Math.floor(Date.now() / 60_000) % 2600));
  await seedTodaysReel(request, [addDays(day, -2), addDays(day, -1)]);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const profile = await request.get(`${base}/rest/v1/profiles?select=id&username=eq.${username}`, { headers: serviceHeaders() });
  const [{ id: userId }] = (await profile.json()) as { id: string }[];
  const plays = await request.post(`${base}/rest/v1/reel_plays`, {
    headers: serviceHeaders(),
    data: [
      { id: uuidv7(), user_id: userId, day: addDays(day, -2), guesses: [], solved: true, finished_at: `${addDays(day, -2)}T12:00:00Z`, streak: 1 },
      { id: uuidv7(), user_id: userId, day: addDays(day, -1), guesses: [], solved: true, finished_at: `${addDays(day, -1)}T12:00:00Z`, streak: 2 },
    ],
  });
  expect(plays.ok(), await plays.text()).toBe(true);

  // The hourly job: 20:05 in Bangkok is early, 21:05 is the hour (the reel changes at 07:00), and only once.
  const cron = async (time: string) => {
    const run = await request.post("/api/cron/weekly-recaps", {
      headers: { Authorization: `Bearer ${cronSecret}` },
      data: { now: `${day}T${time}Z` },
    });
    expect(run.status()).toBe(200);
    return push.received("ok").length;
  };
  expect(await cron("13:05:00")).toBe(0);
  expect(await cron("14:05:00")).toBe(1);
  expect(await cron("14:35:00")).toBe(1);
  expect(await cron("15:05:00")).toBe(1);

  const [delivered] = push.received("ok");
  expect(delivered!.headers).toMatchObject({ "content-encoding": "aes128gcm", topic: "reel-reminder" });
  expect(await delivered!.message()).toEqual({
    title: "🔥 Keep your 2-day streak",
    body: "Today’s Reel of the Day ends in 9 hours. Can you name it?",
    url: "/reel",
    tag: `reel-${day}`,
  });
  await push.close();
});
