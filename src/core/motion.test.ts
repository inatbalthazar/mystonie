import { describe, expect, it } from "vitest";
import {
  countsUp,
  countUpText,
  sheetDismiss,
  SWIPE_BAND,
  swipeFade,
  swipeFollow,
  swipeIntent,
  swipeLeave,
  swipeResult,
  tabDirection,
} from "./motion";

describe("tabDirection", () => {
  it("goes next to the right and back to the left, nowhere when it stays", () => {
    expect(tabDirection(0, 2)).toBe("tab-next");
    expect(tabDirection(2, 1)).toBe("tab-prev");
    expect(tabDirection(1, 1)).toBeNull();
    expect(tabDirection(-1, 1)).toBeNull();
  });
});

describe("swipeIntent", () => {
  it("waits for a few pixels, then tells a swipe from a scroll", () => {
    expect(swipeIntent(4, 3)).toBe("pending");
    expect(swipeIntent(-30, 8)).toBe("horizontal");
    expect(swipeIntent(14, 40)).toBe("vertical");
    // A diagonal is a scroll: sideways has to win clearly.
    expect(swipeIntent(20, 18)).toBe("vertical");
  });
});

describe("swipeResult", () => {
  it("changes tabs after a long swipe, either way", () => {
    expect(swipeResult(-90, 600)).toBe("next");
    expect(swipeResult(90, 600)).toBe("prev");
  });
  it("changes tabs after a short flick, but not after a short slow drag", () => {
    expect(swipeResult(-40, 60)).toBe("next");
    expect(swipeResult(-40, 400)).toBeNull();
    expect(swipeResult(-20, 10)).toBeNull();
  });
});

describe("swipeFollow", () => {
  it("goes with the finger toward a tab, never past the page's width", () => {
    expect(swipeFollow(0, 360)).toBe(0);
    expect(swipeFollow(-100, 360)).toBe(-90);
    expect(swipeFollow(100, 360)).toBe(90);
    expect(swipeFollow(-3000, 360)).toBe(-360);
  });
  it("gives like a rubber band toward no tab, up to the band, keeping the side", () => {
    expect(swipeFollow(30, 360, false)).toBeGreaterThan(0);
    expect(swipeFollow(-30, 360, false)).toBeLessThan(0);
    expect(swipeFollow(60, 360, false)).toBeLessThan(20);
    expect(swipeFollow(3000, 360, false)).toBeLessThanOrEqual(SWIPE_BAND);
  });
});

describe("swipeFade", () => {
  it("fades as the page goes, down to 0.35", () => {
    expect(swipeFade(0, 360)).toBe(1);
    expect(swipeFade(-180, 360)).toBeCloseTo(0.675);
    expect(swipeFade(900, 360)).toBeCloseTo(0.35);
  });
});

describe("swipeLeave", () => {
  it("waits further out on the swipe's side, at least a third of the way, never past the page", () => {
    expect(swipeLeave(-80, 360)).toBe(-120);
    expect(swipeLeave(80, 360)).toBe(120);
    expect(swipeLeave(-200, 360)).toBe(-224);
    expect(swipeLeave(350, 360)).toBe(360);
  });
});

describe("sheetDismiss", () => {
  it("closes after a long drag down or a quick flick, never upwards", () => {
    expect(sheetDismiss(120, 900)).toBe(true);
    expect(sheetDismiss(40, 50)).toBe(true);
    expect(sheetDismiss(40, 500)).toBe(false);
    expect(sheetDismiss(-200, 50)).toBe(false);
  });
});

describe("countUpText", () => {
  it("is the value itself at the end, and zeros at the start", () => {
    expect(countUpText("1,234", 1)).toBe("1,234");
    expect(countUpText("1,234", 0)).toBe("0");
    expect(countUpText("12h 30m", 0)).toBe("0h 0m");
  });
  it("counts every number up, written the same way", () => {
    const mid = countUpText("12,500 titles", 0.5);
    expect(mid).toMatch(/^\d{1,2},\d{3} titles$/);
    expect(countUpText("1.234.567", 0.999)).toMatch(/^1\.234\.\d{3}$/);
    expect(countUpText("1 234", 0.5)).toMatch(/^\d{1,3}( \d{3})?$/);
  });
  it("keeps a padded minute padded", () => {
    expect(countUpText("2h 05m", 0)).toBe("0h 00m");
  });
});

describe("countsUp", () => {
  it("counts numbers above one, not words or a single title", () => {
    expect(countsUp("128")).toBe(true);
    expect(countsUp("1h 30m")).toBe(true);
    expect(countsUp("1")).toBe(false);
    expect(countsUp("—")).toBe(false);
  });
});
