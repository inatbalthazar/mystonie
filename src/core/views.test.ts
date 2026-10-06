import { describe, expect, it } from "vitest";
import { isBotAgent, parseView, viewKey, viewsOf, viewsOfKind, visitorSeed } from "./views";

const ID = "0192f5a0-1c2b-7d3e-8f40-123456789abc";

describe("parseView", () => {
  it("takes a subject and an id", () => {
    expect(parseView({ subject: "card", id: ID.toUpperCase() })).toEqual({ subject: "card", id: ID });
  });

  it("refuses anything else", () => {
    expect(parseView({ subject: "entry", id: ID })).toBeNull();
    expect(parseView({ subject: "profile", id: "nope" })).toBeNull();
    expect(parseView(null)).toBeNull();
  });
});

describe("isBotAgent", () => {
  it("lets browsers through", () => {
    expect(isBotAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36")).toBe(false);
  });

  it("stops crawlers, previews and scripts", () => {
    expect(isBotAgent(null)).toBe(true);
    expect(isBotAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotAgent("Mozilla/5.0 HeadlessChrome/131.0")).toBe(true);
    expect(isBotAgent("curl/8.4.0")).toBe(true);
  });
});

describe("visitorSeed", () => {
  it("uses the account when signed in, else the address and browser, and changes every day", () => {
    expect(visitorSeed("2026-10-06", "u1", "1.2.3.4", "UA")).toBe("2026-10-06|u|u1");
    expect(visitorSeed("2026-10-06", null, "1.2.3.4", "UA")).toBe("2026-10-06|a|1.2.3.4|UA");
    expect(visitorSeed("2026-10-07", null, "1.2.3.4", "UA")).not.toBe(visitorSeed("2026-10-06", null, "1.2.3.4", "UA"));
  });
});

describe("view counts", () => {
  const counts = new Map([
    [viewKey("card", "a"), { recent: 2, total: 9 }],
    [viewKey("card", "b"), { recent: 1, total: 1 }],
    [viewKey("profile", "me"), { recent: 5, total: 40 }],
  ]);

  it("reads one thing, or none", () => {
    expect(viewsOf(counts, "card", "a")).toEqual({ recent: 2, total: 9 });
    expect(viewsOf(counts, "post", "x")).toEqual({ recent: 0, total: 0 });
  });

  it("adds up a kind", () => {
    expect(viewsOfKind(counts, "card")).toEqual({ recent: 3, total: 10 });
    expect(viewsOfKind(counts, "post")).toEqual({ recent: 0, total: 0 });
  });
});
