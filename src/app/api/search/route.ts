import { catalogError, rateLimited } from "@/app/api/_lib/http";
import { searchTitles } from "@/data/tmdb";

// Search-as-you-type sends a request per pause, so the limit allows fast typing.
const LIMIT = { max: 60, windowSeconds: 60 };

/** GET /api/search?q=stranger → { results: SearchResult[] } (movies + series from TMDB). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (q.length < 2 || q.length > 100) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }

  const limited = await rateLimited(request, "search", LIMIT);
  if (limited) return limited;

  try {
    // Lower-cased so "Stranger" and "stranger" share TMDB's cached response.
    const results = await searchTitles(q.toLowerCase());
    return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return catalogError(error);
  }
}
