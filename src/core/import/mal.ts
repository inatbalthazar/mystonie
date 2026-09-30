// MyAnimeList export → anime and manga to import (S3 import & export, ADR 0041). myanimelist.net/panel.php?go=export
// gives `animelist_….xml.gz` and `mangalist_….xml.gz` (gzip, read in the browser). Inside, a flat XML list:
//   <myanimelist><myinfo>…</myinfo>
//     <anime><series_animedb_id>1</series_animedb_id><series_title><![CDATA[Cowboy Bebop]]></series_title>
//       <series_type>TV</series_type><my_watched_episodes>26</my_watched_episodes><my_start_date>0000-00-00</my_start_date>
//       <my_finish_date>…</my_finish_date><my_score>9</my_score><my_status>Completed</my_status>…</anime>
//     <manga><manga_mangadb_id>2</manga_mangadb_id><manga_title>…</manga_title><my_read_chapters>…</my_read_chapters>
//       <my_read_volumes>…</my_read_volumes>…<my_status>Reading</my_status>…</manga>
//   </myanimelist>
// Anime are found on TMDB (movies and series), manga on AniList, both through AniList's MyAnimeList ids.
import type { EntryStatus } from "../collection/entries";
import { capItems, dateOf, importItem, nameOf, ratingFromTen, type FindKind, type ImportItem, type ImportReading, type ParsedImport } from "./items";

/** Whether a text is a MyAnimeList list export. */
export function isMalXml(text: string): boolean {
  const head = text.slice(0, 4000);
  return head.includes("<myanimelist>") && (head.includes("<myinfo>") || /<(anime|manga)>/.test(head));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(v: string): string {
  return v.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[e.toLowerCase()] ?? whole;
  });
}

/** The child elements of one `<anime>` or `<manga>` block, by tag name (CDATA unwrapped, entities decoded). */
function fields(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/<([a-z_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/gi)) {
    out[m[1]!.toLowerCase()] = m[2] !== undefined ? m[2] : decode(m[3] ?? "");
  }
  return out;
}

/**
 * MyAnimeList's statuses, as words or (older exports) numbers. Dropped titles are left out: Mystonie has no
 * "dropped", and they're neither finished nor still being watched.
 */
function statusOf(v: string | undefined): EntryStatus | null {
  switch ((v ?? "").trim().toLowerCase()) {
    case "completed":
    case "2":
      return "finished";
    case "watching":
    case "reading":
    case "on-hold":
    case "1":
    case "3":
      return "watching";
    case "plan to watch":
    case "plan to read":
    case "6":
      return "want";
    default:
      return null;
  }
}

/** Anime MAL types → what TMDB would call them. Music videos, commercials and promos aren't titles to log. */
function findOf(type: string | undefined): FindKind | null {
  switch ((type ?? "").trim().toLowerCase()) {
    case "movie":
      return "movie";
    case "tv":
    case "tv special":
      return "series";
    case "ova":
    case "ona":
    case "special":
    case "":
    case "unknown":
      return "screen";
    default:
      return null;
  }
}

const count = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 100_000 ? n : 0;
};

/**
 * The lists' anime and manga (one file each, or both). Completed ones are dated by their finish date, else their
 * start date, else (MyAnimeList often has neither) `undated`. A manga being read with a start date brings its
 * chapter (or volume) as a reading checkpoint on that day. Null when no text is a MyAnimeList export.
 */
export function parseMal(texts: readonly string[]): ParsedImport | null {
  const lists = texts.filter(isMalXml);
  if (lists.length === 0) return null;
  const items: ImportItem[] = [];
  const seen = new Set<string>();
  for (const text of lists) {
    for (const m of text.matchAll(/<(anime|manga)>([\s\S]*?)<\/\1>/g)) {
      const type = m[1] as "anime" | "manga";
      const f = fields(m[2]!);
      const malId = count(type === "anime" ? f.series_animedb_id : f.manga_mangadb_id);
      const name = nameOf(type === "anime" ? f.series_title : f.manga_title);
      const status = statusOf(f.my_status);
      const find = type === "anime" ? findOf(f.series_type) : "manga";
      const key = `mal:${type}:${malId}`;
      if (!malId || !name || !status || !find || seen.has(key)) continue;
      seen.add(key);
      const started = dateOf(f.my_start_date);
      const watchedOn = status === "finished" ? (dateOf(f.my_finish_date) ?? started) : null;
      const reading: ImportReading[] = [];
      if (type === "manga" && status === "watching" && started) {
        const chapters = count(f.my_read_chapters);
        const volumes = count(f.my_read_volumes);
        const readAt = `${started}T12:00:00.000Z`;
        if (chapters) reading.push({ unit: "chapter", position: chapters, readAt });
        else if (volumes) reading.push({ unit: "volume", position: volumes, readAt });
      }
      items.push(
        importItem({
          key,
          name,
          find,
          query: { by: "mal", type, malId, name },
          status,
          watchedOn,
          undated: status === "finished" && !watchedOn,
          rating: status === "finished" ? ratingFromTen(Number(f.my_score)) : null,
          reading,
        }),
      );
    }
  }
  return { source: "mal", ...capItems(items) };
}
