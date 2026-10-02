import { BanIcon, LockIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { ProfileAlbum } from "@/components/profile/profile-album";
import { BlockButton } from "@/components/social/block-button";
import { USERNAME_RE } from "@/core/account";
import { publicProfile } from "@/data/profiles";
import { userClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";

/** The profile for this request (page + metadata), or null when the name can't exist or nobody has it. */
const load = cache(async (raw: string) => {
  const username = decodeURIComponent(raw).toLowerCase();
  if (!USERNAME_RE.test(username)) return null;
  const db = await userClient();
  if (!db) return null;
  try {
    const profile = await publicProfile(db, username);
    return profile && { db, profile };
  } catch (error) {
    console.error(error);
    return null;
  }
});

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
 * A public profile (S1 profile & privacy): the collector's album others can visit (`ProfileAlbum`). Private profiles
 * only say so (RLS hides the rest); their owner sees the album at /me.
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
  const t = await getTranslations("Profile");

  if (profile.isPrivate && profile.blockedId) {
    // The viewer blocked this person: say so, and let them undo it.
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 pt-16 pb-16 text-center">
        <span aria-hidden="true" className="flex size-16 rotate-[-6deg] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card">
          <BanIcon className="size-7 text-muted-foreground" />
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-balance">{t("blockedTitle", { username: profile.username })}</h1>
        <p className="text-muted-foreground">{t("blockedBody")}</p>
        <BlockButton userId={profile.blockedId} username={profile.username} blocked />
      </main>
    );
  }

  if (profile.isPrivate) {
    // Profiles are readable by their owner only, so finding the row means this is the owner's page.
    const { data: own } = viewerId
      ? await db.from("profiles").select("id").eq("username", profile.username).maybeSingle()
      : { data: null };
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 pt-16 pb-16 text-center">
        <span aria-hidden="true" className="flex size-16 rotate-[-6deg] items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card">
          <LockIcon className="size-7 text-muted-foreground" />
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-balance">{t("privateTitle")}</h1>
        <p className="text-muted-foreground">{t("privateBody", { username: profile.username })}</p>
        {own && (
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-brand-soft px-4 py-3 text-sm">
            <p>{t("ownerPrivate")}</p>
            <Link href="/settings" className="flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
              {t("openSettings")}
            </Link>
          </div>
        )}
      </main>
    );
  }

  return <ProfileAlbum db={db} profile={profile} layout={profile.layout} viewerId={viewerId} locale={locale} />;
}
