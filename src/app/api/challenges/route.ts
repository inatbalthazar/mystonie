import { rateLimited } from "@/app/api/_lib/http";
import { currentMonth, parseChallengeToggle } from "@/core/challenges";
import { setChallenge, syncChallenges } from "@/data/challenges";
import { statsRows } from "@/data/stats";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 60, windowSeconds: 3600 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/challenges { month, slug, join } → { ok: true, progress, completed } (S3 challenges & clubs, ADR 0040).
 * Joins or leaves one of this month's challenges (the month in the user's time zone; 409 `closed` for any other).
 * Joining records progress right away, since everything from the 1st counts: `progress` is how far along, and
 * `completed` the Challenge card's inputs when joining already completed it (else null). A completed challenge
 * can't be left.
 */
export async function POST(request: Request) {
  const input = parseChallengeToggle(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "challenge", LIMIT);
  if (limited) return limited;

  try {
    const { data: profile, error } = await supabase.from("profiles").select("time_zone").eq("id", userId).single();
    if (error) throw new Error(`profiles read failed: ${error.message}`);
    const now = Date.now();
    if (input.month !== currentMonth(now, profile.time_zone)) return Response.json({ error: "closed" }, { status: 409, headers: noStore });
    await setChallenge(supabase, userId, input.month, input.slug, input.on);
    if (!input.on) return Response.json({ ok: true, progress: null, completed: null }, { headers: noStore });
    const sync = await syncChallenges(supabase, userId, await statsRows(supabase, userId), profile.time_zone, now);
    const progress = sync.progress.find((p) => p.slug === input.slug);
    const completed = sync.completed.find((c) => c.challenge?.slug === input.slug) ?? null;
    return Response.json({ ok: true, progress: progress?.value ?? 0, completed }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
