import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { canSeed, mailpitUp, mockSearch, seedTitles, signUp, type SeedTitle } from "./helpers";

// S3 offline (ADR 0042). The only tests with the service worker on (playwright.config.ts blocks it elsewhere).
// `setOffline` cuts a device and its service worker off the network, like flight mode. Needs the local Supabase stack
// (sign-in via Mailpit); search is mocked and the titles seeded, as in the collection test.
test.use({ serviceWorkers: "allow" });

const TITLES: SeedTitle[] = [
  { kind: "movie", externalId: "990101", name: "Paper Moons", year: 2021, posterPath: null, runtimeMin: 101 },
  { kind: "movie", externalId: "990102", name: "The Last Lighthouse", year: 2022, posterPath: null, runtimeMin: 95 },
];
const [MOONS, LIGHTHOUSE] = TITLES.map((t) => t.name) as [string, string];

/** How long a sync may take on a busy `next dev` (the second device's 10 s is checked separately). */
const SYNC_MS = 15_000;
const rows = (page: Page) => page.getByRole("main").getByRole("listitem");
const row = (page: Page, name: string) => rows(page).filter({ hasText: name });

test.beforeEach(async ({ request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedTitles(request, TITLES);
});

/** The page's ➕. Retries until the sheet opens (a first dev compile can take a moment to hydrate). */
async function openAdd(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Add a title" }).click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/** Searches in quick add and taps the result (which also remembers it on this device for adding offline). */
async function pickResult(page: Page, query: string, name: string) {
  await page.getByRole("dialog").getByLabel("Search movies, series, books, manga and games").fill(query);
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${name} Movie`) }).click();
}

/** A new account on this device, with the service worker in charge of its pages. */
async function start(page: Page, request: APIRequestContext, tag: string) {
  await mockSearch(page, TITLES);
  await signUp(page, request, tag);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await openAdd(page);
  await pickResult(page, "Paper", MOONS);
  await page.getByRole("button", { name: "Want to watch" }).click();
  await expect(row(page, MOONS)).toContainText("Want to watch");
  await expect(row(page, MOONS)).not.toContainText("Saving…");
  // Looked at, not added: quick add offers it offline.
  await openAdd(page);
  await pickResult(page, "Lighthouse", LIGHTHOUSE);
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
}

/** Another device signed in to the same account: its own storage, service worker and connection. */
async function secondDevice(browser: Browser, context: BrowserContext): Promise<Page> {
  const other = await browser.newContext({ storageState: await context.storageState(), serviceWorkers: "allow" });
  const page = await other.newPage();
  await mockSearch(page, TITLES);
  await page.goto("/collection");
  await expect(row(page, MOONS)).toBeVisible();
  return page;
}

/** Waits until this device keeps a copy of `path` for offline use that shows `text`. */
async function keptOffline(page: Page, path: string, text: string) {
  await expect
    .poll(
      () =>
        page.evaluate(async (href) => {
          const copy = await caches.match(new URL(href, location.origin).href);
          return copy ? copy.text() : "";
        }, path),
      { timeout: 20_000 },
    )
    .toContain(text);
}

/** The app goes to the background for a while, then comes back to the front (a phone's app switcher). */
async function awayAndBack(page: Page) {
  await page.evaluate(async () => {
    const show = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    show("hidden");
    await new Promise((resolve) => setTimeout(resolve, 5_500));
    show("visible");
  });
}

/** Changes an entry's status in the collection's editor. */
async function setStatus(page: Page, name: string, status: "Want to watch" | "Watching" | "Finished") {
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  const sheet = page.getByRole("dialog");
  await sheet.locator("label").filter({ hasText: new RegExp(`^${status}$`) }).click();
  await expect(sheet.getByRole("radio", { name: status })).toBeChecked();
  await sheet.getByRole("button", { name: "Save" }).click();
}

/** Adds a title from quick add's "seen lately" list (offline, search can't reach the catalogs). */
async function addRecent(page: Page, name: string, status: "Want to watch" | "Watching") {
  await openAdd(page);
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("You're offline, so search will work when you reconnect.")).toBeVisible();
  await sheet.getByRole("region", { name: "Seen lately on this device" }).getByRole("button", { name: new RegExp(`^${name} Movie`) }).click();
  await sheet.getByRole("button", { name: status }).click();
}

/** The account's entries on the server (removed ones too), by title. */
async function serverEntries(page: Page, request: APIRequestContext) {
  const userId = await page.evaluate(() => localStorage.getItem("mystonie.user"));
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/entries?select=status,deleted_at,title:titles(name)&user_id=eq.${userId}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const entries = (await res.json()) as { status: string; deleted_at: string | null; title: { name: string } }[];
  return entries.map((e) => `${e.title.name}:${e.status}${e.deleted_at ? ":removed" : ""}`).sort();
}

test("offline: the app opens with the collection, logs a title, and it reaches another device once back online", async ({
  page,
  context,
  request,
  browser,
}) => {
  await start(page, request, "offline");
  // Once a change has gone through, this device keeps fresh copies of Home and the collection.
  await keptOffline(page, "/home", "Your collection");
  await keptOffline(page, "/collection", MOONS);

  // Flight mode: the installed app opens on Home from this device's copy, and the collection opens too.
  await context.setOffline(true);
  await page.goto("/home?source=pwa");
  await expect(page.getByText("You're offline. What you log is saved on this device and syncs when you're back.")).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Collection" }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your collection");
  await expect(row(page, MOONS)).toContainText("Want to watch");

  // Search can't work, so quick add offers what this device saw lately. The entry shows at once, waiting to sync.
  await addRecent(page, LIGHTHOUSE, "Watching");
  await expect(row(page, LIGHTHOUSE)).toContainText("Waiting to sync");
  await expect(row(page, LIGHTHOUSE)).toContainText("Watching");
  await expect(page.getByText("You're offline · 1 change saved on this device, waiting to sync")).toBeVisible();

  // Closing and reopening the app offline keeps it.
  await page.reload();
  await expect(row(page, LIGHTHOUSE)).toContainText("Waiting to sync");
  await expect(rows(page)).toHaveCount(2);

  // A second device (online) doesn't have it yet.
  const tablet = await secondDevice(browser, context);
  await expect(row(tablet, LIGHTHOUSE)).toHaveCount(0);

  // Back online: it syncs by itself…
  await context.setOffline(false);
  await expect(page.getByText("Back online: 1 change synced")).toBeVisible({ timeout: SYNC_MS });
  await expect(row(page, LIGHTHOUSE)).not.toContainText("Waiting to sync");
  expect(await serverEntries(page, request)).toEqual([`${MOONS}:want`, `${LIGHTHOUSE}:watching`].sort());

  // …and shows on the other device within 10 s of it coming back to the front.
  await awayAndBack(tablet);
  await expect(row(tablet, LIGHTHOUSE)).toContainText("Watching", { timeout: 10_000 });
  await tablet.context().close();
});

test("offline: the same entry changed on two offline devices ends with the later change, with no duplicates", async ({
  page,
  context,
  request,
  browser,
}) => {
  await start(page, request, "offline-both");
  const tablet = await secondDevice(browser, context);

  // Both offline. This phone changes things first, the tablet a moment later: the same entry, and the same new title.
  await context.setOffline(true);
  await tablet.context().setOffline(true);
  await setStatus(page, MOONS, "Watching");
  await expect(row(page, MOONS)).toContainText("Waiting to sync");
  await setStatus(tablet, MOONS, "Finished");
  // Celebrate first, even offline; the card can be shared once online.
  const celebration = tablet.getByRole("dialog", { name: `You finished ${MOONS}!` });
  await expect(celebration.getByRole("button", { name: "Share once you're online" })).toBeDisabled();
  await celebration.getByRole("button", { name: "Skip" }).click();
  await addRecent(page, LIGHTHOUSE, "Want to watch");
  await addRecent(tablet, LIGHTHOUSE, "Watching");
  await expect(row(tablet, LIGHTHOUSE)).toContainText("Waiting to sync");

  // The later changes reach the server first (the tablet), then the earlier ones (this phone): the later ones stay.
  await tablet.context().setOffline(false);
  await expect(tablet.getByText("Back online: 2 changes synced")).toBeVisible({ timeout: SYNC_MS });
  expect(await serverEntries(page, request)).toEqual([`${MOONS}:finished`, `${LIGHTHOUSE}:watching`].sort());
  await context.setOffline(false);
  await expect(page.getByText(`“${LIGHTHOUSE}” was changed on another device after this, so that change stays.`)).toBeVisible({ timeout: SYNC_MS });
  await expect(row(page, MOONS)).toContainText("Finished");
  await expect(row(page, LIGHTHOUSE)).toContainText("Watching");
  await expect(rows(page).filter({ hasText: "Waiting to sync" })).toHaveCount(0);

  // One entry per title, on the server and on both devices.
  expect(await serverEntries(page, request)).toEqual([`${MOONS}:finished`, `${LIGHTHOUSE}:watching`].sort());
  for (const device of [page, tablet]) {
    await device.reload();
    await expect(rows(device)).toHaveCount(2);
    await expect(row(device, MOONS)).toContainText("Finished");
    await expect(row(device, LIGHTHOUSE)).toContainText("Watching");
  }
  await tablet.context().close();
});
