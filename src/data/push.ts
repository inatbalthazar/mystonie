// Web push (ADR 0028). Server only: subscriptions are written with the service role after the route handler has
// verified the user, and the recap job pushes with the VAPID private key, which never reaches the browser.
import { parseRecap } from "@/core/cards/saved";
import type { CardRecap } from "@/core/cards/types";
import { uuidv7 } from "@/core/ids";
import { isVapidKeyPair, pushOutcome, pushRequest, type PushMessage, type PushSubscriptionInput, type VapidKeys } from "@/core/push";
import { LEGAL } from "@/lib/legal";
import { adminClient, type AdminClient } from "./supabase-admin";

export class PushUnavailableError extends Error {}

function admin(): AdminClient {
  const db = adminClient();
  if (!db) throw new PushUnavailableError("Supabase is not configured");
  return db;
}

/** The VAPID keys, or null when push isn't set up (the Settings switch and the recap pushes stay off). */
export function pushConfig(): VapidKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  if (!isVapidKeyPair(publicKey, privateKey)) {
    console.error("VAPID keys are malformed: web push is off");
    return null;
  }
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT?.trim() || `mailto:${LEGAL.contactEmail}` };
}

/** Outside production a local push server may stand in for the browsers' (e2e/home.spec.ts). */
export const allowLocalPushEndpoints = () => process.env.NODE_ENV !== "production";

/**
 * Stores a device's subscription for the user. A device keeps its endpoint across accounts, so an existing row
 * for the endpoint moves to this user (the last account that turned notifications on gets them).
 */
export async function savePushSubscription(userId: string, subscription: PushSubscriptionInput): Promise<void> {
  const db = admin();
  const row = { user_id: userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth };
  const { data, error } = await db.from("push_subscriptions").update(row).eq("endpoint", subscription.endpoint).select("id");
  if (error) throw new PushUnavailableError(`push_subscriptions update failed: ${error.message}`);
  if (data.length > 0) return;
  const { error: insertError } = await db.from("push_subscriptions").insert({ id: uuidv7(), endpoint: subscription.endpoint, ...row });
  // 23505: the same device subscribed twice at once; the other request stored it.
  if (insertError && insertError.code !== "23505") throw new PushUnavailableError(`push_subscriptions insert failed: ${insertError.message}`);
}

/** Forgets one device's subscription (the Settings switch, signing out). Only the user's own row goes. */
export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await admin().from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  if (error) throw new PushUnavailableError(`push_subscriptions delete failed: ${error.message}`);
}

type Outcome = ReturnType<typeof pushOutcome>;

/** Delivers one message to one device. Network errors count as a failed send (the subscription stays). */
async function deliver(vapid: VapidKeys, subscription: PushSubscriptionInput, message: PushMessage, topic: string): Promise<Outcome> {
  try {
    const req = await pushRequest(subscription, message, vapid, { topic });
    const response = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: AbortSignal.timeout(10_000) });
    const outcome = pushOutcome(response.status);
    if (outcome === "failed") {
      const detail = await response.text().catch(() => "");
      console.error(`push to ${new URL(req.url).host} failed: ${response.status} ${detail.slice(0, 200)}`);
    }
    return outcome;
  } catch (error) {
    console.error("push failed", error instanceof Error ? error.message : error);
    return "failed";
  }
}

export type RecapToPush = { id: string; userId: string; locale: string; recap: CardRecap };

/**
 * Pushes recaps not pushed yet (made in the last 2 days) to every device of their users, at most `limit` recaps
 * per call. Each recap is tried once: it is marked pushed whatever the push services answer, and subscriptions
 * they report gone are deleted. `render` writes the notification in the user's language.
 */
export async function pushDueRecaps(
  vapid: VapidKeys,
  render: (recap: RecapToPush) => Promise<PushMessage>,
  limit: number,
): Promise<{ recaps: number; sent: number; gone: number }> {
  const db = admin();
  const { data, error } = await db.rpc("weekly_recaps_to_push", { p_limit: limit });
  if (error) throw new PushUnavailableError(`recaps to push failed: ${error.message}`);
  if (data.length === 0) return { recaps: 0, sent: 0, gone: 0 };

  const messages = new Map<string, PushMessage | null>();
  for (const row of data) {
    if (messages.has(row.id)) continue;
    const recap = parseRecap(row.stats);
    messages.set(row.id, recap && (await render({ id: row.id, userId: row.user_id, locale: row.locale, recap })));
  }

  let sent = 0;
  const gone: string[] = [];
  // A few at a time: each is a signature, an encryption and one request to the push service.
  for (let i = 0; i < data.length; i += 10) {
    await Promise.all(
      data.slice(i, i + 10).map(async (row) => {
        const message = messages.get(row.id);
        if (!message) return;
        const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
        const outcome = await deliver(vapid, subscription, message, "weekly-recap");
        if (outcome === "sent") sent++;
        if (outcome === "gone") gone.push(row.subscription_id);
      }),
    );
  }

  const ids = [...messages.keys()];
  const { error: markError } = await db.from("weekly_recaps").update({ pushed_at: new Date().toISOString() }).in("id", ids);
  if (markError) throw new PushUnavailableError(`weekly_recaps update failed: ${markError.message}`);
  if (gone.length > 0) {
    const { error: deleteError } = await db.from("push_subscriptions").delete().in("id", gone);
    if (deleteError) console.error("push_subscriptions cleanup failed", deleteError.message);
  }
  return { recaps: ids.length, sent, gone: gone.length };
}
