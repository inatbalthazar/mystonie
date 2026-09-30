import type { SurvivedKey } from "../catalog/dtdd";
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
  /** Games (S3 games): RAWG's average playtime, and the hours the player gave (shown instead when set). */
  playtimeHours?: number | null;
  hoursPlayed?: number | null;
  /** 0.5–5 in half steps. */
  rating?: number | null;
  review?: string | null;
  /** Local calendar date the user finished it (or logged the episode), `YYYY-MM-DD`. */
  finishedOn: string;
  /** Set on a Progress card: the episode just logged and how far along the series is. */
  progress?: CardProgress | null;
  /** Set on a reading Progress card (a book or manga): the page, chapter or volume just reached. */
  reading?: CardReading | null;
  /**
   * Set on a recap card (weekly, monthly), a stats card and a Year in Review: the period's totals and collage.
   * `kind`, `name` and `posterUrl` are the top title's.
   */
  recap?: CardRecap | null;
  /** Set on a Milestone card (the 100th title, 1,000 hours): `kind`, `name` and `posterUrl` are the title that did it. */
  milestone?: CardMilestone | null;
  /**
   * Set on a Challenge card (S3 challenges & clubs): the month's challenge that was completed and the days of the
   * month with something logged. `kind`, `name` and `posterUrl` are the title whose save completed it.
   */
  challenge?: CardChallenge | null;
  /**
   * Set on a Survived card (S2 content warnings): the scare DTDD says the movie or series has ("Survived the jump
   * scares"). Only with the `survived` template, on a finish.
   */
  survived?: SurvivedKey | null;
  /**
   * On a Finish card: the finisher's number for this title ("Finisher #1,204", S3 finishers & the board). Handed
   * out by the database; on a saved card the server sets it from the entry, never the browser.
   */
  finisherNo?: number | null;
  /** Printed in the footer (`@username`) of saved cards. The server sets it, never the browser. */
  username?: string | null;
  /** What the user chose to leave off the card. */
  hide?: CardHideable[];
};

/** Things a user can hide on a card (S1 share artwork: "hide username or any stat"). */
export const CARD_HIDEABLE = ["username", "time", "episodes", "seasons", "finisher"] as const;
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
 * A week of watching (Weekly Recap, ADR 0025; also what `weekly_recaps.stats` holds), a month (Monthly Recap,
 * `period: "month"`), a stats period (`kind: "stats"` cards from the stats page, ADR 0026) or a year (Year in
 * Review, `period: "year"` with `highlights`; ADR 0031).
 */
export type CardRecap = {
  /** A weekly recap has none. */
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
  /** Estimated reading time (books and manga), minutes; absent when nothing was read. */
  readMinutes?: number;
  /** Play time of the games finished (S3 games), minutes; absent when none was. */
  playMinutes?: number;
  /** Year in Review only: the year's standouts. */
  highlights?: RecapHighlights;
  /** An "Imported N films" card (S2 Letterboxd import): the titles an import brought in, `period: "all"`. */
  imported?: boolean;
  /** What an imported card counts ("312 films", "48 books"; S3 import & export). Absent: films. */
  importedUnit?: ImportUnit;
};

/** The noun an import is counted in: one kind, or "title" when mixed (S3 import & export, ADR 0041). */
export const IMPORT_UNITS = ["film", "series", "book", "manga", "game", "title"] as const;
export type ImportUnit = (typeof IMPORT_UNITS)[number];

/** The year's standouts on a Year in Review card; each is left out when there is none. */
export type RecapHighlights = {
  /** Top genre (TMDB's English genre name). */
  genre?: string;
  /** Busiest month, `YYYY-MM`. */
  month?: string;
  /** Longest daily streak, days. */
  streak?: number;
};

/** Milestones (S2 milestones & recaps): all-time totals crossing a round number. */
export const MILESTONE_METRICS = ["titles", "hours", "episodes"] as const;
export type MilestoneMetric = (typeof MILESTONE_METRICS)[number];

/** A Milestone card: "100th title", "1,000 hours", "500 episodes". */
export type CardMilestone = { metric: MilestoneMetric; value: number };

/** A completed monthly challenge ("Finish Four, October 2026"); its rule comes from the month's lineup. */
export type CardChallenge = {
  slug: string;
  /** `YYYY-MM`. */
  month: string;
  target: number;
  /** Days of the month (1–31) with a finish, an episode or a reading log: the calendar's circled days. */
  days: number[];
};

export type RecapCollageTitle = { name: string; kind: TitleKind; posterUrl: string | null };

export const RECAP_COLLAGE_MAX = 4;

/** What a saved card is: `cards.kind`. */
export const CARD_KINDS = ["finish", "progress", "sticker", "weekly_recap", "stats", "milestone", "monthly_recap", "year_review", "challenge"] as const;
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
