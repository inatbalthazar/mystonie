// The album's sections (S1 profile & privacy, ADR 0069): the cover and the all-time numbers stay on top, the rest
// comes in the order its owner arranged (`profiles.album_order`), minus the ones they hid (`profiles.album_hidden`).

/** Every section that can move, in the default order: the cards first (why people visit), owner-only last. */
export const ALBUM_SECTIONS = ["cards", "watching", "shelf", "stickers", "atlas", "patches", "clubs", "saved"] as const;
export type AlbumSection = (typeof ALBUM_SECTIONS)[number];

/** The sections hidden with the album's own switch. The Atlas has its own ("Show my Atlas", `atlas_public`). */
export const HIDEABLE_SECTIONS = ALBUM_SECTIONS.filter((s) => s !== "atlas");

export const isAlbumSection = (v: unknown): v is AlbumSection => (ALBUM_SECTIONS as readonly unknown[]).includes(v);

/**
 * The order to show: the saved order's known sections (first time each), then any section it doesn't name, in the
 * default order. So a section added later lands at the end of an arranged album, and nothing ever goes missing.
 */
export function albumOrder(saved: readonly unknown[] | null | undefined): AlbumSection[] {
  const known = [...new Set((saved ?? []).filter(isAlbumSection))];
  return [...known, ...ALBUM_SECTIONS.filter((s) => !known.includes(s))];
}

/** The hidden sections that can be hidden, from a saved list. */
export function albumHidden(saved: readonly unknown[] | null | undefined): AlbumSection[] {
  return HIDEABLE_SECTIONS.filter((s) => (saved ?? []).includes(s));
}

/** How an album is arranged: its sections' order, the hidden ones, and the Shelf's pinned favourites (title ids). */
export type AlbumLayout = { order: AlbumSection[]; hidden: AlbumSection[]; shelfPins: string[] };

/** The layout from a profile's `album_order`, `album_hidden` and `shelf_pins` (null: not arranged). */
export function albumLayout(order: readonly unknown[] | null, hidden: readonly unknown[] | null, pins: readonly unknown[] | null): AlbumLayout {
  return { order: albumOrder(order), hidden: albumHidden(hidden), shelfPins: (pins ?? []).filter((p): p is string => typeof p === "string") };
}

/** A list of sections sent to PATCH /api/account (`albumOrder`, `albumHidden`), repeats dropped; null when invalid. */
export function parseAlbumSections(value: unknown, allowed: readonly AlbumSection[] = ALBUM_SECTIONS): AlbumSection[] | null {
  if (!Array.isArray(value) || !value.every((v) => (allowed as readonly unknown[]).includes(v))) return null;
  return [...new Set(value as AlbumSection[])];
}

/** `section` moved to `to` (clamped), the others keeping their order. */
export function moveSection(order: readonly AlbumSection[], section: AlbumSection, to: number): AlbumSection[] {
  const from = order.indexOf(section);
  if (from < 0) return [...order];
  const next = order.filter((s) => s !== section);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, section);
  return next;
}
