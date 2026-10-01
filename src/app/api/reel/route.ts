import { rateLimited } from "@/app/api/_lib/http";
import { activityBadgeNews } from "@/data/badges";
import { mergeReelGuesses, parseReelGuesses, reelCard, reelDay, reelState, reelStats } from "@/core/reel";
import { ensureReel, reelHistory, reelPlay, saveReelPlay } from "@/data/reel";
import { userClient } from "@/data/supabase-server";

// A guess per request, plus the page's first load: generous for a game with six guesses a day.
const LIMIT = { max: 120, windowSeconds: 3600 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/reel { day, guesses: [{ externalId, name }] } → { state, card, stats, badges } (stage 4 daily game, ADR 0048).
 * Grades the guesses against today's reel (picked on the day's first request) and returns what the player may see:
 * the open clues, how sharp the poster is, and the answer once the play is done. Guests keep their guesses in the
 * browser and send them all each time. For a signed-in player the stored play is the truth: a device can only add
 * guesses to it, and `card` (when done) and `stats` come from the server, with `badges`: the Reel stickers the play
 * that just ended earned (ADR 0063). `day` must be today (UTC), else 409
 * `new_day` with today's.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { day?: unknown; guesses?: unknown } | null;
  const guesses = parseReelGuesses(body?.guesses ?? []);
  if (!body || !guesses) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const today = reelDay(Date.now());
  if (body.day !== undefined && body.day !== today) return Response.json({ error: "new_day", day: today }, { status: 409, headers: noStore });

  const limited = await rateLimited(request, "reel", LIMIT);
  if (limited) return limited;

  try {
    const reel = await ensureReel(today);
    if (!reel) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
    const supabase = await userClient();
    const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
    const userId = auth?.claims.sub;
    if (!supabase || !userId) {
      const state = reelState(reel, guesses);
      return Response.json({ state, card: null, stats: null, badges: [] }, { headers: noStore });
    }

    const stored = await reelPlay(supabase, userId, today);
    const merged = mergeReelGuesses(stored?.guesses ?? [], guesses, reel.answer.externalId);
    let streak = stored?.streak ?? null;
    const added = merged.length > (stored?.guesses.length ?? 0);
    if (added) streak = await saveReelPlay(userId, reel, merged, !!stored);
    const state = reelState(reel, merged);
    const [history, badges] = state.done
      ? await Promise.all([reelHistory(supabase, userId), added ? activityBadgeNews(supabase, userId, Date.now()) : []])
      : [null, []];
    const stats = history ? reelStats(history, today) : null;
    return Response.json({ state, card: reelCard(state, streak ?? 0), stats, badges }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
