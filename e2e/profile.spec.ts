import { expect, test, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { LEGAL } from "../src/lib/legal";
import { canSeed, lastEmail, mailpitUp, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack (sign-in via Mailpit, service role key for seeding). Titles are seeded, so TMDB
// isn't needed.
const PARASITE: SeedTitle = { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: null, runtimeMin: 133 };
const DUNE: SeedTitle = { kind: "movie", externalId: "693134", name: "Dune: Part Two", year: 2024, posterPath: null, runtimeMin: 167 };

const service = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { base: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

const saved = (page: Page) => page.waitForResponse((r) => new URL(r.url()).pathname === "/api/account" && r.request().method() === "PATCH");

test("profile settings, export, the public page, reports and privacy", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, [PARASITE, DUNE]);
  await signUp(page, request, "profile", "/settings");
  const main = page.getByRole("main");

  // Reserved and blocked usernames are rejected; a free one is saved with the display name.
  const username = `pro_${Date.now().toString(36)}`;
  await expect(async () => {
    // Retried: a tap before hydration is lost.
    await main.getByLabel("Username").fill("admin");
    await main.getByRole("button", { name: "Save" }).click();
    await expect(main.getByText("That username isn't allowed. Try another one.")).toBeVisible({ timeout: 2000 });
  }).toPass();
  await main.getByLabel("Username").fill("Mystonie_Fan");
  await main.getByRole("button", { name: "Save" }).click();
  await expect(main.getByText("That username isn't allowed. Try another one.")).toBeVisible();
  await main.getByLabel("Display name").fill("Pat Profile");
  await main.getByLabel("Username").fill(username);
  // The bio (ADR 0057): tidied on save, kept to 160 characters and 4 lines.
  await main.getByLabel("Bio").fill("a\nb\nc\nd\ne");
  await main.getByRole("button", { name: "Save" }).click();
  await expect(main.getByText("Keep your bio to 160 characters and 4 lines.")).toBeVisible();
  await main.getByLabel("Bio").fill("  Bong   Joon-ho fan 🎬\n\n\nhttps://example.com  ");
  await expect(main.getByText("46/160")).toBeVisible();
  await main.getByRole("button", { name: "Save" }).click();
  await expect(main.getByText("Saved.")).toBeVisible();

  // Log two titles through the API (as the signed-in user).
  for (const [title, status] of [[PARASITE, "finished"], [DUNE, "watching"]] as const) {
    const res = await page.request.post("/api/entries", {
      data: { id: uuidv7(), title: { source: "tmdb", kind: title.kind, externalId: title.externalId }, status },
    });
    expect(res.ok(), await res.text()).toBe(true);
  }

  // Export: a JSON download with everything.
  const exported = await page.request.get("/api/account/export");
  expect(exported.ok()).toBe(true);
  expect(exported.headers()["content-disposition"]).toMatch(new RegExp(`^attachment; filename="mystonie-${username}-\\d{4}-\\d{2}-\\d{2}\\.json"$`));
  const data = (await exported.json()) as {
    account: { id: string };
    profile: { username: string; display_name: string; bio: string };
    entries: { status: string; title: { name: string } }[];
    episodeLogs: unknown[];
    cards: unknown[];
  };
  expect(data.profile).toMatchObject({ username, display_name: "Pat Profile", bio: "Bong Joon-ho fan 🎬\nhttps://example.com" });
  expect(data.entries.map((e) => `${e.title.name}:${e.status}`).sort()).toEqual(["Dune: Part Two:watching", "Parasite:finished"]);
  expect(data.episodeLogs).toEqual([]);
  expect(data.cards).toEqual([]);
  const userId = data.account.id;

  // A shared card, as POST /api/cards would store it (no PNG: the page re-renders it).
  const { base, headers } = service();
  const cardId = uuidv7();
  const card = await request.post(`${base}/cards`, {
    headers,
    data: {
      id: cardId,
      user_id: userId,
      kind: "sticker",
      template_id: "sticker",
      size: "story",
      params: { kind: "movie", name: "Parasite", year: 2019, finishedOn: "2026-09-20", username },
      shared_at: new Date().toISOString(),
    },
  });
  expect(card.ok(), await card.text()).toBe(true);
  expect((await page.request.get("/api/account/export").then((r) => r.json())).cards).toHaveLength(1);

  // A signed-out visitor sees the public page…
  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto(`/u/${username}`);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("Pat Profile");
  // The bio, as plain text: the address in it is not a link.
  await expect(guest.getByRole("main").getByText("Bong Joon-ho fan 🎬")).toBeVisible();
  await expect(guest.getByRole("link", { name: /example.com/ })).toHaveCount(0);
  await expect(guest.getByRole("region", { name: "Right now" })).toContainText("Dune: Part Two");
  await expect(guest.getByRole("region", { name: "Card gallery" }).getByRole("link", { name: "Card: Parasite" })).toHaveAttribute(
    "href",
    `/c/${cardId}`,
  );

  // …and can report it.
  await guest.getByRole("button", { name: "Report" }).click();
  const sheet = guest.getByRole("dialog", { name: "Report this page" });
  await sheet.getByRole("radio", { name: "Spam" }).check();
  await sheet.getByLabel("Anything else we should know? (optional)").fill("Test report from e2e");
  await sheet.getByRole("button", { name: "Send report" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Thanks. We'll take a look.");
  const reports = await request.get(`${base}/reports?target_id=eq.${userId}&select=reason,note,target_kind`, { headers });
  expect(await reports.json()).toEqual([{ reason: "spam", note: "Test report from e2e", target_kind: "profile" }]);
  expect((await lastEmail(request, LEGAL.contactEmail)).Subject).toMatch(/^Report: (profile|card) \(/);

  // The card page links to the profile and can be reported too.
  await guest.goto(`/c/${cardId}`);
  await expect(guest.getByRole("link", { name: `@${username}` })).toHaveAttribute("href", `/u/${username}`);
  await expect(guest.getByRole("button", { name: "Report" })).toBeVisible();

  // Private: the page only says so, the card link still works but no longer names the profile.
  const privacy = saved(page);
  await main.getByRole("switch", { name: "Public collection" }).click();
  expect((await privacy).ok()).toBe(true);
  await guest.goto(`/u/${username}`);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("This collection is private");
  await expect(guest.getByText("Dune: Part Two")).toHaveCount(0);
  await expect(guest.getByText("Bong Joon-ho fan")).toHaveCount(0);
  await guest.goto(`/c/${cardId}`);
  await expect(guest.getByText(`From @${username}'s collection`)).toBeVisible();
  await expect(guest.getByRole("link", { name: `@${username}` })).toHaveCount(0);
  await visitor.close();

  // The owner sees a note on their own private page.
  await page.goto(`/u/${username}`);
  await expect(page.getByRole("link", { name: "Change it in Settings" })).toBeVisible();
});

test("language and theme apply at once and stick to the account", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)), "local Supabase (Mailpit) is not running");
  await signUp(page, request, "prefs", "/settings");
  const main = page.getByRole("main");

  // Language: the UI switches straight away and the choice is saved. (Retried: a change before hydration is lost.)
  await expect(async () => {
    await main.getByLabel("Language").selectOption("th", { timeout: 2000 });
    await expect(page).toHaveURL(/\/th\/settings$/, { timeout: 3000 });
  }).toPass();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("การตั้งค่า");
  await page.goto("/stats");
  await expect(page).toHaveURL(/\/th\/stats$/); // the saved language wins over the URL

  // Theme: applied at once, and on the next page load (before paint, from the preferences cookie).
  await page.goto("/th/settings");
  await expect(async () => {
    await main.locator("label", { hasText: "มืด" }).click({ timeout: 2000 });
    await expect(main.getByRole("radio", { name: "มืด" })).toBeChecked({ timeout: 2000 });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 3000 });
  }).toPass();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Back to English and the system theme, from the footer switcher this time.
  await expect(async () => {
    await page.getByRole("contentinfo").getByLabel("ภาษา").selectOption("en", { timeout: 2000 });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/settings$/,{ timeout: 3000 });
  }).toPass();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await main.locator("label", { hasText: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");

  // Signing out drops the saved preferences on this device.
  await main.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/th");
  await expect(page).toHaveURL(/\/th$/);
});
