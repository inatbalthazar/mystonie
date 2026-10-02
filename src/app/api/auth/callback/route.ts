import { NextResponse } from "next/server";
import { PREFS_COOKIE } from "@/core/account";
import { localizedPath, safeNextPath, splitLocale } from "@/core/auth";
import { afterSocialSignIn } from "@/data/sign-in";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";

/**
 * GET /api/auth/callback?code=…&next=…&tz=…: where every social sign-in returns (OAuth with PKCE, ADR 0020,
 * ADR 0064, ADR 0071). Exchanges the code for a session cookie, then gives a brand-new profile its locale (from
 * `next`) and browser time zone (`tz`) and copies the provider's photo (`afterSocialSignIn`).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const next = safeNextPath(params.get("next"));
  const { locale } = splitLocale(next, routing.locales, routing.defaultLocale);
  const code = params.get("code");
  const supabase = await userClient();

  if (supabase && code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await afterSocialSignIn(supabase, data.user, { locale, tz: params.get("tz") ?? "", providerToken: data.session?.provider_token });
      return signedIn(new URL(next, request.url));
    }
    console.warn("oauth sign-in failed", error?.code ?? error?.message);
  }
  const retry = `${localizedPath("/auth", locale, routing.defaultLocale)}?${new URLSearchParams({ error: "oauth", next })}`;
  return NextResponse.redirect(new URL(retry, request.url), 303);
}

/** After a sign-in: drops the previous account's preferences cookie, so the proxy loads this account's. */
function signedIn(next: URL): NextResponse {
  const response = NextResponse.redirect(next, 303);
  response.cookies.delete(PREFS_COOKIE);
  return response;
}
