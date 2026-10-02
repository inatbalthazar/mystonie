import { hasLocale } from "next-intl";
import { after, NextResponse } from "next/server";
import { PREFS_COOKIE } from "@/core/account";
import { localizedPath, safeNextPath, splitLocale } from "@/core/auth";
import { AVATAR_SIZE } from "@/core/avatar";
import { importSignInPhoto } from "@/data/avatars";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";

/** A profile made this recently was created by this sign-in (the trigger runs during the code exchange). */
const NEW_PROFILE_MS = 10 * 60 * 1000;

/**
 * GET /api/auth/callback?code=…&next=…&tz=…: where every social sign-in returns (OAuth with PKCE, ADR 0020,
 * ADR 0064, ADR 0071). Exchanges the code for a session cookie. OAuth can't carry sign-up metadata, so a brand-new
 * profile gets its locale (from `next`) and browser time zone (`tz`) here. After the redirect, the provider's photo is
 * copied into our own storage (`importSignInPhoto`), so sign-in doesn't wait for it.
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
      const { data: profile } = await supabase.from("profiles").select("created_at, avatar_url").eq("id", data.user.id).maybeSingle();
      const isNew = !!profile && Date.now() - Date.parse(profile.created_at) < NEW_PROFILE_MS;
      if (profile) {
        const photo = {
          userId: data.user.id,
          provider: data.user.app_metadata.provider,
          providerToken: data.session?.provider_token,
          avatarUrl: profile.avatar_url,
          isNew,
        };
        after(() => importSignInPhoto(photo, AVATAR_SIZE));
      }
      if (isNew) {
        const tz = params.get("tz") ?? "";
        const settings: { locale?: string; time_zone?: string } = {};
        if (hasLocale(routing.locales, locale)) settings.locale = locale;
        if (tz && tz.length <= 64) settings.time_zone = tz;
        // An unknown zone fails the DB check; retry with the locale alone rather than lose it.
        const { error: updateError } = await supabase.from("profiles").update(settings).eq("id", data.user.id);
        if (updateError && settings.time_zone) await supabase.from("profiles").update({ locale: settings.locale }).eq("id", data.user.id);
      }
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
