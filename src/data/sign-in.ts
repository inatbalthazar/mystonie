// After a social sign-in (server only): what the sign-up email's metadata does for an emailed code. Shared by the
// OAuth callback (`/api/auth/callback`) and Google's own button (`/api/auth/finish`, ADR 0073).
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { hasLocale } from "next-intl";
import { after } from "next/server";
import { AVATAR_SIZE } from "@/core/avatar";
import { routing } from "@/i18n/routing";
import { importSignInPhoto } from "./avatars";
import type { Database } from "./database.types";

/** A profile made this recently was created by this sign-in (the trigger runs as the account is made). */
const NEW_PROFILE_MS = 10 * 60 * 1000;

/**
 * A new profile gets the locale it signed up in and the browser's time zone (`tz`); OAuth can't carry sign-up
 * metadata. After the response, the provider's photo is copied into our storage (`importSignInPhoto`), so sign-in
 * doesn't wait for it.
 */
export async function afterSocialSignIn(
  supabase: SupabaseClient<Database>,
  user: User,
  {
    locale,
    tz,
    providerToken,
  }: { locale: string; tz: string; providerToken?: string | null },
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return;
  const isNew = Date.now() - Date.parse(profile.created_at) < NEW_PROFILE_MS;
  const photo = {
    userId: user.id,
    provider: user.app_metadata.provider,
    providerToken,
    avatarUrl: profile.avatar_url,
    isNew,
  };
  after(() => importSignInPhoto(photo, AVATAR_SIZE));
  if (!isNew) return;
  const settings: { locale?: string; time_zone?: string } = {};
  if (hasLocale(routing.locales, locale)) settings.locale = locale;
  if (tz && tz.length <= 64) settings.time_zone = tz;
  // An unknown zone fails the DB check; retry with the locale alone rather than lose it.
  const { error } = await supabase
    .from("profiles")
    .update(settings)
    .eq("id", user.id);
  if (error && settings.time_zone)
    await supabase
      .from("profiles")
      .update({ locale: settings.locale })
      .eq("id", user.id);
}
