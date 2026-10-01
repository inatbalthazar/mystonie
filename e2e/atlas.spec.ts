import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, navIsland, seedTitles, signUp, type SeedTitle } from "./helpers";

// The Atlas (stage 4, ADR 0059): Me's third tab. Needs the local Supabase stack (Mailpit and the service role key):
// the stories' countries come from seeded `titles.raw`, so nothing calls TMDB.

const rest = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

/** The signed-in user's id, from the session cookie (Supabase SSR: `base64-` JSON, maybe in chunks). */
async function signedInId(page: Page): Promise<string> {
  const parts = (await page.context().cookies())
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const session = JSON.parse(
    Buffer.from(
      parts
        .map((c) => c.value)
        .join("")
        .replace(/^base64-/, ""),
      "base64url",
    ).toString(),
  ) as { access_token: string };
  return (JSON.parse(Buffer.from(session.access_token.split(".")[1]!, "base64url").toString()) as { sub: string }).sub;
}

/** Seeds a title with the catalog body that says where it's from, and puts it in the user's collection. */
async function story(request: APIRequestContext, userId: string, title: SeedTitle, raw: object, status: "finished" | "watching" | "want") {
  await seedTitles(request, [title]);
  const { url, headers } = rest();
  const where = `source=eq.tmdb&kind=eq.${title.kind}&external_id=eq.${title.externalId}`;
  const patch = await request.patch(`${url}/titles?${where}`, { headers, data: { raw } });
  expect(patch.ok(), await patch.text()).toBe(true);
  const id = ((await (await request.get(`${url}/titles?select=id&${where}`, { headers })).json()) as { id: string }[])[0]!.id;
  const entry = await request.post(`${url}/entries`, {
    headers,
    data: { id: uuidv7(), user_id: userId, title_id: id, status, finished_at: status === "finished" ? new Date().toISOString() : null },
  });
  expect(entry.ok(), await entry.text()).toBe(true);
}

test("the Atlas: add countries by map and search, change and remove them, see the stories' countries, show it on the profile", async ({
  page,
  request,
}) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 780 });
  await signUp(page, request, "atlas", "/collection");
  const userId = await signedInId(page);

  const base = 974_000_000 + (Date.now() % 1_000_000) * 3;
  const film = (n: number, name: string, kind: SeedTitle["kind"] = "movie"): SeedTitle => ({
    kind,
    externalId: String(base + n),
    name,
    year: 2024,
    posterPath: null,
    runtimeMin: 100,
  });
  await story(request, userId, film(0, "Seoul Night"), { origin_country: ["KR"] }, "finished");
  await story(request, userId, film(1, "Busan Run"), { origin_country: ["KR"] }, "watching");
  await story(
    request,
    userId,
    film(2, "Paris Rain"),
    { origin_country: [], production_countries: [{ iso_3166_1: "FR", name: "France" }] },
    "finished",
  );
  await story(request, userId, film(3, "Tokyo Later", "series"), { origin_country: ["JP"] }, "want");

  // Collection → Atlas: the fourth tab after Watch · Read · Play, with Collection still lit in the island. Its other
  // tabs lead back to the collection on that tab.
  await page.goto("/collection");
  const tabs = page.getByRole("group", { name: "Collection tabs" });
  await tabs.getByRole("link", { name: "Atlas" }).click();
  await expect(page).toHaveURL(/\/collection\/atlas$/);
  await expect(tabs.getByRole("link", { name: "Atlas" })).toHaveAttribute("aria-current", "page");
  await expect(navIsland(page).getByRole("link", { name: "Collection", exact: true })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Read" }).click();
  await expect(page).toHaveURL(/\/collection\?shelf=read$/);
  await expect(tabs.getByRole("button", { name: "Read" })).toHaveAttribute("aria-pressed", "true");
  await tabs.getByRole("link", { name: "Atlas" }).click();
  await expect(page).toHaveURL(/\/collection\/atlas$/);
  const map = page.getByRole("img", { name: /World map with no countries you've been to/ });
  await expect(map).toBeVisible();
  await expect(page.getByText("Where have you been? Tap a country to start your Atlas.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share my Atlas" })).toBeDisabled();

  // Search in English (or the code), pick, mark it: saved at once.
  const search = page.getByRole("combobox", { name: "Find a country" });
  await search.fill("jap");
  await page.getByRole("option", { name: "Japan" }).click();
  const sheet = page.getByRole("dialog", { name: "Japan" });
  await expect(sheet.getByText("Asia", { exact: true })).toBeVisible();
  // A Want-to-watch series doesn't count as a story.
  await expect(sheet.getByText("Nothing from here in your collection yet.")).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/places") && r.ok());
  await sheet.getByRole("radio", { name: "Been there" }).click();
  await saved;
  await expect(sheet.getByRole("radio", { name: "Been there" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByLabel("First visit").selectOption("2019");
  await sheet.getByRole("button", { name: "Close" }).click();

  // Tap a country on the map (France), mark it Lived there; then one to want to go.
  await page.locator('svg [data-code="FR"]').first().click({ force: true });
  await page.getByRole("dialog", { name: "France" }).getByRole("radio", { name: "Lived there" }).click();
  await expect(page.getByRole("dialog", { name: "France" }).getByText("1 story from France in your collection.")).toBeVisible();
  await page.getByRole("dialog", { name: "France" }).getByRole("button", { name: "Close" }).click();
  await search.fill("PE");
  await search.press("Enter");
  await page.getByRole("dialog", { name: "Peru" }).getByRole("radio", { name: "Want to go" }).click();
  await page.getByRole("dialog", { name: "Peru" }).getByRole("button", { name: "Close" }).click();

  await expect(page.getByRole("img", { name: /World map with 2 countries you've been to/ })).toBeVisible();
  await expect(page.locator('svg [data-code="JP"]').first()).toHaveAttribute("data-tone", "been");
  await expect(page.locator('svg [data-code="FR"]').first()).toHaveAttribute("data-tone", "lived");
  await expect(page.locator('svg [data-code="PE"]').first()).toHaveAttribute("data-tone", "want");
  await expect(page.getByRole("heading", { name: "Been there · 2" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Want to go · 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Japan 2019" })).toBeVisible();
  await expect(page.getByText("Been there, watched that: stories from 1 of your 2 countries.")).toBeVisible();

  // It's all saved: a reload shows the same.
  await page.reload();
  await expect(page.getByRole("button", { name: "Japan 2019" })).toBeVisible();
  await expect(page.getByRole("button", { name: "France lived" })).toBeVisible();

  // Take Peru off.
  await page.getByRole("button", { name: "Peru" }).click();
  const off = page.waitForResponse((r) => r.url().endsWith("/api/places") && r.ok());
  await page.getByRole("dialog", { name: "Peru" }).getByRole("button", { name: "Take it off my Atlas" }).click();
  await off;
  await expect(page.getByRole("heading", { name: /Want to go/ })).toHaveCount(0);

  // The Stories layer: Korea (2 stories) and France, not Japan (only wanted).
  await page.getByRole("button", { name: "Stories" }).click();
  await expect(page.getByRole("heading", { name: "2 countries in your stories" })).toBeVisible();
  await expect(page.getByRole("button", { name: /South Korea\s*2 stories/ })).toBeVisible();
  await expect(page.locator('svg [data-code="KR"]').first()).toHaveAttribute("data-tone", "2");
  await expect(page.locator('svg [data-code="JP"]').first()).not.toHaveAttribute("data-tone");
  await page.getByRole("button", { name: /South Korea/ }).click();
  await expect(page.getByRole("dialog", { name: "South Korea" }).getByRole("link", { name: "Seoul Night" })).toHaveAttribute(
    "href",
    `/title/movie/${base}`,
  );
  await page.getByRole("dialog", { name: "South Korea" }).getByRole("button", { name: "Close" }).click();

  // Zoom to Europe.
  await page.getByRole("button", { name: "Europe" }).click();
  await expect(page.getByRole("button", { name: "Europe" })).toHaveAttribute("aria-pressed", "true");

  // Nobody else sees it until the profile is public and the Atlas shown.
  const { url, headers } = rest();
  const profile = ((await (await request.get(`${url}/profiles?select=username&id=eq.${userId}`, { headers })).json()) as { username: string }[])[0]!;
  await request.patch(`${url}/profiles?id=eq.${userId}`, { headers, data: { visibility: "public" } });
  const visitor = await page.context().browser()!.newPage();
  await visitor.goto(`/u/${profile.username}`);
  await expect(visitor.getByRole("heading", { name: "Atlas", exact: true })).toHaveCount(0);

  await page.reload();
  const shown = page.waitForResponse((r) => r.url().endsWith("/api/account") && r.ok());
  await page.getByRole("switch", { name: "Show my Atlas on my profile" }).click();
  await shown;
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: "Atlas", exact: true })).toBeVisible();
  await expect(visitor.getByText("2 countries · 2 continents")).toBeVisible();
  await expect(visitor.getByRole("img", { name: /World map with 2 countries you've been to/ })).toBeVisible();
  await visitor.close();

  // Share my Atlas: the card, saved as the user's own countries.
  await page.getByRole("button", { name: "Share my Atlas" }).click();
  const celebration = page.getByRole("dialog").filter({ hasText: "2 countries on your Atlas" });
  await expect(celebration).toBeVisible();
  await expect(celebration.getByRole("img", { name: "My Atlas" }).first()).toBeVisible();

  // The server keeps an Atlas card to the countries really on the Atlas.
  const saveCard = (countries: string[]) =>
    page.evaluate(
      async ({ id, countries }) => {
        const data = { kind: "movie", name: "Atlas", posterUrl: null, finishedOn: "2026-10-01", atlas: { countries, stories: 2 } };
        const res = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, kind: "atlas", templateId: "atlas", size: "story", data, share: false }),
        });
        return res.status;
      },
      { id: uuidv7(), countries },
    );
  expect(await saveCard(["FR", "JP", "PE"])).toBe(404);
  expect(await saveCard(["FR", "JP"])).toBe(201);
});

test("the Atlas refuses a bad country and needs an account", async ({ request }) => {
  expect((await request.post("/api/places", { data: { country: "ZZ", status: "been" } })).status()).toBe(400);
  expect((await request.post("/api/places", { data: { country: "JP", status: "been" } })).status()).toBe(401);
});

test("a country's regions: mark them on its map or in its list, undo, share them, and clear them with the country", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 780 });
  await signUp(page, request, "regions", "/collection/atlas");

  // From a country's sheet to its page: Japan isn't on the Atlas yet.
  await page.getByRole("combobox", { name: "Find a country" }).fill("japan");
  await page.getByRole("option", { name: "Japan" }).click();
  await page
    .getByRole("dialog", { name: "Japan" })
    .getByRole("link", { name: /Prefectures\s*0 of 47/ })
    .click();
  await expect(page).toHaveURL(/\/collection\/atlas\/jp$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Japan");
  await expect(navIsland(page).getByRole("link", { name: "Collection", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Mark one and Japan goes on your Atlas as Been there.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share my Japan" })).toBeDisabled();

  // The list: search, mark one (the country goes on the Atlas), undo, mark again.
  const saved = () => page.waitForResponse((r) => r.url().endsWith("/api/places/regions") && r.ok());
  await page.getByRole("searchbox", { name: "Find a prefecture" }).fill("kyo");
  await expect(page.getByRole("button", { name: "Kyoto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hokkaido" })).toHaveCount(0);
  let done = saved();
  await page.getByRole("button", { name: "Kyoto" }).click();
  await done;
  await expect(page.getByRole("button", { name: "Kyoto" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Marked Kyoto")).toBeVisible();
  await expect(page.getByText("1/47")).toBeVisible();
  done = saved();
  await page.getByRole("button", { name: "Undo" }).click();
  await done;
  await expect(page.getByText("Took Kyoto off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kyoto" })).toHaveAttribute("aria-pressed", "false");
  done = saved();
  await page.getByRole("button", { name: "Kyoto" }).click();
  await done;

  // The map: a tap marks a prefecture (Hokkaido, the biggest), and the zoom button zooms in.
  await page.getByRole("searchbox", { name: "Find a prefecture" }).fill("");
  const hokkaido = page.locator('svg [data-region="JP-01"]');
  await hokkaido.scrollIntoViewIfNeeded();
  done = saved();
  await hokkaido.click();
  await done;
  await expect(hokkaido).toHaveAttribute("data-marked", "true");
  await expect(page.getByRole("button", { name: "Hokkaido" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "true");

  // Saved: after a reload, and on the Atlas (Japan as Been there, with its count).
  await page.reload();
  await expect(page.getByText("2/47")).toBeVisible();
  await expect(page.getByRole("img", { name: "Map of Japan: 2 of 47 prefectures you've been to" })).toBeVisible();

  // Share my Japan: the country's card, which the server keeps to the regions really marked.
  await page.getByRole("button", { name: "Share my Japan" }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "2 of 47 prefectures in Japan" })).toBeVisible();
  await page.keyboard.press("Escape");
  const saveCard = (ids: string[]) =>
    page.evaluate(
      async ({ id, ids }) => {
        const regions = { country: "JP", kind: "prefecture", total: 47, ids };
        const data = { kind: "movie", name: "Japan", posterUrl: null, finishedOn: "2026-10-01", atlas: { countries: ["JP"], stories: 0, regions } };
        const res = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, kind: "atlas", templateId: "atlas", size: "story", data, share: false }),
        });
        return res.status;
      },
      { id: uuidv7(), ids },
    );
  expect(await saveCard(["JP-01", "JP-13"])).toBe(404);
  expect(await saveCard(["JP-01", "JP-26"])).toBe(201);

  await page.getByRole("banner").getByRole("link", { name: "Back to Atlas" }).click();
  await expect(page).toHaveURL(/\/collection\/atlas$/);
  await expect(page.getByRole("button", { name: /Japan\s*2\/47/ })).toBeVisible();

  // Want to go clears the prefectures, so it asks first; keeping them changes nothing.
  await page.getByRole("button", { name: /Japan/ }).click();
  const sheet = page.getByRole("dialog", { name: "Japan" });
  await sheet.getByRole("radio", { name: "Want to go" }).click();
  await expect(sheet.getByText("Want to go clears the 2 prefectures you've marked.")).toBeVisible();
  await sheet.getByRole("button", { name: "Keep" }).click();
  await expect(sheet.getByRole("radio", { name: "Been there" })).toHaveAttribute("aria-checked", "true");
  // Taking Japan off asks too, and clears them.
  await sheet.getByRole("button", { name: "Take it off my Atlas" }).click();
  await expect(sheet.getByText("This also clears the 2 prefectures you've marked.")).toBeVisible();
  const removed = page.waitForResponse((r) => r.url().endsWith("/api/places") && r.ok());
  await sheet.getByRole("button", { name: "Take it off", exact: true }).click();
  await removed;
  await page.goto("/collection/atlas/jp");
  await expect(page.getByText("0/47")).toBeVisible();
  await expect(page.getByText("Mark one and Japan goes on your Atlas as Been there.")).toBeVisible();
  // A country too small for regions (a dot on the world map) has no page.
  expect((await page.goto("/collection/atlas/sg"))?.status()).toBe(404);
});

test("regions: the API refuses bad regions and visitors", async ({ request }) => {
  expect((await request.post("/api/places/regions", { data: { region: "JP-99", visited: true } })).status()).toBe(400);
  expect((await request.post("/api/places/regions", { data: { region: "JP-13" } })).status()).toBe(400);
  expect((await request.post("/api/places/regions", { data: { region: "JP-13", visited: true } })).status()).toBe(401);
});
