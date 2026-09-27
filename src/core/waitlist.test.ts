import { describe, expect, it } from "vitest";
import { isValidEmail, parseWaitlistBody, waitlistSource } from "./waitlist";

const LOCALES = ["en", "th"] as const;
const parse = (body: unknown) => parseWaitlistBody(body, LOCALES, "en");

describe("parseWaitlistBody", () => {
  it("normalizes the email and keeps a known locale", () => {
    expect(parse({ email: "  Someone@Example.COM ", locale: "th", source: "placement=home" })).toEqual({
      kind: "ok",
      signup: { email: "someone@example.com", locale: "th", source: "placement=home" },
    });
  });

  it("falls back to the default locale and a null source", () => {
    expect(parse({ email: "a@b.co", locale: "xx", source: "  " })).toEqual({
      kind: "ok",
      signup: { email: "a@b.co", locale: "en", source: null },
    });
  });

  it("flags a filled honeypot as a bot, even with a valid email", () => {
    expect(parse({ email: "a@b.co", website: "http://spam" })).toEqual({ kind: "bot" });
    expect(parse({ email: "a@b.co", website: "" }).kind).toBe("ok");
  });

  it("rejects bad input", () => {
    for (const body of [null, "a@b.co", {}, { email: 42 }, { email: "nope" }, { email: "a@b" }, { email: "a b@c.co" }]) {
      expect(parse(body)).toEqual({ kind: "invalid" });
    }
  });

  it("caps the source length", () => {
    const r = parse({ email: "a@b.co", source: "x".repeat(500) });
    expect(r.kind === "ok" && r.signup.source).toHaveLength(200);
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary and unicode addresses, rejects over-long ones", () => {
    expect(isValidEmail("first.last+tag@sub.example.co.uk")).toBe(true);
    expect(isValidEmail("ผู้ใช้@ตัวอย่าง.ไทย")).toBe(true);
    expect(isValidEmail(`${"a".repeat(320)}@b.co`)).toBe(false);
  });
});

describe("waitlistSource", () => {
  it("keeps the placement and landing attribution only", () => {
    expect(waitlistSource("after_card", "?ref=card&tpl=polaroid&q=secret")).toBe("placement=after_card&ref=card&tpl=polaroid");
    expect(waitlistSource("home", "")).toBe("placement=home");
    expect(waitlistSource("home", "?utm_source=x&utm_campaign=launch")).toBe("placement=home&utm_source=x&utm_campaign=launch");
  });
});
