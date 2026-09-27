import { expect, test } from "@playwright/test";
import { lastEmail, mailpitUp, uniqueEmail } from "./helpers";

test("app pages send signed-out visitors to sign-in and back", async ({ page }) => {
  await page.goto("/th/settings");
  await expect(page).toHaveURL(/\/th\/auth\?next=%2Fth%2Fsettings$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("เปิดสมุดสะสมของคุณ");
  await expect(page.getByRole("banner").getByRole("link", { name: "เข้าสู่ระบบ" })).toBeVisible();
});

test("email code: sign up, see settings, delete the account", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)), "local Supabase (Mailpit) is not running");
  const email = uniqueEmail("code");

  await page.goto("/auth?next=/settings");
  await page.getByLabel("Email").fill("nope");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That doesn't look like an email address.");

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByText(`We emailed a code to ${email}.`)).toBeVisible();

  const message = await lastEmail(request, email);
  const code = message.Subject.match(/^(\d{6,10}) /)?.[1];
  expect(code, message.Subject).toBeTruthy();
  expect(message.Subject).toBe(`${code} is your Mystonie sign-in code`);

  await page.getByLabel("Code from the email").fill("000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That code didn't work. Check it, or send a new one.");

  await page.getByLabel("Code from the email").fill(code!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole("main").getByLabel("Username")).toHaveValue(/^code_[0-9_]+$/); // from the email local part
  await expect(page.getByText("Email code")).toBeVisible();
  // The browser's time zone was saved at sign-up (Playwright uses the machine's zone).
  const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  await expect(page.getByRole("main").getByLabel("Time zone")).toHaveValue(tz);
  await expect(page.getByRole("banner").getByRole("link", { name: "Your account" })).toBeVisible();

  // Signed in: /auth moves straight on.
  await page.goto("/auth?next=/settings");
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Yes, delete everything" }).click();
  await expect(page.getByRole("status")).toContainText("Your account and data are deleted.");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/auth\?next=%2Fsettings$/);
});

test("email link in Thai: confirm page signs in after a tap, sign out ends the session", async ({ page, request }) => {
  test.skip(!(await mailpitUp(request)), "local Supabase (Mailpit) is not running");
  const email = uniqueEmail("link");

  await page.goto("/th/auth?next=/th/settings");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByRole("button", { name: "ส่งรหัสทางอีเมล" }).click();
  await expect(page.getByText(`เราส่งรหัสไปที่ ${email} แล้ว`, { exact: false })).toBeVisible();

  const message = await lastEmail(request, email);
  expect(message.Subject).toMatch(/^\d{6,10} คือรหัสเข้าสู่ระบบ Mystonie ของคุณ$/);
  const link = message.Text.match(/https?:\/\/\S+\/th\/auth\/confirm\?\S+/)?.[0];
  expect(link, message.Text).toBeTruthy();

  // Opening the link (as a mail scanner would) doesn't sign in by itself.
  await page.goto(link!);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("อีกนิดเดียว");
  await page.getByRole("button", { name: "เข้าสู่ระบบเลย" }).click();
  await expect(page).toHaveURL(/\/th\/settings$/);
  await expect(page.getByRole("main").getByLabel("ภาษา")).toHaveValue("th"); // profile locale from the page they signed up on

  // A used link can't sign in again.
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/th$/);
  await page.goto(link!);
  await page.getByRole("button", { name: "เข้าสู่ระบบเลย" }).click();
  await expect(page).toHaveURL(/\/th\/auth\?error=link/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("ลิงก์เข้าสู่ระบบนี้หมดอายุหรือถูกใช้ไปแล้ว ส่งรหัสใหม่ให้ตัวเองได้เลย");
});
