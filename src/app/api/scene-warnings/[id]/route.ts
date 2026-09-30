import { rateLimited } from "@/app/api/_lib/http";
import { isUuid } from "@/core/email/unsubscribe";
import { parseSceneVote } from "@/core/scene-warnings";
import { voteSceneWarning, withdrawSceneWarning } from "@/data/scene-warnings";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 120, windowSeconds: 600 };
const noStore = { "Cache-Control": "no-store" };

async function signedIn(request: Request, bucket: string) {
  const supabase = await userClient();
  if (!supabase) return { response: Response.json({ error: "unavailable" }, { status: 503, headers: noStore }) };
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return { response: Response.json({ error: "unauthorized" }, { status: 401, headers: noStore }) };
  const limited = await rateLimited(request, bucket, LIMIT);
  if (limited) return { response: limited };
  return { supabase, userId };
}

/**
 * PUT /api/scene-warnings/[id] { vote: 1 | -1 | 0 } → { status, confirms, disputes, myVote } | 400 | 401 | 404 (not
 * one the user may vote on: their own, gone, or a title they haven't watched or read) | 429 | 503. "I saw it" (1),
 * "it isn't there" (-1), or taking the vote back (0); the database recounts and sets the status.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/scene-warnings/[id]">) {
  const { id } = await ctx.params;
  const vote = parseSceneVote(await request.json().catch(() => null));
  if (!isUuid(id) || vote === null) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const user = await signedIn(request, "scene-votes");
  if ("response" in user) return user.response;
  try {
    const tally = await voteSceneWarning(user.supabase, user.userId, id.toLowerCase(), vote);
    if (tally === "not_found") return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    return Response.json(tally, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}

/**
 * DELETE /api/scene-warnings/[id] → { ok: true } | 400 | 401 | 404 (not the user's, or no longer waiting: a confirmed
 * warning stays, others rely on it) | 429 | 503. Withdraws a warning the user added (a soft delete).
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/scene-warnings/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const user = await signedIn(request, "scene-votes");
  if ("response" in user) return user.response;
  try {
    const done = await withdrawSceneWarning(user.supabase, user.userId, id.toLowerCase());
    return done ? Response.json({ ok: true }, { headers: noStore }) : Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
