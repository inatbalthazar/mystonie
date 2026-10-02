import { expect, test, type APIRequestContext } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, seedTitles, signUp, uniqueEmail, type SeedTitle } from "./helpers";

// The Journal and "What people said" (stage 4, ADR 0051). The Journal test reads the draft in
// content/journal/how-to-write/ (drafts show outside production); the reviews test needs the local Supabase stack.

const rest = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, headers: { apikey: key, Authorization: `Bearer ${key}` } };
};

/** The Matrix (movie 603, the draft's title card) in the title cache with its real poster, so nothing needs TMDB; a real cached row stays. */
async function cacheMatrix(request: APIRequestContext): Promise<void> {
  const { url, headers } = rest();
  const res = await request.get(`${url}/rest/v1/titles?select=id&source=eq.tmdb&kind=eq.movie&external_id=eq.603`, { headers });
  if (((await res.json()) as unknown[]).length === 0) {
    await seedTitles(request, [{ kind: "movie", externalId: "603", name: "The Matrix", year: 1999, posterPath: "/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg", runtimeMin: 136 }]);
  }
}

test("the Journal: listed in the feed, read, in Thai, and linked from the title's page", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(90_000);
  await cacheMatrix(request);

  // Signed out: the Journal has no list of its own (ADR 0062); its old address leads to the feed, which a visitor sees
  // as the articles and a way to sign in. The footer no longer links it.
  await page.goto("/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Journal" })).toHaveCount(0);
  await page.goto("/journal");
  await expect(page).toHaveURL(/\/feed\?tab=articles$/);
  await expect(page.getByRole("heading", { level: 1, name: "Feed" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth?next=%2Ffeed");
  // One tab only, so no tabs.
  await expect(page.getByRole("navigation", { name: "Feed sections" })).toHaveCount(0);
  const row = page.getByRole("article").filter({ hasText: "How to write for the Journal" });
  await expect(row.getByText("Draft", { exact: true })).toBeVisible();
  await expect(row.getByText("Featured", { exact: true })).toBeVisible();
  // Stamp and Save send a visitor to sign in first, and back.
  await expect(row.getByRole("link", { name: "Stamp" })).toHaveAttribute("href", "/auth?next=%2Ffeed");
  await expect(row.getByRole("link", { name: "Save" })).toHaveAttribute("href", "/auth?next=%2Ffeed");
  await row.getByRole("link", { name: "How to write for the Journal" }).click();

  await expect(page).toHaveURL(/\/journal\/how-to-write$/);
  const actions = page.getByRole("region", { name: "Stamp, save or share" });
  await expect(actions.getByRole("link", { name: "Stamp" })).toHaveAttribute("href", "/auth?next=%2Fjournal%2Fhow-to-write");
  await expect(actions.getByRole("button", { name: "Share" })).toBeVisible();
  const article = page.getByRole("article");
  await expect(article.getByRole("heading", { level: 1 })).toHaveText("How to write for the Journal");
  await expect(article.getByText("By Stonie")).toBeVisible();
  await expect(article.getByRole("heading", { level: 2, name: "Titles with an Add button" })).toBeVisible();
  await expect(article.getByRole("listitem")).toHaveCount(3);
  // The title card: Add opens quick add on the title (through sign-in for a visitor).
  const add = article.getByRole("link", { name: "Add The Matrix to your collection" });
  await expect(add).toHaveAttribute("href", /\/collection\?add=1&pick=movie%3A603$/);
  await expect(article.getByRole("link", { name: "Reel of the Day" })).toHaveAttribute("href", "/reel");
  await expect(article.getByRole("link", { name: "TMDB" })).toHaveAttribute("target", "_blank");
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}") as { headline?: string };
  expect(ld.headline).toBe("How to write for the Journal");
  await expect(page.locator('link[rel="alternate"][hreflang="th"]')).toHaveAttribute("href", /\/th\/journal\/how-to-write$/);

  // In Thai: its own Thai version.
  await page.goto("/th/feed");
  await page.getByRole("link", { name: /วิธีเขียนบทความใน Journal/ }).click();
  await expect(page.getByRole("article").getByRole("heading", { level: 1 })).toHaveText("วิธีเขียนบทความใน Journal");

  // Signed in: Home has no Journal note (ADR 0082), so only check the title page and Add.
  await signUp(page, request, "journal", "/collection");
  await page.goto("/title/movie/603");
  const about = page.getByRole("region", { name: "In the Journal" });
  await expect(about.getByRole("link", { name: "How to write for the Journal" })).toBeVisible();
  await page.goto("/journal/how-to-write");
  await page.getByRole("link", { name: "Add The Matrix to your collection" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog").getByText("The Matrix").first()).toBeVisible();
});

test("the Journal in the feed: For you from the collection, Stamp and Save, Saved, articles among Following", async ({
  page,
  request,
}) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  await cacheMatrix(request);
  await signUp(page, request, "jfeed", "/collection");
  const marked = () => page.waitForResponse((r) => r.url().endsWith("/api/journal/marks") && r.request().method() === "POST");

  // Reading the draft, The Matrix goes on the Want list from its card.
  await page.goto("/journal/how-to-write");
  await page.getByRole("link", { name: "Add The Matrix to your collection" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("dialog").getByRole("button", { name: "Want to watch" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // The feed's Journal tab puts it first For you, and says why it's there.
  await page.goto("/feed");
  const tabs = page.getByRole("navigation", { name: "Feed sections" });
  await expect(tabs.getByRole("link")).toHaveText(["Following", "Journal"]);
  await expect(tabs.getByRole("link", { name: "Following" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Journal" }).click();
  await expect(page).toHaveURL(/\/feed\?tab=articles$/);
  await expect(tabs.getByRole("link", { name: "Journal" })).toHaveAttribute("aria-current", "page");
  const row = page.getByRole("article").filter({ hasText: "How to write for the Journal" });
  await expect(row.getByText("You want to watch The Matrix")).toBeVisible();

  // Stamp and Save from the row.
  let done = marked();
  await row.getByRole("button", { name: "Stamp" }).click();
  expect((await done).ok()).toBe(true);
  await expect(row.getByRole("button", { name: "Take back your Stamp" })).toHaveAttribute("aria-pressed", "true");
  done = marked();
  await row.getByRole("button", { name: "Save" }).click();
  expect((await done).ok()).toBe(true);
  await expect(row.getByRole("button", { name: "Remove from saved" })).toHaveAttribute("aria-pressed", "true");

  // Saved: a tab on the feed, and only there (ADR 0082: not on Me). The Journal's old Saved link lands on it too.
  await page.reload();
  await tabs.getByRole("link", { name: "Saved" }).click();
  await expect(page).toHaveURL(/\/feed\?tab=saved$/);
  await expect(row).toBeVisible();
  await page.goto("/journal?tab=saved");
  await expect(page).toHaveURL(/\/feed\?tab=saved$/);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Saved to read" })).toHaveCount(0);

  // The article page is static: its buttons learn the reader's Stamp and Save once it's open.
  await page.goto("/journal/how-to-write");
  const actions = page.getByRole("region", { name: "Stamp, save or share" });
  await expect(actions.getByRole("button", { name: "Take back your Stamp" })).toHaveAttribute("aria-pressed", "true");
  await expect(actions.getByRole("button", { name: "Remove from saved" })).toHaveAttribute("aria-pressed", "true");

  // Following, the feed's first tab, is empty for a new account, so the Journal's newest show there, with the reason too.
  await page.goto("/feed");
  const card = page.getByRole("article").filter({ hasText: "From the Journal" }).filter({ hasText: "How to write for the Journal" });
  await expect(card.getByText("You want to watch The Matrix")).toBeVisible();
  await expect(card.getByRole("button", { name: "Take back your Stamp" })).toHaveAttribute("aria-pressed", "true");

  // Unsaved from the article, it leaves Saved.
  await page.goto("/journal/how-to-write");
  done = marked();
  await actions.getByRole("button", { name: "Remove from saved" }).click();
  expect((await done).ok()).toBe(true);
  // Its tab is gone, and an old link to it lands on Following.
  await page.goto("/feed?tab=saved");
  await expect(page).toHaveURL(/\/feed$/);
  await expect(tabs.getByRole("link", { name: "Following" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Saved" })).toHaveCount(0);
});

test("an article that doesn't exist is a 404", async ({ page }) => {
  const res = await page.goto("/journal/no-such-article");
  expect(res?.status()).toBe(404);
});

test("what people said: reviews on the title page, mine and public ones, not private ones, three then Show all", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const movie: SeedTitle = {
    kind: "movie",
    externalId: String(960_000_000 + (Date.now() % 10_000_000)),
    name: `Said Film ${stamp}`,
    year: 2025,
    posterPath: null,
    runtimeMin: 95,
  };
  await seedTitles(request, [movie]);
  const { url, headers } = rest();
  const title = (
    (await (
      await request.get(`${url}/rest/v1/titles?select=id&source=eq.tmdb&kind=eq.movie&external_id=eq.${movie.externalId}`, { headers })
    ).json()) as { id: string }[]
  )[0]!.id;

  // Five public reviewers, one private, one finish with no review.
  const people: { name: string; review: string | null; visibility: "public" | "private" }[] = [
    ...[1, 2, 3, 4, 5].map((n) => ({ name: `said${n}_${stamp}`, review: `Review number ${n}`, visibility: "public" as const })),
    { name: `hush_${stamp}`, review: "Kept to myself", visibility: "private" },
    { name: `quiet_${stamp}`, review: null, visibility: "public" },
  ];
  for (const [i, p] of people.entries()) {
    const made = await request.post(`${url}/auth/v1/admin/users`, { headers, data: { email: uniqueEmail(p.name), email_confirm: true } });
    expect(made.ok(), await made.text()).toBe(true);
    const id = ((await made.json()) as { id: string }).id;
    await request.patch(`${url}/rest/v1/profiles?id=eq.${id}`, { headers, data: { username: p.name, visibility: p.visibility } });
    const finished = await request.post(`${url}/rest/v1/entries`, {
      headers,
      data: {
        id: uuidv7(),
        user_id: id,
        title_id: title,
        status: "finished",
        finished_at: new Date(Date.now() - (10 - i) * 60_000).toISOString(),
        rating: 4,
        review: p.review,
      },
    });
    expect(finished.ok(), await finished.text()).toBe(true);
  }

  await signUp(page, request, "said", "/collection");
  await page.goto(`/title/movie/${movie.externalId}`);
  const said = page.getByRole("region", { name: "What people said" });
  await expect(said.getByText("Review number 5")).toBeVisible();
  await expect(said.getByText("Review number 3")).toBeVisible();
  await expect(said.getByText("Review number 2")).toBeHidden();
  await expect(said.getByText("Kept to myself")).toHaveCount(0);
  await said.getByRole("button", { name: "Show all (5)" }).click();
  await expect(said.getByText("Review number 1")).toBeVisible();
  // A Stamp on someone's review.
  await said.getByRole("listitem").first().getByRole("button", { name: /stamp/i }).click();
  await expect(said.getByRole("listitem").first().getByRole("button", { name: /stamp/i })).toHaveAttribute("aria-pressed", "true");
});
