import { FreshPage } from "@/components/motion/fresh-page";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import { StickerAlbum } from "@/components/badges/sticker-album";
import { PageTransition } from "@/components/motion/page-transition";
import { SwipeArea } from "@/components/motion/swipe-area";
import { PaperCard } from "@/components/paper-card";
import { AlbumCover } from "@/components/profile/album-cover";
import { MeTabs } from "@/components/profile/me-tabs";
import { MilestoneShelf } from "@/components/stats/milestone-shelf";
import { ShareStats } from "@/components/stats/share-stats";
import { Favourites, Headline, Heatmap, MonthBars, PeriodTabs, Records, StatsEmpty, Taste } from "@/components/stats/stats-view";
import { StatsPart, StatsVisibility } from "@/components/stats/stats-visibility";
import { STATS_SECTIONS, statsHidden, type StatsSection } from "@/core/album";
import { localizedPath } from "@/core/auth";
import { STATS_PERIODS, type StatsPeriod } from "@/core/cards/types";
import { CREDIT_ROLES } from "@/core/catalog/credits";
import { milestoneCardData, reachedMilestones } from "@/core/stats/milestones";
import { weekStartFor } from "@/core/stats/period";
import { statsReport } from "@/core/stats/report";
import { currentYear } from "@/core/stats/year-review";
import { badgeAlbum } from "@/data/badges";
import { followCounts } from "@/data/social";
import { statsRows } from "@/data/stats";
import { userClient } from "@/data/supabase-server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Stats");
  return { title: `${t("title")} · Mystonie`, robots: { index: false, follow: false } };
}

const isPeriod = (value: unknown): value is StatsPeriod => (STATS_PERIODS as readonly unknown[]).includes(value);

/**
 * The signed-in user's stats (S1 stats), Me's Stats tab under the album's cover (ADR 0053): big numbers first, then the
 * heatmap, months, taste and records for `?period=` (this month by default), in the user's time zone. Everything is
 * computed by `statsReport`. Visitors see them on the profile's Stats tab (ADR 0077); while the profile is public, each
 * part has an eye that keeps it from them.
 */
export default async function StatsPage({ params, searchParams }: PageProps<"/[locale]/stats">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const query = await searchParams;
  const period: StatsPeriod = isPeriod(query.period) ? query.period : "month";
  const self = localizedPath(period === "month" ? "/stats" : `/stats?period=${period}`, locale, routing.defaultLocale);

  const supabase = await userClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const userId = data?.claims.sub;
  if (!supabase || !userId) return redirect({ href: { pathname: "/auth", query: { next: self } }, locale });

  const [{ data: profile, error }, rows, counts, t, tb] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, bio, avatar_url, created_at, time_zone, visibility, stats_hidden").eq("id", userId).single(),
    statsRows(supabase, userId),
    followCounts(supabase, userId).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    getTranslations("Stats"),
    getTranslations("Badges"),
  ]);
  if (error) throw new Error(`profile read failed: ${error.message}`);
  const empty = rows.entries.length === 0 && rows.logs.length === 0 && rows.reads.length === 0;
  const timeZone = profile.time_zone;
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const report = statsReport(
    rows.titles,
    rows.entries,
    rows.logs,
    {
      period,
      timeZone,
      weekStart: weekStartFor(locale),
      now,
    },
    rows.reads,
  );
  // Every milestone reached (all time, whatever the period), newest first, each ready to be a card.
  const titleById = new Map(rows.titles.map((title) => [title.id, title]));
  const milestones = reachedMilestones(rows.titles, rows.entries, rows.logs)
    .reverse()
    .map((m) => milestoneCardData(m, titleById.get(m.titleId)!, timeZone));
  const year = currentYear(now, timeZone);
  const host = siteUrl().host;
  // Stickers come from more than finishes (the Reel of the Day, challenges, the quiz, support; ADR 0063), so an empty
  // collection can have some: then the album shows under the empty state.
  const badges = await badgeAlbum(supabase, userId, rows, timeZone, now).catch((error: unknown) => {
    console.error(error);
    return [];
  });
  const earned = badges.filter((b) => b.earnedAt !== null).length;
  const album = (empty ? earned > 0 : badges.length > 0) && (
    <PaperCard id="stickers" className="flex scroll-mt-6 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">{tb("album")}</h2>
        <p className="font-hand text-xl leading-none text-muted-foreground">{tb("albumCount", { count: earned, total: badges.length })}</p>
      </div>
      <p className="text-sm text-muted-foreground">{tb("albumHint")}</p>
      <StickerAlbum badges={badges} />
    </PaperCard>
  );

  // Each part by name, in STATS_SECTIONS' order; a part with nothing to show is null.
  const parts: Record<StatsSection, ReactNode> = {
    numbers: (
      <Headline report={report} period={period}>
        {report.card && <ShareStats card={report.card} username={profile.username} host={host} />}
      </Headline>
    ),
    activity: <Heatmap report={report} />,
    months: <MonthBars months={report.months} />,
    taste: <Taste report={report} />,
    favourites: CREDIT_ROLES.some((role) => report.people[role].length > 0) && <Favourites report={report} />,
    records: <Records report={report} />,
    milestones: <MilestoneShelf milestones={milestones} username={profile.username} host={host} />,
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <FreshPage />
      <AlbumCover
        profile={{
          id: profile.id,
          username: profile.username,
          displayName: profile.display_name,
          bio: profile.bio,
          avatarUrl: profile.avatar_url,
          joinedAt: profile.created_at,
        }}
        owner
        counts={counts}
      />
      <MeTabs current="stats" />
      {/* Swiping right goes back to the Album, the tab before (ADR 0070). */}
      <SwipeArea prev="/me" next="/me/cards" className="flex flex-col gap-8">
        {empty ? (
          <>
            <StatsEmpty />
            {album}
          </>
        ) : (
          <StatsParts hidden={profile.visibility === "public" ? statsHidden(profile.stats_hidden) : null}>
            <PeriodTabs period={period} />
            {profile.visibility === "public" && (
              <p className="-mt-4 text-sm text-muted-foreground">
                {t("visibilityHint")}{" "}
                <Link href={`/u/${profile.username}/stats`} className="font-semibold text-brand underline underline-offset-4">
                  {t("visibilitySee")}
                </Link>
              </p>
            )}
            {/* Another period slides in from its side (ADR 0070). */}
            <PageTransition key={period}>
              <div className="flex flex-col gap-8">
                {STATS_SECTIONS.filter((section) => parts[section]).map((section) => (
                  <Fragment key={section}>
                    <StatsPart section={section}>{parts[section]}</StatsPart>
                    {section === "numbers" && period === "year" && (
                      <Link
                        href={`/review/${year}`}
                        className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-dashed border-brand/50 px-4 font-hand text-2xl text-brand hover:bg-brand-soft/50"
                      >
                        {t("yearReviewLink", { year })}
                      </Link>
                    )}
                  </Fragment>
                ))}
                {album}
              </div>
            </PageTransition>
          </StatsParts>
        )}
      </SwipeArea>
    </main>
  );
}

/** The eyes on each part while the profile is public (`hidden`, ADR 0077); private, the parts are just the page. */
function StatsParts({ hidden, children }: { hidden: StatsSection[] | null; children: ReactNode }) {
  return hidden ? <StatsVisibility hidden={hidden}>{children}</StatsVisibility> : <>{children}</>;
}
