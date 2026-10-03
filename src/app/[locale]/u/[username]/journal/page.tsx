import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArticleRow } from "@/components/journal/article-row";
import { FreshPage } from "@/components/motion/fresh-page";
import { SwipeArea } from "@/components/motion/swipe-area";
import { AlbumCover } from "@/components/profile/album-cover";
import { ProfileTabs } from "@/components/profile/me-tabs";
import { profileTabHref, profileTabs } from "@/lib/profile-tabs";
import { STATS_SECTIONS } from "@/core/album";
import { localizedPath } from "@/core/auth";
import type { FeedArticle } from "@/core/journal-feed";
import { subjectKinds } from "@/core/journal-posts";
import { journalStampCounts, myJournalMarks } from "@/data/journal-feed";
import { postsBy, subjectCards } from "@/data/journal-posts";
import { followCounts } from "@/data/social";
import { routing } from "@/i18n/routing";
import { ClosedProfile, loadProfile } from "../profile";

export async function generateMetadata({ params }: PageProps<"/[locale]/u/[username]/journal">): Promise<Metadata> {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  const loaded = await loadProfile(username);
  if (!loaded) return { robots: { index: false } };
  const { profile } = loaded;
  const t = await getTranslations({ locale, namespace: "Profile" });
  if (profile.isPrivate) return { title: `${t("privateTitle")} · Mystonie`, robots: { index: false, follow: false } };
  return {
    title: `${t("journalMetaTitle", { name: profile.displayName ?? `@${profile.username}` })} · Mystonie`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/u/${profile.username}/journal` },
  };
}

/**
 * Someone's Journal tab (ADR 0092), next to their album and stats: the articles they published, newest first, as the
 * Journal's rows (with Stamp, Save and Share). Featured ones carry the stamp.
 */
export default async function ProfileJournalPage({ params }: PageProps<"/[locale]/u/[username]/journal">) {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const loaded = await loadProfile(username);
  if (!loaded) notFound();
  const { db, profile } = loaded;
  const { data: auth } = await db.auth.getClaims();
  const viewerId = auth?.claims.sub ?? null;
  if (profile.isPrivate) return <ClosedProfile db={db} profile={profile} viewerId={viewerId} />;

  const isOwner = viewerId === profile.id;
  const self = localizedPath(`/u/${profile.username}/journal`, locale, routing.defaultLocale);
  const [posts, counts, stamps, marks, t] = await Promise.all([
    postsBy(db, profile.id),
    followCounts(db, profile.id).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    journalStampCounts(db).catch(() => new Map<string, number>()),
    viewerId ? myJournalMarks(db, viewerId).catch(() => null) : null,
    getTranslations("Profile"),
  ]);
  const tabs = profileTabs({ stats: profile.statsHidden.length < STATS_SECTIONS.length, journal: true });
  const prev = tabs[tabs.indexOf("journal") - 1]!;
  // A picture per row: the first title's poster (from the catalog cache), else a place's stamp.
  const firstTitles = await subjectCards(
    db,
    posts.flatMap((p) => p.subjects.filter((s) => s.kind !== "place").slice(0, 1)),
    locale,
  );
  const poster = new Map(firstTitles.flatMap((c) => (c.kind === "place" ? [] : [[`${c.kind}:${c.externalId}`, c.posterUrl] as const])));
  const rows: FeedArticle[] = posts.map((p) => {
    const title = p.subjects.find((s) => s.kind !== "place");
    const place = p.subjects.find((s) => s.kind === "place");
    return {
      slug: p.id,
      locale: p.locale,
      title: p.title,
      description: p.summary ?? "",
      date: (p.publishedAt ?? p.updatedAt).slice(0, 10),
      minutes: p.minutes,
      author: profile.displayName ?? profile.username,
      avatar: profile.avatarUrl,
      profile: profile.username,
      image: title && "externalId" in title ? (poster.get(`${title.kind}:${title.externalId}`) ?? null) : null,
      featured: p.state === "featured",
      draft: false,
      stamps: stamps.get(p.id) ?? 0,
      stamped: marks?.stamped.has(p.id) ?? false,
      saved: marks?.saved.has(p.id) ?? false,
      reason: null,
      tags: p.tags,
      kinds: subjectKinds(p.subjects),
      publishedAt: p.publishedAt,
      place: !title && place?.kind === "place" ? place.country : null,
      spoilers: p.spoilers,
    };
  });
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <FreshPage />
      <AlbumCover
        profile={profile}
        owner={isOwner}
        counts={counts}
        follow={isOwner ? undefined : { signedIn: !!viewerId, next: self }}
      />
      <ProfileTabs username={profile.username} current="journal" tabs={tabs} />
      <SwipeArea prev={profileTabHref(profile.username, prev)} replace className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center font-hand text-2xl text-muted-foreground">
            {t("journalEmpty", { username: profile.username })}
          </p>
        ) : (
          <ol className="stagger -mt-4 flex flex-col divide-y-2 divide-dashed divide-border">
            {rows.map((a, i) => (
              <li key={a.slug}>
                <ArticleRow article={a} place="profile" now={now} index={i} signInNext={viewerId ? undefined : self} />
              </li>
            ))}
          </ol>
        )}
      </SwipeArea>
    </main>
  );
}
