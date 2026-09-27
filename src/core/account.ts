// Account settings (S1 profile & privacy): what PATCH /api/account accepts, and the preferences cookie that
// mirrors a signed-in user's saved language and theme. The database stays the authority: it re-checks the
// username format, the name blocklist and the time zone.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const isTheme = (v: unknown): v is Theme => (THEMES as readonly unknown[]).includes(v);

export const VISIBILITIES = ["public", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const isVisibility = (v: unknown): v is Visibility => (VISIBILITIES as readonly unknown[]).includes(v);

/** Same rule as the `profiles.username` check. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const DISPLAY_NAME_MAX = 50;
const TIME_ZONE_RE = /^[A-Za-z][A-Za-z0-9_+/-]{0,63}$/;

/** "  Jane.Doe " → "jane.doe": usernames are lower-case; the format check comes after. */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

/** A settings change, in database column names. Only the fields that were sent. */
export type AccountPatch = {
  username?: string;
  display_name?: string | null;
  avatar_url?: null;
  locale?: string;
  time_zone?: string;
  theme?: Theme;
  visibility?: Visibility;
  email_recaps?: boolean;
};

/**
 * Validates a PATCH /api/account body: any of `username`, `displayName` (empty or null clears it),
 * `avatarUrl` (only null: remove the photo), `locale`, `timeZone`, `theme`, `visibility`, `emailRecaps`.
 * Null when anything sent is invalid or nothing is.
 */
export function parseAccountPatch(body: unknown, locales: readonly string[]): AccountPatch | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const patch: AccountPatch = {};

  if ("username" in b) {
    if (typeof b.username !== "string") return null;
    const username = normalizeUsername(b.username);
    if (!USERNAME_RE.test(username)) return null;
    patch.username = username;
  }
  if ("displayName" in b) {
    if (b.displayName === null) patch.display_name = null;
    else if (typeof b.displayName !== "string") return null;
    else {
      const name = b.displayName.trim().replace(/\s+/g, " ");
      if ([...name].length > DISPLAY_NAME_MAX) return null;
      patch.display_name = name || null;
    }
  }
  if ("avatarUrl" in b) {
    if (b.avatarUrl !== null) return null;
    patch.avatar_url = null;
  }
  if ("locale" in b) {
    if (typeof b.locale !== "string" || !locales.includes(b.locale)) return null;
    patch.locale = b.locale;
  }
  if ("timeZone" in b) {
    if (typeof b.timeZone !== "string" || !TIME_ZONE_RE.test(b.timeZone)) return null;
    patch.time_zone = b.timeZone;
  }
  if ("theme" in b) {
    if (!isTheme(b.theme)) return null;
    patch.theme = b.theme;
  }
  if ("visibility" in b) {
    if (!isVisibility(b.visibility)) return null;
    patch.visibility = b.visibility;
  }
  if ("emailRecaps" in b) {
    if (typeof b.emailRecaps !== "boolean") return null;
    patch.email_recaps = b.emailRecaps;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * The preferences cookie: `<locale>.<theme>` (e.g. `th.dark`), set only for signed-in users from their saved
 * settings (on sign-in by the proxy, and when Settings change). The proxy redirects to the saved locale, and
 * an inline script applies the theme before first paint, so pages stay static. Readable by scripts on purpose
 * (it holds no secret).
 */
export const PREFS_COOKIE = "mystonie_prefs";
export const PREFS_MAX_AGE = 400 * 24 * 60 * 60; // the longest browsers keep a cookie

export type Prefs = { locale: string; theme: Theme };

export function formatPrefs(prefs: Prefs): string {
  return `${prefs.locale}.${prefs.theme}`;
}

export function parsePrefs(value: string | undefined, locales: readonly string[]): Prefs | null {
  const [locale, theme, ...rest] = (value ?? "").split(".");
  if (rest.length > 0 || !locale || !locales.includes(locale) || !isTheme(theme)) return null;
  return { locale, theme };
}

/**
 * Every row of a paged read (PostgREST returns at most `max_rows` per request): asks for `pageSize` rows at a
 * time until a short page comes back.
 */
export async function collectPages<T>(fetchPage: (from: number, to: number) => Promise<T[]>, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
