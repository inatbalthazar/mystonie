import { rateLimited } from "@/app/api/_lib/http";
import { nextFeedCursor, parseFeedCursor } from "@/core/social";
import { followingFeed } from "@/data/social";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 120, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/feed?before=<finishedAt>&id=<entryId> → { items, next } | 400 | 401 | 429 | 503. The next page of the
 * Following feed ("Load more"); the first page is rendered by /feed itself.
 */
export async function GET(request: Request) {
  const cursor = parseFeedCursor(new URL(request.url).searchParams);
  if (cursor === "invalid") return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const viewerId = auth?.claims.sub;
  if (!viewerId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "feed", LIMIT);
  if (limited) return limited;

  try {
    const items = await followingFeed(supabase, viewerId, cursor);
    return Response.json({ items, next: nextFeedCursor(items) }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
