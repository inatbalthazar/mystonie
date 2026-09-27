import { describe, expect, it } from "vitest";
import { contrast, DEFAULT_PALETTE, paletteFromPixels } from "./palette";
import { isLatinSafe, scriptsIn, titleSizeStep, watchMinutes } from "./text";

const pixels = (...colors: [number, number, number, number][]) =>
  Uint8ClampedArray.from(colors.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat()));

describe("paletteFromPixels", () => {
  it("falls back to the default palette for empty or transparent input", () => {
    expect(paletteFromPixels([])).toEqual(DEFAULT_PALETTE);
    expect(paletteFromPixels([10, 10, 10, 0])).toEqual(DEFAULT_PALETTE);
  });

  it.each([
    ["dark red poster", pixels([150, 20, 20, 80], [240, 200, 40, 20])],
    ["near-white poster", pixels([245, 245, 240, 90], [30, 90, 200, 10])],
    ["grey poster", pixels([128, 128, 128, 100])],
    ["neon poster", pixels([0, 255, 200, 60], [255, 0, 180, 40])],
  ])("keeps text readable on a %s", (_, px) => {
    const p = paletteFromPixels(px);
    expect(contrast(p.text, p.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.muted, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.accent, p.background)).toBeGreaterThanOrEqual(3);
    for (const c of Object.values(p)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("takes the background hue from the dominant colour", () => {
    const p = paletteFromPixels(pixels([20, 40, 160, 90], [250, 250, 250, 10]));
    const [r, , b] = [1, 3, 5].map((i) => parseInt(p.background.slice(i, i + 2), 16));
    expect(b!).toBeGreaterThan(r!);
  });
});

describe("scriptsIn", () => {
  it("detects the scripts that need Noto fallbacks", () => {
    expect(scriptsIn("Stranger Things", "Loved it!")).toEqual([]);
    expect(scriptsIn("ดีมาก")).toEqual(["thai"]);
    expect(scriptsIn("기생충")).toEqual(["korean"]);
    expect(scriptsIn("千と千尋の神隠し")).toEqual(["japanese"]);
    expect(scriptsIn("Parasite", null, "재밌다 สนุก")).toEqual(["thai", "korean"]);
  });
});

describe("watchMinutes", () => {
  it("multiplies episode runtime for series", () => {
    expect(watchMinutes({ kind: "series", runtimeMin: 50, episodeCount: 42 })).toBe(2100);
    expect(watchMinutes({ kind: "series", runtimeMin: 50, episodeCount: null })).toBeNull();
    expect(watchMinutes({ kind: "movie", runtimeMin: 133, episodeCount: null })).toBe(133);
    expect(watchMinutes({ kind: "movie", runtimeMin: null })).toBeNull();
  });
});

describe("titleSizeStep", () => {
  it("shrinks long titles, counting code points", () => {
    expect(titleSizeStep("Parasite")).toBe(0);
    expect(titleSizeStep("Stranger Things: Tales")).toBe(1);
    expect(titleSizeStep("Dr. Strangelove or: How I Learned to Stop Worrying")).toBe(3);
    expect(titleSizeStep("千と千尋の神隠し")).toBe(0);
  });
});

describe("isLatinSafe", () => {
  it("accepts Latin titles with accents and punctuation", () => {
    expect(isLatinSafe("Amélie")).toBe(true);
    expect(isLatinSafe("Dr. Strangelove — or: How I Learned…")).toBe(true);
    expect(isLatinSafe("Łódź")).toBe(true);
  });

  it("rejects other scripts and emoji", () => {
    for (const s of ["千と千尋の神隠し", "기생충", "เพราะเราคู่กัน", "Кино", "Up 🎈"]) expect(isLatinSafe(s)).toBe(false);
  });
});
