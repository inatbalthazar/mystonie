// The Supporter sticker (ADR 0063): for people who paid for Pro or tipped through Buy Me a Coffee. Tips arrive as Buy
// Me a Coffee webhooks (signed, checked on the server); this reads what they say. Nothing here trusts the client.
import type { SubscriptionStatus } from "./billing";

/** Buy Me a Coffee events that are support: a one-off tip, or a membership starting. */
export const TIP_EVENTS: readonly string[] = ["donation.created", "membership.started"];

/** Subscription statuses that mean Pro was paid for at least once (no trials: `trialing` and `paused` never paid). */
export const PAID_STATUSES: readonly SubscriptionStatus[] = ["active", "past_due", "canceled", "unpaid"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A plausible email, trimmed and lowercased (how Supabase Auth stores them), or null. */
export function normalEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 320 && EMAIL_RE.test(email) ? email : null;
}

/**
 * A verified Buy Me a Coffee webhook body → the supporter's email and when (ms), or null when it isn't a tip or has
 * no email (an anonymous supporter). `{ type, created (Unix seconds), data: { supporter_email, … } }`.
 */
export function parseTipEvent(body: unknown, now: number): { email: string; at: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const { type, created, data } = body as { type?: unknown; created?: unknown; data?: unknown };
  if (typeof type !== "string" || !TIP_EVENTS.includes(type) || typeof data !== "object" || data === null) return null;
  const email = normalEmail((data as { supporter_email?: unknown }).supporter_email);
  if (!email) return null;
  const at = typeof created === "number" && Number.isFinite(created) && created > 0 ? created * 1000 : now;
  // A clock far ahead can't date a sticker in the future.
  return { email, at: Math.min(at, now) };
}
