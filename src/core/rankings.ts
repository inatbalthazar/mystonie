// Rankings (ADR 0099): a "Top 3/5/10" or a tier list of anything (movies, series, books, manga, games, countries and
// their regions), made into a card to share. Not limited to what you've finished: a title or place you have finished, or been to, gets
// a ✓ that the server sets when the card is saved (never the browser), and that the owner can hide.
import { isCardPosterUrl } from "./catalog/images";
import { isExternalId, isTitleKind, sourceForKind, type TitleKind } from "./catalog/types";
import { isCountryCode } from "./countries";

/** At most this many things on a top list. */
export const RANK_MAX = 10;

/** At most this many things on a tier list, and rows on it. */
export const TIER_ITEMS_MAX = 30;
export const TIERS_MAX = 6;

/** A row's label: "S", "Must watch". */
export const TIER_LABEL_MAX = 12;

/** The rows a new tier list starts with. */
export const DEFAULT_TIERS = ["S", "A", "B", "C", "D"] as const;

/** The lengths offered first. Any length from 1 to `RANK_MAX` makes a card. */
export const RANK_SIZES = [3, 5, 10] as const;

/** A place on a ranking: a whole country (ISO 3166-1 alpha-2) or one of its regions (ISO 3166-2-like ids). */
export type PlaceKind = "country" | "region";

/** What an item is: a title of a kind, or a place. */
export type RankKind = TitleKind | PlaceKind;

/**
 * One thing on the list.
 * - `ref` says what it is, to check it: `tmdb:movie:603`, `google_books:book:<id>`, `anilist:manga:30013`,
 *   `rawg:game:3498`, `country:JP` or `region:TH-10`.
 * - `posterUrl` is a catalog poster (titles only).
 * - `done`: finished (a title) or been to (a place), set by the server.
 */
export type RankItem = {
  ref: string;
  kind: RankKind;
  name: string;
  year?: number | null;
  posterUrl?: string | null;
  /** The owner's short line about it. */
  note?: string | null;
  done?: boolean;
  /** On a tier list: the row it sits in (an index into `tiers`). */
  tier?: number;
};

/**
 * A ranking: its items in order. A tier list (step 2) also has `tiers`, the rows' labels top to bottom, and each item
 * names its row; within a row, items keep the list's order.
 */
export type CardRanking = { items: RankItem[]; tiers?: string[] };

/** Whether a ranking is a tier list. */
export const isTierList = (ranking: CardRanking | null | undefined): boolean => !!ranking?.tiers;

/** The longest note on an item. */
export const RANK_NOTE_MAX = 60;

/** The longest name a ranking can have (`CardData.name`). */
export const RANK_TITLE_MAX = 60;

const TITLE_REF = /^(tmdb|google_books|anilist|rawg):(movie|series|book|manga|game):([A-Za-z0-9_-]{1,12})$/;
const REGION_ID = /^[A-Z]{2}-[A-Z0-9]{1,8}$/;

/** A title's ref, `source:kind:externalId`. */
export const titleRef = (kind: TitleKind, externalId: string) => `${sourceForKind(kind)}:${kind}:${externalId}`;

export type ParsedRef =
  | { type: "title"; kind: TitleKind; externalId: string }
  | { type: "country"; code: string }
  | { type: "region"; id: string; country: string };

/** What a ref points at, or null when it's malformed (a title from the wrong catalog, an unknown country). */
export function parseRef(ref: unknown): ParsedRef | null {
  if (typeof ref !== "string") return null;
  const title = TITLE_REF.exec(ref);
  if (title) {
    const [, source, kind, externalId] = title;
    if (!isTitleKind(kind) || sourceForKind(kind) !== source || !isExternalId(kind, externalId)) return null;
    return { type: "title", kind, externalId: externalId! };
  }
  if (ref.startsWith("country:")) {
    const code = ref.slice(8);
    return isCountryCode(code) ? { type: "country", code } : null;
  }
  if (ref.startsWith("region:")) {
    const id = ref.slice(7);
    return REGION_ID.test(id) && isCountryCode(id.slice(0, 2)) ? { type: "region", id, country: id.slice(0, 2) } : null;
  }
  return null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

/**
 * A ranking from a request: 1 to `RANK_MAX` items, each named, its kind matching its ref, a poster only on a title and
 * only from a catalog, no item twice. `done` is kept as sent; the server sets it again before saving. `undefined` =
 * invalid; null = none.
 */
export function parseRanking(v: unknown): CardRanking | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isObject(v) || !Array.isArray(v.items)) return undefined;
  const tiers = parseTiers(v.tiers);
  if (tiers === undefined) return undefined;
  if (v.items.length < 1 || v.items.length > (tiers ? TIER_ITEMS_MAX : RANK_MAX)) return undefined;
  const items: RankItem[] = [];
  const seen = new Set<string>();
  for (const raw of v.items) {
    if (!isObject(raw) || !text(raw.name, 300)) return undefined;
    const ref = parseRef(raw.ref);
    if (!ref || seen.has(raw.ref as string)) return undefined;
    seen.add(raw.ref as string);
    const kind = ref.type === "title" ? ref.kind : ref.type;
    if (raw.kind !== kind) return undefined;
    const { posterUrl, year, note, done } = raw;
    if (posterUrl !== undefined && posterUrl !== null && (ref.type !== "title" || typeof posterUrl !== "string" || !isCardPosterUrl(posterUrl))) return undefined;
    if (year !== undefined && year !== null && (typeof year !== "number" || !Number.isInteger(year) || year < 1000 || year > 2200)) return undefined;
    if (note !== undefined && note !== null && note !== "" && !text(note, RANK_NOTE_MAX)) return undefined;
    if (done !== undefined && typeof done !== "boolean") return undefined;
    const { tier } = raw;
    if (tiers ? !(typeof tier === "number" && Number.isInteger(tier) && tier >= 0 && tier < tiers.length) : tier !== undefined && tier !== null) return undefined;
    items.push({
      ref: raw.ref as string,
      kind,
      name: (raw.name as string).trim(),
      year: (year as number | null | undefined) ?? null,
      posterUrl: (posterUrl as string | null | undefined) ?? null,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
      done: done === true,
      ...(tiers ? { tier: tier as number } : {}),
    });
  }
  return tiers ? { items, tiers } : { items };
}

/** A tier list's row labels: 1 to `TIERS_MAX`, each 1 to `TIER_LABEL_MAX` characters. `undefined` = invalid; null = none. */
function parseTiers(v: unknown): string[] | null | undefined {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length < 1 || v.length > TIERS_MAX) return undefined;
  if (!v.every((label) => text(label, TIER_LABEL_MAX))) return undefined;
  return v.map((label: string) => label.trim());
}

/** A tier list's rows with their items in order, the empty rows left out (the card doesn't draw them). */
export function tierRows(ranking: CardRanking): { label: string; tier: number; items: RankItem[] }[] {
  return (ranking.tiers ?? []).flatMap((label, tier) => {
    const items = ranking.items.filter((i) => i.tier === tier);
    return items.length ? [{ label, tier, items }] : [];
  });
}

/**
 * The poster height (px) that fits a tier list's rows on a card: `counts` items per row, in `width` x `height` with
 * `gap` between posters, rows and wrapped lines. A row too long for one line wraps; the biggest size that fits wins,
 * within `max`.
 */
export function tierPosterHeight(counts: readonly number[], width: number, height: number, gap: number, max: number): number {
  if (counts.length === 0) return max;
  for (let h = max; h > 24; h -= 4) {
    const w = (h * 2) / 3;
    const perLine = Math.max(1, Math.floor((width + gap) / (w + gap)));
    const lines = counts.reduce((sum, n) => sum + Math.max(1, Math.ceil(n / perLine)), 0);
    if (lines * h + (lines - 1) * gap <= height) return h;
  }
  return 24;
}

/** The items marked done from what the owner has finished (title refs) and been to (countries and regions). */
export function markDone(ranking: CardRanking, finished: ReadonlySet<string>, places: ReadonlySet<string>): CardRanking {
  return {
    ...ranking,
    items: ranking.items.map((item) => {
      const ref = parseRef(item.ref);
      const done = !ref ? false : ref.type === "title" ? finished.has(item.ref) : places.has(ref.type === "country" ? ref.code : ref.id);
      return { ...item, done };
    }),
  };
}

/** Moves the item at `from` to `to` (both clamped), keeping the others in order. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return [...items];
  const target = Math.max(0, Math.min(items.length - 1, to));
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item!);
  return next;
}

/** The labels new rows get, in order: S, A, B, C, D, then E for a sixth. */
export const ROW_NAMES = [...DEFAULT_TIERS, "E"] as const;

/** Moves an item to the end of another row of a tier list. */
export function moveToTier(items: readonly RankItem[], ref: string, tier: number): RankItem[] {
  const item = items.find((i) => i.ref === ref);
  if (!item || item.tier === tier) return [...items];
  return [...items.filter((i) => i.ref !== ref), { ...item, tier }];
}

/** Moves an item one place left (-1) or right (1) within its row, past the row's neighbour; the other rows keep their order. */
export function shiftInTier(items: readonly RankItem[], ref: string, by: 1 | -1): RankItem[] {
  const from = items.findIndex((i) => i.ref === ref);
  if (from < 0) return [...items];
  const row = items.flatMap((i, index) => (i.tier === items[from]!.tier ? [index] : []));
  const to = row[row.indexOf(from) + by];
  if (to === undefined) return [...items];
  const next = [...items];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/** Takes an empty row off a tier list: the rows below move up. A row that still holds items stays. */
export function removeTier(ranking: { items: readonly RankItem[]; tiers: readonly string[] }, row: number): { items: RankItem[]; tiers: string[] } {
  if (ranking.tiers.length <= 1 || ranking.items.some((i) => i.tier === row)) return { items: [...ranking.items], tiers: [...ranking.tiers] };
  return {
    tiers: ranking.tiers.filter((_, i) => i !== row),
    items: ranking.items.map((i) => (i.tier !== undefined && i.tier > row ? { ...i, tier: i.tier - 1 } : i)),
  };
}

/**
 * A shared ranking to start your own from (step 4, remix): the same things in the same order and rows, without its
 * maker's ✓ marks or lines about them; your own ✓ marks come from the server again.
 */
export function remixRanking(ranking: CardRanking): CardRanking {
  const items = ranking.items.map((item) => {
    const copy = { ...item };
    delete copy.done;
    delete copy.note;
    return copy;
  });
  return ranking.tiers ? { items, tiers: [...ranking.tiers] } : { items };
}
