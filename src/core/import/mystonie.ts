// Mystonie's own CSV export, and reading it back (S3 import & export, ADR 0041). Settings → Your data → "Export as
// CSV" downloads a ZIP of three spreadsheets; importing that ZIP (or its CSVs) restores the collection, into this
// account or another, without matching: every row carries its catalog id.
//   collection.csv  kind, source, external_id, name, original_name, year, original_language, genres, status,
//                   finished_at, rating, review, added_at, hours_played (a game's; exports before games lack it)
//   episodes.csv    source, external_id, name, season, episode, runtime_min, watched_at
//   reading.csv     kind, source, external_id, name, unit, position, read_at
import { isExternalId, isTitleKind, sourceForKind, type CatalogSource, type TitleKind } from "../catalog/types";
import { isEntryStatus, isHoursPlayed, type EntryStatus } from "../collection/entries";
import { isReadingUnit, MAX_READING_POSITION, type ReadingUnit } from "../collection/reading";
import { csvRecords } from "./csv";
import { capItems, capLogs, importItem, momentOf, nameOf, yearOf, type ImportItem, type ParsedImport } from "./items";

export type ExportEntry = {
  kind: TitleKind;
  source: CatalogSource;
  externalId: string;
  name: string;
  originalName: string | null;
  year: number | null;
  originalLanguage: string | null;
  genres: string[];
  status: EntryStatus;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
  addedAt: string;
  /** A game's hours played. */
  hoursPlayed: number | null;
};
export type ExportEpisode = { source: CatalogSource; externalId: string; name: string; season: number; episode: number; runtimeMin: number | null; watchedAt: string };
export type ExportReading = { kind: TitleKind; source: CatalogSource; externalId: string; name: string; unit: ReadingUnit; position: number; readAt: string };

const COLLECTION = [
  "kind",
  "source",
  "external_id",
  "name",
  "original_name",
  "year",
  "original_language",
  "genres",
  "status",
  "finished_at",
  "rating",
  "review",
  "added_at",
  "hours_played",
];
/** The collection file as exported before games (S3 games added `hours_played`): still read back. */
const COLLECTION_BEFORE_GAMES = COLLECTION.slice(0, -1);
const EPISODES = ["source", "external_id", "name", "season", "episode", "runtime_min", "watched_at"];
const READING = ["kind", "source", "external_id", "name", "unit", "position", "read_at"];

/**
 * One CSV cell. Quoted when it has a comma, quote or line break. A cell a spreadsheet would run as a formula
 * (`=`, `+`, `-`, `@`, tab, carriage return first) gets a leading `'`, which reading the file back removes.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let v = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Undoes `csvCell`'s formula guard. */
const unguard = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

function csv(header: string[], rows: (string | number | null)[][]): string {
  // A byte-order mark, so spreadsheets read the names (Thai, Korean, …) as UTF-8.
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** The three files of a CSV export, by file name. */
export function mystonieCsvFiles(entries: readonly ExportEntry[], episodes: readonly ExportEpisode[], reading: readonly ExportReading[]): Record<string, string> {
  return {
    "collection.csv": csv(
      COLLECTION,
      entries.map((e) => [
        e.kind,
        e.source,
        e.externalId,
        e.name,
        e.originalName,
        e.year,
        e.originalLanguage,
        e.genres.join("; "),
        e.status,
        e.finishedAt,
        e.rating,
        e.review,
        e.addedAt,
        e.hoursPlayed,
      ]),
    ),
    "episodes.csv": csv(
      EPISODES,
      episodes.map((e) => [e.source, e.externalId, e.name, e.season, e.episode, e.runtimeMin, e.watchedAt]),
    ),
    "reading.csv": csv(
      READING,
      reading.map((r) => [r.kind, r.source, r.externalId, r.name, r.unit, r.position, r.readAt]),
    ),
  };
}

type Which = "collection" | "episodes" | "reading";

/** Which of our files a CSV is, by its header (the file may have been renamed). */
export function mystonieFileOf(text: string): Which | null {
  const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0]!.trim();
  if (header === COLLECTION.join(",") || header === COLLECTION_BEFORE_GAMES.join(",")) return "collection";
  if (header === EPISODES.join(",")) return "episodes";
  if (header === READING.join(",")) return "reading";
  return null;
}

/**
 * A CSV export (any of its three files) → one item per title, with its catalog id. Entries keep their exact
 * finish time, rating and review; a series gets its episodes and a book or manga its reading logs. Logs of a title
 * with no collection row (removed from the collection) come back as "watching". Null when no file is ours.
 */
export function parseMystonie(texts: readonly string[]): ParsedImport | null {
  const byKind = new Map<Which, string>();
  for (const text of texts) {
    const which = mystonieFileOf(text);
    if (which) byKind.set(which, text);
  }
  if (byKind.size === 0) return null;

  const items = new Map<string, ImportItem>();
  const item = (kind: TitleKind, externalId: string, name: string, status: EntryStatus): ImportItem => {
    const key = `mystonie:${kind}:${externalId}`;
    let it = items.get(key);
    if (!it) {
      it = importItem({ key, name, find: kind, query: { by: "id", kind, externalId }, status });
      items.set(key, it);
    }
    return it;
  };
  const known = (kind: string, source: string, externalId: string): kind is TitleKind =>
    isTitleKind(kind) && source === sourceForKind(kind) && isExternalId(kind, externalId);

  for (const row of csvRecords(byKind.get("collection") ?? "")) {
    const name = nameOf(unguard(row.name ?? ""));
    const { kind, source, external_id: externalId, status } = row;
    if (!name || !known(kind!, source!, externalId!) || !isEntryStatus(status)) continue;
    const finishedAt = status === "finished" ? momentOf(row.finished_at) : null;
    if (status === "finished" && !finishedAt) continue;
    const rating = Number(row.rating);
    const review = unguard(row.review ?? "").trim();
    const hours = Number(row.hours_played);
    Object.assign(item(kind as TitleKind, externalId!, name, status), {
      year: yearOf(row.year),
      status,
      finishedAt,
      rating: row.rating && rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2) ? rating : null,
      review: review && review.length <= 280 ? review : null,
      hoursPlayed: kind === "game" && row.hours_played && isHoursPlayed(hours) ? hours : null,
    });
  }
  for (const row of csvRecords(byKind.get("episodes") ?? "")) {
    const name = nameOf(unguard(row.name ?? ""));
    const season = Number(row.season);
    const episode = Number(row.episode);
    const watchedAt = momentOf(row.watched_at);
    if (!name || !known("series", row.source!, row.external_id!) || !watchedAt) continue;
    if (!Number.isInteger(season) || season < 1 || season > 32767 || !Number.isInteger(episode) || episode < 0 || episode > 32767) continue;
    item("series", row.external_id!, name, "watching").episodes.push({ season, episode, watchedAt });
  }
  for (const row of csvRecords(byKind.get("reading") ?? "")) {
    const name = nameOf(unguard(row.name ?? ""));
    const position = Number(row.position);
    const readAt = momentOf(row.read_at);
    const { kind, unit } = row;
    if (!name || (kind !== "book" && kind !== "manga") || !known(kind, row.source!, row.external_id!) || !readAt) continue;
    if (!isReadingUnit(unit) || (kind === "book") !== (unit === "page")) continue;
    if (!Number.isInteger(position) || position < 1 || position > MAX_READING_POSITION) continue;
    item(kind, row.external_id!, name, "watching").reading.push({ unit, position, readAt });
  }

  const list = [...items.values()].map((i) => ({
    ...i,
    episodes: capLogs(i.episodes, (e) => e.watchedAt),
    reading: capLogs(i.reading, (r) => r.readAt),
  }));
  return { source: "mystonie", ...capItems(list) };
}
