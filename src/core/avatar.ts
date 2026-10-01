// Profile photos (ADR 0064): uploaded by the person, or copied from Google or Facebook when they sign up with it, and
// kept in our own public `avatars` bucket at `<user id>/<photo id>.<ext>`. Providers' photo links expire (Facebook's)
// or tell the provider who looks at them, so nothing is shown from their servers once a copy exists.

/** The side of the square a photo is saved at, in pixels (the browser crops and resizes before uploading). */
export const AVATAR_SIZE = 320;
/** The most a stored photo may weigh. A 320 px WebP or JPEG is far below it. */
export const AVATAR_MAX_BYTES = 1_000_000;

export type AvatarType = "jpeg" | "png" | "webp";

export const AVATAR_MIME: Record<AvatarType, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const EXT: Record<AvatarType, string> = { jpeg: "jpg", png: "png", webp: "webp" };

/** What the bytes really are (their first bytes, not a name or a header), or null when not a JPEG, PNG or WebP. */
export function sniffImage(bytes: Uint8Array): AvatarType | null {
  const at = (i: number, ...values: number[]) => values.every((v, k) => bytes[i + k] === v);
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  // "RIFF" <size> "WEBP"
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  return null;
}

/** Where a photo lives in the bucket. */
export const avatarPath = (userId: string, photoId: string, type: AvatarType): string => `${userId}/${photoId}.${EXT[type]}`;

/** Whether `url` is one of this person's photos in our bucket (`storageUrl`: the Supabase URL). */
export function isOwnAvatar(url: string | null, userId: string, storageUrl: string): boolean {
  return !!url && url.startsWith(`${storageUrl.replace(/\/+$/, "")}/storage/v1/object/public/avatars/${userId}/`);
}

/** Sign-in providers the sign-in page can offer, in the order of their buttons (each only when switched on). */
export const OAUTH_PROVIDERS = ["google", "facebook"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const isOAuthProvider = (v: unknown): v is OAuthProvider => (OAUTH_PROVIDERS as readonly unknown[]).includes(v);

/** The switched-on providers from Supabase Auth's `/auth/v1/settings` (`{ external: { google: true, … } }`). */
export function enabledProviders(settings: unknown): OAuthProvider[] {
  const external = typeof settings === "object" && settings !== null ? (settings as { external?: unknown }).external : null;
  if (typeof external !== "object" || external === null) return [];
  return OAUTH_PROVIDERS.filter((p) => (external as Record<string, unknown>)[p] === true);
}

/**
 * A provider's photo link at a size worth copying. Google's end in a size (`=s96-c`): ask for `AVATAR_SIZE`.
 * Anything not https is no photo.
 */
export function providerPhotoUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname.endsWith(".googleusercontent.com")) return url.href.replace(/=s\d+(-c)?$/, `=s${AVATAR_SIZE}-c`);
  return url.href;
}

/**
 * Facebook's `/me/picture?redirect=false` answer → the photo's link, or null when it's Facebook's grey silhouette
 * (the person has no photo) or the answer is something else.
 */
export function facebookPicture(json: unknown): string | null {
  const data = typeof json === "object" && json !== null ? (json as { data?: unknown }).data : null;
  if (typeof data !== "object" || data === null) return null;
  const { url, is_silhouette: silhouette } = data as { url?: unknown; is_silhouette?: unknown };
  return silhouette === true ? null : providerPhotoUrl(url);
}

// Framing a photo (the crop sheet): the picture, `width` × `height`, fills a square frame `view` px wide at `zoom`
// (1 = its short side fits the frame), with its top-left corner at `x`, `y` px from the frame's (≤ 0: it always
// covers the frame).

export const MAX_ZOOM = 4;

export type Framing = { zoom: number; x: number; y: number };

/** How many screen px one picture px takes in the frame. */
const scaleOf = (width: number, height: number, view: number, zoom: number) => (view / Math.min(width, height)) * zoom;

/** `framing` kept inside the rules: zoom 1–`MAX_ZOOM`, and the picture covering the whole frame. */
export function clampFraming(width: number, height: number, view: number, framing: Framing): Framing {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(framing.zoom) ? framing.zoom : 1));
  const scale = scaleOf(width, height, view, zoom);
  const clamp = (v: number, size: number) => Math.min(0, Math.max(view - size * scale, Number.isFinite(v) ? v : 0));
  return { zoom, x: clamp(framing.x, width), y: clamp(framing.y, height) };
}

/** The picture centred in the frame at `zoom`. */
export function centredFraming(width: number, height: number, view: number, zoom = 1): Framing {
  const scale = scaleOf(width, height, view, zoom);
  return clampFraming(width, height, view, { zoom, x: (view - width * scale) / 2, y: (view - height * scale) / 2 });
}

/** Zooms around the frame's centre, so what's in the middle stays there. */
export function zoomFraming(width: number, height: number, view: number, framing: Framing, zoom: number): Framing {
  const before = scaleOf(width, height, view, framing.zoom);
  const after = scaleOf(width, height, view, Math.min(MAX_ZOOM, Math.max(1, zoom)));
  const mid = view / 2;
  return clampFraming(width, height, view, { zoom, x: mid - ((mid - framing.x) / before) * after, y: mid - ((mid - framing.y) / before) * after });
}

/** The square of the picture (in picture px) that the frame shows: what gets drawn at `AVATAR_SIZE`. */
export function cropSquare(width: number, height: number, view: number, framing: Framing): { x: number; y: number; size: number } {
  const f = clampFraming(width, height, view, framing);
  const scale = scaleOf(width, height, view, f.zoom);
  const size = Math.min(width, height, view / scale);
  return { x: Math.min(width - size, Math.max(0, -f.x / scale)), y: Math.min(height - size, Math.max(0, -f.y / scale)), size };
}
