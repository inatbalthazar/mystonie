// Letterboxd export → the films to import (S2 Letterboxd import, ADR 0033). An export is a ZIP of CSVs; the ones
// that matter are at its root:
//   diary.csv      Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date   (one row per watch)
//   watched.csv    Date, Name, Year, Letterboxd URI                                        (every film marked watched)
//   ratings.csv    Date, Name, Year, Letterboxd URI, Rating                                (the current rating)
//   watchlist.csv  Date, Name, Year, Letterboxd URI                                        (films to watch)
// A diary row's URI points at the diary entry, not the film, so rows are joined by name + year.
import { csvRecords } from "./csv";

export const LETTERBOXD_FILES = ["diary", "watched", "ratings", "watchlist"] as const;
export type LetterboxdFile = (typeof LETTERBOXD_FILES)[number];

/** More films than this in one export are cut (the newest are kept). */
export const LETTERBOXD_MAX_FILMS = 5000;

/** One film to import: finished (watched, with its latest watch date) or wanted (only on the watchlist). */
export type LetterboxdFilm = {
  /** Name + year: joins the files, and identifies the film in the preview. */
  key: string;
  name: string;
  year: number | null;
  status: "finished" | "want";
  /** `YYYY-MM-DD` of the latest watch (the diary's watched date, else the day it was marked watched). Null for `want`. */
  watchedOn: string | null;
  /** 0.5–5 in half steps: ratings.csv, else the latest rated diary entry. */
  rating: number | null;
  /** Diary entries for it (more than one = rewatched). */
  watches: number;
};

export type LetterboxdImport = {
  films: LetterboxdFilm[];
  /** Which of the export's files were found. */
  files: LetterboxdFile[];
  /** Films left out over `LETTERBOXD_MAX_FILMS`. */
  cut: number;
};

/**
 * Which export file a path is: the root-level `diary.csv` and friends (a ZIP's `deleted/diary.csv` and
 * `orphaned/…` are not), also when picked one by one. Null for anything else.
 */
export function letterboxdFileOf(path: string): LetterboxdFile | null {
  const name = path.replace(/\\/g, "/").toLowerCase();
  if (name.includes("/")) return null;
  const base = name.replace(/\.csv$/, "");
  return name.endsWith(".csv") && (LETTERBOXD_FILES as readonly string[]).includes(base) ? (base as LetterboxdFile) : null;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date `YYYY-MM-DD`, else null. */
function dateOf(v: string | undefined): string | null {
  const match = v ? DATE_RE.exec(v) : null;
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? v! : null;
}

function yearOf(v: string | undefined): number | null {
  const year = v && /^\d{4}$/.test(v) ? Number(v) : NaN;
  return year >= 1870 && year <= 2200 ? year : null;
}

function ratingOf(v: string | undefined): number | null {
  const rating = v ? Number(v) : NaN;
  return rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2) ? rating : null;
}

type Film = LetterboxdFilm & { diaryRatingOn: string | null; ratingFromFile: boolean };

/**
 * Merges the export's CSVs (`{ path, text }`, from the ZIP or picked one by one) into one row per film. Newest
 * watch first, then the watchlist. Null when none of the files is a Letterboxd export file.
 */
export function parseLetterboxd(files: readonly { path: string; text: string }[]): LetterboxdImport | null {
  const byKind = new Map<LetterboxdFile, string>();
  for (const f of files) {
    const kind = letterboxdFileOf(f.path);
    if (kind) byKind.set(kind, f.text);
  }
  if (byKind.size === 0) return null;

  const films = new Map<string, Film>();
  const film = (row: Record<string, string>): Film | null => {
    const name = row.name?.replace(/\s+/g, " ").trim();
    if (!name || name.length > 300) return null;
    const year = yearOf(row.year);
    const key = `${name}\u0000${year ?? ""}`;
    let f = films.get(key);
    if (!f) {
      f = { key, name, year, status: "want", watchedOn: null, rating: null, watches: 0, diaryRatingOn: null, ratingFromFile: false };
      films.set(key, f);
    }
    return f;
  };
  const watched = (f: Film, on: string | null) => {
    f.status = "finished";
    if (on && (!f.watchedOn || on > f.watchedOn)) f.watchedOn = on;
  };

  for (const row of csvRecords(byKind.get("diary") ?? "")) {
    const f = film(row);
    if (!f) continue;
    // The diary's "Watched Date" is the day it was seen; "Date" is when it was logged.
    const on = dateOf(row["watched date"]) ?? dateOf(row.date);
    f.watches += 1;
    watched(f, on);
    const rating = ratingOf(row.rating);
    if (rating !== null && !f.ratingFromFile && (!f.diaryRatingOn || (on ?? "") >= f.diaryRatingOn)) {
      f.rating = rating;
      f.diaryRatingOn = on ?? "";
    }
  }
  for (const row of csvRecords(byKind.get("watched") ?? "")) {
    const f = film(row);
    // "Date" is when it was marked watched: the best date there is for a film with no diary entry.
    if (f && f.watches === 0) watched(f, dateOf(row.date));
  }
  for (const row of csvRecords(byKind.get("ratings") ?? "")) {
    const f = film(row);
    const rating = ratingOf(row.rating);
    if (!f || rating === null) continue;
    f.rating = rating;
    f.ratingFromFile = true;
    // Only watched films can be rated on Letterboxd; the day it was rated stands in when nothing else dates it.
    if (f.status !== "finished" || !f.watchedOn) watched(f, dateOf(row.date));
  }
  for (const row of csvRecords(byKind.get("watchlist") ?? "")) film(row);

  // A finished film with no usable date at all can't be imported as finished (the date is required).
  const list: LetterboxdFilm[] = [...films.values()].flatMap(({ key, name, year, status, watchedOn, rating, watches }) =>
    status === "finished" && !watchedOn ? [] : [{ key, name, year, status, watchedOn, rating: status === "finished" ? rating : null, watches }],
  );
  list.sort(
    (a, b) =>
      (a.status === b.status ? 0 : a.status === "finished" ? -1 : 1) ||
      (b.watchedOn ?? "").localeCompare(a.watchedOn ?? "") ||
      a.name.localeCompare(b.name) ||
      (a.year ?? 0) - (b.year ?? 0),
  );
  return {
    films: list.slice(0, LETTERBOXD_MAX_FILMS),
    files: LETTERBOXD_FILES.filter((k) => byKind.has(k)),
    cut: Math.max(0, list.length - LETTERBOXD_MAX_FILMS),
  };
}
