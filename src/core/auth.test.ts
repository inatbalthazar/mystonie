import { describe, expect, it } from "vitest";
import { hasAuthCookie, isProtectedPath, localizedPath, safeNextPath, splitLocale } from "./auth";

const LOCALES = ["en", "th"];

describe("locale paths", () => {
  it("splits the locale prefix off", () => {
    expect(splitLocale("/th/settings", LOCALES, "en")).toEqual({ locale: "th", path: "/settings" });
    expect(splitLocale("/th", LOCALES, "en")).toEqual({ locale: "th", path: "/" });
    expect(splitLocale("/settings", LOCALES, "en")).toEqual({ locale: "en", path: "/settings" });
    expect(splitLocale("/thumbs", LOCALES, "en")).toEqual({ locale: "en", path: "/thumbs" });
    expect(splitLocale("/", LOCALES, "en")).toEqual({ locale: "en", path: "/" });
  });

  it("adds a prefix for non-default locales only", () => {
    expect(localizedPath("/auth", "en", "en")).toBe("/auth");
    expect(localizedPath("/auth", "th", "en")).toBe("/th/auth");
    expect(localizedPath("/", "th", "en")).toBe("/th");
  });
});

describe("protected paths", () => {
  it("covers app pages and their sub-pages only", () => {
    expect(isProtectedPath("/home")).toBe(true);
    expect(isProtectedPath("/collection")).toBe(true);
    expect(isProtectedPath("/title/series/66732")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/")).toBe(true);
    expect(isProtectedPath("/recap/01926000-0000-7000-8000-000000000001")).toBe(true);
    expect(isProtectedPath("/settings/account")).toBe(true);
    expect(isProtectedPath("/feed")).toBe(true);
    expect(isProtectedPath("/people")).toBe(true);
    expect(isProtectedPath("/board")).toBe(true);
    expect(isProtectedPath("/challenges")).toBe(true);
    // Club pages are public: signed-out visitors see the club and are asked to sign in to join.
    expect(isProtectedPath("/clubs/kdrama")).toBe(false);
    expect(isProtectedPath("/settingsx")).toBe(false);
    expect(isProtectedPath("/homework")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/auth")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site page paths with their query", () => {
    expect(safeNextPath("/th/settings")).toBe("/th/settings");
    expect(safeNextPath("/?ref=card")).toBe("/?ref=card");
  });

  it("rejects open redirects, API routes and junk", () => {
    for (const bad of [null, undefined, "", "settings", "//evil.com", "/\\evil.com", "https://evil.com", "/api/account", "/api", "/a\nb", "/%2F%2Fevil.com/.."]) {
      expect(safeNextPath(bad), String(bad)).toBe("/");
    }
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com"); // stays an encoded path on our site
    expect(safeNextPath("//evil.com", "/th")).toBe("/th");
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/");
  });
});

describe("hasAuthCookie", () => {
  it("spots Supabase session cookies, chunked or not", () => {
    expect(hasAuthCookie(["sb-127-auth-token"])).toBe(true);
    expect(hasAuthCookie(["theme", "sb-fuhwuwhiquysbfjmgtfi-auth-token.0"])).toBe(true);
    expect(hasAuthCookie(["sb-127-auth-token-code-verifier"])).toBe(false);
    expect(hasAuthCookie([])).toBe(false);
  });
});
