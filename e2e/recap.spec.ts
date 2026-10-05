import { expect, test } from "@playwright/test";
import { periodRange } from "../src/core/stats/period";
import { canSeed, fakePushService, lastEmail, mailpitUp, mockSearch, openQuickAdd, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack and a dev server started with CRON_SECRET and UNSUBSCRIBE_SECRET (the recap
// route and its unsubscribe links). The recap email lands in Mailpit, like sign-in emails.
const TITLE: SeedTitle = { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", runtimeMin: 133 };
const ZONE = "America/New_York";

test.use({ timezoneId: ZONE });

test("a finished week → Monday recap email → recap card → share, then unsubscribe", async ({ page, request, context }) => {
  const cronSecret = process.env.CRON_SECRET;
  test.skip(!(await mailpitUp(request)) || !canSeed() || !cronSecret || !process.env.UNSUBSCRIBE_SECRET, "needs local Supabase, CRON_SECRET and UNSUBSCRIBE_SECRET");
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true }));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seedTitles(request, [TITLE]);
  await mockSearch(page, [TITLE]);
  const email = await signUp(page, request, "recap");

  // Finish a movie this week.
  await openQuickAdd(page);
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill("Parasite");
  await page.getByRole("dialog").getByRole("button", { name: /^Parasite Movie/ }).first().click();
  const added = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/entries" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Finished today", exact: true }).click();
  expect((await added).status()).toBe(201);
  await page.getByRole("button", { name: "Skip" }).click();

  // Two devices turned recap notifications on (ADR 0028), through a fake push service; one of them is gone.
  const pushOn = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
  const push = pushOn ? await fakePushService() : null;
  if (push) {
    for (const device of [push.device("ok"), push.device("gone")]) {
      expect((await page.request.post("/api/push", { data: { subscription: device.subscription } })).status()).toBe(201);
    }
  }

  // The hourly job, run as next Monday 10:00 in the user's time zone.
  const nextMonday = periodRange("week", { timeZone: ZONE, weekStart: 1, offset: 1 })!.from;
  const cron = (now: string) =>
    request.post("/api/cron/weekly-recaps", { headers: { Authorization: `Bearer ${cronSecret}` }, data: { now } });
  // 08:00 is too early: no recap email yet (the newest one is still the sign-in code).
  expect((await cron(new Date(nextMonday + 8 * 3_600_000).toISOString())).status()).toBe(200);
  expect((await lastEmail(request, email)).Subject).toMatch(/^\d+ is your Mystonie sign-in code$/);
  const run = await cron(new Date(nextMonday + 10 * 3_600_000).toISOString());
  expect(run.status()).toBe(200);
  expect(await run.json()).toMatchObject({ created: expect.any(Number), pushed: push ? 1 : 0, sent: expect.any(Number) });
  // Running again creates, pushes and sends nothing new.
  expect(await (await cron(new Date(nextMonday + 11 * 3_600_000).toISOString())).json()).toEqual({ created: 0, pushed: 0, reminded: 0, sent: 0 });
  expect((await request.post("/api/cron/weekly-recaps", { data: {} })).status()).toBe(401);

  const mail = await lastEmail(request, email);
  expect(mail.Subject).toMatch(/^Your week on Mystonie \(/);
  expect(mail.Text).toContain("2 hours · 1 finished");
  const recapPath = new URL(mail.Text.match(/Open my recap card: (\S+)/)![1]!).pathname;
  const unsubscribeUrl = new URL(mail.Text.match(/Turn off recap emails: (\S+)/)![1]!);
  expect(recapPath).toMatch(/^\/recap\/[0-9a-f-]{36}$/);

  if (push) {
    // The notification: encrypted for the device, signed with VAPID, opening the same recap card.
    const [delivered] = push.received("ok");
    expect(delivered!.headers).toMatchObject({ "content-encoding": "aes128gcm", ttl: "172800", topic: "weekly-recap" });
    expect(delivered!.headers.authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/);
    const message = await delivered!.message();
    expect(message).toMatchObject({ title: expect.stringMatching(/^Your week is in: /), url: recapPath });
    expect(message.body).toBe("2 hours · 1 finished. Tap to see your recap card.");
    // The push service said the other device is gone, so it was forgotten; the working one stays.
    expect(push.received("gone")).toHaveLength(1);
    expect(await push.stored()).toEqual([push.device("ok").subscription.endpoint]);
    await push.close();
  }

  // The link opens the celebration with the week's card.
  await page.goto(recapPath);
  const celebration = page.getByRole("dialog", { name: /^Your week, / });
  await expect(celebration).toBeVisible();
  await expect(celebration.locator("[data-card]")).toContainText("1 title this week");
  await expect(celebration.getByText("Collage · swipe for another style")).toBeVisible();

  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await celebration.getByRole("button", { name: "Copy card link" }).click({ timeout: 15_000 });
  const save = await saved;
  expect(save.status()).toBe(201);
  const { id, kind } = save.request().postDataJSON() as { id: string; kind: string };
  expect(kind).toBe("weekly_recap");
  await expect(celebration.getByRole("status")).toHaveText("Link copied. Paste it anywhere.");
  await celebration.getByRole("button", { name: "Done" }).click();

  // Back on Home, the week's note links to the same recap.
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("link", { name: "See your recap card" })).toHaveAttribute("href", recapPath);

  // The shared recap card, signed out.
  await context.clearCookies();
  await page.goto(`/c/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^A week of watching, /);

  // The email's unsubscribe link turns recap emails off (after a confirm tap).
  await page.goto(unsubscribeUrl.pathname + unsubscribeUrl.search);
  await expect(page.getByText(/^Stop getting the weekly recap email\?/)).toBeVisible();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("status")).toHaveText(/^Done\. No more weekly recap emails\./);
  // A tampered link is refused.
  const forged = new URL(unsubscribeUrl);
  forged.searchParams.set("list", "waitlist");
  expect((await request.post(`/api/unsubscribe${forged.search}`)).status()).toBe(400);
});
