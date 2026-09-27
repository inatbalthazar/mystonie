import { isEmailList, verifyUnsubscribeToken } from "@/core/email/unsubscribe";
import { unsubscribeFromRecaps } from "@/data/recaps";
import { unsubscribeFromWaitlist } from "@/data/waitlist";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/unsubscribe?id=<id>&t=<token>[&list=recaps] → { ok: true } | 400 invalid_link | 503 unavailable.
 * `id` is a waitlist row (no `list`: the launch email) or a profile (`list=recaps`: weekly recap emails).
 * Used by the confirm page and, as the List-Unsubscribe target, by mail apps' one-click button (RFC 8058:
 * they POST `List-Unsubscribe=One-Click`; the body carries nothing we need). No GET: link scanners open
 * URLs, and that must not unsubscribe anyone.
 */
export async function POST(request: Request) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });

  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  const token = params.get("t") ?? "";
  const list = params.get("list") ?? "waitlist";
  if (!isEmailList(list) || !(await verifyUnsubscribeToken(secret, id, token, list))) {
    return Response.json({ error: "invalid_link" }, { status: 400, headers: noStore });
  }

  try {
    if (list === "recaps") await unsubscribeFromRecaps(id.toLowerCase());
    else await unsubscribeFromWaitlist(id.toLowerCase());
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("unsubscribe failed", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
