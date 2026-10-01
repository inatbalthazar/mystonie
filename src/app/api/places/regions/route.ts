import { rateLimited } from "@/app/api/_lib/http";
import { parseRegionWrite } from "@/core/atlas-regions";
import { setRegion } from "@/data/atlas";
import { userClient } from "@/data/supabase-server";

// Marking a whole country's provinces one tap at a time takes a few dozen writes.
const WRITE = { max: 600, windowSeconds: 3600 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/places/regions { region, visited: boolean } → { ok: true } | 400 | 401 | 429 | 503. Marks a region of a
 * country as been there (putting the country on the viewer's Atlas as visited if it isn't), or unmarks it. Stage 4,
 * ADR 0060.
 */
export async function POST(request: Request) {
  const input = parseRegionWrite(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const db = await userClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await db.auth.getClaims();
  const viewerId = auth?.claims.sub;
  if (!viewerId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const limited = await rateLimited(request, "place_regions", WRITE);
  if (limited) return limited;

  try {
    await setRegion(db, viewerId, input);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
