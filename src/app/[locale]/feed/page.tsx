import { ClapperboardIcon, FlagIcon, LogInIcon, ShieldIcon, TrophyIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { DividerTabs } from "@/components/divider-tabs";
import { ArticleRow } from "@/components/journal/article-row";
import { Avatar } from "@/components/social/avatar";
import { FeedList } from "@/components/social/feed-list";
import { FeedNewsSeen } from "@/components/social/feed-news";
import { PageTransition } from "@/components/motion/page-transition";
import { SwipeArea } from "@/components/motion/swipe-area";
import { FollowButton } from "@/components/social/follow-button";
import { localizedPath } from "@/core/auth";
import { FEED_ARTICLES, feedTabs, pickFeedTab, type FeedArticle, type FeedTab } from "@/core/journal-feed";
import { nextFeedCursor } from "@/core/social";
import { journalFeed } from "@/data/journal-feed";
import { followingFeed, myActivity } from "@/data/social";
import { userClient } from "@/data/supabase-server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const ACTIVITY = 8;
const TAB_NAMES = { following: "tabFollowing", articles: "tabArticles", saved: "tabSaved" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Social");
  // Public since the Journal moved in (ADR 0062): visitors and search engines get the articles.
  return { title: `${t("feedTitle")} · Mystonie`, description: t("feedDescription"), alternates: { canonical: "/feed" } };
}

/**
 * The feed (S3 social), the nav island's Feed (ADR 0053), with the Journal in it (ADR 0062). Tabs as links (`?tab=`):
 * **Following**, the default, is what the people you follow finished and your own finishes, newest first, each with a
 * Stamp, with the Journal's newest articles among them by date (ADR 0052), under the latest Stamps on your finishes
 * and new followers ("Follow back"); **Articles** is every article, For you first (articles about the titles in your
 * collection, saying why); **Saved** shows once you saved one. Above them, the community pages. Visitors get the
 * articles, newest first, and a way to sign in. Opening it clears the Feed tab's dot (ADR 0054).
 */
export default async function FeedPage({ params, searchParams }: PageProps<"/[locale]/feed">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const asked = (await searchParams).tab;
  const self = localizedPath("/feed", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub ?? null;
  // The tab asked for, so only what it shows is read; Saved is checked once the reader's Saves are known.
  const wanted: FeedTab = !userId ? "articles" : asked === "articles" || asked === "saved" ? asked : "following";
  const following = !!supabase && !!userId && wanted === "following";

  const [items, activity, journal, t, format] = await Promise.all([
    following ? followingFeed(supabase, userId, null) : [],
    following
      ? myActivity(supabase, ACTIVITY).catch((error: unknown) => {
          console.error(error);
          return [];
        })
      : [],
    following
      ? journalFeed(locale, { db: supabase, viewerId: userId, forYou: "reasons", limit: FEED_ARTICLES }).catch((error: unknown) => {
          console.error(error);
          return null;
        })
      : journalFeed(locale, { db: supabase, viewerId: userId, forYou: wanted === "articles" && userId ? "rank" : false }),
    getTranslations("Social"),
    getFormatter(),
  ]);

  const tabs = feedTabs({ signedIn: !!userId, saved: journal?.saved.length ?? 0 });
  const tab = pickFeedTab(wanted, tabs);
  // Saved asked for with nothing saved (the last one just went): the default tab, whose data wasn't read.
  if (tab !== wanted) return redirect({ href: "/feed", locale });
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const friends = items.some((i) => !i.mine);
  const href = (value: FeedTab) => (value === tabs[0] ? "/feed" : { pathname: "/feed", query: { tab: value } });
  // Swiping sideways opens the tab next to this one (ADR 0070).
  const at = tabs.indexOf(tab);
  const swipeTo = (value: FeedTab | undefined) => (value === undefined ? null : value === tabs[0] ? "/feed" : `/feed?tab=${value}`);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      {/* Opening the feed clears the Feed tab's dot (ADR 0054). */}
      {userId && <FeedNewsSeen user={userId} now={new Date(now).toISOString()} />}
      <header className="flex flex-col gap-1">
        <p className="font-hand text-2xl leading-none text-muted-foreground">{userId ? t("feedKicker") : t("feedVisitorKicker")}</p>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("feedTitle")}</h1>
        {!userId && <p className="mt-1 text-muted-foreground">{t("feedVisitorIntro")}</p>}
      </header>

      {userId ? (
        // The community pages, as tabs stuck along the album's edge: one row to swipe on a phone.
        <nav aria-label={t("communityLabel")} className="-mx-4 -mt-5 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:flex-wrap">
          {[
            { href: "/board", icon: TrophyIcon, label: t("toBoard") },
            { href: "/challenges", icon: FlagIcon, label: t("toChallenges") },
            { href: "/clubs", icon: ShieldIcon, label: t("toClubs") },
            { href: "/reel", icon: ClapperboardIcon, label: t("toReel") },
            { href: "/people", icon: UsersIcon, label: t("findPeople") },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-semibold whitespace-nowrap text-brand shadow-sm ring-1 ring-border hover:bg-muted"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      ) : (
        <Link
          href={{ pathname: "/auth", query: { next: self } }}
          className="-mt-4 flex h-12 items-center gap-2 self-start rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
        >
          <LogInIcon className="size-5" aria-hidden="true" />
          {t("feedSignIn")}
        </Link>
      )}

      <div className="flex flex-col gap-6">
        {tabs.length > 1 && (
          <DividerTabs
            label={t("feedTabsLabel")}
            tabs={tabs.map((value) => ({ value, href: href(value), name: t(TAB_NAMES[value]) }))}
            current={tab}
          />
        )}

        <SwipeArea prev={swipeTo(tabs[at - 1])} next={swipeTo(tabs[at + 1])}>
          {/* A tab's content slides in from its side (ADR 0070). */}
          <PageTransition key={tab}>
            <div className="flex flex-col gap-6">
              {tab === "following" ? (
                <>
                  {activity.length > 0 && (
                    <section aria-labelledby="activity" className="flex flex-col gap-2 rounded-2xl bg-brand-soft/60 p-4 dark:bg-brand/10">
                      <h2 id="activity" className="font-display text-lg font-extrabold">
                        {t("activityTitle")}
                      </h2>
                      <ul className="flex flex-col divide-y divide-dashed divide-brand/20">
                        {activity.map((a) => {
                          const name = a.user.displayName || a.user.username;
                          return (
                            <li key={`${a.kind}-${a.user.id}-${a.at}`} className="flex items-center gap-3 py-2">
                              <Link href={`/u/${a.user.username}`} className="shrink-0">
                                <Avatar name={name} url={a.user.avatarUrl} className="size-9" />
                              </Link>
                              <p className="min-w-0 flex-1 text-sm">
                                {t.rich(a.kind === "stamp" ? "activityStamp" : "activityFollow", {
                                  name,
                                  title: a.titleName ?? "",
                                  b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
                                })}
                                <span className="block text-xs text-muted-foreground">{format.relativeTime(new Date(a.at), now)}</span>
                              </p>
                              {a.kind === "follow" && !a.iFollow && <FollowButton userId={a.user.id} following={false} via="activity" />}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {!friends && (
                    <section className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-8 text-center">
                      <p className="font-hand text-2xl text-muted-foreground">{t("feedEmpty")}</p>
                      <Link
                        href="/people"
                        className="flex h-12 items-center gap-2 rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
                      >
                        <UsersIcon className="size-5" aria-hidden="true" />
                        {t("findPeople")}
                      </Link>
                    </section>
                  )}

                  {(items.length > 0 || (journal?.articles.length ?? 0) > 0) && (
                    <FeedList items={items} next={nextFeedCursor(items)} now={now} articles={journal?.articles} />
                  )}
                </>
              ) : (
                journal && <Articles tab={tab} feed={journal} now={now} signInNext={userId ? undefined : self} />
              )}
            </div>
          </PageTransition>
        </SwipeArea>
      </div>
    </main>
  );
}

/** The Articles and Saved tabs: the Journal's articles as rows (ADR 0052), For you first when signed in. */
async function Articles({
  tab,
  feed,
  now,
  signInNext,
}: {
  tab: Exclude<FeedTab, "following">;
  feed: Awaited<ReturnType<typeof journalFeed>>;
  now: number;
  signInNext?: string;
}) {
  const t = await getTranslations("Journal");
  const bySlug = new Map(feed.articles.map((a) => [a.slug, a]));
  const pick = (slugs: readonly string[]) => slugs.flatMap((slug) => bySlug.get(slug) ?? []);
  const rows: FeedArticle[] = tab === "saved" ? pick(feed.saved) : feed.forYou ? pick(feed.forYou) : feed.articles;

  return (
    <>
      {tab === "articles" && feed.forYou && !feed.personal && rows.length > 0 && (
        <p className="-mt-2 text-sm text-muted-foreground">{t("forYouHint")}</p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center font-hand text-2xl text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="stagger -mt-4 flex flex-col divide-y-2 divide-dashed divide-border">
          {rows.map((a, i) => (
            <li key={a.slug}>
              <ArticleRow article={a} place="feed" now={now} index={i} signInNext={signInNext} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
