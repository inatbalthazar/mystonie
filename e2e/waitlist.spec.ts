import { expect, test } from "@playwright/test";

// The API itself is checked against Supabase by hand (see S0 spec); here the route is stubbed so
// runs don't fill the local waitlist or hit its rate limit.
test("home waitlist form sends email, locale and landing attribution", async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/waitlist", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });

  await page.goto("/th?ref=card&tpl=polaroid");
  const email = page.getByPlaceholder("you@example.com");
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "ลงชื่อ" }).click();
  await expect(page.getByText("ตรวจสอบอีเมลอีกครั้ง")).toBeVisible();
  expect(bodies).toHaveLength(0);

  await email.fill("fan@example.com");
  await page.getByRole("button", { name: "ลงชื่อ" }).click();
  await expect(page.getByRole("status")).toContainText("ลงชื่อแล้ว");
  expect(await page.evaluate(() => window.__mystonieEvents)).toContainEqual(["waitlist_joined", { placement: "home" }]);
  expect(bodies).toEqual([
    { email: "fan@example.com", locale: "th", website: "", source: "placement=home&ref=card&tpl=polaroid" },
  ]);
});

test("the honeypot is invisible and out of the tab order", async ({ page }) => {
  await page.goto("/");
  const honeypot = page.locator('input[name="website"]');
  await expect(honeypot).toHaveAttribute("tabindex", "-1");
  const box = await honeypot.boundingBox();
  expect(box === null || box.x + box.width <= 0).toBe(true);
});

test("privacy and terms are linked from the footer and name the operator contact", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
  await expect(page.getByRole("link", { name: "inatbalthazar@gmail.com" }).first()).toHaveAttribute("href", "mailto:inatbalthazar@gmail.com");
  await expect(page.getByRole("link", { name: "codenat.me" })).toHaveAttribute("href", "https://www.codenat.me/");

  await page.getByRole("contentinfo").getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of Use");
  await expect(page).toHaveURL(/\/terms$/);
});

test("the unsubscribe link asks first, then posts the signed id", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/api/unsubscribe?**", async (route) => {
    calls.push(`${route.request().method()} ${new URL(route.request().url()).search}`);
    await route.fulfill({ json: { ok: true } });
  });

  await page.goto("/unsubscribe?id=0192f4c5-7a1b-7c3d-8e4f-5a6b7c8d9e0f&t=tok");
  await expect(page.getByText("Stop getting Mystonie emails at this address?")).toBeVisible();
  expect(calls).toEqual([]); // opening the link changes nothing
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("status")).toContainText("You're unsubscribed");
  expect(calls).toEqual(["POST ?id=0192f4c5-7a1b-7c3d-8e4f-5a6b7c8d9e0f&t=tok"]);

  await page.goto("/th/unsubscribe");
  await expect(page.getByText("ลิงก์ยกเลิกนี้ใช้ไม่ได้")).toBeVisible();
});
