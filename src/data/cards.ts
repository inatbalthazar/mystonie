// Saved cards (S1 share artwork, ADR 0024). Server only.
import { atlasCardCountries } from "@/core/atlas";
import { isAvatarUrl, isOwnAvatar } from "@/core/avatar";
import { regionsByCountry, regionsOf } from "@/core/atlas-regions";
import { cardImagePath, parseCardData, type CardSave } from "@/core/cards/saved";
import { isTemplateId, type TemplateId } from "@/core/cards/templates";
import type { CardData, CardKind, CardSize } from "@/core/cards/types";
import { isCountryCode } from "@/core/countries";
import { shownShare } from "@/core/finish-share";
import { userPlaces, userRegions } from "./atlas";
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
export function publicImageUrl(path: string): string | null {
  const env = publicSupabaseEnv();
  return env ? `${env.url}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}

/**
 * Saves a card's inputs as the signed-in user (RLS). Saving the same card id again (another template, then
 * Share after Download) updates it. The footer's `@username` and photo (ADR 0068) come from the profile, never from the request.
 * A share also returns a signed URL the browser uploads the PNG to (the bucket has no client write access).
 */
export async function saveCard(db: UserClient, userId: string, save: CardSave): Promise<{ uploadUrl: string | null } | null> {
  const [{ data: profile, error: profileError }, finishShare, completed, played, mapped] = await Promise.all([
    db.from("profiles").select("username, avatar_url").eq("id", userId).single(),
    cardFinishShare(db, userId, save),
    completedChallenge(db, userId, save),
    playedReel(db, userId, save),
    ownAtlas(db, userId, save),
  ]);
  if (profileError) throw new Error(`profiles read failed: ${profileError.message}`);
  if (!completed || !played || !mapped) return null;
  const hideName = save.data.hide?.includes("username");
  const storage = publicSupabaseEnv()?.url;
  const photo = !hideName && !save.data.hide?.includes("photo") && storage && isOwnAvatar(profile.avatar_url, userId, storage) ? profile.avatar_url : null;
  const params = { ...save.data, username: hideName ? null : profile.username, avatarUrl: photo, finishShare };
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

/**
 * Whether a Reel of the Day card (or its sticker) is the user's own finished play (stage 4 daily game): the same
 * right and wrong guesses and the streak the server recorded. Cards about anything else pass.
 */
async function playedReel(db: UserClient, userId: string, save: CardSave): Promise<boolean> {
  const reel = save.data.reel;
  if (!reel) return true;
  const { data, error } = await db
    .from("reel_plays")
    .select("guesses, solved, streak, finished_at")
    .eq("user_id", userId)
    .eq("day", reel.day)
    .maybeSingle();
  if (error) throw new Error(`reel_plays read failed: ${error.message}`);
  if (!data?.finished_at) return false;
  const guesses = Array.isArray(data.guesses) ? data.guesses.length : 0;
  return data.solved === reel.solved && data.streak === reel.streak && guesses === reel.results.length;
}

/**
 * Whether an Atlas card colours in exactly the countries the user has been to (stage 4, ADR 0059), or, on a country's
 * card, exactly the regions of it they marked, with that country's real count and kind (ADR 0060). Cards about anything
 * else pass.
 */
async function ownAtlas(db: UserClient, userId: string, save: CardSave): Promise<boolean> {
  const atlas = save.data.atlas;
  if (!atlas) return true;
  if (atlas.regions) {
    const { country, kind, total, ids } = atlas.regions;
    if (!isCountryCode(country)) return false;
    const list = regionsOf(country);
    if (!list || list.kind !== kind || list.ids.length !== total) return false;
    const marked = regionsByCountry(await userRegions(db, userId, country)).get(country) ?? [];
    return marked.length === ids.length && marked.every((id, i) => id === ids[i]);
  }
  const visited = atlasCardCountries(await userPlaces(db, userId));
  return visited.length === atlas.countries.length && visited.every((code, i) => code === atlas.countries[i]);
}

/**
 * Whether a card about a challenge (a Challenge card, or its sticker) is about one the user really completed (S3
 * challenges & clubs). Cards about anything else pass.
 */
async function completedChallenge(db: UserClient, userId: string, save: CardSave): Promise<boolean> {
  const challenge = save.data.challenge;
  if (!challenge) return true;
  const { data, error } = await db
    .from("challenge_joins")
    .select("id")
    .eq("user_id", userId)
    .eq("month", `${challenge.month}-01`)
    .eq("slug", challenge.slug)
    .not("completed_at", "is", null)
    .is("deleted_at", null)
    .limit(1);
  if (error) throw new Error(`challenge_joins read failed: ${error.message}`);
  return data.length > 0;
}

/**
 * The rare-finish share a card may print (ADR 0067): the entry's own, only on a Finish card, and not when the user hid
 * it. Whatever the browser sent is ignored.
 */
async function cardFinishShare(db: UserClient, userId: string, save: CardSave): Promise<number | null> {
  if (save.kind !== "finish" || !save.entryId || save.data.hide?.includes("finisher")) return null;
  const { data, error } = await db.from("entries").select("finish_share, finish_members").eq("id", save.entryId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`entries read failed: ${error.message}`);
  return data ? shownShare(data.finish_share, data.finish_members) : null;
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
  // Only a photo from our bucket, and only next to the username (ADR 0068).
  const storage = publicSupabaseEnv()?.url;
  const avatarUrl = username && storage && isAvatarUrl(params.avatarUrl, storage) ? params.avatarUrl : null;
  return {
    id: row.id,
    kind: row.kind as CardKind,
    templateId: row.template_id,
    size: row.size as CardSize,
    data: { ...cardData, username, avatarUrl },
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
