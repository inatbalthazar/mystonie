import { catalogError, rateLimited } from "@/app/api/_lib/http";
import { survivedTopic } from "@/core/catalog/dtdd";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";
import { titleWarnings } from "@/data/warnings";

const LIMIT = { max: 30, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/warnings/movie/245891 → { status: "matched" | "unmatched", survived: SurvivedKey | null } | 404 | 503.
 * Asked by a movie's or series' finish celebration: whether it can offer a Survived card ("Survived the jump
 * scares"). Looks the title up on DTDD when it isn't cached yet (signed in only: it spends DTDD's quota).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/warnings/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  if ((kind !== "movie" && kind !== "series") || !/^\d{1,10}$/.test(id)) {
    return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  }
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "warnings", LIMIT);
  if (limited) return limited;

  try {
    const title = await ensureTitle(kind, id);
    if (!title || (title.title.kind !== "movie" && title.title.kind !== "series")) {
      return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    }
    const warnings = await titleWarnings(title.id, { ...title.title, kind: title.title.kind });
    if (!warnings) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
    const survived = warnings.status === "matched" ? survivedTopic(warnings.topics) : null;
    return Response.json({ status: warnings.status, survived }, { headers: noStore });
  } catch (error) {
    return catalogError(error);
  }
}
