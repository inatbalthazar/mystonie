import { expect, test, type APIRequestContext } from "@playwright/test";
import { LEGAL } from "../src/lib/legal";
import { MAILPIT, mailpitUp, signUp } from "./helpers";

// The beta (ADR 0055): the BETA stamp, "Report a problem" signed out and in, the operator's email, "Your reports",
// and Pro shown but not on sale. Needs the local Supabase stack (Mailpit) and `pnpm dev`.

/** The operator's notification whose body contains `token`, polled until it arrives. */
async function operatorEmail(request: APIRequestContext, token: string): Promise<{ Subject: string; Text: string }> {
  for (let i = 0; i < 30; i++) {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${LEGAL.contactEmail}" ${token}` } });
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages[0]) return (await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json();
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no operator email with ${token}`);
}

test("report a problem from any page, signed out and signed in", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)), "local Supabase (Mailpit) is not available");
  test.setTimeout(90_000);
  const main = page.getByRole("main");

  // Signed out: the footer link remembers the page it was on.
  await page.goto("/privacy");
  await expect(page.getByRole("link", { name: /Mystonie is in beta/ })).toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "Report a problem" }).click();
  await expect(page).toHaveURL(/\/feedback\?from=%2Fprivacy$/);
  await expect(main.getByRole("heading", { level: 1, name: "Mystonie is in beta" })).toBeVisible();
  await expect(main.getByText("Want a reply? Sign in first")).toBeVisible();

  const idea = `idea-${Date.now().toString(36)}`;
  await expect(async () => {
    // Retried: typing before hydration is lost.
    await main.getByText("An idea", { exact: true }).click();
    await main.getByLabel("What's your idea?").fill(`Please add ${idea}`);
    await expect(main.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 2000 });
  }).toPass();
  await main.getByRole("button", { name: "Send" }).click();
  await expect(main.getByText("Thank you! We read every report.")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Your reports" })).toHaveCount(0);
  const email = await operatorEmail(request, idea);
  expect(email.Subject).toBe(`Beta idea: Please add ${idea}`);
  expect(email.Text).toContain("/privacy");
  expect(email.Text).toContain("From: (signed out)");

  // Signed in: the report is listed under "Your reports" as received.
  await signUp(page, request, "feedback", "/feedback");
  const bug = `bug-${Date.now().toString(36)}`;
  await expect(async () => {
    await main.getByLabel("What happened? What did you expect?").fill(`The ${bug} button does nothing`);
    await expect(main.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 2000 });
  }).toPass();
  await main.getByRole("button", { name: "Send" }).click();
  await expect(main.getByText("Thank you! We read every report.")).toBeVisible();
  const yours = main.getByRole("listitem").filter({ hasText: bug });
  await expect(yours).toBeVisible();
  await expect(yours.getByText("Received")).toBeVisible();
  expect((await operatorEmail(request, bug)).Text).toMatch(/From: feedback-.+@example\.com \(/);

  // Settings has the beta card; a missing page offers a report too.
  await page.goto("/settings");
  await expect(main.getByRole("heading", { name: "Mystonie is in beta" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Report a problem" })).toHaveAttribute("href", "/feedback?from=%2Fsettings");
  await page.goto("/no-such-page-here");
  await expect(main.getByRole("link", { name: "Report a problem" })).toHaveAttribute("href", /kind=bug/);
});

test("Pro shows its plans but isn't on sale during the beta", async ({ page }) => {
  test.skip(process.env.PRO_ENABLED === "true", "Pro is switched on (e2e/pro.spec.ts covers it)");
  await page.goto("/pro");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Mystonie Pro" })).toBeVisible();
  await expect(main.getByText("Pro isn't on sale yet")).toBeVisible();
  await expect(main.getByText("$2.99 a month")).toBeVisible();
  await expect(main.getByText("$19.99 a year")).toBeVisible();
  const buttons = main.getByRole("button", { name: "Not on sale yet" });
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) await expect(button).toBeDisabled();
  await expect(main.getByText("Planned prices in USD.")).toBeVisible();
});
