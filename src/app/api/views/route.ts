import { rateLimited } from "@/app/api/_lib/http";
import { isBotAgent, parseView } from "@/core/views";
import { clientIp } from "@/data/rate-limit";
import { userClient } from "@/data/supabase-server";
import { recordView } from "@/data/views";

const noStore = { "Cache-Control": "no-store" };
const LIMIT = { max: 120, windowSeconds: 3600 };

/**
 * POST /api/views { subject: "profile" | "card" | "post", id } → { counted } | 400 | 429. A visit to a public page,
 * shared card or published article, sent by the page once it's shown (ADR 0098). Counted once a day per visitor
 * (a salted hash, never the address), never for the owner or a crawler. Works signed out.
 */
export async function POST(request: Request) {
  const input = parseView(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const userAgent = request.headers.get("user-agent");
  if (isBotAgent(userAgent)) return Response.json({ counted: false }, { headers: noStore });

  const limited = await rateLimited(request, "views", LIMIT);
  if (limited) return limited;

  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  try {
    const counted = await recordView(input.subject, input.id, {
      viewerId: data?.claims.sub ?? null,
      ip: clientIp(request.headers),
      userAgent: userAgent ?? "",
    });
    return Response.json({ counted }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ counted: false }, { headers: noStore });
  }
}
