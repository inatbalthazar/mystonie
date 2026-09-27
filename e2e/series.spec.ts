import { expect, test, type Page } from "@playwright/test";
import { canSeed, mailpitUp, seedSeries, signUp } from "./helpers";

// Needs the local Supabase stack. The series is seeded (ended, 5 + 2 episodes), so TMDB isn't called.
const SHOW = { externalId: "990001", name: "Stonie Test Show", seasons: [5, 2] };

/** Resolves when the next write to /api/episodes or /api/entries has been answered. */
const saved = (page: Page) =>
  page.waitForResponse((r) => /^\/api\/(episodes|entries)/.test(new URL(r.url()).pathname) && r.request().method() !== "GET");

test("log episodes, next episode in one tap, finish the series", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  await seedSeries(request, SHOW);
  await signUp(page, request, "series");

  await page.goto(`/title/series/${SHOW.externalId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SHOW.name);
  await expect(page.getByText("0 of 7 episodes")).toBeVisible();

  // Tap S1E4: logged, and the series joins the collection as watching.
  const e4 = page.getByRole("button", { name: /^S1 · E4 · Episode 4/ });
  await expect(async () => {
    const done = saved(page);
    await e4.click({ timeout: 2000 });
    await done;
  }).toPass();
  await expect(e4).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Next episode S1 · E5/ })).toBeVisible();
  // A Progress card is offered, not forced.
  await expect(page.getByText("Logged S1 · E4. Want a card?")).toBeVisible();

  // "Up next" on Home: S1E5 after S1E4, in one tap.
  await page.goto("/collection");
  await expect(page.getByRole("button", { name: `Edit ${SHOW.name}` })).toContainText("Watching");
  await page.goto("/home");
  const upNext = page.getByRole("region", { name: "Up next" });
  await expect(upNext).toContainText("S1 · E5");
  const logged = saved(page);
  await upNext.getByRole("button", { name: `Log ${SHOW.name} S1 E5` }).click();
  expect((await logged).status()).toBe(201);
  await expect(upNext).toContainText("S2 · E1");
  await page.reload();
  await expect(page.getByRole("region", { name: "Up next" })).toContainText("S2 · E1");

  // Mark both seasons watched: every episode is out and logged, so it asks to finish.
  await page.goto(`/title/series/${SHOW.externalId}`);
  await expect(page.getByText("2 of 7 episodes")).toBeVisible();
  // The season with the next episode (2) starts open; open season 1 too.
  await page.getByText("Season 1", { exact: true }).click();
  let done = saved(page);
  await page.getByRole("button", { name: "Mark season 1 watched" }).click();
  await done;
  // 5 of 7 crosses the halfway mark: the offer turns into a milestone, and the card says so.
  await expect(page.getByText("Halfway there! 🎉")).toBeVisible();
  await page.getByRole("button", { name: "Make a card" }).click();
  const progressCard = page.getByRole("dialog", { name: `Halfway through ${SHOW.name}!` });
  await expect(progressCard).toBeVisible();
  await expect(progressCard.locator("[data-card]")).toContainText("Halfway there");
  await progressCard.getByRole("button", { name: "Skip" }).click();
  await expect(progressCard).toBeHidden();
  done = saved(page);
  await page.getByRole("button", { name: "Mark season 2 watched" }).click();
  await done;
  await expect(page.getByText("7 of 7 episodes")).toBeVisible();
  await expect(page.getByText("All caught up!")).toBeVisible();
  done = saved(page);
  await page.getByRole("button", { name: "Yes, I finished it" }).click();
  // Celebrate first: the stamp and the Finish card show while the entry saves.
  const celebration = page.getByRole("dialog", { name: `You finished ${SHOW.name}!` });
  await expect(celebration).toBeVisible();
  expect((await done).status()).toBe(201);
  await expect(celebration.getByRole("button", { name: /Copy card link|Share/ })).toBeEnabled();
  await celebration.getByRole("button", { name: "Skip" }).click();
  await expect(celebration).toBeHidden();

  // Un-log one episode (soft delete).
  done = saved(page);
  await page.getByRole("button", { name: /^S2 · E2 · Episode 2/ }).click();
  await done;
  await page.reload();
  await expect(page.getByText("6 of 7 episodes")).toBeVisible();
  await expect(page.getByText("Finished", { exact: true })).toBeVisible();

  await page.goto("/collection");
  await expect(page.getByRole("button", { name: `Edit ${SHOW.name}` })).toContainText("Finished");
});
