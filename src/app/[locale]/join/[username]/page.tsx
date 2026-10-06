import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Avatar } from "@/components/social/avatar";
import { FollowButton } from "@/components/social/follow-button";
import { InviteCard } from "@/components/social/invite-card";
import { RememberInvite } from "@/components/social/remember-invite";
import { localizedPath } from "@/core/auth";
import { followCounts } from "@/data/social";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { loadProfile } from "../../u/[username]/profile";

/** The inviter, when the link names a public member (official accounts don't invite). */
async function inviter(raw: string) {
  const loaded = await loadProfile(raw);
  if (!loaded || loaded.profile.isPrivate || loaded.profile.official) return null;
  return loaded;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/join/[username]">): Promise<Metadata> {
  const { locale: raw, username } = await params;
  const t = await getTranslations({ locale: raw as Locale, namespace: "Join" });
  const found = await inviter(username);
  const name = found && !found.profile.isPrivate ? (found.profile.displayName ?? found.profile.username) : null;
  const title = name ? t("metaTitle", { name }) : t("unknownTitle");
  return {
    title: `${title} · Mystonie`,
    description: t("metaDescription"),
    robots: { index: false, follow: false },
    openGraph: { title, description: t("metaDescription"), siteName: "Mystonie" },
  };
}

/**
 * An invite link (ADR 0098): `/join/<username>`. A visitor sees who invited them and signs up; this device remembers
 * the invite, and once the new account is signed in the two follow each other (`InviteAccept`). Signed in, it offers a
 * Follow instead, or, on your own link, the link to share.
 */
export default async function JoinPage({ params }: PageProps<"/[locale]/join/[username]">) {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const [found, t] = await Promise.all([inviter(username), getTranslations("Join")]);
  const { data } = found ? await found.db.auth.getClaims() : { data: null };
  const viewerId = data?.claims.sub ?? null;

  if (!found || found.profile.isPrivate) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 pt-16 pb-16 text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-balance">{t("unknownTitle")}</h1>
        <p className="text-muted-foreground">{t("unknownBody")}</p>
        {!viewerId && (
          <Link href="/auth" className="flex h-12 items-center rounded-full bg-brand px-6 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press">
            {t("cta")}
          </Link>
        )}
      </main>
    );
  }

  const { profile, db } = found;
  const name = profile.displayName ?? profile.username;
  const own = viewerId === profile.id;
  const counts = viewerId && !own ? await followCounts(db, profile.id).catch(() => null) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-5 px-4 pt-12 pb-16 text-center">
      {/* Their photo, taped in like the album's cover. */}
      <div className="relative rotate-[-4deg] rounded-md bg-card p-2 pb-5 shadow-md ring-1 ring-border">
        <span aria-hidden="true" className="absolute -top-2.5 left-1/2 h-5 w-14 -translate-x-1/2 rotate-[3deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/15 dark:bg-brand/30" />
        <Avatar name={name} url={profile.avatarUrl} className="size-24 rounded-sm text-4xl" />
      </div>
      {own ? (
        <>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-balance">{t("ownTitle")}</h1>
          <p className="text-muted-foreground">{t("ownBody")}</p>
          <div className="w-full text-left">
            <InviteCard username={profile.username} place="join" />
          </div>
        </>
      ) : viewerId ? (
        <>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-balance">{t("signedInTitle")}</h1>
          <p className="text-muted-foreground">{t("signedInBody", { name })}</p>
          <FollowButton userId={profile.id} following={counts?.iFollow ?? false} via="join" />
        </>
      ) : (
        <>
          <p className="-mb-3 font-hand text-2xl text-muted-foreground">{t("kicker")}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-balance">{t("title", { name })}</h1>
          <p className="text-muted-foreground">{t("body", { name })}</p>
          <Link
            href={{ pathname: "/auth", query: { next: localizedPath("/home", locale, routing.defaultLocale) } }}
            className="flex h-12 items-center rounded-full bg-brand px-6 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
          >
            {t("cta")}
          </Link>
          <RememberInvite username={profile.username} />
        </>
      )}
      <Link href={`/u/${profile.username}`} className="flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
        {t("seeAlbum", { name })}
      </Link>
    </main>
  );
}
