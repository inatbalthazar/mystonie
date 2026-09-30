// Which app an export comes from, and its items (S3 import & export, ADR 0041). The import page takes whatever the
// user picks (a ZIP, CSVs, MyAnimeList's .xml once un-gzipped) and asks each reader in turn; the first that
// recognises the files wins.
import { parseGoodreads } from "./goodreads";
import { importItem, type ImportItem, type ParsedImport } from "./items";
import { letterboxdFileOf, parseLetterboxd, type LetterboxdFilm } from "./letterboxd";
import { parseMal } from "./mal";
import { parseMystonie } from "./mystonie";
import { isTvTimeFile, parseTvTime } from "./tvtime";

export type ExportFile = { path: string; text: string };

/** Letterboxd's films as import items. */
export function letterboxdItems(films: readonly LetterboxdFilm[]): ImportItem[] {
  return films.map((f) =>
    importItem({
      key: `letterboxd:${f.key}`,
      name: f.name,
      year: f.year,
      find: "movie",
      query: { by: "film", name: f.name, year: f.year },
      status: f.status,
      watchedOn: f.watchedOn,
      rating: f.rating,
    }),
  );
}

/**
 * The files inside a ZIP worth opening: the export files each reader knows, and nothing else (a TV Time export
 * also holds tokens and device data, which are never read).
 */
export function wantedInZip(path: string): boolean {
  const name = path.replace(/\\/g, "/").toLowerCase();
  const base = name.split("/").pop()!;
  return (
    letterboxdFileOf(path) !== null ||
    isTvTimeFile(path) ||
    ["collection.csv", "episodes.csv", "reading.csv", "goodreads_library_export.csv"].includes(base) ||
    (base.endsWith(".xml") && (base.startsWith("animelist") || base.startsWith("mangalist")))
  );
}

/** The export's source and items, or null when nothing in it is an export we know. */
export function parseExport(files: readonly ExportFile[]): ParsedImport | null {
  const texts = files.map((f) => f.text);
  const mystonie = parseMystonie(texts);
  if (mystonie) return mystonie;
  const letterboxd = parseLetterboxd(files);
  if (letterboxd) return { source: "letterboxd", items: letterboxdItems(letterboxd.films), cut: letterboxd.cut };
  for (const text of texts) {
    const goodreads = parseGoodreads(text);
    if (goodreads) return goodreads;
  }
  return parseMal(texts) ?? parseTvTime(files);
}
