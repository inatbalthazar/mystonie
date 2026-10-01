import { catalogError, rateLimited } from "@/app/api/_lib/http";
import { parseCredits } from "@/core/catalog/credits";
import { isExternalId, isScreenKind, isTitleKind, sourceForKind } from "@/core/catalog/types";
import { creditNames, flaggedTopics, tmdbFacts, type PreviewWarnings, type TitlePreview } from "@/core/title-preview";
import { titleCheck } from "@/core/warnings";
import { catalogDetails } from "@/data/catalog";
import { communityAvoidHits } from "@/data/scene-warnings";
import { userClient } from "@/data/supabase-server";
import { getCachedTitle, saveTitle, titleExtras } from "@/data/titles";
import { avoidTopicIds, titleWarnings } from "@/data/warnings";

const LIMIT = { max: 30, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/titles/preview/movie/496243 → TitlePreview | 401 | 404 | 429 | 503.
 * "Look before you add" (stage 4, ADR 0058): what the ➕ sheet shows about a picked title on request: its synopsis,
 * TMDB score, IMDb id, who made it, DoesTheDogDie's most-voted Yes topics (movies and series) and the viewer's own
 * check against their avoid-topics. Signed in only: it can spend DTDD's quota, like opening the title page.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/titles/preview/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  if (!isTitleKind(kind) || !isExternalId(kind, id)) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "title-preview", LIMIT);
  if (limited) return limited;

  // The cached title, fetched again past its week (older series rows then gain their IMDb id); a stale copy is
  // still fine when the catalog fails.
  let row: { id: string; title: TitlePreview["title"] } | null = null;
  try {
    const cached = await getCachedTitle(sourceForKind(kind), kind, id);
    if (cached && !cached.stale) row = cached;
    else {
      const details = await catalogDetails(kind, id).catch((error) => {
        if (cached) return null;
        throw error;
      });
      if (details) {
        const saved = await saveTitle(details.title, details.raw);
        row = saved ? { id: saved, title: details.title } : null;
      } else row = cached;
    }
  } catch (error) {
    return catalogError(error);
  }
  if (!row) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  const { id: titleId, title } = row;

  const screen = isScreenKind(title.kind) ? title.kind : null;
  const [extras, avoid, dtdd] = await Promise.all([
    titleExtras(titleId),
    avoidTopicIds(supabase, userId),
    screen ? titleWarnings(titleId, { ...title, kind: screen }) : null,
  ]);
  const ours = avoid.length > 0 ? ((await communityAvoidHits(supabase, [titleId])).get(titleId) ?? []) : [];
  const credits = parseCredits(extras.credits);
  const warnings: PreviewWarnings | null = !screen
    ? null
    : !dtdd
      ? { status: "unavailable" }
      : dtdd.status === "matched"
        ? { status: "matched", url: dtdd.sourceUrl, ...flaggedTopics(dtdd.topics) }
        : { status: "unmatched" };

  const preview: TitlePreview = {
    title,
    facts: title.source === "tmdb" ? tmdbFacts(extras.raw) : { overview: null, tagline: null, score: null, votes: null, imdbId: null },
    directors: creditNames(credits, "director"),
    cast: creditNames(credits, "actor"),
    makers: creditNames(credits, title.kind === "game" ? "developer" : "author"),
    warnings,
    check: avoid.length > 0 ? titleCheck(avoid, dtdd?.status === "matched" ? dtdd.topics : null, ours) : null,
  };
  return Response.json(preview, { headers: noStore });
}
