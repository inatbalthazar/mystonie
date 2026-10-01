// Account data outside RLS (service role). Server only.
import { enabledProviders, type OAuthProvider } from "@/core/avatar";
import { deleteAvatars } from "./avatars";
import { deleteCardImages } from "./cards";
import { cancelSubscriptionNow, stripeConfig } from "./stripe";
import { liveSubscriptionIds } from "./subscriptions";
import { adminClient } from "./supabase-admin";
import { publicSupabaseEnv } from "./supabase-server";

/**
 * Deletes the auth user; `profiles` (and every user table after it) cascades from `auth.users`.
 * Also removes the user's shared card images and a waitlist row with the same email, so no personal data is left behind (GDPR/PDPA/CCPA).
 * A Pro subscription is cancelled at Stripe first: otherwise it would keep charging an account that's gone.
 */
export async function deleteAccount(userId: string, email: string | undefined): Promise<void> {
  const db = adminClient();
  if (!db) throw new Error("Supabase is not configured");
  // Before anything is deleted: if Stripe can't be reached, the account stays and the user can try again.
  const stripe = stripeConfig();
  const subscriptions = await liveSubscriptionIds(userId);
  if (subscriptions.length > 0) {
    if (!stripe) throw new Error("live Stripe subscriptions but Pro is switched off");
    for (const id of subscriptions) await cancelSubscriptionNow(stripe, id);
  }
  // Shared card PNGs sit in a public bucket; the rows cascade, the files don't.
  await deleteCardImages(userId).catch((error) => console.error("card image cleanup after account deletion failed", error));
  await deleteAvatars(userId).catch((error) => console.error("avatar cleanup after account deletion failed", error));
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw error;
  if (email) {
    const { error: waitlistError } = await db.from("waitlist").delete().eq("email", email.trim().toLowerCase());
    if (waitlistError) console.error("waitlist cleanup after account deletion failed", waitlistError);
  }
}

/** The sign-in providers switched on in Supabase Auth (the sign-in page shows a button for each, ADR 0064). */
export async function oauthProviders(): Promise<OAuthProvider[]> {
  const env = publicSupabaseEnv();
  if (!env) return [];
  try {
    const res = await fetch(`${env.url}/auth/v1/settings`, {
      headers: { apikey: env.anonKey },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? enabledProviders(await res.json()) : [];
  } catch {
    return [];
  }
}
