import { catalogError, rateLimited } from "@/app/api/_lib/http";
import type { TmdbKind } from "@/core/catalog/tmdb";
import { titleDetails } from "@/data/tmdb";
import { getCachedTitle, saveTitle } from "@/data/titles";

const LIMIT = { max: 30, windowSeconds: 60 };

/**
 * GET /api/titles/tmdb/series/66732 → { title: Title }.
 * Called when the user picks a title: serves the cached `titles` row, or fetches
 * TMDB details and caches them for later (card stats, stage 1 entries).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/titles/tmdb/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  if ((kind !== "movie" && kind !== "series") || !/^\d{1,10}$/.test(id)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const limited = await rateLimited(request, "titles", LIMIT);
  if (limited) return limited;

  const headers = { "Cache-Control": "public, s-maxage=3600" };
  const cached = await getCachedTitle("tmdb", kind, id);
  if (cached && !cached.stale) return Response.json({ title: cached.title }, { headers });

  try {
    const details = await titleDetails(kind as TmdbKind, id);
    if (!details) return Response.json({ error: "not_found" }, { status: 404 });
    await saveTitle(details.title, details.raw);
    return Response.json({ title: details.title }, { headers });
  } catch (error) {
    // TMDB down or rate-limited: an old copy still makes a fine card.
    if (cached) return Response.json({ title: cached.title }, { headers: { "Cache-Control": "no-store" } });
    return catalogError(error);
  }
}
