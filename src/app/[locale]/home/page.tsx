import { FreshPage } from "@/components/motion/fresh-page";
import { FlameIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RememberTitles } from "@/components/offline/recent-titles";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PushPrompt } from "@/components/pwa/push";
import { RecapNote } from "@/components/recap-note";
import { UpNext, type UpNextSeries } from "@/components/series/up-next";
import { SharedCardImage, SignupFromCard } from "@/components/shared-card";
import { ChallengeNote, type NoteChallenge } from "@/components/challenges/challenge-note";
import { ReelNote } from "@/components/reel/reel-note";
import { BoardNote } from "@/components/social/board-note";
import { CommunityLinks } from "@/components/social/community-links";
import { FriendsFinished } from "@/components/social/friends-finished";
import { QuoteOfTheDay } from "@/components/quote-of-the-day";
import { QuizNote } from "@/components/warnings/quiz-note";
import { localizedPath } from "@/core/auth";
import { currentMonth, isChallengeSlug, monthChallenges } from "@/core/challenges";
import { quizStanding } from "@/core/quiz-standing";
import { MOVIE_QUOTES } from "@/core/quotes";
import { reelDay, reelNumber } from "@/core/reel";
import { localDateKey, safeTimeZone } from "@/core/stats/period";
import { reviewSeasonYear } from "@/core/stats/year-review";
import { blendTrending, type TrendingTitle } from "@/core/trending";
import { quizHelps } from "@/data/badges";
import { friendBoard } from "@/data/board";
import { recentCards } from "@/data/cards";
import { userJoins, type ChallengeJoin } from "@/data/challenges";
import { followingFeed } from "@/data/social";
import { listCollection } from "@/data/entries";
import { cachedEpisodes, episodeLogs } from "@/data/episodes";
import { pushConfig } from "@/data/push";
import { reelPlay } from "@/data/reel";
import { latestRecap } from "@/data/recaps";
import { userClient, type UserClient } from "@/data/supabase-server";
import { trendingTitles } from "@/data/tmdb";
import { ownTrending } from "@/data/trending";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import { Reveal } from "@/components/motion/reveal";

const RECENT_CARDS = 6;
const TRENDING = 9;
/** Friends' finishes on Home, picked from the first feed items (which include the viewer's own). */
const FRIENDS = 3;
const FRIENDS_LOOKAHEAD = 12;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomeApp");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

/**
 * Trending never blocks Home: what people on Mystonie finished this week first (S3 finishers & the board), then
 * TMDB's weekly list. No token, or TMDB down, leaves our own; nothing at all hides the section.
 */
async function loadTrending(db: UserClient): Promise<TrendingTitle[]> {
  const [own, world] = await Promise.all([
    ownTrending(db),
    trendingTitles().then(
      (list) => list.filter((r) => r.kind === "movie" || r.kind === "series"),
      (error: unknown) => {
        console.warn(`Trending unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      },
    ),
  ]);
  return blendTrending(own, world, TRENDING);
}

/**
 * Home (signed-in landing, S1 collection): the Year in Review note (December and January, ADR 0031), the latest
 * recap's note, the next episode of every series being watched,
 * the user's recent cards and what's trending (one tap into quick add). Stage 3 adds friends' finishes, the board,
 * this month's challenges and the warnings quiz, and under the greeting the community pages (ADR 0078). Also offers
 * installing the app and, once
 * installed, recap notifications (ADR 0028). (The getting-started checklist floats over every page, ADR 0056.) It also
 * tells the nav island whether something about you happened since you last opened the feed (ADR 0054).
 */
export default async function HomePage({ params }: PageProps<"/[locale]/home">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const self = localizedPath("/home", locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [{ data: profile }, items, cards, recap, trending, feed, t, format] = await Promise.all([
    supabase.from("profiles").select("time_zone, username, display_name, avatar_url, created_at").eq("id", userId).single(),
    listCollection(supabase, userId),
    recentCards(supabase, userId, RECENT_CARDS).catch((error: unknown) => {
      console.error(error);
      return [];
    }),
    latestRecap(supabase, userId).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    loadTrending(supabase),
    followingFeed(supabase, userId, null, FRIENDS_LOOKAHEAD).catch((error: unknown) => {
      console.error(error);
      return [];
    }),
    getTranslations("HomeApp"),
    getFormatter(),
  ]);

  // "Up next": series being watched whose episodes are cached (quick add caches them after adding).
  const watching = items.filter((i) => i.status === "watching" && i.title.kind === "series" && i.title.id);
  const ids = watching.map((i) => i.title.id!);
  const timeZone = profile?.time_zone ?? "UTC";
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const viewer = { id: userId, username: profile?.username ?? "", displayName: profile?.display_name ?? null, avatarUrl: profile?.avatar_url ?? null };
  const month = currentMonth(now, timeZone);
  const today = reelDay(now);
  // A random movie line each time Home opens (ADR 0093).
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const firstQuote = Math.floor(Math.random() * MOVIE_QUOTES.length);
  const finishedSomething = items.some((i) => i.status === "finished");
  const [episodes, logs, board, joins, reel, helps] = await Promise.all([
    cachedEpisodes(supabase, ids),
    episodeLogs(supabase, userId, ids),
    friendBoard(supabase, viewer, "week", timeZone, now).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    userJoins(supabase, userId, month).catch((error: unknown): ChallengeJoin[] => {
      console.error(error);
      return [];
    }),
    // Reel of the Day (stage 4): today's play, if any.
    reelPlay(supabase, userId, today).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    // The quiz note's streak and next sticker (ADR 0094).
    finishedSomething
      ? quizHelps(supabase, userId).catch((error: unknown) => {
          console.error(error);
          return null;
        })
      : null,
  ]);
  // This month's challenges: progress as the last save recorded it (S3 challenges & clubs).
  const challenges: NoteChallenge[] = monthChallenges(month).flatMap(({ slug, rule }) => {
    if (!isChallengeSlug(slug)) return [];
    const join = joins.find((j) => j.slug === slug);
    return [{ slug, target: rule.target, value: join?.progress ?? 0, joined: !!join, completed: !!join?.completedAt }];
  });
  const upNext: UpNextSeries[] = watching.map((i) => ({
    externalId: i.title.externalId,
    name: i.title.name,
    posterUrl: i.title.posterUrl,
    episodes: episodes.get(i.title.id!) ?? [],
    logs: logs.get(i.title.id!) ?? [],
  }));
  // Sign-in lands here: an account made in the last few minutes is a sign-up (signup_from_card).
  const newAccount = !!profile && now - Date.parse(profile.created_at) < 15 * 60 * 1000;
  const name = profile?.display_name || profile?.username || "";
  // Year in Review: this year in December, last year in January, once something was finished in it.
  const reviewYear = reviewSeasonYear(now, timeZone);
  const hasReview =
    reviewYear !== null && items.some((i) => i.finishedAt && localDateKey(Date.parse(i.finishedAt), safeTimeZone(timeZone)).startsWith(`${reviewYear}-`));
  const friends = feed.filter((i) => !i.mine).slice(0, FRIENDS);
  const publicKey = pushConfig()?.publicKey;
  const host = siteUrl().host;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <FreshPage />
      <SignupFromCard newAccount={newAccount} />
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">
          {format.dateTime(now, { weekday: "long", month: "long", day: "numeric", timeZone })}
        </p>
        <QuoteOfTheDay first={firstQuote} greeting={name ? t("greeting", { name }) : t("title")} longName={[...name].length > 12} />
      </header>
      <CommunityLinks />

      <InstallPrompt />
      {publicKey && <PushPrompt publicKey={publicKey} />}
      {hasReview && (
        <Link
          href={`/review/${reviewYear}`}
          className="group relative flex rotate-[0.6deg] flex-col gap-1 rounded-2xl bg-card p-5 pt-6 shadow-md ring-1 ring-border hover:ring-brand/50"
        >
          <span aria-hidden="true" className="absolute -top-3 left-10 h-6 w-20 -rotate-3 rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10" />
          <span className="font-display text-5xl leading-none font-extrabold tracking-[-0.04em] tabular-nums">{reviewYear}</span>
          <span className="font-hand text-2xl leading-tight">{t("reviewTitle", { year: reviewYear })}</span>
          <span className="text-sm text-muted-foreground">{t("reviewBody")}</span>
          <span className="mt-2 inline-flex h-11 items-center self-start rounded-full bg-brand px-4 font-semibold text-brand-foreground group-hover:bg-brand/90 press">
            {t("reviewCta")}
          </span>
        </Link>
      )}
      {recap && <RecapNote recap={recap} />}
      <UpNext userId={userId} series={upNext} timeZone={timeZone} />
      <FriendsFinished items={friends} now={now} />
      {board && board.following > 0 && <BoardNote rows={board.rows} />}
      <ChallengeNote month={month} challenges={challenges} />
      <ReelNote number={reelNumber(today)} play={reel && { guesses: reel.guesses.length, solved: reel.solved, finished: reel.finished }} />
      {/* The warnings quiz asks about finished titles (S3 warnings & quiz). */}
      {finishedSomething && <QuizNote standing={helps ? quizStanding(helps, timeZone, now) : null} />}

      <section aria-labelledby="recent-cards" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="recent-cards" className="font-display text-xl font-extrabold">
            {t("recentCards")}
          </h2>
          {/* Every card is on Me's Cards tab (ADR 0076). */}
          {cards.length > 0 && (
            <Link href="/me/cards" className="flex min-h-11 items-center text-sm font-semibold text-brand">
              {t("seeAllCards")}
            </Link>
          )}
        </div>
        {cards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-8 text-center">
            <p className="font-hand text-2xl text-muted-foreground">{t("recentCardsEmpty")}</p>
            <Link
              href={{ pathname: "/collection", query: { add: "1" } }}
              className="flex h-12 items-center rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
            >
              {t("addFirst")}
            </Link>
          </div>
        ) : (
          // A strip of cards pasted in slightly crooked; swipe sideways on a phone.
          <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-1 pb-3">
            {cards.map((card, i) => {
              const image = (
                <SharedCardImage
                  imageUrl={card.imageUrl}
                  alt={t("cardAlt", { name: card.data.reel ? t("reelCard", { number: card.data.reel.number }) : card.data.atlas?.regions ? t("atlasRegionsCard", { country: card.data.name }) : card.data.atlas ? t("atlasCard", { count: card.data.atlas.countries.length }) : card.data.milestone ? t("milestoneCard") : card.data.recap?.highlights ? t("yearCard") : card.data.recap ? t("recapCard") : card.data.name })}
                  templateId={card.templateId}
                  size={card.size}
                  data={card.data}
                  host={host}
                />
              );
              return (
                // Dealt in each time they're shown, sideways too (ADR 0080).
                <Reveal
                  as="li"
                  key={card.id}
                  className={`deal w-[40%] shrink-0 snap-start sm:w-[30%] ${i % 2 ? "rotate-[1.2deg]" : "rotate-[-1.2deg]"}`}
                  style={{ ["--grow-delay" as string]: `${Math.min(i, 3) * 80}ms` }}
                >
                  {card.sharedAt ? (
                    <Link href={`/c/${card.id}`} className="block rounded-lg shadow-md transition-transform hover:-translate-y-0.5">
                      {image}
                    </Link>
                  ) : (
                    <div className="rounded-lg shadow-md">{image}</div>
                  )}
                </Reveal>
              );
            })}
          </ul>
        )}
      </section>

      {trending.length > 0 && (
        <section aria-labelledby="trending" className="flex flex-col gap-3">
          <div>
            <h2 id="trending" className="font-display text-xl font-extrabold">
              {t("trending")}
            </h2>
            <p className="text-sm text-muted-foreground">{trending.some((r) => r.people) ? t("trendingOwnHint") : t("trendingHint")}</p>
          </div>
          {/* Offline, quick add offers titles seen lately: trending ones count, after the ones the user opened. */}
          <RememberTitles titles={trending} later />
          <ul className="grid grid-cols-3 gap-x-3 gap-y-4">
            {trending.map((r, i) => (
              <li key={`${r.kind}-${r.externalId}`} className={i % 2 ? "rotate-[1deg]" : "rotate-[-1deg]"}>
                {/* Straight to the status step of quick add: two taps to a finished title. */}
                <Link
                  href={{ pathname: "/collection", query: { add: "1", pick: `${r.kind}:${r.externalId}` } }}
                  aria-label={r.people ? t("addTrendingTitle", { name: r.name, count: r.people }) : t("addTitle", { name: r.name })}
                  className="group block"
                >
                  <span className="relative block aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5">
                    {r.imageUrl && <Image src={r.imageUrl} alt="" fill unoptimized sizes="120px" className="object-cover" />}
                    {r.people && (
                      // Trending on Mystonie: how many people were on it this week, as a little inked tag.
                      <span
                        title={t("trendingPeople", { count: r.people })}
                        className="absolute bottom-1.5 left-1.5 flex -rotate-3 items-center gap-1 rounded-full bg-card/95 px-2 py-0.5 text-xs font-bold text-brand shadow-sm ring-1 ring-brand/30"
                      >
                        <FlameIcon className="size-3.5" aria-hidden="true" />
                        {format.number(r.people)}
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 line-clamp-2 text-xs font-medium">{r.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
