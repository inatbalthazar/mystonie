import { expect, test } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, seedTitles, signUp, type SeedTitle } from "./helpers";

// A lively album, honestly (ADR 0098): Stonie, the labelled mascot, followed by new members and stamping their first
// finish; an invite link that makes two people follow each other; visits counted for the owner. Needs the local
// Supabase stack (Mailpit, service role key); the title is seeded, so TMDB isn't needed.
const ARRIVAL: SeedTitle = { kind: "movie", externalId: "329865", name: "Arrival", year: 2016, posterPath: null, runtimeMin: 116 };
// Headless Chrome says so in its User-Agent, and visits from it don't count: the visitor looks like a phone.
const PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

test("Stonie, invites and visits (ADR 0098)", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  await seedTitles(request, [ARRIVAL]);
  const lia = `lia_${Date.now().toString(36)}`;
  const main = page.getByRole("main");

  // A new member follows Stonie, labelled as the mascot, and is told why.
  await signUp(page, request, "lively-lia", "/home");
  const named = await page.request.patch("/api/account", { data: { username: lia, displayName: "Lia Lively" } });
  expect(named.ok(), await named.text()).toBe(true);
  await page.goto("/people");
  const following = main.getByRole("region", { name: "You follow 1" });
  await expect(following.getByText("Stonie", { exact: true })).toBeVisible();
  await expect(following.getByText("Mascot", { exact: true })).toBeVisible();
  await expect(main.getByText("New members follow Stonie and the team to start. Unfollow them any time.")).toBeVisible();

  // Stonie stamps the first finish, and says so in the activity.
  const logged = await page.request.post("/api/entries", {
    data: { id: uuidv7(), title: { source: "tmdb", kind: ARRIVAL.kind, externalId: ARRIVAL.externalId }, status: "finished" },
  });
  expect(logged.ok(), await logged.text()).toBe(true);
  await page.goto("/feed");
  await expect(main.getByText("stamped your very first finish,")).toBeVisible();
  await expect(main.getByRole("region", { name: "Lately" }).getByText("Mascot", { exact: true })).toBeVisible();

  // Stonie's page: the label, and no way to be mistaken for a person.
  await page.goto("/u/stonie");
  await expect(main.getByRole("heading", { level: 1 })).toContainText("Stonie");
  await expect(main.getByRole("heading", { level: 1 }).getByText("Mascot")).toBeVisible();
  await expect(main.getByText("Mystonie's mascot, not a person.", { exact: false })).toBeVisible();

  // Lia's invite link, for Bo (signed out, on a phone).
  await page.goto("/people");
  await expect(main.getByRole("button", { name: "Share my invite link" })).toBeVisible();
  const bo = await browser.newContext({ userAgent: PHONE });
  const boPage = await bo.newPage();
  await boPage.goto(`/join/${lia}`);
  await expect(boPage.getByRole("heading", { name: "Lia Lively invited you to Mystonie" })).toBeVisible();
  await expect(boPage.getByRole("main").getByRole("link", { name: "Start your collection, free" })).toBeVisible();

  // Bo signs up: the invite is accepted, and the two follow each other.
  const accepted = boPage.waitForResponse((r) => new URL(r.url()).pathname === "/api/invites");
  await signUp(boPage, request, "lively-bo");
  expect((await accepted).ok()).toBe(true);
  await expect(boPage.getByRole("status").filter({ hasText: "follow each other now" })).toContainText("Lia Lively");
  await boPage.goto("/people");
  await expect(boPage.getByRole("heading", { name: "You follow 2" })).toBeVisible();

  // Bo visits Lia's album: one visitor this week, which only Lia sees.
  const counted = boPage.waitForResponse((r) => new URL(r.url()).pathname === "/api/views");
  await boPage.goto(`/u/${lia}`);
  expect((await counted).ok()).toBe(true);
  await bo.close();

  await page.goto("/feed");
  await expect(main.getByText("joined Mystonie from your invite")).toBeVisible();
  await page.goto("/me");
  await expect(main.getByText("1 visitor this week")).toBeVisible();
});
