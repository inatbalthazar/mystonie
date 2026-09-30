// Saved cards (S1 share artwork): what `POST /api/cards` accepts, what `cards.params` holds, and the
// Progress card's milestones. The params are a snapshot of the card's inputs, so `/c/[id]` and the profile
// gallery can re-render it without the entry (which may change later).
import { isSurvivedKey, type SurvivedKey } from "../catalog/dtdd";
import { findChallenge, isMonth } from "../challenges";
import { isCardPosterUrl } from "../catalog/images";
import { isTitleKind } from "../catalog/types";
import { MAX_HOURS_PLAYED } from "../collection/entries";
import {
  isReadingUnit,
  MAX_READING_POSITION,
  READING_SECONDS,
  readingAmounts,
  readingPosition,
  unitTotal,
  type ReadingLengths,
  type ReadingLog,
  type ReadingUnit,
} from "../collection/reading";
import { isUuidV7 } from "../ids";
import { reviewLength } from "./edit";
import { isSurvivedTemplate, isTemplateId, templateFits, type TemplateId } from "./templates";
import {
  CARD_HIDEABLE,
  CARD_KINDS,
  IMPORT_UNITS,
  MILESTONE_METRICS,
  MILESTONES,
  RECAP_COLLAGE_MAX,
  REVIEW_MAX_CHARS,
  STATS_PERIODS,
  type CardChallenge,
  type CardData,
  type CardHideable,
  type CardKind,
  type CardMilestone,
  type CardProgress,
  type CardReading,
  type CardRecap,
  type CardSize,
  type ImportUnit,
  type Milestone,
  type MilestoneMetric,
  type RecapHighlights,
  type StatsPeriod,
} from "./types";

/** The milestone (25/50/75 %) that going from `before` to `after` logged episodes crosses, if any. */
export function crossedMilestone(before: number, after: number, total: number): Milestone | null {
  if (total <= 0 || after <= before) return null;
  let crossed: Milestone | null = null;
  for (const m of MILESTONES) if (before * 100 < m * total && after * 100 >= m * total) crossed = m;
  return crossed;
}

/**
 * A reading Progress card for reaching `position` in `unit`: how far along (when the length is known and not passed),
 * the estimated reading time so far and the milestone crossed. `before` and `after` are the title's logs around it.
 */
export function readingProgress(
  title: ReadingLengths,
  before: readonly ReadingLog[],
  after: readonly ReadingLog[],
  unit: ReadingUnit,
  position: number,
): CardReading {
  const length = unitTotal(title, unit);
  const total = length && position <= length ? length : null;
  const seconds = readingAmounts(after).reduce((sum, { log, amount }) => sum + amount * READING_SECONDS[log.unit], 0);
  return {
    unit,
    position,
    total,
    readMin: seconds > 0 ? Math.round(seconds / 60) : null,
    milestone: total ? crossedMilestone(readingPosition(before, unit), readingPosition(after, unit), total) : null,
  };
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
  /** The reading log a reading Progress card was made from. */
  readingLogId: string | null;
  /** The weekly or monthly recap a recap card (or its sticker) was made from; the server links it to the card. */
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

const isPoster = (v: unknown) => v === undefined || v === null || (typeof v === "string" && isCardPosterUrl(v));
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

/** `undefined` = invalid; null = none. */
function parseReading(v: unknown): CardReading | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isObject(v)) return undefined;
  const { unit, position, total, readMin, milestone } = v;
  if (!isReadingUnit(unit) || !int(position, 1, MAX_READING_POSITION) || !optInt(total, 1, MAX_READING_POSITION)) return undefined;
  if (typeof total === "number" && (position as number) > total) return undefined;
  if (!optInt(readMin, 0, 10_000_000)) return undefined;
  if (milestone !== undefined && milestone !== null && !(MILESTONES as readonly unknown[]).includes(milestone)) return undefined;
  if (milestone && typeof total !== "number") return undefined;
  return {
    unit,
    position: position as number,
    total: orNull(total as number | null | undefined),
    readMin: orNull(readMin as number | null | undefined),
    milestone: orNull(milestone as Milestone | null | undefined),
  };
}

/**
 * A week's recap (card params, `weekly_recaps.stats`), or null when it's malformed. The collage's
 * posters follow the same catalog-only rule as a card's poster.
 */
export function parseRecap(v: unknown): CardRecap | null {
  if (!isObject(v)) return null;
  const { period, from, to, minutes, episodes, finished, titleCount, titles, readMinutes, highlights, imported, importedUnit } = v;
  if (period !== undefined && !(STATS_PERIODS as readonly unknown[]).includes(period)) return null;
  if (typeof from !== "string" || !DATE_RE.test(from) || typeof to !== "string" || !DATE_RE.test(to) || to < from) return null;
  // All-time stats cards can hold years of watching.
  if (!int(minutes, 0, 10_000_000) || !int(episodes, 0, 1_000_000) || !int(finished, 0, 100_000) || !int(titleCount, 0, 100_000)) return null;
  if (!Array.isArray(titles) || titles.length > RECAP_COLLAGE_MAX || titles.length > (titleCount as number)) return null;
  const collage: CardRecap["titles"] = [];
  for (const t of titles) {
    if (!isObject(t) || !text(t.name, 300) || !isTitleKind(t.kind) || !isPoster(t.posterUrl)) return null;
    collage.push({ name: (t.name as string).trim(), kind: t.kind as CardData["kind"], posterUrl: orNull(t.posterUrl as string | null | undefined) });
  }
  if (readMinutes !== undefined && !int(readMinutes, 0, 10_000_000)) return null;
  if (imported !== undefined && (imported !== true || period !== "all")) return null;
  if (importedUnit !== undefined && (!imported || !(IMPORT_UNITS as readonly unknown[]).includes(importedUnit))) return null;
  const standouts = parseHighlights(highlights);
  if (standouts === undefined) return null;
  return {
    ...(period === undefined ? {} : { period: period as StatsPeriod }),
    from,
    to,
    minutes: minutes as number,
    episodes: episodes as number,
    finished: finished as number,
    titleCount: titleCount as number,
    titles: collage,
    ...(readMinutes ? { readMinutes: readMinutes as number } : {}),
    ...(standouts ? { highlights: standouts } : {}),
    ...(imported ? { imported: true } : {}),
    ...(importedUnit ? { importedUnit: importedUnit as ImportUnit } : {}),
  };
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A Year in Review's highlights. `undefined` = invalid; null = none. */
function parseHighlights(v: unknown): RecapHighlights | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isObject(v)) return undefined;
  const { genre, month, streak } = v;
  if (genre !== undefined && !text(genre, 40)) return undefined;
  if (month !== undefined && (typeof month !== "string" || !MONTH_RE.test(month))) return undefined;
  if (streak !== undefined && !int(streak, 1, 366)) return undefined;
  return {
    ...(genre === undefined ? {} : { genre: (genre as string).trim() }),
    ...(month === undefined ? {} : { month: month as string }),
    ...(streak === undefined ? {} : { streak: streak as number }),
  };
}

/** A Milestone card's milestone. `undefined` = invalid; null = none. */
function parseMilestone(v: unknown): CardMilestone | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isObject(v)) return undefined;
  const { metric, value } = v;
  if (!(MILESTONE_METRICS as readonly unknown[]).includes(metric) || !int(value, 1, 1_000_000)) return undefined;
  return { metric: metric as MilestoneMetric, value: value as number };
}

/** A Challenge card's challenge: one of that month's lineup, its target, the calendar's days. `undefined` = invalid. */
function parseChallenge(v: unknown): CardChallenge | null | undefined {
  if (v === undefined || v === null) return null;
  if (!isObject(v)) return undefined;
  const { slug, month, target, days } = v;
  if (!isMonth(month)) return undefined;
  const challenge = findChallenge(month, slug);
  if (!challenge || target !== challenge.rule.target) return undefined;
  if (!Array.isArray(days) || days.length > 31 || !days.every((d) => int(d, 1, 31))) return undefined;
  return { slug: challenge.slug, month, target: challenge.rule.target, days: [...new Set(days as number[])].sort((a, b) => a - b) };
}

/** Card inputs from a request, or null when anything is off. `username` is always dropped. */
export function parseCardData(v: unknown): CardData | null {
  if (!isObject(v)) return null;
  const { kind, name, year, posterUrl, genres, runtimeMin, episodeCount, seasonCount, pageCount, chapterCount, volumeCount, rating, review, finishedOn, hide } = v;
  const { playtimeHours, hoursPlayed } = v;
  if (!isTitleKind(kind)) return null;
  if (!text(name, 300) || typeof finishedOn !== "string" || !DATE_RE.test(finishedOn)) return null;
  // Books go back further than film (1000: the oldest year Google Books dates we keep).
  if (!optInt(year, kind === "book" ? 1000 : 1870, 2200) || !optInt(runtimeMin, 0, 1440)) return null;
  // Hours belong to a game (RAWG's average, the player's own).
  if (!optInt(playtimeHours, 1, 10_000) || !optInt(hoursPlayed, 1, MAX_HOURS_PLAYED)) return null;
  if (kind !== "game" && num(playtimeHours, hoursPlayed) > 0) return null;
  if (!optInt(episodeCount, 0, 100000) || !optInt(seasonCount, 0, 1000)) return null;
  if (!optInt(pageCount, 0, MAX_READING_POSITION) || !optInt(chapterCount, 0, MAX_READING_POSITION) || !optInt(volumeCount, 0, 10_000)) return null;
  if (!isPoster(posterUrl)) return null;
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
  const reading = parseReading(v.reading);
  if (progress === undefined || reading === undefined) return null;
  const recap = v.recap === undefined || v.recap === null ? null : parseRecap(v.recap);
  if (recap === null && v.recap !== undefined && v.recap !== null) return null;
  const milestone = parseMilestone(v.milestone);
  const challenge = parseChallenge(v.challenge);
  if (milestone === undefined || challenge === undefined) return null;
  if (num(progress, reading, recap, milestone, challenge) > 1) return null;
  const survived = v.survived ?? null;
  if (survived !== null && (!isSurvivedKey(survived) || (kind !== "movie" && kind !== "series") || num(progress, reading, recap, milestone, challenge) > 0)) {
    return null;
  }
  // Only a Finish card has a finisher number.
  const finisherNo = v.finisherNo ?? null;
  if (finisherNo !== null && (!int(finisherNo, 1, 1_000_000_000) || num(progress, reading, recap, milestone, challenge) > 0)) return null;
  return {
    kind: kind as CardData["kind"],
    name: (name as string).trim(),
    year: orNull(year as number | null | undefined),
    posterUrl: orNull(posterUrl as string | null | undefined),
    genres: (genres as string[] | undefined) ?? [],
    runtimeMin: orNull(runtimeMin as number | null | undefined),
    episodeCount: orNull(episodeCount as number | null | undefined),
    seasonCount: orNull(seasonCount as number | null | undefined),
    pageCount: orNull(pageCount as number | null | undefined),
    chapterCount: orNull(chapterCount as number | null | undefined),
    volumeCount: orNull(volumeCount as number | null | undefined),
    ...(kind === "game" ? { playtimeHours: orNull(playtimeHours as number | null | undefined), hoursPlayed: orNull(hoursPlayed as number | null | undefined) } : {}),
    rating: orNull(rating as number | null | undefined),
    review: review ? (review as string).trim() : null,
    finishedOn,
    progress,
    reading,
    recap,
    milestone,
    challenge,
    survived: survived as SurvivedKey | null,
    finisherNo: finisherNo as number | null,
    hide: [...new Set((hide as CardHideable[] | undefined) ?? [])],
  };
}

/**
 * `POST /api/cards` body → a card to save, or null. A finish card needs its entry; a progress card its progress;
 * a recap card its recap and no entry or episode.
 */
export function parseCardSave(body: unknown): CardSave | null {
  if (!isObject(body)) return null;
  const { id, kind, templateId, size, entryId, episodeLogId, readingLogId, recapId, share } = body;
  if (typeof id !== "string" || !isUuidV7(id)) return null;
  if (!(CARD_KINDS as readonly unknown[]).includes(kind) || (size !== "story" && size !== "feed")) return null;
  if (!isTemplateId(templateId)) return null;
  const uuidOrNull = (v: unknown) => v === undefined || v === null || (typeof v === "string" && isUuidV7(v));
  if (!uuidOrNull(entryId) || !uuidOrNull(episodeLogId) || !uuidOrNull(readingLogId) || !uuidOrNull(recapId)) return null;
  if (num(entryId, episodeLogId, readingLogId, recapId) > 1) return null;
  const data = parseCardData(body.data);
  if (!data || !templateFits(templateId, kind as CardKind, size, data.kind)) return null;
  const reading = data.kind === "book" || data.kind === "manga";
  if (kind === "finish" && (!entryId || data.progress || data.reading || data.recap || data.milestone || data.challenge)) return null;
  if (kind === "progress" && !(reading ? data.reading : data.progress && data.kind === "series")) return null;
  if (episodeLogId && !data.progress) return null;
  if (readingLogId && !data.reading) return null;
  const sourced = !!(entryId || episodeLogId || readingLogId);
  if (kind === "weekly_recap" && (!data.recap || data.recap.period || sourced)) return null;
  if (kind === "monthly_recap" && (data.recap?.period !== "month" || sourced)) return null;
  if (kind === "stats" && (!data.recap?.period || sourced || recapId)) return null;
  if (kind === "year_review" && (data.recap?.period !== "year" || sourced || recapId)) return null;
  if (kind === "milestone" && (!data.milestone || sourced || recapId)) return null;
  if (kind === "challenge" && (!data.challenge || sourced || recapId)) return null;
  // A Survived card is a finish on the Survived template, and that template draws nothing else.
  if (!!data.survived !== isSurvivedTemplate(templateId) || (data.survived && kind !== "finish")) return null;
  // Highlights belong to a Year in Review; a recap id to a weekly or monthly recap.
  if (data.recap?.highlights && kind !== "year_review" && kind !== "sticker") return null;
  if (recapId && (!data.recap || (data.recap.period && data.recap.period !== "month"))) return null;
  return {
    id,
    kind: kind as CardKind,
    templateId,
    size,
    entryId: (entryId as string | null | undefined) ?? null,
    episodeLogId: (episodeLogId as string | null | undefined) ?? null,
    readingLogId: (readingLogId as string | null | undefined) ?? null,
    recapId: (recapId as string | null | undefined) ?? null,
    data,
    share: share === true,
  };
}
