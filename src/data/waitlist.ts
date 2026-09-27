import type { WaitlistSignup } from "@/core/waitlist";
import { adminClient } from "./supabase-admin";

export class WaitlistUnavailableError extends Error {}

/**
 * Adds a sign-up (consent given now). An existing email is not an error, so the response never
 * reveals who is on the list; a previously unsubscribed email is re-subscribed with fresh consent.
 * The first sign-up's locale and source are kept.
 */
export async function joinWaitlist(signup: WaitlistSignup): Promise<void> {
  const db = adminClient();
  if (!db) throw new WaitlistUnavailableError("Supabase is not configured");

  const consentAt = new Date().toISOString();
  const { error } = await db
    .from("waitlist")
    .insert({ email: signup.email, locale: signup.locale, source: signup.source, consent_at: consentAt });
  if (!error) return;
  if (error.code !== "23505") throw new WaitlistUnavailableError(error.message);

  const { error: resubscribeError } = await db
    .from("waitlist")
    .update({ unsubscribed_at: null, consent_at: consentAt })
    .eq("email", signup.email)
    .not("unsubscribed_at", "is", null);
  if (resubscribeError) throw new WaitlistUnavailableError(resubscribeError.message);
}

/** Marks one row unsubscribed (idempotent: an already unsubscribed row keeps its first date). */
export async function unsubscribeFromWaitlist(id: string): Promise<void> {
  const db = adminClient();
  if (!db) throw new WaitlistUnavailableError("Supabase is not configured");
  const { error } = await db
    .from("waitlist")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", id)
    .is("unsubscribed_at", null);
  if (error) throw new WaitlistUnavailableError(error.message);
}

export type LaunchRecipient = { id: string; email: string; locale: string };

/** Subscribed rows that haven't had the launch email yet, oldest sign-ups first, plus how many are left in total. */
export async function launchRecipients(limit: number): Promise<{ recipients: LaunchRecipient[]; remaining: number }> {
  const db = adminClient();
  if (!db) throw new WaitlistUnavailableError("Supabase is not configured");
  const { data, count, error } = await db
    .from("waitlist")
    .select("id, email, locale", { count: "exact" })
    .is("unsubscribed_at", null)
    .is("launch_sent_at", null)
    .order("created_at")
    .limit(limit);
  if (error) throw new WaitlistUnavailableError(error.message);
  return { recipients: data, remaining: count ?? data.length };
}

export async function markLaunchSent(ids: string[]): Promise<void> {
  const db = adminClient();
  if (!db) throw new WaitlistUnavailableError("Supabase is not configured");
  const { error } = await db.from("waitlist").update({ launch_sent_at: new Date().toISOString() }).in("id", ids);
  if (error) throw new WaitlistUnavailableError(error.message);
}
