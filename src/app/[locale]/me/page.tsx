import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileAlbum } from "@/components/profile/profile-album";
import { localizedPath } from "@/core/auth";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/me">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "Profile" });
  return { title: `${t("meTitle")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Me, the nav island's last tab (ADR 0050): your own album, as visitors see it at /u/<username>, plus Share my
 * collection and Settings. Private profiles open here too (visitors get "This collection is private"). Its tabs are
 * Album (here) and Stats (/stats, ADR 0053).
 */
export default async function MePage({ params }: PageProps<"/[locale]/me">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const db = await userClient();
  const { data } = db ? await db.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!db || !userId) {
    return redirect({ href: { pathname: "/auth", query: { next: localizedPath("/me", locale, routing.defaultLocale) } }, locale });
  }

  const { data: me, error } = await db
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at, visibility, time_zone")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`profile read failed: ${error.message}`);
  return (
    <ProfileAlbum
      db={db}
      viewerId={userId}
      locale={locale}
      timeZone={me.time_zone}
      privateToOthers={me.visibility === "private"}
      me
      profile={{ id: me.id, username: me.username, displayName: me.display_name, bio: me.bio, avatarUrl: me.avatar_url, joinedAt: me.created_at }}
    />
  );
}
