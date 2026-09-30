import { rateLimited } from "@/app/api/_lib/http";
import { parseAvoidTopics } from "@/core/warnings";
import { userClient } from "@/data/supabase-server";
import { saveAvoidTopics } from "@/data/warnings";

const LIMIT = { max: 60, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * PUT /api/warnings/topics { topicIds: number[] } → { topicIds } | 400 invalid | 401 | 503. Replaces the signed-in
 * user's avoid-topics (Settings → Content warnings). Written as the user (RLS: owner only).
 */
export async function PUT(request: Request) {
  const topicIds = parseAvoidTopics(await request.json().catch(() => null));
  if (!topicIds) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "avoid-topics", LIMIT);
  if (limited) return limited;

  try {
    await saveAvoidTopics(supabase, userId, topicIds);
    return Response.json({ topicIds }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
