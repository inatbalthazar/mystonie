// Routing rules for sign-in (ADR 0020): which pages need an account, where to send people afterwards.
// Paths here are external URLs, so they may carry a locale prefix (`/th/settings`).

/**
 * App pages that need a signed-in user. Add new ones as they ship (collection, stats, …). Not `/feed`: visitors see
 * the Journal's articles there (ADR 0062).
 */
export const PROTECTED_PATHS = ["/home", "/collection", "/settings", "/title", "/recap", "/people", "/board", "/challenges", "/me", "/journal/write", "/admin"] as const;

/** `/th/settings` → { locale: "th", path: "/settings" }; unprefixed paths are the default locale. */
export function splitLocale(pathname: string, locales: readonly string[], defaultLocale: string) {
  const [, first, ...rest] = pathname.split("/");
  if (first && first !== defaultLocale && locales.includes(first)) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  return { locale: defaultLocale, path: pathname || "/" };
}

/** Adds the locale prefix (none for the default locale), as next-intl's `as-needed` mode does. */
export function localizedPath(path: string, locale: string, defaultLocale: string): string {
  if (locale === defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export function isProtectedPath(path: string): boolean {
  const clean = path.replace(/\/+$/, "") || "/";
  return PROTECTED_PATHS.some((p) => clean === p || clean.startsWith(`${p}/`));
}

/**
 * The `next` parameter, if it is a same-site page path; else `fallback`. Blocks open redirects
 * (`//evil.com`, `/\evil.com`, `https://…`) and API routes.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || raw.length > 512 || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, "https://mystonie.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://mystonie.invalid" || url.pathname === "/api" || url.pathname.startsWith("/api/")) return fallback;
  return url.pathname + url.search;
}

/**
 * Supabase keeps the session in `sb-<project>-auth-token` cookies (split into `.0`, `.1`, … when long).
 * Their presence is a cheap "probably signed in" hint; the proxy verifies the session itself.
 */
export function hasAuthCookie(cookieNames: Iterable<string>): boolean {
  for (const name of cookieNames) if (/^sb-.+-auth-token(\.\d+)?$/.test(name)) return true;
  return false;
}

/**
 * Runs before first paint (with the theme, in the layout's <script>): `<html data-auth>` when `hasAuthCookie` would
 * say yes. The signed-in shell (the nav island, ADR 0050) shows from CSS on it, so static pages need no session
 * read and nothing pops in after hydration. Sign-in and sign-out load a new page, so it's always current.
 */
export const SIGNED_IN_SCRIPT = `try{if(document.cookie.split("; ").some(function(c){return /^sb-.+-auth-token(\\.\\d+)?$/.test(c.split("=")[0])}))document.documentElement.dataset.auth=""}catch(e){}`;
