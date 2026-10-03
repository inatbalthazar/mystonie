// The team's own pages (ADR 0092): an account signed in with one of the `ADMIN_EMAILS` addresses is the team. There's
// no separate admin account or role in the database; the admin pages and routes check this, then act with the
// service role. Server only.
import { isAdminEmail } from "@/core/journal-posts";
import { userClient } from "./supabase-server";

/** The signed-in account's id when it's the team's, else null. */
export async function teamMember(): Promise<{ userId: string } | null> {
  const db = await userClient();
  if (!db) return null;
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !isAdminEmail(process.env.ADMIN_EMAILS, claims.email)) return null;
  return { userId: claims.sub };
}
