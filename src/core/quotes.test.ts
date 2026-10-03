import { describe, expect, it } from "vitest";
import { MOVIE_QUOTES, QUOTE_MAX_CHARS, quoteFitsOneLine } from "./quotes";

describe("quoteFitsOneLine", () => {
  it("guesses short quotes fit one line", () => {
    expect(quoteFitsOneLine("Why so serious?")).toBe(true);
    expect(quoteFitsOneLine("You're gonna need a bigger boat.")).toBe(false);
  });
});

describe("MOVIE_QUOTES", () => {
  it("are short, with a movie id each, and no line twice", () => {
    expect(new Set(MOVIE_QUOTES.map((q) => q.text)).size).toBe(MOVIE_QUOTES.length);
    for (const q of MOVIE_QUOTES) {
      expect(q.text.length).toBeLessThanOrEqual(QUOTE_MAX_CHARS);
      expect(q.tmdbId).toMatch(/^\d+$/);
      expect(q.year).toBeGreaterThan(1900);
    }
  });
});
