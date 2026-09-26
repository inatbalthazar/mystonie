// Poster → card palette. Input is RGBA pixels from a small downscaled poster (the browser
// draws it on a canvas); this module stays pure so it can be tested and reused.
import type { Palette } from "./types";

type Rgb = [number, number, number];

export const DEFAULT_PALETTE: Palette = {
  background: "#1c1b1a",
  surface: "#2a2826",
  text: "#fafaf9",
  muted: "#c9c5bf",
  accent: "#e8b04b",
  paper: "#f6f2ea",
  ink: "#1f1d1b",
};

const hex = ([r, g, b]: Rgb) =>
  "#" + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");

const parse = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;

/** WCAG relative luminance. */
export function luminance(color: string): number {
  const [r, g, b] = parse(color).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb;

function saturation([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Darkens (or lightens) `color` until `against` reaches `min` contrast on it. */
function ensureContrast(color: Rgb, against: string, min: number): Rgb {
  const target: Rgb = luminance(against) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(color, target, t);
    if (contrast(hex(c), against) >= min) return c;
  }
  return target;
}

/**
 * Picks the poster's dominant colour for the background (darkened so white text reads at
 * WCAG AA 4.5:1) and its most saturated common colour as the accent.
 */
export function paletteFromPixels(rgba: ArrayLike<number>): Palette {
  const buckets = new Map<number, { n: number; sum: Rgb }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3]! < 128) continue; // transparent
    const rgb: Rgb = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!];
    const key = ((rgb[0] >> 4) << 8) | ((rgb[1] >> 4) << 4) | (rgb[2] >> 4);
    const b = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] };
    b.n++;
    b.sum = [b.sum[0] + rgb[0], b.sum[1] + rgb[1], b.sum[2] + rgb[2]];
    buckets.set(key, b);
  }
  if (buckets.size === 0) return DEFAULT_PALETTE;

  const colors = [...buckets.values()]
    .map((b) => ({ n: b.n, rgb: b.sum.map((s) => s / b.n) as Rgb }))
    .sort((a, b) => b.n - a.n);
  const total = colors.reduce((s, c) => s + c.n, 0);

  const text = "#ffffff";
  const background = ensureContrast(colors[0]!.rgb, text, 7); // AAA headroom for small stats labels
  const common = colors.filter((c) => c.n / total >= 0.02);
  const vivid = [...common].sort((a, b) => saturation(b.rgb) - saturation(a.rgb))[0]!.rgb;
  const accent = saturation(vivid) > 0.25 ? vivid : parse(DEFAULT_PALETTE.accent);

  const bg = hex(background);
  return {
    background: bg,
    surface: hex(mix(background, [255, 255, 255], 0.08)),
    text,
    muted: hex(ensureContrast(mix(background, [255, 255, 255], 0.7), bg, 4.5)),
    // The accent is used for large text and shapes, so it needs 3:1 against the background.
    accent: hex(ensureContrast(accent, bg, 3)),
    paper: DEFAULT_PALETTE.paper,
    ink: DEFAULT_PALETTE.ink,
  };
}
