import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileAlbum } from "@/components/profile/profile-album";
import { STATS_SECTIONS } from "@/core/album";
import { ClosedProfile, loadProfile as load } from "./profile";

export async function generateMetadata({ params }: PageProps<"/[locale]/u/[username]">): Promise<Metadata> {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  const loaded = await load(username);
  if (!loaded) return { robots: { index: false } };
  const { profile } = loaded;
  const t = await getTranslations({ locale, namespace: "Profile" });
  if (profile.isPrivate) return { title: `${t("privateTitle")} · Mystonie`, robots: { index: false, follow: false } };
  const title = t("metaTitle", { name: profile.displayName ?? profile.username, username: profile.username });
  const description = t("metaDescription", { username: profile.username });
  return {
    title: `${title} · Mystonie`,
    description,
    // Public on purpose, but a person's page shouldn't show up in search results.
    robots: { index: false, follow: true },
    alternates: { canonical: `/u/${profile.username}` },
    openGraph: { type: "profile", title, description, url: `/u/${profile.username}`, siteName: "Mystonie" },
  };
}

/**
 * A public profile (S1 profile & privacy): the collector's album others can visit (`ProfileAlbum`), the Album tab next
 * to its Stats (ADR 0077). Private profiles only say so (RLS hides the rest); their owner sees the album at /me.
 */
export default async function ProfilePage({ params }: PageProps<"/[locale]/u/[username]">) {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const loaded = await load(username);
  if (!loaded) notFound();
  const { db, profile } = loaded;
  const { data: auth } = await db.auth.getClaims();
  const viewerId = auth?.claims.sub ?? null;
  if (profile.isPrivate) return <ClosedProfile db={db} profile={profile} viewerId={viewerId} />;

  return (
    <ProfileAlbum
      db={db}
      profile={profile}
      layout={profile.layout}
      viewerId={viewerId}
      locale={locale}
      // The Stats tab, unless its owner keeps every part of it to themselves (ADR 0077).
      statsTab={profile.statsHidden.length < STATS_SECTIONS.length}
    />
  );
}
