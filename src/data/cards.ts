// Saved cards (S1 share artwork, ADR 0024). Server only.
import { cardImagePath, parseCardData, type CardSave } from "@/core/cards/saved";
import { isTemplateId, type TemplateId } from "@/core/cards/templates";
import type { CardData, CardKind, CardSize } from "@/core/cards/types";
import { linkRecapCard } from "./recaps";
import { adminClient } from "./supabase-admin";
import { publicSupabaseEnv, type UserClient } from "./supabase-server";

const BUCKET = "cards";

export type SharedCard = {
  id: string;
  kind: CardKind;
  templateId: TemplateId;
  size: CardSize;
  data: CardData;
  /** Public URL of the uploaded PNG, when there is one. */
  imageUrl: string | null;
  sharedAt: string;
};

/** Public URL of an object in the (public) cards bucket. */
function publicImageUrl(path: string): string | null {
  const env = publicSupabaseEnv();
  return env ? `${env.url}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}

/**
 * Saves a card's inputs as the signed-in user (RLS). Saving the same card id again (another template, then
 * Share after Download) updates it. The footer's `@username` comes from the profile, never from the request.
 * A share also returns a signed URL the browser uploads the PNG to (the bucket has no client write access).
 */
export async function saveCard(
  db: UserClient,
  userId: string,
  save: CardSave,
): Promise<{ uploadUrl: string | null } | null> {
  const { data: profile, error: profileError } = await db.from("profiles").select("username").eq("id", userId).single();
  if (profileError) throw new Error(`profiles read failed: ${profileError.message}`);
  const hideName = save.data.hide?.includes("username");
  const params = { ...save.data, username: hideName ? null : profile.username };
  const path = cardImagePath(userId, save.id);

  const { data: existing, error: readError } = await db.from("cards").select("id, shared_at").eq("id", save.id).maybeSingle();
  if (readError) throw new Error(`cards read failed: ${readError.message}`);

  const shared = save.share ? { image_path: path, shared_at: existing?.shared_at ?? new Date().toISOString() } : {};
  const { error } = existing
    ? await db
        .from("cards")
        .update({ template_id: save.templateId, size: save.size, params, ...shared })
        .eq("id", save.id)
    : await db.from("cards").insert({
        id: save.id,
        kind: save.kind,
        entry_id: save.entryId,
        episode_log_id: save.episodeLogId,
        reading_log_id: save.readingLogId,
        template_id: save.templateId,
        size: save.size,
        params,
        ...shared,
      });
  if (error) {
    // 23503: the entry, episode log or reading log isn't the user's (composite foreign key), or doesn't exist yet.
    if (error.code === "23503") return null;
    throw new Error(`cards write failed: ${error.message}`);
  }
  if (save.recapId && !existing) await linkRecapCard(userId, save.recapId, save.id);
  if (!save.share) return { uploadUrl: null };

  const admin = adminClient();
  if (!admin) return { uploadUrl: null };
  const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (signError) {
    console.error("card upload URL failed", signError.message);
    return { uploadUrl: null };
  }
  return { uploadUrl: signed.signedUrl };
}

type SharedCardRow = {
  id: string;
  kind: string;
  template_id: string;
  size: string;
  params: unknown;
  image_path: string | null;
  shared_at: string | null;
};

/** A saved card of the user's own, shared or not (Home's recent cards). */
export type UserCard = Omit<SharedCard, "sharedAt"> & { sharedAt: string | null };

function toUserCard(row: SharedCardRow): UserCard | null {
  if (!isTemplateId(row.template_id)) return null;
  const params = row.params as Record<string, unknown>;
  const cardData = parseCardData(params);
  if (!cardData) return null;
  const username = typeof params.username === "string" ? params.username : null;
  return {
    id: row.id,
    kind: row.kind as CardKind,
    templateId: row.template_id,
    size: row.size as CardSize,
    data: { ...cardData, username },
    imageUrl: row.image_path && row.shared_at ? publicImageUrl(row.image_path) : null,
    sharedAt: row.shared_at,
  };
}

function toSharedCard(row: SharedCardRow): SharedCard | null {
  const card = row.shared_at ? toUserCard(row) : null;
  return card && { ...card, sharedAt: card.sharedAt! };
}

/**
 * A live shared card by id, or null. Its link works even on a private profile (`shared_card()`, ADR 0027);
 * `profileUsername` is the owner's current username when their profile is public and the card shows their name.
 */
export async function sharedCard(db: UserClient, id: string): Promise<(SharedCard & { profileUsername: string | null }) | null> {
  const { data, error } = await db.rpc("shared_card", { p_id: id });
  if (error) throw new Error(`shared_card failed: ${error.message}`);
  const row = data[0];
  const card = row ? toSharedCard(row) : null;
  return card && { ...card, profileUsername: row!.profile_username };
}

/** The newest shared cards of a public profile (its gallery). RLS returns nothing for a private one. */
export async function sharedCards(db: UserClient, userId: string, limit: number): Promise<SharedCard[]> {
  const { data, error } = await db
    .from("cards")
    .select("id, kind, template_id, size, params, image_path, shared_at")
    .eq("user_id", userId)
    .not("shared_at", "is", null)
    .is("deleted_at", null)
    .order("shared_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`cards read failed: ${error.message}`);
  return data.map(toSharedCard).filter((card): card is SharedCard => card !== null);
}

/** The user's newest saved cards, shared or only downloaded (RLS: owners read their own). */
export async function recentCards(db: UserClient, userId: string, limit: number): Promise<UserCard[]> {
  const { data, error } = await db
    .from("cards")
    .select("id, kind, template_id, size, params, image_path, shared_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`cards read failed: ${error.message}`);
  return data.map(toUserCard).filter((card): card is UserCard => card !== null);
}

/** Removes every card PNG of a user (account deletion; the rows cascade with the profile). */
export async function deleteCardImages(userId: string): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  for (;;) {
    const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 1000 });
    if (error) throw new Error(`card images list failed: ${error.message}`);
    if (!data || data.length === 0) return;
    const { error: removeError } = await admin.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
    if (removeError) throw new Error(`card images remove failed: ${removeError.message}`);
    if (data.length < 1000) return;
  }
}
