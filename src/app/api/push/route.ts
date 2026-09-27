import { rateLimited } from "@/app/api/_lib/http";
import { isPushEndpoint, parsePushSubscription } from "@/core/push";
import { allowLocalPushEndpoints, deletePushSubscription, pushConfig, savePushSubscription } from "@/data/push";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 20, windowSeconds: 3600 };
const MAX_BODY_BYTES = 4_000;
const noStore = { "Cache-Control": "no-store" };

async function signedInUser(): Promise<string | null> {
  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  return data?.claims.sub ?? null;
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * POST /api/push { subscription: PushSubscription.toJSON() } → 201 { ok } | 400 | 401 | 429 | 503 (push not set
 * up). Turns on Weekly Recap notifications for this device (ADR 0028). Also re-sent by Settings on load and by
 * the service worker when the browser renews the subscription (`replaces`: the old endpoint).
 */
export async function POST(request: Request) {
  if (!pushConfig()) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const userId = await signedInUser();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const limited = await rateLimited(request, "push", LIMIT);
  if (limited) return limited;

  const body = (await readJson(request)) as { subscription?: unknown; replaces?: unknown } | null;
  const subscription = parsePushSubscription(body?.subscription, allowLocalPushEndpoints());
  if (!subscription) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  try {
    await savePushSubscription(userId, subscription);
    if (typeof body?.replaces === "string" && body.replaces !== subscription.endpoint && isPushEndpoint(body.replaces, allowLocalPushEndpoints())) {
      await deletePushSubscription(userId, body.replaces);
    }
    return Response.json({ ok: true }, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}

/** DELETE /api/push { endpoint } → { ok } | 400 | 401 | 503. Turns notifications off for this device. */
export async function DELETE(request: Request) {
  const userId = await signedInUser();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const body = (await readJson(request)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || body.endpoint.length > 1024) {
    return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  }
  try {
    await deletePushSubscription(userId, body.endpoint);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
