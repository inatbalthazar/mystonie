import { describe, expect, it } from "vitest";
import { siteUrl } from "./site";

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    expect(
      siteUrl({
        NEXT_PUBLIC_SITE_URL: "https://mystonie.app",
        VERCEL_PROJECT_PRODUCTION_URL: "mystonie.vercel.app",
      }).href,
    ).toBe("https://mystonie.app/");
  });

  it("falls back to the Vercel production domain (host only, no scheme)", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "mystonie.vercel.app" }).href).toBe(
      "https://mystonie.vercel.app/",
    );
  });

  it("ignores blank values and falls back to local dev", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: " " }).href).toBe("http://localhost:3000/");
  });
});
