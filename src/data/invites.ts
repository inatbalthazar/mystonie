// Invites (ADR 0098): accepting one makes the new member and the inviter follow each other (`accept_invite()`, as the
// new member; the rules are in the database). Server only.
import type { UserClient } from "./supabase-server";

export type Inviter = { id: string; username: string; displayName: string | null };

/** Accepts the invite of `username` for the signed-in account; null when it doesn't apply (see `accept_invite`). */
export async function acceptInvite(db: UserClient, username: string): Promise<Inviter | null> {
  const { data, error } = await db.rpc("accept_invite", { p_username: username });
  if (error) throw new Error(`accept_invite failed: ${error.message}`);
  const row = data[0];
  return row ? { id: row.id, username: row.username, displayName: row.display_name ?? null } : null;
}
