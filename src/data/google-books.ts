// Server-side Google Books v1 client. The key stays on the server. Without `GOOGLE_BOOKS_API_KEY` book search is off:
// Google's anonymous quota is 0 queries a day (checked 2026-09-27), so keyless calls would only fail.
import { normalizeGoogleBooksDetails, normalizeGoogleBooksSearch } from "@/core/catalog/google-books";
import type { SearchResult, Title } from "@/core/catalog/types";
import { CatalogError } from "./catalog-error";

const API = "https://www.googleapis.com/books/v1";
const DAY = 86_400;

async function books(path: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) throw new CatalogError("GOOGLE_BOOKS_API_KEY is not set", 503);
  const url = new URL(API + path);
  url.search = new URLSearchParams({ ...params, key }).toString();
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: DAY }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new CatalogError(`Google Books ${path} responded ${res.status}`, 502);
  return res.json();
}

export async function searchBooks(query: string): Promise<SearchResult[]> {
  return normalizeGoogleBooksSearch(await books("/volumes", { q: query, printType: "books", maxResults: "20", orderBy: "relevance" }));
}

/** Details plus the raw body (kept in `titles.raw`, e.g. for the authors). Null when Google has no such volume. */
export async function bookDetails(externalId: string): Promise<{ title: Title; raw: unknown } | null> {
  const raw = await books(`/volumes/${externalId}`, {});
  const title = normalizeGoogleBooksDetails(raw);
  return title ? { title, raw } : null;
}
