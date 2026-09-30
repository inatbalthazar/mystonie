// Goodreads library export → books to import (S3 import & export, ADR 0041). Goodreads → My Books → Import and
// export → Export Library gives one CSV, `goodreads_library_export.csv`:
//   Book Id, Title, Author, Author l-f, Additional Authors, ISBN, ISBN13, My Rating, Average Rating, Publisher,
//   Binding, Number of Pages, Year Published, Original Publication Year, Date Read, Date Added, Bookshelves,
//   Bookshelves with positions, Exclusive Shelf, My Review, Spoiler, Private Notes, Read Count, Owned Copies
// ISBNs are written as spreadsheet formulas (`="0439023483"`), dates as `2023/05/14`, ratings 0–5 (0 = unrated).
import { csvRecords } from "./csv";
import { capItems, dateOf, importItem, nameOf, yearOf, type ImportItem, type ParsedImport } from "./items";

/** Whether a CSV's header is a Goodreads library export's. */
export function isGoodreadsCsv(text: string): boolean {
  const header = text.slice(0, 2000).split(/\r?\n/, 1)[0]!.toLowerCase();
  return header.includes("book id") && header.includes("exclusive shelf");
}

/** `="0439023483"` → `0439023483`; a valid ISBN-10 or ISBN-13, else null. */
export function isbnOf(cell: string | undefined): string | null {
  const v = (cell ?? "").replace(/^=/, "").replace(/"/g, "").replace(/[\s-]/g, "").toUpperCase();
  return /^\d{9}[\dX]$/.test(v) || /^97[89]\d{10}$/.test(v) ? v : null;
}

/** "The Hunger Games (The Hunger Games, #1)" → "The Hunger Games": the series goes, the book stays. */
export function bookTitle(title: string): string {
  return title.replace(/\s*\([^()]*#\s*[\d.–-]+\)\s*$/, "").trim() || title;
}

/** The shelves Mystonie knows. Custom exclusive shelves ("did-not-finish") are left out. */
const SHELVES: Record<string, ImportItem["status"]> = { read: "finished", "currently-reading": "watching", "to-read": "want" };

/** The export's books: read ones with their date (read, else added) and rating, current reads and the to-read shelf. */
export function parseGoodreads(text: string): ParsedImport | null {
  if (!isGoodreadsCsv(text)) return null;
  const items: ImportItem[] = [];
  const seen = new Set<string>();
  for (const row of csvRecords(text)) {
    const status = SHELVES[row["exclusive shelf"]?.toLowerCase() ?? ""];
    const title = nameOf(row.title);
    if (!status || !title) continue;
    const name = bookTitle(title);
    const author = nameOf(row.author);
    const key = `goodreads:${row["book id"] || `${name}\u0000${author ?? ""}`}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // "Date Read" is often empty for books shelved long ago; the day it was shelved is the best there is then.
    const watchedOn = status === "finished" ? (dateOf(row["date read"]) ?? dateOf(row["date added"])) : null;
    if (status === "finished" && !watchedOn) continue;
    const rating = Number(row["my rating"]);
    items.push(
      importItem({
        key,
        name,
        year: yearOf(row["original publication year"]) ?? yearOf(row["year published"]),
        author,
        find: "book",
        query: { by: "book", name, author, isbn: isbnOf(row.isbn13) ?? isbnOf(row.isbn) },
        status,
        watchedOn,
        rating: status === "finished" && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
      }),
    );
  }
  return { source: "goodreads", ...capItems(items) };
}
