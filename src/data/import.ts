// The import's server side (S2 Letterboxd import, ADR 0033; S3 import & export, ADR 0041): finding the export's
// titles in the catalogs, and saving the picked ones as the signed-in user (RLS), with their episodes and reading
// logs. The rules live in src/core/import; this file only reads and writes.
import { posterUrl } from "@/core/catalog/images";
import type { SearchResult, Title, TitleKind } from "@/core/catalog/types";
import type { EntryStatus } from "@/core/collection/entries";
import { episodeKey, seriesComplete, seriesProgress } from "@/core/collection/episodes";
import { importedFinishedAt, planImport, undatedFinishedAt, type ExistingEntry, type ImportRow } from "@/core/import/commit";
import type { ItemQuery } from "@/core/import/items";
import { matchAnime, matchBook, matchFilm, matchShow, MATCH_CANDIDATES, type FilmMatch } from "@/core/import/match";
import { uuidv7 } from "@/core/ids";
import { localDateKey } from "@/core/stats/period";
import { anilistByMal, searchManga } from "./anilist";
import { ensureEpisodes } from "./episodes";
import { searchBooks } from "./google-books";
import { checkProgress } from "./milestones";
import type { UserClient } from "./supabase-server";
import { ensureTitle } from "./titles";
import { searchMovies, searchSeries, seriesByTvdb } from "./tmdb";

/** Catalog calls in flight per request: quick, and far inside the catalogs' rate limits. */
const CONCURRENCY = 4;

/** `fn` over `items` with at most `limit` running at once; results in input order. */
async function pool<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** A cached title as a search result (for the preview's poster and name). */
function asResult(title: Title): SearchResult {
  const result: SearchResult = { source: title.source, externalId: title.externalId, kind: title.kind, name: title.name };
  if (title.originalName && title.originalName !== title.name) result.originalName = title.originalName;
  if (title.year) result.year = title.year;
  const image = posterUrl(title.source, title.posterPath);
  if (image) result.imageUrl = image;
  return result;
}

/**
 * Each item's match (throws `CatalogError` when a catalog fails, so the client retries the batch). MyAnimeList
 * items are looked up on AniList in one request per list first.
 */
export async function matchItems(queries: readonly ItemQuery[]): Promise<FilmMatch[]> {
  const mal = (type: "anime" | "manga") => queries.flatMap((q) => (q.by === "mal" && q.type === type ? [q.malId] : []));
  const [anime, manga] = await Promise.all([anilistByMal(mal("anime"), "ANIME"), anilistByMal(mal("manga"), "MANGA")]);

  return pool(queries, CONCURRENCY, async (q): Promise<FilmMatch> => {
    switch (q.by) {
      case "film":
        return matchFilm(q, searchMovies);
      case "show":
        return matchShow(q, searchSeries, seriesByTvdb);
      case "book":
        return matchBook(q, searchBooks);
      case "mal": {
        if (q.type === "anime") {
          return matchAnime(anime.anime.get(q.malId) ?? null, { name: q.name, find: "series" }, { movies: searchMovies, series: searchSeries });
        }
        const found = manga.manga.get(q.malId);
        if (found) return { state: "matched", match: found };
        // Not on AniList by that id (or a novel, which is a book): let the user pick from a search by name.
        const candidates = (await searchManga(q.name)).slice(0, MATCH_CANDIDATES);
        return candidates.length ? { state: "ambiguous", candidates } : { state: "missing" };
      }
      case "id": {
        const title = await ensureTitle(q.kind, q.externalId);
        return title ? { state: "matched", match: asResult(title.title) } : { state: "missing" };
      }
    }
  });
}

/**
 * The status of each of these catalog titles the user already has, keyed `kind:externalId` (for "In your
 * collection" in the preview).
 */
export async function titleStatuses(
  db: UserClient,
  userId: string,
  titles: readonly Pick<SearchResult, "kind" | "externalId">[],
): Promise<Record<string, EntryStatus>> {
  if (titles.length === 0) return {};
  const wanted = new Set(titles.map((t) => `${t.kind}:${t.externalId}`));
  const { data, error } = await db
    .from("entries")
    .select("status, title:titles!inner(kind, external_id)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("title.external_id", [...new Set(titles.map((t) => t.externalId))]);
  if (error) throw new Error(`entries read failed: ${error.message}`);
  return Object.fromEntries(
    data.flatMap((row) => {
      const key = `${row.title.kind}:${row.title.external_id}`;
      return wanted.has(key) ? [[key, row.status as EntryStatus]] : [];
    }),
  );
}

/** What saving a row did. `added` counts a retried row the first request saved. */
export type ImportOutcome = {
  id: string;
  outcome: "added" | "updated" | "kept" | "failed";
  /** Finished by this import (added or updated as finished): the "Imported N films" card counts it. */
  finished: boolean;
  /** Episodes and reading checkpoints this import logged. */
  episodes: number;
  reading: number;
  /** Watch time this import added: a film it finished, the episodes it logged. */
  minutes: number;
  /** First and last day of what it brought (finish, logs), `YYYY-MM-DD` in the user's calendar; null when nothing. */
  from: string | null;
  to: string | null;
  /** The saved title, for the card and the done list. */
  title?: { name: string; kind: TitleKind; posterUrl: string | null };
};

async function existingEntries(db: UserClient, userId: string, titleIds: readonly string[]): Promise<Map<string, ExistingEntry>> {
  if (titleIds.length === 0) return new Map();
  const { data, error } = await db
    .from("entries")
    .select("id, title_id, status, rating, review, hours_played")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("title_id", [...titleIds]);
  if (error) throw new Error(`entries read failed: ${error.message}`);
  return new Map(
    data.map((e) => [e.title_id, { id: e.id, status: e.status as EntryStatus, rating: e.rating, review: e.review, hoursPlayed: e.hours_played }]),
  );
}

/**
 * Logs the series' episodes the user hasn't logged yet (only episodes TMDB lists: numbering the catalogs disagree
 * on is left out). Returns what was logged, and whether every episode is now out and logged in an ended series.
 */
async function importEpisodes(
  db: UserClient,
  userId: string,
  titleId: string,
  row: ImportRow,
  typicalRuntime: number | null,
  today: string,
): Promise<{ logged: { watchedAt: string; runtimeMin: number | null }[]; complete: boolean }> {
  const { episodes: known, ended } = await ensureEpisodes(titleId, row.externalId);
  const byKey = new Map(known.map((e) => [episodeKey(e), e]));
  const { data: have, error } = await db
    .from("episode_logs")
    .select("season, episode")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .is("deleted_at", null)
    .limit(20000);
  if (error) throw new Error(`episode_logs read failed: ${error.message}`);
  const done = new Set(have.map(episodeKey));
  const fresh = row.episodes.filter((e) => byKey.has(episodeKey(e)) && !done.has(episodeKey(e)));
  const logged = fresh.map((e) => ({ ...e, runtimeMin: byKey.get(episodeKey(e))!.runtimeMin ?? typicalRuntime }));
  if (logged.length > 0) {
    const { error: insertError } = await db.from("episode_logs").insert(
      logged.map((e) => ({ id: uuidv7(), title_id: titleId, season: e.season, episode: e.episode, runtime_min: e.runtimeMin, watched_at: e.watchedAt })),
    );
    if (insertError) throw new Error(`episode_logs insert failed: ${insertError.message}`);
  }
  const all = [...have, ...fresh];
  return { logged, complete: seriesComplete(seriesProgress(known, all, today), ended) };
}

/** Adds the reading checkpoints the user doesn't have yet. Returns the ones added. */
async function importReading(db: UserClient, userId: string, titleId: string, row: ImportRow): Promise<{ readAt: string }[]> {
  const { data: have, error } = await db
    .from("reading_logs")
    .select("unit, position")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .is("deleted_at", null)
    .limit(5000);
  if (error) throw new Error(`reading_logs read failed: ${error.message}`);
  const done = new Set(have.map((l) => `${l.unit}:${l.position}`));
  const fresh = row.reading.filter((l) => !done.has(`${l.unit}:${l.position}`));
  if (fresh.length > 0) {
    const { error: insertError } = await db
      .from("reading_logs")
      .insert(fresh.map((l) => ({ id: uuidv7(), title_id: titleId, unit: l.unit, position: l.position, read_at: l.readAt })));
    if (insertError) throw new Error(`reading_logs insert failed: ${insertError.message}`);
  }
  return fresh;
}

/**
 * Saves a batch of picked titles. Idempotent: a title already in the collection is never added twice (see
 * `planImport`), and episodes and reading checkpoints already logged aren't logged again, so re-importing the same
 * export adds nothing. `done` marks the import's last request: the milestones, badges and challenges the imported
 * history reached are then recorded without being celebrated.
 */
export async function commitImport(
  db: UserClient,
  userId: string,
  rows: readonly ImportRow[],
  done: boolean,
  now: number,
): Promise<ImportOutcome[]> {
  const { data: profile, error: profileError } = await db.from("profiles").select("time_zone").eq("id", userId).single();
  if (profileError) throw new Error(`profiles read failed: ${profileError.message}`);
  const zone = profile.time_zone;
  const today = localDateKey(now, zone);
  const day = (iso: string) => localDateKey(Date.parse(iso), zone);

  // The catalog first (cached titles cost nothing; new ones one call each). A title the catalog can't give is skipped.
  const titles = await pool(rows, CONCURRENCY, (row) =>
    ensureTitle(row.kind, row.externalId).catch((error) => {
      console.warn("import: title not cached", row.kind, row.externalId, error);
      return null;
    }),
  );
  const existing = await existingEntries(db, userId, titles.flatMap((t) => (t ? [t.id] : [])));

  type Saved = { outcome: ImportOutcome["outcome"]; finished: boolean };

  /** The entry: added, moved forward, or kept (see `planImport`). */
  const saveEntry = async (
    row: ImportRow,
    status: EntryStatus,
    finishedAt: string | null,
    titleId: string,
    entry: ExistingEntry | undefined,
    logged: boolean,
  ): Promise<Saved> => {
    const plan = planImport({ ...row, status }, entry);
    if (plan.action === "keep") {
      if (plan.retried) return { outcome: "added", finished: status === "finished" };
      return { outcome: logged ? "updated" : "kept", finished: false };
    }
    if (plan.action === "insert") {
      const { error } = await db
        .from("entries")
        .insert({
          id: row.id,
          title_id: titleId,
          status,
          finished_at: finishedAt,
          rating: row.rating,
          review: row.review,
          hours_played: row.hoursPlayed ?? null,
        });
      if (!error) return { outcome: "added", finished: status === "finished" };
      // Added in between (another tab, a quick add): plan again against what's there now.
      if (error.code === "23505") {
        const current = (await existingEntries(db, userId, [titleId])).get(titleId);
        if (current) return saveEntry(row, status, finishedAt, titleId, current, logged);
      }
      throw new Error(`entries insert failed: ${error.message}`);
    }
    const { error } = await db
      .from("entries")
      .update({
        ...(plan.status ? { status: plan.status, finished_at: plan.status === "finished" ? finishedAt : null } : {}),
        ...(plan.rating ? { rating: row.rating } : {}),
        ...(plan.review ? { review: row.review } : {}),
        ...(plan.hours ? { hours_played: row.hoursPlayed } : {}),
      })
      .eq("id", entry!.id);
    if (error) throw new Error(`entries update failed: ${error.message}`);
    return { outcome: "updated", finished: plan.status === "finished" };
  };

  const save = async (row: ImportRow, titleId: string, title: Title, entry: ExistingEntry | undefined) => {
    // Logs first: a series whose episodes are now all seen is finished by them, dated by the last one.
    const episodes = row.episodes.length > 0 ? await importEpisodes(db, userId, titleId, row, title.runtimeMin, today) : null;
    const reading = row.reading.length > 0 ? await importReading(db, userId, titleId, row) : [];
    const lastEpisode = row.episodes.map((e) => e.watchedAt).sort().at(-1) ?? null;
    const byEpisodes = !!episodes?.complete && row.status !== "finished" && lastEpisode !== null;
    const status: EntryStatus = byEpisodes ? "finished" : row.status;
    const finishedAt =
      status !== "finished"
        ? null
        : byEpisodes
          ? lastEpisode
          : (row.finishedAt ??
            (row.watchedOn ? importedFinishedAt(row.watchedOn, zone, now) : row.undated ? undatedFinishedAt(title.year, now) : null));
    const logged = episodes?.logged ?? [];
    const saved: Saved =
      status === "finished" && !finishedAt
        ? { outcome: "failed", finished: false }
        : await saveEntry(row, status, finishedAt, titleId, entry, logged.length + reading.length > 0);
    return { ...saved, finishedAt: saved.finished ? finishedAt : null, logged, reading };
  };

  const outcomes = await pool(rows, CONCURRENCY, async (row, i): Promise<ImportOutcome> => {
    const title = titles[i];
    const empty = { id: row.id, episodes: 0, reading: 0, minutes: 0, from: null, to: null };
    if (!title) return { ...empty, outcome: "failed", finished: false };
    const info = { name: title.title.name, kind: title.title.kind, posterUrl: posterUrl(title.title.source, title.title.posterPath) };
    try {
      const saved = await save(row, title.id, title.title, existing.get(title.id));
      const { logged } = saved;
      const days = [
        ...(saved.finishedAt ? [day(saved.finishedAt)] : []),
        ...logged.map((e) => day(e.watchedAt)),
        ...saved.reading.map((l) => day(l.readAt)),
      ].sort();
      const minutes = logged.reduce((n, e) => n + (e.runtimeMin ?? 0), 0) + (saved.finished && row.kind === "movie" ? (title.title.runtimeMin ?? 0) : 0);
      return {
        id: row.id,
        outcome: saved.outcome,
        finished: saved.finished,
        episodes: logged.length,
        reading: saved.reading.length,
        minutes,
        from: days[0] ?? null,
        to: days.at(-1) ?? null,
        title: info,
      };
    } catch (error) {
      console.error(error);
      return { ...empty, outcome: "failed", finished: false, title: info };
    }
  });

  if (done) await checkProgress(db, userId, now, true);
  return outcomes;
}
