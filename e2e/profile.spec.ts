import { expect, test, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { LEGAL } from "../src/lib/legal";
import { canSeed, lastEmail, mailpitUp, mockSearch, openQuickAdd, seedTitles, signUp, type SeedTitle } from "./helpers";

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
  // No card gallery on an album (ADR 0076): the cards are on the owner's Cards tab, each shared one at its own link.
  await expect(guest.getByRole("link", { name: "Card: Parasite" })).toHaveCount(0);
  const own = await page.context().newPage();
  await own.goto("/me/cards");
  await expect(own.getByRole("link", { name: "Cards", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(own.getByRole("region", { name: "Your cards" }).getByRole("link", { name: "Card: Parasite" })).toHaveAttribute(
    "href",
    `/c/${cardId}`,
  );
  // Cards is one of Me's tabs: the logo stays, no back button (ADR 0081)...
  await expect(own.getByRole("banner").getByRole("link", { name: "Mystonie home" })).toBeVisible();
  await expect(own.getByRole("banner").getByRole("link", { name: /^Back/ })).toHaveCount(0);
  // ...and another tab changes only the page under the cover: the cover is the very same one (Me's layout).
  await own.waitForLoadState("networkidle");
  await own.locator("body > main > header").evaluate((cover) => ((window as unknown as { cover?: Element }).cover = cover));
  await own.getByRole("link", { name: "Stats", exact: true }).click();
  await expect(own).toHaveURL(/\/stats$/);
  await expect(own.getByRole("link", { name: "Stats", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await own.locator("body > main > header").evaluate((cover) => cover === (window as unknown as { cover?: Element }).cover)).toBe(true);
  await own.close();

  // …and can report it.
  await guest.getByRole("button", { name: "Report" }).click();
  const sheet = guest.getByRole("dialog", { name: "Report this page" });
  await sheet.getByRole("radio", { name: "Spam" }).check();
  await sheet.getByLabel("Anything else we should know? (optional)").fill("Test report from e2e");
  await sheet.getByRole("button", { name: "Send report" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Thanks. We'll take a look.");
  const reports = await request.get(`${base}/reports?target_id=eq.${userId}&select=reason,note,target_kind`, { headers });
  expect(await reports.json()).toEqual([{ reason: "spam", note: "Test report from e2e", target_kind: "profile" }]);
  expect((await lastEmail(request, LEGAL.teamInbox)).Subject).toMatch(/^Report: (profile|card) \(/);

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
  // Still signed in after the switch: the nav island, no "Sign in" (a client-side switch used to lose both).
  await expect(page.locator("html")).toHaveAttribute("data-auth", "");
  await expect(page.locator("[data-nav-island]")).toBeVisible();
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

  // Signed in, the footer is an app's: only the data credits, no language menu or legal links (ADR 0065).
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: /RAWG/ })).toBeVisible();
  await expect(footer.getByLabel("ภาษา")).toBeHidden();
  await expect(footer.getByRole("link", { name: "ความเป็นส่วนตัว" })).toBeHidden();

  // Back to English and the system theme.
  await expect(async () => {
    await main.getByLabel("ภาษา").selectOption("en", { timeout: 2000 });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/settings$/,{ timeout: 3000 });
  }).toPass();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await main.locator("label", { hasText: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");

  // The legal pages and the data credits live in Settings → About instead.
  const about = main.getByRole("navigation", { name: "About Mystonie" });
  await expect(about.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  await expect(about.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  await expect(main.getByRole("link", { name: /not endorsed or certified by TMDB/ })).toBeVisible();

  // Signing out drops the saved preferences on this device.
  await main.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/th");
  await expect(page).toHaveURL(/\/th$/);
});

test("a profile photo: picked, framed and uploaded, shown on the profile and on cards, then removed (ADR 0064, ADR 0068)", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await signUp(page, request, "photo", "/settings");

  // Only real images go in, from signed-in people.
  const svg = await page.request.post("/api/account/avatar", { data: "<svg xmlns='http://www.w3.org/2000/svg'/>", headers: { "Content-Type": "image/png" } });
  expect(svg.status()).toBe(400);
  expect((await request.post("/api/account/avatar", { data: "x" })).status()).toBe(401);

  // A landscape picture made in the page (left half coral, right half blue).
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#e8553f";
    ctx.fillRect(0, 0, 450, 600);
    ctx.fillStyle = "#2560c4";
    ctx.fillRect(450, 0, 450, 600);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  const main = page.getByRole("main");
  const chooser = page.waitForEvent("filechooser");
  await main.getByRole("button", { name: "Add photo" }).click();
  await (await chooser).setFiles({ name: "me.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });

  const sheet = page.getByRole("dialog", { name: "Your photo" });
  const frame = sheet.getByRole("img", { name: "Your photo, framed for your profile" });
  await expect(frame).toBeVisible();
  await sheet.getByRole("slider", { name: "Zoom" }).fill("2");
  // Drag the picture right, so its coral half fills the frame.
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const upload = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/account/avatar" && r.request().method() === "POST");
  await sheet.getByRole("button", { name: "Use this photo" }).click();
  const uploaded = await upload;
  expect(uploaded.status()).toBe(200);
  expect(uploaded.request().headers()["content-type"]).toMatch(/^image\/(webp|jpeg)$/);
  const { avatarUrl } = (await uploaded.json()) as { avatarUrl: string };
  expect(avatarUrl).toMatch(/\/storage\/v1\/object\/public\/avatars\/[0-9a-f-]+\/[0-9a-f-]+\.(webp|jpg)$/);
  await expect(sheet).toHaveCount(0);

  // The stored photo is a 320 px square of the coral half.
  const photo = main.getByRole("img", { name: "Your profile photo" });
  await expect(photo).toHaveAttribute("src", avatarUrl);
  const pixel = await page.evaluate(async (src) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return { width: img.naturalWidth, height: img.naturalHeight, rgb: [...ctx.getImageData(160, 160, 1, 1).data.slice(0, 3)] };
  }, avatarUrl);
  expect(pixel).toMatchObject({ width: 320, height: 320 });
  expect(pixel.rgb[0]).toBeGreaterThan(200);
  expect(pixel.rgb[2]).toBeLessThan(100);

  // Changing it replaces the file; the profile page shows the new one.
  const exported = await page.request.get("/api/account/export");
  const username = ((await exported.json()) as { profile: { username: string } }).profile.username;
  await page.goto(`/u/${username}`);
  await expect(page.getByRole("main").locator(`img[src="${avatarUrl}"]`)).toBeVisible();

  // On a card (ADR 0068): a circle before @username, one tap to hide, and the server stamps it on the saved card.
  await seedTitles(request, [PARASITE]);
  await mockSearch(page, [PARASITE]);
  await openQuickAdd(page);
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill("Parasite");
  await page.getByRole("dialog").getByRole("button", { name: /^Parasite Movie/ }).first().click();
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  const celebration = page.getByRole("dialog", { name: "You finished Parasite!" });
  const cardPhoto = celebration.locator(`[data-card] img[src="${avatarUrl}"]`);
  await expect(cardPhoto).toBeVisible();
  await expect.poll(() => cardPhoto.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(320);
  const hidePhoto = celebration.getByRole("button", { name: "Photo", exact: true });
  await hidePhoto.click();
  await expect(cardPhoto).toHaveCount(0);
  await hidePhoto.click();
  await expect(cardPhoto).toBeVisible();
  const savedCard = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await celebration.getByRole("button", { name: "Download" }).click({ timeout: 15_000 });
  const cardSave = await savedCard;
  expect(cardSave.status()).toBe(201);
  expect(cardSave.request().postDataJSON().data).not.toHaveProperty("avatarUrl");
  const { id: cardId } = cardSave.request().postDataJSON() as { id: string };
  const { base, headers } = service();
  const stored = (await (await request.get(`${base}/cards?id=eq.${cardId}&select=params`, { headers })).json()) as { params: { avatarUrl: string | null } }[];
  expect(stored[0]?.params.avatarUrl).toBe(avatarUrl);
  await celebration.getByRole("button", { name: "Done" }).click();

  // Removing it goes back to the initial and deletes the file.
  await page.goto("/settings");
  await main.getByRole("button", { name: "Remove photo" }).click();
  await expect(main.getByRole("img", { name: "Your profile photo" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Add photo" })).toBeVisible();
  await expect.poll(async () => (await request.get(avatarUrl)).status()).toBeGreaterThanOrEqual(400);
});

test("the album as its owner arranges it: favourites on the shelf, sections moved and hidden (ADR 0069)", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  const films: SeedTitle[] = ["Alpha", "Bravo", "Charlie"].map((name, i) => ({
    kind: "movie",
    externalId: `990690${i}`,
    name: `${name} Album Film`,
    year: 2020 + i,
    posterPath: null,
    runtimeMin: 100,
  }));
  await seedTitles(request, films);
  await signUp(page, request, "arrange", "/me");
  const username = `arr_${Date.now().toString(36)}`;
  expect((await page.request.patch("/api/account", { data: { username } })).ok()).toBe(true);
  // Finished one after another: the shelf shows Charlie, Bravo, Alpha.
  for (const film of films) {
    const res = await page.request.post("/api/entries", {
      data: { id: uuidv7(), title: { source: "tmdb", kind: "movie", externalId: film.externalId }, status: "finished" },
    });
    expect(res.ok(), await res.text()).toBe(true);
  }
  await page.reload();
  const main = page.getByRole("main");
  const headings = (p: Page) => p.getByRole("main").getByRole("heading", { level: 2 });
  const shelf = (p: Page) => p.getByRole("region", { name: "The shelf" }).getByRole("listitem");

  // The default order (nothing being watched, so no "Right now"); no card gallery (ADR 0076).
  await expect(headings(page)).toHaveText(["All time so far", "The shelf", "Clubs"]);
  await expect(shelf(page).first()).toHaveAttribute("title", "Charlie Album Film");

  // Pin the oldest finish as a favourite: it stands first, with a star.
  await expect(async () => {
    // Retried: a tap before hydration is lost.
    await main.getByRole("button", { name: "Pick favourites" }).click();
    await expect(page.getByRole("dialog", { name: "Favourites on your shelf" })).toBeVisible({ timeout: 2000 });
  }).toPass();
  const favourites = page.getByRole("dialog", { name: "Favourites on your shelf" });
  await favourites.getByRole("button", { name: "Alpha Album Film" }).click();
  await expect(favourites.getByRole("button", { name: "Alpha Album Film" })).toHaveAttribute("aria-pressed", "true");
  const pinSaved = saved(page);
  await favourites.getByRole("button", { name: "Save" }).click();
  expect((await pinSaved).request().postDataJSON()).toEqual({ shelfPins: [expect.any(String)] });
  await expect(favourites).toBeHidden();
  await expect(shelf(page).first()).toHaveAttribute("title", "Alpha Album Film");
  await expect(shelf(page).first()).toContainText("Favourite");
  await expect(page.getByRole("region", { name: "The shelf" })).toContainText("Favourites first, then newest.");

  // Arrange: the shelf to the top with its arrows, Clubs hidden.
  await main.getByRole("button", { name: "Arrange" }).click();
  const arrange = page.getByRole("dialog", { name: "Arrange your album" });
  await arrange.getByRole("button", { name: "Move The shelf up" }).click();
  await arrange.getByRole("button", { name: "Hide Clubs" }).click();
  await expect(arrange.getByRole("button", { name: "Show Clubs" })).toBeVisible();
  const layoutSaved = saved(page);
  await arrange.getByRole("button", { name: "Save", exact: true }).click();
  expect((await layoutSaved).request().postDataJSON()).toEqual({
    albumOrder: ["shelf", "watching", "stickers", "atlas", "patches", "clubs"],
    albumHidden: ["clubs"],
  });
  await expect(arrange).toBeHidden();
  await expect(headings(page)).toHaveText(["All time so far", "The shelf"]);

  // Dragging a row by its handle moves it; closing without saving keeps the saved order.
  await main.getByRole("button", { name: "Arrange" }).click();
  const rows = arrange.getByRole("listitem");
  await expect(rows.first()).toContainText("The shelf");
  const handle = (await arrange.getByRole("button", { name: /^Move Right now \(drag/ }).boundingBox())!;
  const step = (await rows.first().boundingBox())!.height + 8;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - (step * i) / 5);
  await page.mouse.up();
  await expect(rows.first()).toContainText("Right now");
  await page.keyboard.press("Escape");
  await expect(arrange).toBeHidden();
  await main.getByRole("button", { name: "Arrange" }).click();
  await expect(rows.first()).toContainText("The shelf");
  await page.keyboard.press("Escape");

  // Visitors get the album as arranged.
  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto(`/u/${username}`);
  await expect(headings(guest)).toHaveText(["All time so far", "The shelf"]);
  await expect(shelf(guest).first()).toHaveAttribute("title", "Alpha Album Film");
  await visitor.close();
});

test("a profile's Stats tab: visitors see the stats minus the parts its owner hides, and what they both finished (ADR 0077)", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  const films: SeedTitle[] = ["Echo", "Foxtrot"].map((name, i) => ({
    kind: "movie",
    externalId: `990695${i}`,
    name: `${name} Stats Film`,
    year: 2021 + i,
    posterPath: null,
    runtimeMin: 110,
  }));
  await seedTitles(request, films);
  const finish = async (p: Page, film: SeedTitle) => {
    const res = await p.request.post("/api/entries", {
      data: { id: uuidv7(), title: { source: "tmdb", kind: "movie", externalId: film.externalId }, status: "finished" },
    });
    expect(res.ok(), await res.text()).toBe(true);
  };
  await signUp(page, request, "pubstats", "/stats");
  const username = `pst_${Date.now().toString(36)}`;
  expect((await page.request.patch("/api/account", { data: { username } })).ok()).toBe(true);
  for (const film of films) await finish(page, film);
  await page.reload();
  const headings = (p: Page) => p.getByRole("main").getByRole("heading", { level: 2 });

  // Me's Stats: every part has an eye; hiding Activity keeps it on Me, marked "Only you".
  await expect(page.getByRole("main")).not.toContainText("Visitors see these stats on your profile.");
  const activitySaved = saved(page);
  await expect(async () => {
    // Retried: a tap before hydration is lost.
    await page.getByRole("button", { name: "Hide Activity from your profile" }).click();
    await expect(page.getByRole("button", { name: "Show Activity on your profile" })).toBeVisible({ timeout: 2000 });
  }).toPass();
  expect((await activitySaved).request().postDataJSON()).toEqual({ statsHidden: ["activity"] });
  await expect(page.getByRole("button", { name: "Show Activity on your profile" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Show Activity on your profile" })).toContainText("Only you");
  await page.reload();
  await expect(headings(page)).toContainText(["Activity", "Per month", "Taste", "Records"]);
  await expect(page.getByRole("button", { name: "Show Activity on your profile" })).toBeVisible();

  // A guest: the album has Album · Stats tabs; the Stats tab has no Activity and nothing "in common".
  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  await guest.goto(`/u/${username}`);
  const tabs = guest.getByRole("navigation", { name: `@${username}'s album and stats` });
  await expect(tabs.getByRole("link", { name: "Album" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Stats" }).click();
  await expect(guest).toHaveURL(new RegExp(`/u/${username}/stats$`));
  await expect(tabs.getByRole("link", { name: "Stats" })).toHaveAttribute("aria-current", "page");
  await expect(guest.getByRole("main")).toContainText("This month");
  await expect(headings(guest)).toHaveText(["Per month", "Taste", "Records"]);
  await expect(guest.getByRole("button", { name: /from your profile/ })).toHaveCount(0);
  // Another period stays on their page.
  await guest.getByRole("link", { name: "All time" }).click();
  await expect(guest).toHaveURL((url) => url.pathname === `/u/${username}/stats` && url.search === "?period=all");
  await visitor.close();

  // Someone signed in who finished one of the same films sees it in common.
  const friendContext = await browser.newContext();
  const friend = await friendContext.newPage();
  await signUp(friend, request, "pubstats-friend", "/home");
  await finish(friend, films[1]);
  await friend.goto(`/u/${username}/stats`);
  const common = friend.getByRole("region", { name: "In common" });
  await expect(common).toContainText("You've both finished 1 title.");
  await expect(common.getByRole("listitem")).toHaveText(["Foxtrot Stats Film"]);
  await friendContext.close();

  // Every part hidden: no Stats tab on the album, and the Stats page says so.
  expect(
    (
      await page.request.patch("/api/account", {
        data: { statsHidden: ["numbers", "activity", "months", "taste", "favourites", "records", "milestones"] },
      })
    ).ok(),
  ).toBe(true);
  const later = await browser.newContext();
  const guest2 = await later.newPage();
  await guest2.goto(`/u/${username}`);
  await expect(guest2.getByRole("heading", { name: "The shelf" })).toBeVisible();
  await expect(guest2.getByRole("navigation", { name: `@${username}'s album and stats` })).toHaveCount(0);
  await guest2.goto(`/u/${username}/stats`);
  await expect(guest2.getByRole("main")).toContainText(`@${username} keeps their stats to themselves.`);
  await later.close();
});
