import { catalogError, rateLimited } from "@/app/api/_lib/http";
import { parseMatchBody } from "@/core/import/commit";
import { matchItems, titleStatuses } from "@/data/import";
import { userClient } from "@/data/supabase-server";

// A 500-title export is 25 requests; a 5,000-title one waits out the window a few times (the client honours Retry-After).
const LIMIT = { max: 120, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };
// A batch of series fetches every season of each (cached after), and a batch of books a search or two each.
export const maxDuration = 60;

/**
 * POST /api/import/match { items: ItemQuery[] } (≤ 20) → { matches: FilmMatch[], have: { "kind:externalId": status } }.
 * Finds each imported title in its catalog (S2 Letterboxd import, S3 import & export, ADR 0041): films and shows on
 * TMDB, books on Google Books, MyAnimeList entries through AniList. `have` marks the found titles the user already
 * has. Nothing is saved.
 */
export async function POST(request: Request) {
  const items = parseMatchBody(await request.json().catch(() => null));
  if (!items) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "import-match", LIMIT);
  if (limited) return limited;

  let matches;
  try {
    matches = await matchItems(items);
  } catch (error) {
    return catalogError(error);
  }
  const found = matches.flatMap((m) => (m.state === "matched" ? [m.match] : m.state === "ambiguous" ? m.candidates : []));
  try {
    const have = await titleStatuses(supabase, userId, found);
    return Response.json({ matches, have }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
