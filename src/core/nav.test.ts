import { describe, expect, it } from "vitest";
import { navTab } from "./nav";

describe("navTab", () => {
  it("lights the tab a page belongs to", () => {
    expect(navTab("/home")).toBe("home");
    expect(navTab("/collection")).toBe("collection");
    expect(navTab("/collection/")).toBe("collection");
    expect(navTab("/collection/atlas")).toBe("collection");
    expect(navTab("/feed")).toBe("feed");
    expect(navTab("/me")).toBe("me");
    expect(navTab("/settings")).toBe("me");
    expect(navTab("/settings/warnings")).toBe("me");
  });

  it("lights Home on the community pages (ADR 0078) and Feed on the Journal", () => {
    for (const path of ["/people", "/board", "/challenges", "/clubs", "/clubs/horror", "/reel"]) {
      expect(navTab(path), path).toBe("home");
    }
    for (const path of ["/journal", "/journal/how-to-write"]) {
      expect(navTab(path), path).toBe("feed");
    }
  });

  it("lights Me on its Stats tab and Year in Review", () => {
    expect(navTab("/stats")).toBe("me");
    expect(navTab("/review/2026")).toBe("me");
  });

  it("lights nothing elsewhere", () => {
    for (const path of [
      "/",
      "/title/series/66732",
      "/u/someone",
      "/c/abc",
      "/homework",
      "/meet",
      "/statsx",
      "/feeds",
      "/reels",
      "/journals",
      "/atlas",
    ]) {
      expect(navTab(path), path).toBeNull();
    }
  });
});
