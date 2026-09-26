import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

// Records what the page passes to navigator.share, and whether it was still inside the click
// (iOS rejects shares that start after an await).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        w.__shared.push({ url: data.url, name: file?.name, type: file?.type, size: file?.size, active: navigator.userActivation.isActive });
      },
    });
  });
});

test("edit a card, swipe templates, then share and download it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: /trending/i }).waitFor();
  await page.locator("section ul li button").first().click();

  const preview = page.locator("[data-card]").last();
  await preview.waitFor();

  // Rating: tap 4 → 4, tap 4 again → 3.5.
  await page.getByRole("button", { name: "4 stars" }).click();
  await page.getByRole("button", { name: "4 stars" }).click();
  await expect(page.getByText("3.5 / 5")).toBeVisible();

  // Review: cut at 80 characters, one line, shown on the card.
  const review = page.getByLabel("One-line review");
  await review.fill("Loved it. ".repeat(12));
  await expect(page.getByText("80/80")).toBeVisible();
  await expect(preview).toContainText("Loved it.");

  // Date: printed in the UI locale.
  await page.getByLabel("Finished on").fill("2026-02-14");
  await expect(preview).toContainText("Feb 14, 2026");

  // Swipe left: Polaroid → Bold Stats.
  await preview.scrollIntoViewIfNeeded();
  const box = (await preview.boundingBox())!;
  const y = box.y + Math.min(box.height / 2, 200);
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Bold Stats" })).toHaveAttribute("aria-pressed", "true");

  // Share: file + attributable URL, called while the click is still active.
  const share = page.getByRole("button", { name: "Share" });
  await expect(share).toBeEnabled({ timeout: 30_000 });
  await share.click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: Record<string, unknown>[] }).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]).toMatchObject({ type: "image/png", active: true });
  expect(shared[0]!.name).toMatch(/^mystonie-.+-boldStats\.png$/);
  expect(new URL(shared[0]!.url as string).search).toBe("?ref=card&tpl=boldStats");
  expect(shared[0]!.size).toBeGreaterThan(10_000);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toMatch(/-boldStats\.png$/);
});
