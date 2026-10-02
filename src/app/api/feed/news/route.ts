import { rateLimited } from "@/app/api/_lib/http";
import type { FeedFacts } from "@/core/feed-news";
import { reelDay } from "@/core/reel";
import { newestArticleKey } from "@/data/journal";
import { reelPlay } from "@/data/reel";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 120, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };
/** Enough of the following feed to find someone else's finish among your own. */
const LOOKAHEAD = 10;

/**
 * GET /api/feed/news → FeedFacts | 401 | 429 | 503. What the feed's dots compare with what this device has seen
 * (ADR 0074): the newest Stamp or follow about you, the newest finish by someone you follow, the newest article and
 * whether today's Reel of the Day is finished. The nav island asks at most once a minute.
 */
export async function GET(request: Request) {
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "feed-news", LIMIT);
  if (limited) return limited;

  const now = Date.now();
  const today = reelDay(now);
  try {
    const [activity, feed, article, play] = await Promise.all([
      supabase.rpc("my_activity", { p_limit: 1 }),
      supabase.rpc("following_feed", { p_limit: LOOKAHEAD }),
      newestArticleKey(),
      reelPlay(supabase, userId, today),
    ]);
    if (activity.error) throw new Error(`my_activity failed: ${activity.error.message}`);
    if (feed.error) throw new Error(`following_feed failed: ${feed.error.message}`);
    const iso = (at: string | undefined) => (at ? new Date(at).toISOString() : null);
    const facts: FeedFacts = {
      user: userId,
      now: new Date(now).toISOString(),
      aboutYou: iso(activity.data[0]?.at),
      friends: iso(feed.data.find((r) => r.user_id !== userId)?.finished_at),
      article,
      reel: { day: today, done: !!play?.finished },
    };
    return Response.json(facts, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
