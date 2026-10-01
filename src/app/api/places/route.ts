import { rateLimited } from "@/app/api/_lib/http";
import { parsePlaceWrite } from "@/core/atlas";
import { setPlace } from "@/data/atlas";
import { userClient } from "@/data/supabase-server";

const WRITE = { max: 300, windowSeconds: 3600 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/places { country, status: "been" | "lived" | "want" | null, firstYear?: number | null } → { ok: true } |
 * 400 | 401 | 429 | 503. Puts a country on the viewer's Atlas, changes it, or takes it off (null). Stage 4, ADR 0059.
 */
export async function POST(request: Request) {
  const input = parsePlaceWrite(await request.json().catch(() => null), new Date().getUTCFullYear() + 1);
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const db = await userClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await db.auth.getClaims();
  const viewerId = auth?.claims.sub;
  if (!viewerId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const limited = await rateLimited(request, "places", WRITE);
  if (limited) return limited;

  try {
    await setPlace(db, viewerId, input);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
