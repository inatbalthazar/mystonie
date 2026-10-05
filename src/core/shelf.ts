// The Shelf on public profiles (S3 badges & shelf): every live finish, newest first, after the owner's favourites
// (ADR 0069).
import { SHELF_CARD_MAX, type CardShelf } from "./cards/types";
import type { TitleKind } from "./catalog/types";
import type { StatsEntry } from "./stats/summary";

export type ShelfTitle = { id: string; kind: TitleKind; name: string; posterUrl: string | null };

/** How many favourites the owner can pin at the front of their Shelf: a top ten (ADR 0069, ADR 0095). */
export const SHELF_PINS_MAX = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A `shelfPins` sent to PATCH /api/account: up to `SHELF_PINS_MAX` title ids, repeats dropped. Null when invalid. */
export function parseShelfPins(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === "string" && UUID_RE.test(v))) return null;
  const pins = [...new Set(value)];
  return pins.length <= SHELF_PINS_MAX ? pins : null;
}

/**
 * The Shelf: the pinned favourites still finished (in pin order), then the other finishes newest first (ties by
 * title id, so the order is stable), `max` in all. `pinned`: how many of `items` lead as favourites; `more`: how many
 * finishes didn't fit.
 */
export function shelfItems(
  titles: readonly ShelfTitle[],
  entries: readonly StatsEntry[],
  max: number,
  pins: readonly string[] = [],
): { items: ShelfTitle[]; pinned: number; more: number } {
  const byId = new Map(titles.map((t) => [t.id, t]));
  const finished = entries
    .flatMap((e) => {
      const title = byId.get(e.titleId);
      const at = e.finishedAt ? Date.parse(e.finishedAt) : NaN;
      return !e.deletedAt && e.status === "finished" && title && !Number.isNaN(at) ? [{ at, title }] : [];
    })
    .sort((a, b) => b.at - a.at || a.title.id.localeCompare(b.title.id))
    .map((f) => f.title);
  // A pin whose title was un-finished or deleted since simply drops out.
  const favourites = pins.slice(0, SHELF_PINS_MAX).flatMap((id) => finished.find((t) => t.id === id) ?? []);
  const rest = finished.filter((t) => !favourites.includes(t));
  const items = [...favourites, ...rest].slice(0, max);
  return { items, pinned: Math.min(favourites.length, max), more: Math.max(0, finished.length - max) };
}

/**
 * A Shelf card's titles (ADR 0095): the Shelf's first `SHELF_CARD_MAX`, favourites first, and how many it holds in
 * all. Null for an empty Shelf.
 */
export function shelfCard(shelf: { items: readonly ShelfTitle[]; pinned: number; more: number }): CardShelf | null {
  const titles = shelf.items.slice(0, SHELF_CARD_MAX).map(({ name, kind, posterUrl }) => ({ name, kind, posterUrl }));
  if (titles.length === 0) return null;
  return { titles, pinned: Math.min(shelf.pinned, titles.length), total: shelf.items.length + shelf.more };
}
