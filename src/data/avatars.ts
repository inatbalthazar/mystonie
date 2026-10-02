// Profile photos (ADR 0064). Server only: the `avatars` bucket has no client write access, so every photo goes
// through here with the service role, after the bytes were checked to be a JPEG, PNG or WebP.
import { AVATAR_MAX_BYTES, AVATAR_MIME, avatarPath, facebookPicture, isOwnAvatar, providerPhotoUrl, sniffImage } from "@/core/avatar";
import { uuidv7 } from "@/core/ids";
import { adminClient } from "./supabase-admin";
import { publicSupabaseEnv } from "./supabase-server";

const BUCKET = "avatars";

/** Public URL of a photo in the bucket. */
function publicAvatarUrl(path: string): string | null {
  const env = publicSupabaseEnv();
  return env ? `${env.url}/storage/v1/object/public/${BUCKET}/${path}` : null;
}

/**
 * Stores `bytes` as the user's photo and points their profile at it; their older photos are removed. Returns the new
 * URL, or null when the bytes aren't a photo we keep or there's no service role.
 */
export async function storeAvatar(userId: string, bytes: Uint8Array): Promise<string | null> {
  const type = sniffImage(bytes);
  const admin = adminClient();
  if (!type || bytes.length > AVATAR_MAX_BYTES || !admin) return null;
  const path = avatarPath(userId, uuidv7(), type);
  const url = publicAvatarUrl(path);
  if (!url) return null;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: AVATAR_MIME[type], cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`avatar upload failed: ${error.message}`);
  const { error: updateError } = await admin.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (updateError) {
    await admin.storage.from(BUCKET).remove([path]);
    throw new Error(`profiles update failed: ${updateError.message}`);
  }
  await deleteAvatars(userId, path).catch((e: unknown) => console.error("old avatar cleanup failed", e));
  return url;
}

/** Removes the user's photo: the profile shows their initial again, and the files go. */
export async function removeAvatar(userId: string): Promise<boolean> {
  const admin = adminClient();
  if (!admin) return false;
  const { error } = await admin.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) throw new Error(`profiles update failed: ${error.message}`);
  await deleteAvatars(userId);
  return true;
}

/** Deletes the user's photo files, all but `keep` (account deletion: all). */
export async function deleteAvatars(userId: string, keep?: string): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
  if (error) throw new Error(`avatars list failed: ${error.message}`);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length === 0) return;
  const { error: removeError } = await admin.storage.from(BUCKET).remove(old);
  if (removeError) throw new Error(`avatars remove failed: ${removeError.message}`);
}

/** Downloads a provider's photo (https, a few seconds, at most `AVATAR_MAX_BYTES`), or null. */
async function download(url: string): Promise<Uint8Array | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "follow", cache: "no-store" });
  if (!res.ok || !res.url.startsWith("https://")) return null;
  if (Number(res.headers.get("content-length") ?? 0) > AVATAR_MAX_BYTES) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.length <= AVATAR_MAX_BYTES ? bytes : null;
}

/** Facebook's photo at `size` px, asked with the sign-in's token (its plain photo link is tiny and expires). */
async function facebookPhoto(token: string, size: number): Promise<string | null> {
  const query = new URLSearchParams({ width: String(size), height: String(size), redirect: "false", access_token: token });
  const res = await fetch(`https://graph.facebook.com/me/picture?${query}`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  return res.ok ? facebookPicture(await res.json()) : null;
}

export type SignInPhoto = {
  userId: string;
  provider: string | undefined;
  /** The provider's access token from the sign-in (Facebook's lets us ask for a bigger photo). */
  providerToken: string | null | undefined;
  /** What the profile shows now. */
  avatarUrl: string | null;
  /** Whether this sign-in created the account. */
  isNew: boolean;
};

/**
 * After a social sign-in (Google, Apple, Facebook, X, Discord): copies the provider's photo into our bucket when the
 * account is new, or when the profile still shows a provider's link from before photos were kept here. A photo someone
 * uploaded or removed stays as it is. Facebook's own photo links expire, so when its photo can't be copied the link is
 * dropped (the profile shows the initial). Never throws: a photo isn't worth failing a sign-in for.
 */
export async function importSignInPhoto(photo: SignInPhoto, size: number): Promise<void> {
  const env = publicSupabaseEnv();
  if (!env || isOwnAvatar(photo.avatarUrl, photo.userId, env.url)) return;
  if (!photo.isNew && !photo.avatarUrl) return;
  let stored: string | null = null;
  try {
    const source =
      photo.provider === "facebook" && photo.providerToken ? await facebookPhoto(photo.providerToken, size) : providerPhotoUrl(photo.avatarUrl);
    const bytes = source ? await download(source) : null;
    stored = bytes ? await storeAvatar(photo.userId, bytes) : null;
  } catch (error) {
    console.error("sign-in photo import failed", error);
  }
  if (!stored && photo.provider === "facebook" && photo.avatarUrl) {
    await adminClient()
      ?.from("profiles")
      .update({ avatar_url: null })
      .eq("id", photo.userId)
      .eq("avatar_url", photo.avatarUrl)
      .then(({ error }) => error && console.error("facebook photo link cleanup failed", error.message));
  }
}
