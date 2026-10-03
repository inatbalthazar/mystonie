import { describe, expect, it } from "vitest";
import { MOVIE_QUOTES, quoteOfTheDay } from "./quotes";

describe("quoteOfTheDay", () => {
  it("is the same all day and moves on the next day", () => {
    expect(quoteOfTheDay("2026-10-03")).toBe(quoteOfTheDay("2026-10-03"));
    expect(quoteOfTheDay("2026-10-04")).not.toBe(quoteOfTheDay("2026-10-03"));
  });

  it("goes through every quote before repeating", () => {
    const start = Date.parse("2026-10-03T00:00:00Z");
    const seen = new Set<string>();
    for (let i = 0; i < MOVIE_QUOTES.length; i++) seen.add(quoteOfTheDay(new Date(start + i * 86_400_000).toISOString().slice(0, 10)).text);
    expect(seen.size).toBe(MOVIE_QUOTES.length);
  });

  it("still gives a quote for a bad day", () => {
    expect(quoteOfTheDay("nope")).toBe(MOVIE_QUOTES[0]);
  });
});

describe("MOVIE_QUOTES", () => {
  it("are short, with a movie id each, and no line twice", () => {
    expect(new Set(MOVIE_QUOTES.map((q) => q.text)).size).toBe(MOVIE_QUOTES.length);
    for (const q of MOVIE_QUOTES) {
      expect(q.text.length).toBeLessThanOrEqual(120);
      expect(q.tmdbId).toMatch(/^\d+$/);
      expect(q.year).toBeGreaterThan(1900);
    }
  });
});
