import { FlameIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ClubJoin } from "@/components/clubs/club-join";
import { ClubCrest } from "@/components/clubs/crest";
import { PaperCard } from "@/components/paper-card";
import { Avatar } from "@/components/social/avatar";
import { FeedList } from "@/components/social/feed-list";
import { localizedPath } from "@/core/auth";
import { findClub, isClubSlug } from "@/core/clubs";
import type { FeedItem } from "@/core/social";
import type { TrendingTitle } from "@/core/trending";
import { clubCounts, clubFeed, clubTrending, friendsInClub, userClubs } from "@/data/clubs";
import { myFollowing, type FollowedPerson } from "@/data/social";
import { userClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/clubs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isClubSlug(slug)) return {};
  const t = await getTranslations("Clubs");
  return { title: `${t(`items.${slug}.name`)} · Mystonie`, description: t(`items.${slug}.tagline`) };
}

const logged = <T,>(fallback: T) => (error: unknown) => {
  console.error(error);
  return fallback;
};

/**
 * A fandom club (S3 challenges & clubs): its crest, member count and Join; the people you follow who are in; what
 * members are on lately (from 3 members up); and the latest finishes of titles that fit the club, by members whose
 * collections are public, with Stamps. Signed-out visitors see it too and are asked to sign in to join.
 */
export default async function ClubPage({ params }: PageProps<"/[locale]/clubs/[slug]">) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const club = findClub(slug);
  if (!club || !isClubSlug(slug)) notFound();
  const self = localizedPath(`/clubs/${slug}`, locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub ?? null;
  const [counts, mine, following, feed, trending, t, format] = await Promise.all([
    supabase ? clubCounts(supabase).catch(logged(new Map<string, number>())) : new Map<string, number>(),
    supabase && userId ? userClubs(supabase, userId).catch(logged([])) : [],
    supabase && userId ? myFollowing(supabase).catch(logged([] as FollowedPerson[])) : ([] as FollowedPerson[]),
    supabase ? clubFeed(supabase, userId, club).catch(logged([] as FeedItem[])) : ([] as FeedItem[]),
    supabase ? clubTrending(supabase, club).catch(logged([] as TrendingTitle[])) : ([] as TrendingTitle[]),
    getTranslations("Clubs"),
    getFormatter(),
  ]);
  const friends = supabase && userId ? await friendsInClub(supabase, following, slug).catch(logged([] as FollowedPerson[])) : [];
  const member = (mine as string[]).includes(slug);
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <Link href="/clubs" className="flex min-h-11 items-center self-start text-sm font-semibold text-brand">
        {t("back")}
      </Link>

      <header className="relative flex flex-col items-center gap-3 rounded-3xl bg-card px-5 pt-8 pb-6 text-center shadow-md ring-1 ring-border">
        <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-[2deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
        <ClubCrest club={slug} size={88} className="rotate-[-5deg]" />
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em]">{t(`items.${slug}.name`)}</h1>
        <p className="font-hand text-xl leading-tight text-muted-foreground">{t(`items.${slug}.tagline`)}</p>
        <p className="text-sm font-semibold">{t("members", { count: counts.get(slug) ?? 0 })}</p>
        <ClubJoin club={slug} member={member} signedIn={!!userId} next={self} via="club" className="items-center" />
      </header>

      {friends.length > 0 && (
        <section aria-labelledby="club-friends" className="flex flex-col gap-2">
          <h2 id="club-friends" className="font-display text-lg font-extrabold">
            {t("friends")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {friends.map((p) => {
              const name = p.displayName || p.username;
              return (
                <li key={p.id}>
                  <Link href={`/u/${p.username}`} className="flex min-h-11 items-center gap-2 rounded-full bg-card py-1 pr-3 pl-1 text-sm shadow-sm ring-1 ring-border hover:bg-muted">
                    <Avatar name={name} url={p.avatarUrl} className="size-8 text-sm" />
                    <span className="max-w-[9rem] truncate font-medium">{name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {trending.length > 0 && (
        <PaperCard className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold">{t("trending")}</h2>
            <p className="text-sm text-muted-foreground">{t("trendingHint")}</p>
          </div>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-4">
            {trending.map((r, i) => (
              <li key={`${r.kind}-${r.externalId}`} className={i % 2 ? "rotate-[1deg]" : "rotate-[-1deg]"}>
                <Link href={`/title/${r.kind}/${r.externalId}`} className="group block">
                  <span className="relative block aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5">
                    {r.imageUrl && <Image src={r.imageUrl} alt="" fill unoptimized sizes="120px" className="object-cover" />}
                    <span className="absolute bottom-1.5 left-1.5 flex -rotate-3 items-center gap-1 rounded-full bg-card/95 px-2 py-0.5 text-xs font-bold text-brand shadow-sm ring-1 ring-brand/30">
                      <FlameIcon className="size-3.5" aria-hidden="true" />
                      {format.number(r.people ?? 0)}
                      <span className="sr-only">{t("trendingPeople", { count: r.people ?? 0 })}</span>
                    </span>
                  </span>
                  <span className="mt-1.5 line-clamp-2 text-xs font-medium">{r.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </PaperCard>
      )}

      <section aria-labelledby="club-feed" className="flex flex-col gap-4">
        <h2 id="club-feed" className="font-display text-xl font-extrabold">
          {t("feedTitle")}
        </h2>
        {feed.length > 0 ? (
          <FeedList items={feed} next={null} now={now} readOnly={!userId} />
        ) : (
          <p className="rounded-3xl border-2 border-dashed border-border px-6 py-8 text-center font-hand text-2xl text-muted-foreground">{t("feedEmpty")}</p>
        )}
      </section>

      <p className="text-sm text-muted-foreground">{t("hint")}</p>
    </main>
  );
}
