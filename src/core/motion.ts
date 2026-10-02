/**
 * Motion helpers (ADR 0070): which way a navigation goes, when a finger's drag is a swipe, and the in-between frames of
 * a number counting up. Pure, so the gestures behave the same in the web app and a future native one.
 */

/** Which way a navigation goes, for the page transition: `<html data-nav>`. */
export type NavDirection = "forward" | "back" | "tab" | "tab-next" | "tab-prev" | "none";

/** A page's own tabs (the feed's, Me's Album · Stats, the collection's shelves): sideways, in the tabs' order. */
export function tabDirection(from: number, to: number): NavDirection | null {
  if (from < 0 || to < 0 || from === to) return null;
  return to > from ? "tab-next" : "tab-prev";
}

/** How far (px) a finger moves before a drag counts as a swipe or a scroll. */
export const SWIPE_SLOP = 10;
/** How far (px) a swipe has to go, let go slowly, to change tabs. */
export const SWIPE_DISTANCE = 72;
/** A quick flick (px/ms) changes tabs from a shorter swipe (`SWIPE_FLICK_DISTANCE`). */
export const SWIPE_FLICK = 0.45;
export const SWIPE_FLICK_DISTANCE = 32;
/** Touches that start this close (px) to the screen's side edges belong to the system's back gesture. */
export const SWIPE_EDGE = 24;

/**
 * What a drag is, so far: still too short to say, sideways (a swipe), or up and down (a scroll, left to the page).
 * Sideways means clearly more across than down.
 */
export function swipeIntent(dx: number, dy: number): "pending" | "horizontal" | "vertical" {
  if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return "pending";
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
}

/** A sideways swipe let go after `ms`: "next" (finger went left), "prev" (right), or nothing (back to where it was). */
export function swipeResult(dx: number, ms: number): "next" | "prev" | null {
  const speed = Math.abs(dx) / Math.max(ms, 1);
  const far = Math.abs(dx) >= SWIPE_DISTANCE || (speed >= SWIPE_FLICK && Math.abs(dx) >= SWIPE_FLICK_DISTANCE);
  if (!far) return null;
  return dx < 0 ? "next" : "prev";
}

/** How far (px) the page gives toward a side with no tab, like a rubber band. */
export const SWIPE_BAND = 40;

/**
 * How far the page follows a swipe of `dx` px across a page `width` px wide. Toward a tab (`open`), it goes with
 * the finger, as if pulled off screen; toward no tab, it gives a third of the finger, easing off, never more than
 * `SWIPE_BAND`.
 */
export function swipeFollow(dx: number, width: number, open = true): number {
  if (open) return Math.max(-width, Math.min(width, dx * 0.9));
  const pulled = dx / 3;
  return Math.sign(pulled) * SWIPE_BAND * (1 - Math.exp(-Math.abs(pulled) / SWIPE_BAND));
}

/** How visible the page is when it has followed a swipe `x` px of `width`: it fades as it goes, down to 0.35. */
export function swipeFade(x: number, width: number): number {
  return 1 - Math.min(Math.abs(x) / Math.max(width, 1), 1) * 0.65;
}

/**
 * Where a page that was swiped away waits (px) while the next tab loads: on past where the finger let it go, at
 * least a third of the way out, on the swipe's side. The page transition then carries it off.
 */
export function swipeLeave(x: number, width: number): number {
  const side = x < 0 ? -1 : 1;
  return side * Math.min(Math.max(Math.abs(x) + 24, width / 3), width);
}

/** A sheet dragged down by `dy` px and let go after `ms`: true closes it. */
export function sheetDismiss(dy: number, ms: number): boolean {
  if (dy <= 0) return false;
  return dy >= 110 || (dy >= 32 && dy / Math.max(ms, 1) >= 0.5);
}

// A number as people write it: 1234, 1,234 or 1.234 (thousands), 1 234 (with a thin or no-break space).
const NUMBER = /\d{1,3}(?:([,.   ])\d{3})+(?!\d)|\d+/g;

/**
 * `value` (already formatted: "1,234", "12h 30m", "3 titles") with every number at `progress` (0 to 1) of its way up
 * from 0, written the same way (same thousands separator). Eased out, so it slows into the real value.
 */
export function countUpText(value: string, progress: number): string {
  const p = Math.min(Math.max(progress, 0), 1);
  if (p >= 1) return value;
  const eased = 1 - Math.pow(1 - p, 3);
  return value.replace(NUMBER, (token, separator: string | undefined) => {
    const target = Number(separator ? token.split(separator).join("") : token);
    const now = Math.round(target * eased);
    if (!separator) return String(now).padStart(token.length > 1 && token.startsWith("0") ? token.length : 0, "0");
    return String(now).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  });
}

/** True when `value` has a number worth counting up to (more than 1). */
export function countsUp(value: string): boolean {
  return (value.match(NUMBER) ?? []).some((token) => Number(token.replace(/\D/g, "")) > 1);
}
