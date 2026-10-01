import { rateLimited } from "@/app/api/_lib/http";
import { AVATAR_MAX_BYTES, sniffImage } from "@/core/avatar";
import { removeAvatar, storeAvatar } from "@/data/avatars";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 20, windowSeconds: 3600 };
const noStore = { "Cache-Control": "no-store" };

async function signedIn(request: Request): Promise<{ userId: string } | { response: Response }> {
  const supabase = await userClient();
  if (!supabase) return { response: Response.json({ error: "unavailable" }, { status: 503, headers: noStore }) };
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return { response: Response.json({ error: "unauthorized" }, { status: 401, headers: noStore }) };
  const limited = await rateLimited(request, "avatar", LIMIT);
  return limited ? { response: limited } : { userId };
}

/**
 * POST /api/account/avatar, body: the photo's bytes (a JPEG, PNG or WebP of at most 1 MB; Settings sends a 320 px
 * square it cropped in the browser) → { avatarUrl } (ADR 0064). The bytes themselves must be an image, whatever the
 * header says. The photo replaces the old one, which is deleted. 400 invalid | 401 | 413 too_large | 429 | 503.
 */
export async function POST(request: Request) {
  const user = await signedIn(request);
  if ("response" in user) return user.response;
  if (Number(request.headers.get("content-length") ?? 0) > AVATAR_MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413, headers: noStore });
  }
  const bytes = new Uint8Array(await request.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (bytes.length > AVATAR_MAX_BYTES) return Response.json({ error: "too_large" }, { status: 413, headers: noStore });
  if (!sniffImage(bytes)) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  try {
    const avatarUrl = await storeAvatar(user.userId, bytes);
    if (avatarUrl) return Response.json({ avatarUrl }, { headers: noStore });
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}

/** DELETE /api/account/avatar → 204: the profile shows the initial again and the photo files are deleted. 401 | 503. */
export async function DELETE(request: Request) {
  const user = await signedIn(request);
  if ("response" in user) return user.response;
  try {
    if (!(await removeAvatar(user.userId))) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
    return new Response(null, { status: 204, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
