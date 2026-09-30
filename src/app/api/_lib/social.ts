import { rateLimited } from "@/app/api/_lib/http";
import type { SocialWrite } from "@/data/social";
import { userClient, type UserClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };

/**
 * The shared shape of POST /api/follows, /api/stamps and /api/blocks: parse the JSON body, require a signed-in user,
 * rate-limit, write as the user. → { ok: true } | 400 | 401 | 404 (not allowed, e.g. private or blocked) | 429 | 503.
 */
export async function socialWrite<T>(
  request: Request,
  bucket: string,
  limit: { max: number; windowSeconds: number },
  parse: (body: unknown) => T | null,
  write: (db: UserClient, viewerId: string, input: T) => Promise<SocialWrite>,
): Promise<Response> {
  const input = parse(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const viewerId = auth?.claims.sub;
  if (!viewerId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, bucket, limit);
  if (limited) return limited;

  try {
    const result = await write(supabase, viewerId, input);
    if (result === "not_found") return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
