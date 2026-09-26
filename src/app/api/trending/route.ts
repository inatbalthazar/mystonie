import { catalogError, rateLimited } from "@/app/api/_lib/http";
import { trendingTitles } from "@/data/tmdb";

const LIMIT = { max: 30, windowSeconds: 60 };

/** GET /api/trending → { results: SearchResult[] }, this week's trending movies + series. */
export async function GET(request: Request) {
  const limited = await rateLimited(request, "trending", LIMIT);
  if (limited) return limited;

  try {
    const results = await trendingTitles();
    // Same for everyone, so the CDN may serve it for an hour.
    return Response.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    return catalogError(error);
  }
}
