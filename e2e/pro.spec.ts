import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { uuidv7 } from "../src/core/ids";
import { canSeed, mailpitUp, seedTitles, signUp, type SeedTitle } from "./helpers";

// S2 Pro (ADR 0034) in Stripe test mode without Stripe: the dev server runs with PRO_ENABLED=true and test values
// for the Stripe variables, and this test plays Stripe by posting signed webhook events. Checkout and the portal
// themselves need real Stripe test keys and aren't covered here. Skips unless PRO_ENABLED=true and
// STRIPE_WEBHOOK_SECRET are set for both the server and the test.
const MOVIE: SeedTitle = { kind: "movie", externalId: "974001", name: "Pro Test Reel", year: 2024, posterPath: null, runtimeMin: 101 };
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/** The signed-in user's id, from the Supabase session cookie (possibly split into chunks). */
async function userId(page: Page): Promise<string> {
  const cookies = (await page.context().cookies()).filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
  const value = cookies
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((c) => decodeURIComponent(c.value))
    .join("");
  const session = JSON.parse(Buffer.from(value.replace(/^base64-/, ""), "base64url").toString("utf8")) as { access_token: string };
  return (JSON.parse(Buffer.from(session.access_token.split(".")[1]!, "base64url").toString("utf8")) as { sub: string }).sub;
}

/** Posts a `customer.subscription.*` event to the webhook, signed as Stripe would. */
async function webhook(page: Page, type: string, user: string, created: number, sub: Record<string, unknown> = {}) {
  const body = JSON.stringify({
    id: `evt_${created}`,
    type,
    created,
    data: {
      object: {
        id: `sub_e2e${user.replace(/-/g, "").slice(0, 20)}`,
        customer: `cus_e2e${user.replace(/-/g, "").slice(0, 20)}`,
        status: "active",
        cancel_at_period_end: false,
        metadata: { user_id: user },
        items: { data: [{ price: { id: "price_e2emonthly" }, current_period_end: created + 30 * 86_400 }] },
        ...sub,
      },
    },
  });
  const t = Math.floor(Date.now() / 1000);
  const signature = `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`;
  const res = await page.request.post("/api/billing/webhook", { headers: { "Stripe-Signature": signature, "Content-Type": "application/json" }, data: body });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as { changed?: boolean; ignored?: boolean };
}

async function openCard(page: Page) {
  await page.goto("/collection");
  await page.getByRole("button", { name: `Edit ${MOVIE.name}` }).first().click();
  await page.getByRole("button", { name: "Make a card" }).click();
  const celebration = page.getByRole("dialog", { name: `You finished ${MOVIE.name}!` });
  await expect(celebration).toBeVisible();
  // Round the styles to Film Strip.
  await expect(async () => {
    await celebration.getByRole("button", { name: "Change style" }).click();
    await expect(celebration.getByText(/^Film Strip \(Pro\)/)).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  return celebration;
}

test("Pro from verified webhooks only: locked, unlocked, replay-safe, then ended", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)) || !canSeed(), "local Supabase (Mailpit, service role key) is not available");
  test.skip(process.env.PRO_ENABLED !== "true" || SECRET.length < 8, "PRO_ENABLED and STRIPE_WEBHOOK_SECRET are not set");
  await seedTitles(request, [MOVIE]);
  await signUp(page, request, "pro");
  const res = await page.request.post("/api/entries", {
    data: { id: uuidv7(), title: { source: "tmdb", kind: "movie", externalId: MOVIE.externalId }, status: "finished" },
  });
  expect(res.status(), await res.text()).toBe(201);
  const user = await userId(page);

  // Not Pro: the Pro style is a locked preview.
  let celebration = await openCard(page);
  await expect(celebration.getByText("Film Strip is a Pro style.", { exact: false })).toBeVisible();
  await expect(celebration.getByRole("button", { name: "Download" })).toBeDisabled();
  await expect(celebration.getByRole("link", { name: "Unlock" })).toHaveAttribute("href", "/pro");

  // A forged event changes nothing.
  const forged = await page.request.post("/api/billing/webhook", { headers: { "Stripe-Signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` }, data: "{}" });
  expect(forged.status()).toBe(400);

  // Stripe says the subscription started: Pro.
  const start = Math.floor(Date.now() / 1000) - 60;
  expect(await webhook(page, "customer.subscription.created", user, start)).toMatchObject({ changed: true });
  expect(await webhook(page, "customer.subscription.created", user, start)).toMatchObject({ changed: true }); // replay: same values
  expect(await webhook(page, "customer.subscription.updated", user, start - 60, { status: "canceled" })).toMatchObject({ changed: false }); // older
  expect(await webhook(page, "invoice.paid", user, start)).toMatchObject({ ignored: true });

  celebration = await openCard(page);
  await expect(celebration.getByText("Film Strip is a Pro style.", { exact: false })).toHaveCount(0);
  const saved = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/cards" && r.method() === "POST");
  const savedResponse = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/cards");
  await celebration.getByRole("button", { name: "Download" }).click({ timeout: 15_000 });
  const cardBody = (await saved).postDataJSON() as Record<string, unknown>;
  expect(cardBody.templateId).toBe("filmStrip");
  expect((await savedResponse).status()).toBe(201);
  await celebration.getByRole("button", { name: "Done" }).click();

  // The Pro page and Settings know.
  await page.goto("/pro");
  await expect(page.getByText("You're Pro. Thank you!")).toBeVisible();
  await expect(page.getByText(/^Renews on /)).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Manage Pro" })).toBeVisible();

  // Cancelled in the portal: still Pro until the period ends.
  await webhook(page, "customer.subscription.updated", user, start + 30, { cancel_at_period_end: true });
  await page.goto("/pro");
  await expect(page.getByText(/^Cancelled: Pro stays on until /)).toBeVisible();

  // The period ended: Stripe deletes the subscription, Pro is off and the server refuses Pro cards again.
  await webhook(page, "customer.subscription.deleted", user, start + 60, { status: "canceled" });
  const refused = await page.request.post("/api/cards", { data: { ...cardBody, id: uuidv7() } });
  expect(refused.status()).toBe(403);
  expect(await refused.json()).toEqual({ error: "pro_required" });
  await page.goto("/pro");
  await expect(page.getByText("You're Pro. Thank you!")).toHaveCount(0);
});
