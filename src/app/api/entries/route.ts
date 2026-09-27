import { after } from "next/server";
import { catalogError, rateLimited } from "@/app/api/_lib/http";
import { parseNewEntry } from "@/core/collection/entries";
import { addEntry } from "@/data/entries";
import { ensureEpisodes } from "@/data/episodes";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";

const LIMIT = { max: 60, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/entries { id, title: { source, kind, externalId }, status, finishedAt? } → { entry } (quick add).
 * Caches the title from TMDB when needed, then saves the entry as the signed-in user (RLS).
 * A title already in the collection is updated instead, so the response id may differ from the request.
 */
export async function POST(request: Request) {
  const input = parseNewEntry(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "entries", LIMIT);
  if (limited) return limited;

  let title;
  try {
    title = await ensureTitle(input.title.kind, input.title.externalId);
  } catch (error) {
    return catalogError(error);
  }
  if (!title) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });

  try {
    const entry = await addEntry(supabase, userId, input, title.id);
    // Cache the episodes after answering, so "Up next" and the series page have them.
    if (input.title.kind === "series") {
      after(() => ensureEpisodes(title.id, input.title.externalId).catch((e) => console.warn("episodes not cached", e)));
    }
    return Response.json({ entry }, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
