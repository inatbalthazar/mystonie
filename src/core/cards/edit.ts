import { REVIEW_MAX_CHARS } from "./types";

/**
 * Star tap: a new star sets a full rating, tapping the current full star makes it a half star,
 * and tapping it again restores the full star. Clearing is a separate action.
 */
export function nextRating(current: number | null | undefined, star: number): number {
  return current === star ? star - 0.5 : star;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Visible characters (Thai vowels/tone marks and emoji count as part of one character). */
export function reviewLength(text: string): number {
  return [...graphemes.segment(text)].length;
}

/** Review as typed: one line, cut to `REVIEW_MAX_CHARS` visible characters. */
export function clampReview(text: string, max = REVIEW_MAX_CHARS): string {
  const oneLine = text.replace(/\s*[\r\n]+\s*/g, " ");
  let out = "";
  let n = 0;
  for (const { segment } of graphemes.segment(oneLine)) {
    if (n++ >= max) break;
    out += segment;
  }
  return out;
}

/** Review as printed on the card: trimmed, or nothing. */
export function finalReview(text: string): string | null {
  return text.trim() || null;
}

/** Link shared next to the PNG, attributable in analytics (`ref=card&tpl=…`). */
export function cardShareUrl(pageUrl: string, template: string): string {
  const url = new URL(pageUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("ref", "card");
  url.searchParams.set("tpl", template);
  return url.toString();
}

/** Next (`step` 1) or previous (`step` -1) item, wrapping around (template swipe). */
export function cycle<T>(items: readonly T[], current: T, step: 1 | -1): T {
  const i = items.indexOf(current);
  return items[(i + step + items.length) % items.length]!;
}

/** `YYYY-MM-DD` of a local calendar date (the "finished" date defaults to today). */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
