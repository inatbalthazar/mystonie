import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { canSeed, lastEmail, MAILPIT, mailpitUp, mockSearch, seedTitles, signUp, skipWelcome, type SeedTitle } from "./helpers";

// Members write for the Journal (stage 4, ADR 0092): a draft, then published with what it's about and sent to be
// Featured; the team features it; everyone finds it with the Journal's filters, and Check opens what it's about.
// Needs the local Supabase stack (Mailpit, service role); the admin page part also needs the server and this test to
// run with ADMIN_EMAILS set to JOURNAL_ADMIN below.

const FILM: SeedTitle = { kind: "movie", externalId: "9950001", name: "Journal Test Film", year: 2024, posterPath: null, runtimeMin: 101 };
const JOURNAL_ADMIN = "journal-admin-e2e@example.com";
const BODY = [
  "## Why it stayed",
  "",
  "**Journal Test Film** is quiet, patient and kind. It made me call an old friend the next day, and I keep thinking about its last scene.",
  "",
  "See [my blog](https://spam.example) too.",
].join("\n");

const rest = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
};

/** The team's answer through the service role, as /api/admin/journal gives it. */
async function feature(request: APIRequestContext, id: string): Promise<void> {
  const { url, headers } = rest();
  const res = await request.patch(`${url}/rest/v1/journal_posts?id=eq.${id}`, {
    headers,
    data: { feature_request: "approved", featured_at: new Date().toISOString(), review_note: "Lovely piece." },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Signs in (or up) with a fixed address, through the email code (an earlier run's codes are cleared first). */
async function signInAs(page: Page, request: APIRequestContext, email: string, next: string): Promise<void> {
  await skipWelcome(page);
  await request.delete(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  await page.goto(`/auth?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  const code = (await lastEmail(request, email)).Subject.match(/^(\d{6,10}) /)?.[1];
  await page.getByLabel("Code from the email").fill(code!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

test("a member writes an article, the team features it, and everyone finds it", async ({ page, request, browser }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.setTimeout(150_000);
  await seedTitles(request, [FILM]);
  await mockSearch(page, [FILM]);

  // Me → Journal starts empty, with a way to write.
  await signUp(page, request, "journal-writer", "/me/journal");
  await expect(page.getByText("You haven’t written an article yet.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Write your first article" }).click();
  await expect(page).toHaveURL(/\/journal\/write$/);
  await expect(page.getByRole("heading", { level: 1, name: "Write an article" })).toBeVisible();

  const title = `Why it stayed with me ${Date.now()}`;
  await expect(async () => {
    await page.getByLabel("Title", { exact: true }).fill(title);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
  }).toPass();
  await page.getByLabel("One line under the title (optional)").fill("A quiet film about the people we might have been.");

  // What it's about: a title from the search, and a place.
  await page.getByPlaceholder("Search movies, series, books, manga and games").fill("journal test");
  await page.getByRole("button", { name: /Journal Test Film/ }).click();
  await page.getByRole("tab", { name: "Places" }).click();
  await page.getByRole("combobox", { name: "Find a country" }).fill("Japan");
  await page.getByRole("option", { name: "Japan" }).click();
  await expect(page.getByRole("button", { name: "Remove Journal Test Film" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Japan" })).toBeVisible();

  // Publishing asks for a category and enough text first; a draft doesn't.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await expect(page).toHaveURL(/\/journal\/write\?id=[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Pick 1 to 3 categories before publishing.")).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("textbox", { name: "Your article" }).fill(BODY);

  // The preview shows the Markdown, and a link stays text.
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Why it stayed" })).toBeVisible();
  await expect(page.locator("strong", { hasText: "Journal Test Film" })).toBeVisible();
  await expect(page.getByRole("link", { name: "my blog" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Write" }).click();

  await page.getByRole("switch", { name: /Send it to be Featured/ }).check();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published and sent to the team.")).toBeVisible();
  const id = new URL(page.url()).searchParams.get("id")!;
  await page.getByRole("link", { name: "See it" }).click();

  // The article: its writer sees where it stands; what it's about has Check.
  await expect(page).toHaveURL(new RegExp(`/journal/u/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByRole("region", { name: "Your article" }).getByText("Waiting for the team")).toBeVisible();
  const about = page.getByRole("region", { name: "What it’s about" });
  await expect(about.getByRole("link", { name: "Check Journal Test Film" })).toHaveAttribute("href", /\/collection\?add=1&pick=movie%3A9950001$/);
  await expect(about.getByRole("link", { name: "Check Japan" })).toHaveAttribute("href", /\/collection\/atlas\?country=jp$/);
  // Check opens quick add on the title, as Trending's posters do.
  await about.getByRole("link", { name: "Check Journal Test Film" }).click();
  await expect(page.getByRole("dialog", { name: "Add a title" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog").getByText("Journal Test Film").first()).toBeVisible();

  // Not Featured yet: someone else's Journal doesn't have it.
  const reader = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await reader.goto("/feed?tab=articles");
  await expect(reader.getByRole("link", { name: title })).toHaveCount(0);

  // The team features it: in everyone's Journal, with the stamp and the filters.
  await feature(request, id);
  await reader.goto("/feed?tab=articles&tag=review");
  const row = reader.getByRole("article").filter({ hasText: title });
  await expect(row.getByText("Featured", { exact: true })).toBeVisible();
  await expect(row.getByText("Review", { exact: true })).toBeVisible();
  await reader.getByLabel("About", { exact: true }).selectOption("game");
  await expect(reader).toHaveURL(/kind=game/);
  await expect(reader.getByRole("article").filter({ hasText: title })).toHaveCount(0);
  await reader.getByLabel("About", { exact: true }).selectOption("place");
  await expect(reader.getByRole("article").filter({ hasText: title })).toBeVisible();
  await reader.getByLabel("Sort", { exact: true }).selectOption("top");
  await expect(reader).toHaveURL(/sort=top/);

  // A visitor reads it: the byline, the text, Report, and Stamp through sign-in.
  await reader.getByRole("link", { name: title }).click();
  await expect(reader).toHaveURL(new RegExp(`/journal/u/${id}$`));
  await expect(reader.getByRole("region", { name: "Your article" })).toHaveCount(0);
  await expect(reader.getByText("It made me call an old friend")).toBeVisible();
  await expect(reader.getByRole("button", { name: "Report" })).toBeVisible();
  await expect(reader.getByRole("region", { name: "Stamp, save or share" }).getByRole("link", { name: "Stamp" })).toHaveAttribute(
    "href",
    `/auth?next=%2Fjournal%2Fu%2F${id}`,
  );
  await reader.close();

  // The writer sees the team's answer on Me's Journal, and their profile has a Journal tab.
  await page.goto("/me/journal");
  await expect(page.getByText("From the team: Lovely piece.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: title }).getByText("Featured", { exact: true })).toBeVisible();
  await page.goto(`/journal/u/${id}`);
  // The byline leads to the writer's page.
  await page.getByRole("article").locator('a[href^="/u/"]').first().click();
  await expect(page).toHaveURL(/\/u\/[a-z0-9_]+$/);
  await page.getByRole("link", { name: "Journal", exact: true }).click();
  await expect(page).toHaveURL(/\/u\/[a-z0-9_]+\/journal$/);
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  // Changing a Featured article sends it back to the team.
  await page.goto(`/journal/write?id=${id}`);
  await expect(page.getByText("It’s Featured. Changing it sends it back to the team")).toBeVisible();
  await page.getByRole("textbox", { name: "Your article" }).fill(`${BODY}\n\nOne more thought.`);
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("Published and sent to the team.")).toBeVisible();

  // Deleting it (after a confirmation) leaves Me's Journal empty again, and the Journal as the other tests expect it.
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page).toHaveURL(/\/me\/journal$/);
  await expect(page.getByRole("link", { name: "Write your first article" })).toBeVisible();
});

test("the team's review page is the team's only", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.skip(!process.env.ADMIN_EMAILS?.includes(JOURNAL_ADMIN), `ADMIN_EMAILS (server and test) doesn't include ${JOURNAL_ADMIN}`);
  test.setTimeout(90_000);

  // Anyone else gets a 404.
  await signUp(page, request, "journal-not-team", "/settings");
  await expect(page.getByRole("link", { name: "Journal review (team)" })).toHaveCount(0);
  expect((await page.goto("/admin/journal"))?.status()).toBe(404);
  await page.context().clearCookies();

  await signInAs(page, request, JOURNAL_ADMIN, "/settings");
  await page.getByRole("link", { name: "Journal review (team)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Journal review" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Sent to be Featured/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Reported/ })).toBeVisible();
});
