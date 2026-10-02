import { expect, test } from "@playwright/test";

// The landing page's way in (ADR 0071): the hero's button and the box under the card maker go to /auth, where
// sign-up and sign-in are one step. (The waitlist's form is gone; its API stays for the launch email.)
test("the landing page invites visitors to sign up", async ({ page }) => {
  await page.goto("/th");
  await expect(page.getByRole("heading", { name: "เก็บทุกเรื่องที่ดูจบไว้ในคอลเลกชันเดียว" })).toBeVisible();
  await expect(page.getByRole("link", { name: "เปิดคอลเลกชันของคุณ" })).toBeHidden();

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Start your collection", exact: true })).toHaveAttribute("href", "/auth");
  await page.getByRole("link", { name: "Start your collection, free" }).click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Open your collection");
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeVisible();
});

test("privacy and terms are linked from the footer and name the operator contact", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
  await expect(page.getByRole("link", { name: "privacy@mystonie.com" }).first()).toHaveAttribute("href", "mailto:privacy@mystonie.com");
  await expect(page.getByRole("link", { name: "codenat.me" })).toHaveAttribute("href", "https://www.codenat.me/");

  await page.getByRole("contentinfo").getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of Use");
  await expect(page).toHaveURL(/\/terms$/);

  // The tip link (ADR 0049): in the footer, opening Buy Me a Coffee in a new tab; the Terms say what a tip is.
  const tip = page.getByRole("contentinfo").getByRole("link", { name: /Buy Stonie a coffee/ });
  await expect(tip).toHaveAttribute("href", "https://buymeacoffee.com/inatbalthab");
  await expect(tip).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("heading", { name: "Tips" })).toBeVisible();
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
