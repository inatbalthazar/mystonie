import { expect, test, type Page } from "@playwright/test";
import { canSeed, mailpitUp, mockSearch, seedTitles, signUp, type SeedTitle } from "./helpers";

// Needs the local Supabase stack (sign-in via Mailpit, Storage for the PNG). TMDB isn't needed for the flow:
// the title is seeded and search is mocked (the poster itself loads from TMDB's image CDN when reachable).
const TITLE: SeedTitle = { kind: "movie", externalId: "496243", name: "Parasite", year: 2019, posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", runtimeMin: 133 };

type Tracked = [string, Record<string, unknown>][];
const events = (page: Page) => page.evaluate(() => (window as unknown as { __mystonieEvents?: Tracked }).__mystonieEvents ?? []);

test("finish → celebration → publish the card → /c/[id] with its preview", async ({ page, request, context }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  // Desktop path: no file sharing, so Share becomes "Copy card link" (the phone share sheet can't be automated).
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true }));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seedTitles(request, [TITLE]);
  await mockSearch(page, [TITLE]);
  await signUp(page, request, "share");

  // Quick add → Finished: the celebration opens at once, with the card and Skip.
  await expect(async () => {
    await page.getByRole("button", { name: "Add a title" }).click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole("dialog").getByLabel("Search movies and series").fill("Parasite");
  await page.getByRole("dialog").getByRole("button", { name: /^Parasite Movie/ }).first().click();
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  const celebration = page.getByRole("dialog", { name: "You finished Parasite!" });
  await expect(celebration).toBeVisible();
  await expect(celebration.locator("[data-card]")).toContainText("Parasite");
  await expect(celebration.getByRole("button", { name: "Skip" })).toBeVisible();

  // Optional notes show on the card straight away.
  await celebration.getByRole("button", { name: "4 stars" }).click();
  await celebration.getByLabel("One-line review").fill("That staircase.");
  await expect(celebration.locator("[data-card]")).toContainText("That staircase.");
  // Hide the username: the server must not print it either.
  await celebration.getByRole("button", { name: /^@share/ }).click();

  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  const uploaded = page.waitForResponse((r) => r.url().includes("/storage/v1/object/upload/sign/cards/"));
  await celebration.getByRole("button", { name: "Copy card link" }).click({ timeout: 15_000 });
  const save = await saved;
  expect(save.status()).toBe(201);
  expect((await uploaded).ok()).toBe(true);
  const { id, templateId } = save.request().postDataJSON() as { id: string; templateId: string };
  await expect(celebration.getByRole("status")).toHaveText("Link copied. Paste it anywhere.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/c/${id}\\?ref=card&tpl=${templateId}$`));
  expect((await events(page)).map(([e]) => e)).toEqual(expect.arrayContaining(["card_created", "card_shared"]));

  // Done saves the rating and review on the entry.
  const notes = page.waitForResponse((r) => new URL(r.url()).pathname.startsWith("/api/entries/") && r.request().method() === "PATCH");
  await celebration.getByRole("button", { name: "Done" }).click();
  expect((await notes).ok()).toBe(true);

  // The Sticker, from "Make a card" on the finished entry: a download, no publish.
  await page.getByRole("button", { name: "Edit Parasite" }).click();
  await page.getByRole("button", { name: "Make a card" }).click();
  const again = page.getByRole("dialog", { name: "You finished Parasite!" });
  await expect(again.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");
  await again.getByRole("button", { name: "Sticker" }).click();
  await expect(again.getByText("Transparent background: put it on your own photo.")).toBeVisible();
  const download = page.waitForEvent("download");
  await again.getByRole("button", { name: "Download" }).click({ timeout: 15_000 });
  expect((await download).suggestedFilename()).toBe("mystonie-parasite-sticker.png");
  expect(await events(page)).toContainEqual(["card_downloaded", expect.objectContaining({ tpl: "sticker", card: "sticker" })]);
  await again.getByRole("button", { name: "Done" }).click();

  // The public page, signed out: the card, its line and the CTA. No username (hidden).
  await context.clearCookies();
  await page.goto(`/c/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Finished Parasite");
  await expect(page.getByText("From a Mystonie collection")).toBeVisible();
  await expect(page.getByRole("img", { name: "Card: Finished Parasite" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Make your own card" })).toHaveAttribute("href", `/?ref=card&tpl=${templateId}`);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  const og = await request.get(new URL(ogImage!).pathname + new URL(ogImage!).search);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toBe("image/png");

  // Unknown or unshared ids are a 404.
  expect((await page.goto("/c/01926000-0000-7000-8000-000000000000"))?.status()).toBe(404);
});
