// Saved cards (S1 share artwork): what `POST /api/cards` accepts, what `cards.params` holds, and the
// Progress card's milestones. The params are a snapshot of the card's inputs, so `/c/[id]` and the profile
// gallery can re-render it without the entry (which may change later).
import { isUuidV7 } from "../ids";
import { reviewLength } from "./edit";
import { isTemplateId, templateFits, type TemplateId } from "./templates";
import {
  CARD_HIDEABLE,
  CARD_KINDS,
  MILESTONES,
  RECAP_COLLAGE_MAX,
  REVIEW_MAX_CHARS,
  STATS_PERIODS,
  type CardData,
  type CardHideable,
  type CardKind,
  type CardProgress,
  type CardRecap,
  type CardSize,
  type Milestone,
  type StatsPeriod,
} from "./types";

/** The milestone (25/50/75 %) that going from `before` to `after` logged episodes crosses, if any. */
export function crossedMilestone(before: number, after: number, total: number): Milestone | null {
  if (total <= 0 || after <= before) return null;
  let crossed: Milestone | null = null;
  for (const m of MILESTONES) if (before * 100 < m * total && after * 100 >= m * total) crossed = m;
  return crossed;
}

/** Storage path of a card's PNG in the `cards` bucket (the database checks the same shape). */
export const cardImagePath = (userId: string, cardId: string) => `${userId}/${cardId}.png`;

export type CardSave = {
  id: string;
  kind: CardKind;
  templateId: TemplateId;
  size: CardSize;
  entryId: string | null;
  episodeLogId: string | null;
  /** The weekly recap a recap card (or its sticker) was made from; the server links it to the card. */
  recapId: string | null;
  /** Card inputs without `username` (the server adds it from the profile). */
  data: CardData;
  /** Share = publish at `/c/[id]` and upload the PNG. Download only saves the inputs. */
  share: boolean;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const optInt = (v: unknown, min: number, max: number) => v === undefined || v === null || int(v, min, max);
const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
/** How many of the values are set. */
const num = (...values: unknown[]) => values.filter((v) => v !== undefined && v !== null).length;

// Only TMDB images: a card link must not be able to show an arbitrary picture under our name.
const POSTER_RE = /^https:\/\/image\.tmdb\.org\/t\/p\/w\d{2,4}\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** `undefined` = invalid; null = none. */
function parseProgress(v: unknown): CardProgress | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isObject(v)) return undefined;
  const { season, episode, watched, total, watchedMin, milestone } = v;
  if (!int(season, 1, 32767) || !int(episode, 0, 32767) || !int(total, 1, 100000)) return undefined;
  if (!int(watched, 0, total as number) || !optInt(watchedMin, 0, 10_000_000)) return undefined;
  if (milestone !== undefined && milestone !== null && !(MILESTONES as readonly unknown[]).includes(milestone)) return undefined;
  return {
    season: season as number,
    episode: episode as number,
    watched: watched as number,
    total: total as number,
    watchedMin: orNull(watchedMin as number | null | undefined),
    milestone: orNull(milestone as Milestone | null | undefined),
  };
}

/**
 * A week's recap (card params, `weekly_recaps.stats`), or null when it's malformed. The collage's
 * posters follow the same TMDB-only rule as a card's poster.
 */
export function parseRecap(v: unknown): CardRecap | null {
  if (!isObject(v)) return null;
  const { period, from, to, minutes, episodes, finished, titleCount, titles } = v;
  if (period !== undefined && !(STATS_PERIODS as readonly unknown[]).includes(period)) return null;
  if (typeof from !== "string" || !DATE_RE.test(from) || typeof to !== "string" || !DATE_RE.test(to) || to < from) return null;
  // All-time stats cards can hold years of watching.
  if (!int(minutes, 0, 10_000_000) || !int(episodes, 0, 1_000_000) || !int(finished, 0, 100_000) || !int(titleCount, 0, 100_000)) return null;
  if (!Array.isArray(titles) || titles.length > RECAP_COLLAGE_MAX || titles.length > (titleCount as number)) return null;
  const collage: CardRecap["titles"] = [];
  for (const t of titles) {
    if (!isObject(t) || !text(t.name, 300) || (t.kind !== "movie" && t.kind !== "series")) return null;
    if (t.posterUrl !== undefined && t.posterUrl !== null && (typeof t.posterUrl !== "string" || !POSTER_RE.test(t.posterUrl))) return null;
    collage.push({ name: (t.name as string).trim(), kind: t.kind, posterUrl: orNull(t.posterUrl as string | null | undefined) });
  }
  return {
    ...(period === undefined ? {} : { period: period as StatsPeriod }),
    from,
    to,
    minutes: minutes as number,
    episodes: episodes as number,
    finished: finished as number,
    titleCount: titleCount as number,
    titles: collage,
  };
}

/** Card inputs from a request, or null when anything is off. `username` is always dropped. */
export function parseCardData(v: unknown): CardData | null {
  if (!isObject(v)) return null;
  const { kind, name, year, posterUrl, genres, runtimeMin, episodeCount, seasonCount, rating, review, finishedOn, hide } = v;
  if (kind !== "movie" && kind !== "series") return null;
  if (!text(name, 300) || typeof finishedOn !== "string" || !DATE_RE.test(finishedOn)) return null;
  if (!optInt(year, 1870, 2200) || !optInt(runtimeMin, 0, 1440)) return null;
  if (!optInt(episodeCount, 0, 100000) || !optInt(seasonCount, 0, 1000)) return null;
  if (posterUrl !== undefined && posterUrl !== null && (typeof posterUrl !== "string" || !POSTER_RE.test(posterUrl))) return null;
  if (genres !== undefined && (!Array.isArray(genres) || genres.length > 5 || !genres.every((g) => text(g, 40)))) return null;
  if (rating !== undefined && rating !== null) {
    if (typeof rating !== "number" || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2)) return null;
  }
  if (review !== undefined && review !== null) {
    if (!text(review, 400) || reviewLength(review as string) > REVIEW_MAX_CHARS) return null;
  }
  if (hide !== undefined && (!Array.isArray(hide) || !hide.every((h) => (CARD_HIDEABLE as readonly unknown[]).includes(h)))) {
    return null;
  }
  const progress = parseProgress(v.progress);
  if (progress === undefined) return null;
  const recap = v.recap === undefined || v.recap === null ? null : parseRecap(v.recap);
  if (recap === null && v.recap !== undefined && v.recap !== null) return null;
  if (progress && recap) return null;
  return {
    kind,
    name: (name as string).trim(),
    year: orNull(year as number | null | undefined),
    posterUrl: orNull(posterUrl as string | null | undefined),
    genres: (genres as string[] | undefined) ?? [],
    runtimeMin: orNull(runtimeMin as number | null | undefined),
    episodeCount: orNull(episodeCount as number | null | undefined),
    seasonCount: orNull(seasonCount as number | null | undefined),
    rating: orNull(rating as number | null | undefined),
    review: review ? (review as string).trim() : null,
    finishedOn,
    progress,
    recap,
    hide: [...new Set((hide as CardHideable[] | undefined) ?? [])],
  };
}

/**
 * `POST /api/cards` body → a card to save, or null. A finish card needs its entry; a progress card its progress;
 * a recap card its recap and no entry or episode.
 */
export function parseCardSave(body: unknown): CardSave | null {
  if (!isObject(body)) return null;
  const { id, kind, templateId, size, entryId, episodeLogId, recapId, share } = body;
  if (typeof id !== "string" || !isUuidV7(id)) return null;
  if (!(CARD_KINDS as readonly unknown[]).includes(kind) || (size !== "story" && size !== "feed")) return null;
  if (!isTemplateId(templateId) || !templateFits(templateId, kind as CardKind, size)) return null;
  const uuidOrNull = (v: unknown) => v === undefined || v === null || (typeof v === "string" && isUuidV7(v));
  if (!uuidOrNull(entryId) || !uuidOrNull(episodeLogId) || !uuidOrNull(recapId)) return null;
  if (num(entryId, episodeLogId, recapId) > 1) return null;
  const data = parseCardData(body.data);
  if (!data) return null;
  if (kind === "finish" && (!entryId || data.progress || data.recap)) return null;
  if (kind === "progress" && (!data.progress || data.kind !== "series")) return null;
  if (kind === "weekly_recap" && (!data.recap || data.recap.period || entryId || episodeLogId)) return null;
  if (kind === "stats" && (!data.recap?.period || entryId || episodeLogId || recapId)) return null;
  if (recapId && (!data.recap || data.recap.period)) return null;
  return {
    id,
    kind: kind as CardKind,
    templateId,
    size,
    entryId: (entryId as string | null | undefined) ?? null,
    episodeLogId: (episodeLogId as string | null | undefined) ?? null,
    recapId: (recapId as string | null | undefined) ?? null,
    data,
    share: share === true,
  };
}
