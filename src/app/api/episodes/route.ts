import { catalogError, otherAccount, rateLimited } from "@/app/api/_lib/http";
import { episodeKey, parseEpisodeLog } from "@/core/collection/episodes";
import { ensureEpisodes, logEpisodes } from "@/data/episodes";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";

const LIMIT = { max: 120, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/episodes { externalId, episodes: [{ id, season, episode }], watchedAt? } → { logs, status }.
 * Logs episodes of a TMDB series as the signed-in user (one tap, "Next episode", "Mark season watched"), watched at
 * `watchedAt` (default now: a log made offline keeps its own time, ADR 0042).
 * The series joins the collection as "watching" if it isn't there yet.
 */
export async function POST(request: Request) {
  const input = parseEpisodeLog(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const other = otherAccount(request, userId);
  if (other) return other;

  const limited = await rateLimited(request, "episodes", LIMIT);
  if (limited) return limited;

  let title, series;
  try {
    title = await ensureTitle("series", input.externalId);
    if (!title) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    series = await ensureEpisodes(title.id, input.externalId);
  } catch (error) {
    return catalogError(error);
  }

  try {
    const perEpisode = new Map(series.episodes.map((e) => [episodeKey(e), e.runtimeMin]));
    const result = await logEpisodes(supabase, userId, title.id, input, { perEpisode, typical: title.title.runtimeMin });
    return Response.json(result, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
