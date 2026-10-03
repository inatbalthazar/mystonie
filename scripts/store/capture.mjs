// Captures Maya's real screens (light and dark, English and Thai), her stickers and real card exports into RAW.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { BASE, emailOf, label, LOCALES, RAW, session, setLocale } from "./lib.mjs";

const VIEWPORT = { width: 412, height: 892 };
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function context(browser, locale, scheme, scale = 3) {
  const jar = await session(emailOf("maya"));
  const ctx = await browser.newContext({
    viewport: VIEWPORT, deviceScaleFactor: scale, isMobile: true, hasTouch: true, acceptDownloads: true, colorScheme: scheme,
    reducedMotion: "reduce", serviceWorkers: "block", locale: locale === "th" ? "th-TH" : "en-GB", timezoneId: "Europe/London",
  });
  await ctx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: new URL(BASE).hostname, path: "/", sameSite: "Lax" })));
  // A seasoned collector: no getting-started checklist, no install sheet.
  await ctx.addInitScript(() => {
    for (const k of ["skipped", "welcomed", "celebrated"]) localStorage.setItem(`mystonie.gettingStarted.${k}`, "1");
    localStorage.setItem("mystonie.install.dismissed", String(Date.now()));
    sessionStorage.setItem("mystonie.install.asked", "1");
  });
  return ctx;
}

async function open(ctx, locale, path) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${locale === "en" ? "" : `/${locale}`}${path}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  return page;
}

/** Scrolls through the page so lazy images load, then to `y` (or so `target`'s top sits `offset` px down). */
async function settle(page, target, offset = 20) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(100);
  }
  const y = target ? (await target.first().boundingBox()).y + (await page.evaluate(() => window.scrollY)) - offset : 0;
  await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), y);
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(800);
}

/** Opens a title's celebration from the collection, like "Make a card" does. */
async function celebrate(ctx, locale, title, shelf) {
  const page = await open(ctx, locale, `/collection${shelf ? `?shelf=${shelf}` : ""}`);
  await settle(page);
  await page.getByRole("button", { name: new RegExp(`^${escape(label(locale, "Collection.edit", { name: title }))}`) }).first().click();
  await page.getByRole("button", { name: label(locale, "Collection.makeCard") }).click();
  await page.getByRole("dialog").last().waitFor();
  return page;
}

async function screens(browser, locale, out) {
  const light = await context(browser, locale, "light");
  const shot = (page, name) => page.screenshot({ path: join(out, `${name}.png`) });

  let page = await celebrate(light, locale, "Past Lives");
  await page.waitForTimeout(2500);
  await shot(page, "celebrate");
  await page.close();

  page = await open(light, locale, "/me");
  await settle(page, page.getByRole("heading", { name: label(locale, "Profile.watchingNow") }), 22);
  await shot(page, "album-shelf");
  await page.close();

  page = await open(light, locale, "/feed");
  await settle(page, page.locator("article"), 14);
  await shot(page, "feed-items");
  await page.close();

  page = await open(light, locale, "/title/series/126308");
  await settle(page, page.getByRole("heading", { name: label(locale, "WhereToWatch.title") }), 40);
  await shot(page, "shogun-progress");
  await page.close();

  page = await open(light, locale, "/stats?period=year");
  await settle(page, page.getByRole("heading", { name: label(locale, "Stats.milestones") }), 60);
  await shot(page, "stats-milestones");
  await page.close();

  page = await open(light, locale, "/title/movie/6479");
  await settle(page);
  await shot(page, "legend");
  await page.close();
  await light.close();

  const dark = await context(browser, locale, "dark");
  page = await open(dark, locale, "/stats?period=year");
  await settle(page, page.getByRole("navigation", { name: label(locale, "Stats.periodsLabel") }), 14);
  await shot(page, "stats-numbers");
  await page.close();

  page = await open(dark, locale, "/collection/atlas");
  await settle(page);
  await shot(page, "atlas-been");
  await page.close();
  await dark.close();
}

/** The real stickers on their own, transparent, to scatter around the phone. */
async function stickers(browser, out) {
  const ctx = await context(browser, "en", "light");
  const page = await open(ctx, "en", "/me");
  await settle(page);
  await page.addStyleTag({ content: "html,body{background:transparent!important} body *{visibility:hidden!important} .keep,.keep *{visibility:visible!important}" });
  const spans = page.locator('span[aria-hidden="true"][style*="background-color"].rounded-full');
  for (let i = 0; i < Math.min(await spans.count(), 8); i++) {
    const el = spans.nth(i);
    await el.scrollIntoViewIfNeeded();
    await el.evaluate((n) => n.classList.add("keep"));
    const b = await el.boundingBox();
    await page.screenshot({ path: join(out, `sticker-${i}.png`), omitBackground: true, clip: { x: b.x - 10, y: b.y - 6, width: b.width + 20, height: b.height + 20 } });
    await el.evaluate((n) => n.classList.remove("keep"));
  }
  await ctx.close();
}

// One card per kind, each in its own style: [file, title, shelf, taps on "Change style"].
const CARDS = [
  ["polaroid-past-lives", "Past Lives", null, 0],
  ["boldstats-severance", "Severance", null, 1],
  ["spine-pachinko", "Pachinko", "read", 0],
  ["panel-spy", "SPY x FAMILY", "read", 0],
  ["cartridge-hades", "Hades", "play", 0],
];

/** The cards as the app exports them (Download), at full size. */
async function cards(browser, locale, out) {
  const ctx = await context(browser, locale, "light", 2);
  for (const [name, title, shelf, changes] of CARDS) {
    const page = await celebrate(ctx, locale, title, shelf);
    for (let i = 0; i < changes; i++) {
      await page.getByRole("button", { name: label(locale, "Celebration.changeStyle") }).click();
      await page.waitForTimeout(400);
    }
    const download = page.getByRole("button", { name: label(locale, "Celebration.download") });
    await page.waitForFunction((el) => !el.disabled, await download.elementHandle(), { timeout: 30000 });
    const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
    await file.saveAs(join(out, `card-${name}.png`));
    await page.close();
  }
  await ctx.close();
}

export async function capture() {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    for (const locale of LOCALES) {
      const out = join(RAW, locale);
      mkdirSync(out, { recursive: true });
      // The app follows the account's language, whatever the URL says.
      await setLocale("maya", locale);
      await screens(browser, locale, out);
      await cards(browser, locale, out);
      console.log(`captured ${locale}`);
    }
    await stickers(browser, RAW);
  } finally {
    await setLocale("maya", "en");
    await browser.close();
  }
}
