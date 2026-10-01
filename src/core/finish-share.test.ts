import { describe, expect, it } from "vitest";
import { isRare, liveShare, shareFormat, shownShare } from "./finish-share";

const pct = (share: number, locale = "en") => {
  const f = shareFormat(share);
  return (f.under ? "<" : "") + new Intl.NumberFormat(locale, f.options).format(f.value);
};

describe("shownShare", () => {
  it("shows a share once Mystonie has 1,000 members", () => {
    expect(shownShare(0.004, 1000)).toBe(0.004);
    expect(shownShare("0.004", 25_000)).toBe(0.004);
    expect(shownShare(0.004, 999)).toBeNull();
    expect(shownShare(0.5, null)).toBeNull();
  });
  it("drops anything that isn't a share", () => {
    for (const bad of [null, undefined, 0, -0.1, 1.5, Number.NaN, "abc"]) expect(shownShare(bad, 5000), String(bad)).toBeNull();
    expect(shownShare(1, 5000)).toBe(1);
  });
});

describe("liveShare", () => {
  it("is finishers out of members, from 1,000 members", () => {
    expect(liveShare(32, 1000)).toBe(0.032);
    expect(liveShare(32, 999)).toBeNull();
    expect(liveShare(0, 5000)).toBeNull();
    expect(liveShare(1200, 1000)).toBe(1);
  });
});

describe("isRare", () => {
  it("is 10% or less", () => {
    expect(isRare(0.1)).toBe(true);
    expect(isRare(0.004)).toBe(true);
    expect(isRare(0.11)).toBe(false);
    expect(isRare(null)).toBe(false);
  });
});

describe("shareFormat", () => {
  it("prints whole percents, one decimal, then one digit, never 0%", () => {
    expect(pct(0.48)).toBe("48%");
    expect(pct(0.1)).toBe("10%");
    expect(pct(0.043)).toBe("4.3%");
    expect(pct(0.01)).toBe("1%");
    expect(pct(0.0043)).toBe("0.4%");
    expect(pct(0.00031)).toBe("0.03%");
    expect(pct(0.0001)).toBe("0.01%");
    expect(pct(0.00004)).toBe("<0.01%");
  });
  it("follows the locale", () => {
    expect(pct(0.043, "th")).toBe("4.3%");
    expect(pct(0.043, "de")).toBe("4,3 %");
  });
});
