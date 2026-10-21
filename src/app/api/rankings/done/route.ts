import { rateLimited } from "@/app/api/_lib/http";
import { parseRef, RANK_MAX } from "@/core/rankings";
import { rankingDone } from "@/data/rankings";
import { userClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };
const LIMIT = { max: 120, windowSeconds: 60 };

/**
 * POST /api/rankings/done { refs } → { done: refs } | 400 | 401 | 429 | 503. Which of a ranking's things the signed-in
 * owner finished or has been to (ADR 0099), so the card maker shows the ✓ marks before saving. Saving sets them again.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { refs?: unknown } | null;
  const refs = body?.refs;
  if (!Array.isArray(refs) || refs.length > RANK_MAX || !refs.every((ref) => parseRef(ref))) {
    return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  }
  const db = await userClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data } = await db.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "ranking-done", LIMIT);
  if (limited) return limited;

  try {
    const items = (refs as string[]).map((ref) => {
      const parsed = parseRef(ref)!;
      return { ref, kind: parsed.type === "title" ? parsed.kind : parsed.type, name: ref };
    });
    const marked = await rankingDone(db, userId, { items });
    return Response.json({ done: (marked?.items ?? []).filter((i) => i.done).map((i) => i.ref) }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
