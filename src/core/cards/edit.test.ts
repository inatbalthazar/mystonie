import { describe, expect, it } from "vitest";
import { cardShareUrl, clampReview, cycle, finalReview, localDateString, nextRating, reviewLength } from "./edit";

describe("nextRating", () => {
  it("sets a full star, halves it on a second tap, restores it on a third", () => {
    expect(nextRating(null, 4)).toBe(4);
    expect(nextRating(4, 4)).toBe(3.5);
    expect(nextRating(3.5, 4)).toBe(4);
    expect(nextRating(1, 1)).toBe(0.5);
    expect(nextRating(2.5, 5)).toBe(5);
  });
});

describe("review", () => {
  it("counts Thai and emoji as visible characters", () => {
    expect(reviewLength("ดีมาก")).toBe(4); // ด ี ม า ก → ดี is one grapheme
    expect(reviewLength("👍🏽")).toBe(1);
    expect(reviewLength("")).toBe(0);
  });

  it("cuts to the limit without splitting a character", () => {
    expect(clampReview("a".repeat(100))).toHaveLength(80);
    expect(clampReview("ที่สุด", 2)).toBe("ที่สุ");
    expect(clampReview("👍🏽👍🏽", 1)).toBe("👍🏽");
  });

  it("keeps it on one line", () => {
    expect(clampReview("so\n\ngood")).toBe("so good");
  });

  it("prints nothing for blank reviews", () => {
    expect(finalReview("  ")).toBeNull();
    expect(finalReview(" wow ")).toBe("wow");
  });
});

describe("cardShareUrl", () => {
  it("replaces the query with ref and tpl", () => {
    expect(cardShareUrl("https://mystonie.com/th?q=x#top", "boldStats")).toBe("https://mystonie.com/th?ref=card&tpl=boldStats");
  });
});

describe("cycle", () => {
  it("wraps both ways", () => {
    const items = ["a", "b", "c"] as const;
    expect(cycle(items, "c", 1)).toBe("a");
    expect(cycle(items, "a", -1)).toBe("c");
    expect(cycle(items, "a", 1)).toBe("b");
  });
});

describe("localDateString", () => {
  it("pads month and day", () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
