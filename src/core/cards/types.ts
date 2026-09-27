import type { TitleKind } from "../catalog/types";
import type { ReadingUnit } from "../collection/reading";

export type CardSize = "story" | "feed";

/** Export pixel sizes: 9:16 (Stories, TikTok) and 4:5 (feed posts). */
export const CARD_DIMENSIONS: Record<CardSize, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
};

export const REVIEW_MAX_CHARS = 80;

/** Everything a template may show. Templates must cope with every optional field missing. */
export type CardData = {
  kind: TitleKind;
  name: string;
  year?: number | null;
  posterUrl?: string | null;
  genres?: string[];
  runtimeMin?: number | null;
  episodeCount?: number | null;
  seasonCount?: number | null;
  /** Books: pages. Manga: chapters and volumes. */
  pageCount?: number | null;
  chapterCount?: number | null;
  volumeCount?: number | null;
  /** 0.5–5 in half steps. */
  rating?: number | null;
  review?: string | null;
  /** Local calendar date the user finished it (or logged the episode), `YYYY-MM-DD`. */
  finishedOn: string;
  /** Set on a Progress card: the episode just logged and how far along the series is. */
  progress?: CardProgress | null;
  /** Set on a reading Progress card (a book or manga): the page, chapter or volume just reached. */
  reading?: CardReading | null;
  /** Set on a Weekly Recap card: the week's totals and collage. `kind`, `name` and `posterUrl` are the top title's. */
  recap?: CardRecap | null;
  /** Printed in the footer (`@username`) of saved cards. The server sets it, never the browser. */
  username?: string | null;
  /** What the user chose to leave off the card. */
  hide?: CardHideable[];
};

/** Things a user can hide on a card (S1 share artwork: "hide username or any stat"). */
export const CARD_HIDEABLE = ["username", "time", "episodes", "seasons"] as const;
export type CardHideable = (typeof CARD_HIDEABLE)[number];

export type CardProgress = {
  season: number;
  episode: number;
  /** Aired episodes logged, out of `total` aired. */
  watched: number;
  total: number;
  /** Watched time so far, minutes. */
  watchedMin: number | null;
  /** A milestone crossed by this log (25/50/75 %), else null. */
  milestone: Milestone | null;
};

/** A reading Progress card: "Chapter 1100", and how far along when the length is known. */
export type CardReading = {
  unit: ReadingUnit;
  /** The page, chapter or volume reached. */
  position: number;
  /** The title's length in `unit`; null while unknown (a running manga). */
  total: number | null;
  /** Estimated reading time so far, minutes. */
  readMin: number | null;
  /** A milestone crossed by this log (25/50/75 %), else null. */
  milestone: Milestone | null;
};

export const MILESTONES = [25, 50, 75] as const;
export type Milestone = (typeof MILESTONES)[number];

/** Stats page periods (S1 stats). A recap card with a `period` is a "Share stats" card. */
export const STATS_PERIODS = ["week", "month", "year", "all"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/**
 * A week of watching (Weekly Recap, ADR 0025; also what `weekly_recaps.stats` holds), or a stats period
 * (`kind: "stats"` cards from the stats page, ADR 0026).
 */
export type CardRecap = {
  /** Set on stats cards only; a weekly recap has none. */
  period?: StatsPeriod;
  /** First and last local dates, `YYYY-MM-DD` (a weekly recap: a Monday and the Sunday after it). */
  from: string;
  to: string;
  minutes: number;
  episodes: number;
  /** Titles finished that week. */
  finished: number;
  /** Titles watched that week (finished, or with episodes logged). */
  titleCount: number;
  /** Most watched first, at most `RECAP_COLLAGE_MAX`: the poster collage. */
  titles: RecapCollageTitle[];
};

export type RecapCollageTitle = { name: string; kind: TitleKind; posterUrl: string | null };

export const RECAP_COLLAGE_MAX = 4;

/** What a saved card is: `cards.kind`. */
export const CARD_KINDS = ["finish", "progress", "sticker", "weekly_recap", "stats"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

/** Card colours, all as `#rrggbb`. `text` and `muted` meet contrast on `background`. */
export type Palette = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  /** Ticket stock / polaroid frame, and the ink printed on it. Fixed, not from the poster. */
  paper: string;
  ink: string;
};
