import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { formatPrefs, isTheme, parsePrefs, PREFS_COOKIE, type Prefs } from "./core/account";
import { hasAuthCookie, isProtectedPath, localizedPath, splitLocale } from "./core/auth";
import { routing } from "./i18n/routing";
import { prefsCookieOptions } from "./lib/prefs";

// Resolves the locale from the URL prefix (none = en) and rewrites to /[locale].
const intl = createMiddleware(routing);

type Cookie = { name: string; value: string; options: CookieOptions };

/**
 * 1. Refreshes the Supabase session cookie when there is one (ADR 0020). Signed-out visitors skip this, so
 *    public pages stay as fast as before.
 * 2. Sends signed-out visitors of app pages (`PROTECTED_PATHS`) to /auth?next=<where they were>.
 * 3. Signed in: mirrors the saved language and theme into the preferences cookie (read once per device, then
 *    kept fresh by PATCH /api/account), and sends page views in another language to the saved one (S1 profile).
 * 4. Hands over to next-intl.
 */
export default async function proxy(request: NextRequest) {
  const { locale, path } = splitLocale(request.nextUrl.pathname, routing.locales, routing.defaultLocale);
  const needsUser = isProtectedPath(path);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let refreshed: Cookie[] = [];
  let signedIn = false;
  let prefs = parsePrefs(request.cookies.get(PREFS_COOKIE)?.value, routing.locales);
  let newPrefs: Prefs | null = null;

  if (url && anonKey && (needsUser || hasAuthCookie(request.cookies.getAll().map((c) => c.name)))) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          // Pages rendered for this request read the new tokens (next-intl copies the request headers)…
          for (const { name, value } of list) request.cookies.set(name, value);
          // …and the browser stores them from the response below.
          refreshed = list;
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims);
    if (data?.claims && !prefs) {
      const { data: profile } = await supabase.from("profiles").select("locale, theme").eq("id", data.claims.sub).maybeSingle();
      if (profile && routing.locales.includes(profile.locale as never) && isTheme(profile.theme)) {
        prefs = newPrefs = { locale: profile.locale, theme: profile.theme };
      }
    }
  }

  let response: NextResponse;
  if (needsUser && !signedIn) {
    const target = `${localizedPath("/auth", locale, routing.defaultLocale)}?${new URLSearchParams({ next: request.nextUrl.pathname + request.nextUrl.search })}`;
    response = NextResponse.redirect(new URL(target, request.url));
  } else if (signedIn && prefs && prefs.locale !== locale && request.method === "GET") {
    const target = localizedPath(path, prefs.locale, routing.defaultLocale) + request.nextUrl.search;
    response = NextResponse.redirect(new URL(target, request.url));
    response.headers.set("Cache-Control", "private, no-store");
  } else {
    response = intl(request);
  }
  for (const { name, value, options } of refreshed) response.cookies.set(name, value, options);
  if (newPrefs) response.cookies.set(PREFS_COOKIE, formatPrefs(newPrefs), prefsCookieOptions());
  // Pages that depend on the session must never be cached by a CDN.
  if (needsUser) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Skip API routes, the PostHog (/ingest) and Sentry (/monitoring) proxies, Next internals,
  // generated metadata images (served without an extension) and files with an extension.
  matcher: "/((?!api|ingest|monitoring|_next|_vercel|apple-icon|opengraph-image|.*\\..*).*)",
};
