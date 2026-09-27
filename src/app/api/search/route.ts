import { catalogError, rateLimited } from "@/app/api/_lib/http";
import { isSearchType } from "@/core/catalog/types";
import { searchCatalog } from "@/data/catalog";

// Search-as-you-type sends a request per pause, so the limit allows fast typing.
const LIMIT = { max: 60, windowSeconds: 60 };

/**
 * GET /api/search?q=stranger[&type=all|screen|book|manga] → { results: SearchResult[] }. Without a type: movies +
 * series from TMDB (the card maker). `all` merges TMDB, AniList and Google Books (the collection's search sheet).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  const type = params.get("type") ?? "screen";
  if (q.length < 2 || q.length > 100 || !isSearchType(type)) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }

  const limited = await rateLimited(request, "search", LIMIT);
  if (limited) return limited;

  try {
    // Lower-cased so "Stranger" and "stranger" share the catalogs' cached responses.
    const results = await searchCatalog(q.toLowerCase(), type);
    return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return catalogError(error);
  }
}
