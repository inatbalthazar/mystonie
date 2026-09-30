// Series progress (S1 collection → Series): which episodes count, what's next, and when a series is done.
// Shared by the series page, "Up next" and the logging route.
import type { Episode } from "../catalog/types";
import { isUuidV7 } from "../ids";
import { actionTime } from "./entries";

export type EpisodeRef = { season: number; episode: number };

export const episodeKey = (e: EpisodeRef) => `${e.season}:${e.episode}`;

const byOrder = (a: EpisodeRef, b: EpisodeRef) => a.season - b.season || a.episode - b.episode;

/**
 * Episodes that are out on `today` (the user's local `YYYY-MM-DD`), in order. Specials (season 0) and
 * episodes without an air date don't count: they'd make "next" and "finished" wrong for most people.
 */
export function airedEpisodes<T extends Episode>(episodes: readonly T[], today: string): T[] {
  return episodes.filter((e) => e.season > 0 && e.airDate !== null && e.airDate <= today).sort(byOrder);
}

/**
 * The episode after the furthest one logged (S1E5 after S1E4), skipping ones already logged.
 * The first episode when nothing is logged; null when caught up.
 */
export function nextEpisode<T extends Episode>(episodes: readonly T[], logged: readonly EpisodeRef[], today: string): T | null {
  const aired = airedEpisodes(episodes, today);
  const done = new Set(logged.map(episodeKey));
  let start = 0;
  aired.forEach((e, i) => {
    if (done.has(episodeKey(e))) start = i + 1;
  });
  return aired.slice(start).find((e) => !done.has(episodeKey(e))) ?? null;
}

export type SeriesProgress = { watched: number; aired: number; total: number };

/** Logged aired episodes out of the aired ones, plus the full count TMDB lists (future ones too). */
export function seriesProgress(episodes: readonly Episode[], logged: readonly EpisodeRef[], today: string): SeriesProgress {
  const done = new Set(logged.map(episodeKey));
  const aired = airedEpisodes(episodes, today);
  return {
    watched: aired.filter((e) => done.has(episodeKey(e))).length,
    aired: aired.length,
    total: episodes.filter((e) => e.season > 0).length,
  };
}

/** Every episode is out and logged: time to ask "Finished the series?". */
export function seriesComplete(progress: SeriesProgress, ended: boolean): boolean {
  return ended && progress.aired > 0 && progress.aired === progress.total && progress.watched === progress.aired;
}

/** Most episodes one request may log ("Mark season watched" on a long anime season). */
export const MAX_EPISODES_PER_LOG = 500;

export type EpisodeLogRequest = {
  externalId: string;
  episodes: (EpisodeRef & { id: string })[];
  /** When they were watched, by the device's clock (a log made offline arrives later, ADR 0042). */
  watchedAt: string;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const smallInt = (v: unknown, min: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= 32767;

/**
 * POST /api/episodes body: `{ externalId, episodes: [{ id, season, episode }], watchedAt? }` (TMDB series id, v7 ids,
 * `watchedAt` defaults to now).
 */
export function parseEpisodeLog(body: unknown, now: number = Date.now()): EpisodeLogRequest | null {
  if (!isObject(body) || typeof body.externalId !== "string" || !/^\d{1,10}$/.test(body.externalId)) return null;
  if (!Array.isArray(body.episodes) || body.episodes.length === 0 || body.episodes.length > MAX_EPISODES_PER_LOG) return null;
  const watchedAt = actionTime(body.watchedAt, now);
  if (!watchedAt) return null;
  const episodes: EpisodeLogRequest["episodes"] = [];
  const seen = new Set<string>();
  for (const e of body.episodes) {
    if (!isObject(e) || typeof e.id !== "string" || !isUuidV7(e.id)) return null;
    if (!smallInt(e.season, 1) || !smallInt(e.episode, 0)) return null;
    const ref = { id: e.id, season: e.season as number, episode: e.episode as number };
    if (seen.has(episodeKey(ref))) continue;
    seen.add(episodeKey(ref));
    episodes.push(ref);
  }
  return { externalId: body.externalId, episodes, watchedAt };
}
