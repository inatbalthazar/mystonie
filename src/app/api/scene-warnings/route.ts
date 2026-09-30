import { rateLimited } from "@/app/api/_lib/http";
import { parseSceneWarning } from "@/core/scene-warnings";
import { addSceneWarning } from "@/data/scene-warnings";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 30, windowSeconds: 600 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/scene-warnings { id, titleId, topic, season?, episode?, startSec?, endSec?, unit?, position? } → 201
 * { warning } | 400 invalid | 401 | 403 not_seen (the title isn't in the collection as watching or finished) | 409
 * duplicate | 429 (rate limit, or 30 a day: daily_limit) | 503. A scene warning (S3 warnings & quiz), added as the
 * user; the database checks the topic and place against the title's kind.
 */
export async function POST(request: Request) {
  const input = parseSceneWarning(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "scene-warnings", LIMIT);
  if (limited) return limited;

  try {
    const result = await addSceneWarning(supabase, input);
    if ("warning" in result) return Response.json(result, { status: 201, headers: noStore });
    const status = { not_seen: 403, duplicate: 409, daily_limit: 429, invalid: 400 }[result.error];
    return Response.json({ error: result.error }, { status, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
