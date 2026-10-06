import { rateLimited } from "@/app/api/_lib/http";
import { parseInvite } from "@/core/invites";
import { acceptInvite } from "@/data/invites";
import { userClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };
const LIMIT = { max: 20, windowSeconds: 3600 };

/**
 * POST /api/invites { username } → { inviter: { username, displayName } | null } | 400 | 401 | 429 | 503. Accepts the
 * invite remembered on this device for the signed-in account (ADR 0098): a new account and its inviter follow each
 * other. `inviter: null` when it doesn't apply (an older account, already invited, yourself, not found).
 */
export async function POST(request: Request) {
  const username = parseInvite(await request.json().catch(() => null));
  if (!username) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const db = await userClient();
  if (!db) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data } = await db.auth.getClaims();
  if (!data?.claims.sub) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "invites", LIMIT);
  if (limited) return limited;

  try {
    const inviter = await acceptInvite(db, username);
    return Response.json({ inviter: inviter && { username: inviter.username, displayName: inviter.displayName } }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
