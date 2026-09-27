// Account data outside RLS (service role). Server only.
import { deleteCardImages } from "./cards";
import { adminClient } from "./supabase-admin";
import { publicSupabaseEnv } from "./supabase-server";

/**
 * Deletes the auth user; `profiles` (and every user table after it) cascades from `auth.users`.
 * Also removes the user's shared card images and a waitlist row with the same email, so no personal data is left behind (GDPR/PDPA/CCPA).
 */
export async function deleteAccount(userId: string, email: string | undefined): Promise<void> {
  const db = adminClient();
  if (!db) throw new Error("Supabase is not configured");
  // Shared card PNGs sit in a public bucket; the rows cascade, the files don't.
  await deleteCardImages(userId).catch((error) => console.error("card image cleanup after account deletion failed", error));
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw error;
  if (email) {
    const { error: waitlistError } = await db.from("waitlist").delete().eq("email", email.trim().toLowerCase());
    if (waitlistError) console.error("waitlist cleanup after account deletion failed", waitlistError);
  }
}

/** Whether Google sign-in is switched on in Supabase Auth (the sign-in page hides the button otherwise). */
export async function googleSignInEnabled(): Promise<boolean> {
  const env = publicSupabaseEnv();
  if (!env) return false;
  try {
    const res = await fetch(`${env.url}/auth/v1/settings`, {
      headers: { apikey: env.anonKey },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
