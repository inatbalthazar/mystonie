import { rateLimited } from "@/app/api/_lib/http";
import { sourceForKind, type TitleKind } from "@/core/catalog/types";
import { badgeKey, parseBadgeTitles, type BadgeTopic } from "@/core/warnings";
import { userClient } from "@/data/supabase-server";
import { avoidBadges } from "@/data/warnings";

const LIMIT = { max: 60, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/warnings/badges { titles: [{ kind, externalId }] } → { badges: { "movie:245891": [{ id: 153, name: "a dog dies" }] } }.
 * Search results' warning badges: the user's avoid-topics each title has a Yes for, from DTDD's cache (never DTDD
 * itself, so a title nobody has opened has none from there) and our own confirmed warnings and quiz answers (every
 * kind). Titles without a badge are left out.
 */
export async function POST(request: Request) {
  const titles = parseBadgeTitles(await request.json().catch(() => null));
  if (!titles) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "warning-badges", LIMIT);
  if (limited) return limited;

  const badges: Record<string, BadgeTopic[]> = {};
  if (titles.length === 0) return Response.json({ badges }, { headers: noStore });
  const { data: rows, error } = await supabase
    .from("titles")
    .select("id, kind, source, external_id")
    .in("external_id", [...new Set(titles.map((t) => t.externalId))]);
  if (error) {
    console.error("titles read failed", error.message);
    return Response.json({ badges }, { headers: noStore });
  }
  const wanted = new Set(titles.map(badgeKey));
  const found = (rows ?? []).filter((r) => r.source === sourceForKind(r.kind as TitleKind) && wanted.has(`${r.kind}:${r.external_id}`));
  const byTitle = await avoidBadges(supabase, found.map((r) => r.id));
  for (const r of found) {
    const topics = byTitle.get(r.id);
    if (topics) badges[`${r.kind}:${r.external_id}`] = topics;
  }
  return Response.json({ badges }, { headers: noStore });
}
