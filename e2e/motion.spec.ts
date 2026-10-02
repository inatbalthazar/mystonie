import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { mailpitUp, navIsland, openQuickAdd, signUp } from "./helpers";

// Motion (ADR 0070). The other tests run with reduced motion (playwright.config.ts); these turn it back on and check
// that pages slide the way you went, that swipes change tabs and close sheets, and that pages have skeletons. Needs the
// local Supabase stack (sign-in via Mailpit).
test.use({ reducedMotion: "no-preference" });

/** Records the direction (`<html data-nav>`) of every view transition the page starts. */
async function recordTransitions(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __transitions: string[] };
    w.__transitions = [];
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
      w.__transitions.push(document.documentElement.dataset.nav ?? "");
      return start(arg);
    }) as typeof document.startViewTransition;
  });
}
const transitions = (page: Page) => page.evaluate(() => (window as unknown as { __transitions: string[] }).__transitions);

/** Waits for the page to stop sliding (the direction clears once it has). */
const settled = (page: Page) => expect(page.locator("html")).not.toHaveAttribute("data-nav");

/** A finger dragged from (x, y) by (dx, dy), as the phone's touchscreen sends it. */
async function drag(cdp: CDPSession, x: number, y: number, dx: number, dy: number) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("pages slide the way you go, tabs swipe and sheets drag away (ADR 0070)", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)), "local Supabase (Mailpit) isn't running");
  await recordTransitions(page);
  // Desktop Chrome takes a sideways drag anywhere as its own back or forward; on phones that gesture starts at the
  // screen's edge, where the app's swipes don't. Off here, as on a phone.
  await page.addInitScript(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("html { overscroll-behavior-x: none; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
  await signUp(page, request, "motion", "/home");

  // Pages have skeletons: the first HTML holds the page's shape while the server reads its data.
  expect(await (await page.request.get("/feed")).text()).toContain("data-skeleton");

  // The island's tabs crossfade...
  await navIsland(page).getByRole("link", { name: "Feed" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect.poll(() => transitions(page)).toContain("tab");

  // ...a link goes forward, and the back button back.
  await page.getByRole("link", { name: "The board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect.poll(() => transitions(page)).toContain("forward");
  await page.getByRole("banner").getByRole("link", { name: "Back to Feed" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect.poll(() => transitions(page)).toContain("back");
  // (While a page slides, touches go past it: wait for the slide to end.)
  await expect(page.locator("html")).not.toHaveAttribute("data-nav-manual");

  // A swipe left opens the next tab (Articles), sliding in from the right; a swipe right comes back.
  const cdp = await page.context().newCDPSession(page);
  const area = page.locator("[data-swipe-area]");
  await expect(area).toBeVisible();
  let box = (await area.boundingBox())!;
  await drag(cdp, box.x + box.width / 2, box.y + 40, -160, 6);
  await expect(page).toHaveURL(/\/feed\?tab=articles$/);
  await expect(page.getByRole("link", { name: "Articles", exact: true })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => transitions(page)).toContain("tab-next");
  await settled(page);
  box = (await area.boundingBox())!;
  await drag(cdp, box.x + box.width / 2, box.y + 40, 160, -4);
  await expect(page).toHaveURL(/\/feed$/);
  await expect.poll(() => transitions(page)).toContain("tab-prev");
  await settled(page);

  // Up and down is a scroll, not a swipe.
  box = (await area.boundingBox())!;
  await drag(cdp, box.x + box.width / 2, box.y + 40, -40, 200);
  await expect(page).toHaveURL(/\/feed$/);

  // A sheet rises, and dragging its top down closes it.
  await openQuickAdd(page);
  const sheet = page.getByRole("dialog", { name: "Add a title" });
  const top = (await sheet.boundingBox())!;
  await drag(cdp, top.x + top.width / 3, top.y + 12, 0, 260);
  await expect(sheet).toBeHidden();
});
