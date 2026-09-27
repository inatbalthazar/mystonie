import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const CARD_DIMENSIONS = { story: [1080, 1920], feed: [1080, 1350] } as const;

async function settle(page: Page) {
  await page.evaluate(async () => {
    const ready = (async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null))));
      return "ready";
    })();
    const state = await Promise.race([ready, new Promise((r) => setTimeout(() => r("timeout"), 15_000))]);
    if (state !== "ready") {
      const pending = [...document.images].filter((i) => !i.complete).map((i) => i.src);
      console.log(`settle timeout; fonts=${document.fonts.status}; pending images=${pending.join(",")}`);
    }
  });
}

const loadedFonts = (page: Page) =>
  page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));

test.setTimeout(180_000);

test("every template × size × hard case stays inside the card", async ({ page }, testInfo) => {
  await page.goto("/card-lab");
  await page.locator("[data-card]").first().waitFor();
  await page.waitForTimeout(1500); // palettes
  await settle(page);

  const cards = page.locator("[data-testid]");
  const count = await cards.count();
  // Finish fixtures: 3 finish templates + the sticker; progress, recap and stats fixtures: 2 templates + the sticker.
  expect(count).toBe(5 * 4 * 2 + 2 * 3 * 2 + 3 * 3 * 2);

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const id = await card.getAttribute("data-testid");
    // Every text/image element must sit inside the card's visible box.
    const escaped = await card.evaluate((el) => {
      const root = el.querySelector("[data-card]")!;
      const outside = (a: DOMRect, b: DOMRect) =>
        a.top < b.top - 1 || a.bottom > b.bottom + 1 || a.left < b.left - 1 || a.right > b.right + 1;
      return [...root.querySelectorAll("h2, p, dd, dt, img[width]")]
        .filter((n) => {
          const r = n.getBoundingClientRect();
          if (r.height === 0) return false;
          // Check against every ancestor that clips (the card, the ticket paper, …).
          for (let a = n.parentElement; a && root.contains(a); a = a.parentElement) {
            if (getComputedStyle(a).overflow !== "visible" && outside(r, a.getBoundingClientRect())) return true;
          }
          return false;
        })
        .map((n) => n.textContent?.slice(0, 40) || n.tagName);
    });
    expect(escaped, `${id} has content outside the card`).toEqual([]);
    // Text boxes are clamped, never clipped mid-line.
    const clipped = await card.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>("[data-fit]")].filter((n) => n.scrollWidth > n.clientWidth + 1).length,
    );
    expect(clipped, `${id} has horizontally overflowing text`).toBe(0);
    await testInfo.attach(`${id}.png`, { body: await card.screenshot(), contentType: "image/png" });
  }

  // Thai, Korean and Japanese reviews pulled in their Noto fallbacks.
  const families = (await loadedFonts(page)).join(" | ");
  for (const script of ["Thai", "KR", "JP"]) expect(families).toContain(`Noto Sans ${script}`);
});

test("first screen does not download Korean/Japanese fonts or their CSS", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-card]").first().waitFor();
  await settle(page);
  // document.fonts lists every @font-face rule on the page, loaded or not: KR/JP must not even be declared.
  const declared = (await page.evaluate(() => [...document.fonts].map((f) => f.family))).join(" | ");
  expect(declared).not.toContain("Noto Sans KR");
  expect(declared).not.toContain("Noto Sans JP");
});

test("a picked title downloads as a PNG at export size", async ({ page }) => {
  test.skip(!!process.env.CI, "needs TMDB access");
  await page.goto("/");
  await page.getByRole("searchbox").fill("parasite");
  await page.locator("main ul li button").first().click();
  for (const size of ["story", "feed"] as const) {
    if (size === "feed") await page.getByRole("button", { name: /4:5/ }).click();
    const button = page.getByRole("button", { name: "Download" });
    await expect(button).toBeEnabled({ timeout: 20_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    const png = Buffer.from(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c)));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual(CARD_DIMENSIONS[size]);
  }
});

test("Thai, Korean and Japanese text survive PNG export", async ({ page }, testInfo) => {
  await page.goto("/card-lab");
  await page.locator("[data-card]").first().waitFor();
  await page.waitForTimeout(1500);
  await settle(page);
  for (const id of ["long-title-thai.polaroid.story", "korean.ticket.story", "japanese-no-poster.boldStats.feed"]) {
    const base64 = await page.evaluate((testId) => (window as unknown as { __exportCard: (id: string) => Promise<string> }).__exportCard(testId), id);
    const png = Buffer.from(base64, "base64");
    const [w, h] = id.endsWith(".feed") ? CARD_DIMENSIONS.feed : CARD_DIMENSIONS.story;
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([w, h]);
    await testInfo.attach(`${id}.export.png`, { body: png, contentType: "image/png" });
    writeFileSync(testInfo.outputPath(`${id}.export.png`), png);
  }
});

test("the Stats Sticker exports with a transparent background", async ({ page }) => {
  await page.goto("/card-lab");
  await page.locator("[data-card]").first().waitFor();
  await settle(page);
  for (const id of ["korean.sticker.story", "progress-halfway.sticker.feed"]) {
    const alpha = await page.evaluate(async (testId) => {
      const base64 = await (window as unknown as { __exportCard: (id: string) => Promise<string> }).__exportCard(testId);
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const at = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
      const opaque = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data.some((v, i) => i % 4 === 3 && v === 255);
      return { corners: [at(0, 0), at(bitmap.width - 1, 0), at(0, bitmap.height - 1), at(bitmap.width - 1, bitmap.height - 1)], opaque };
    }, id);
    expect(alpha.corners, `${id} corners`).toEqual([0, 0, 0, 0]);
    expect(alpha.opaque, `${id} has visible stats`).toBe(true);
  }
});
