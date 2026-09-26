import type { TitleKind } from "../catalog/types";

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
  /** 0.5–5 in half steps. */
  rating?: number | null;
  review?: string | null;
  /** Local calendar date the user finished it, `YYYY-MM-DD`. */
  finishedOn: string;
};

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
