import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StickerAlbum } from "@/components/badges/sticker-album";
import { PaperCard } from "@/components/paper-card";
import { MilestoneShelf } from "@/components/stats/milestone-shelf";
import { ShareStats } from "@/components/stats/share-stats";
import { Headline, Heatmap, MonthBars, PeriodTabs, Records, StatsEmpty, Taste } from "@/components/stats/stats-view";
import { localizedPath } from "@/core/auth";
import { STATS_PERIODS, type StatsPeriod } from "@/core/cards/types";
import { milestoneCardData, reachedMilestones } from "@/core/stats/milestones";
import { weekStartFor } from "@/core/stats/period";
import { statsReport } from "@/core/stats/report";
import { currentYear } from "@/core/stats/year-review";
import { badgeAlbum } from "@/data/badges";
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
 * The signed-in user's stats (S1 stats): big numbers first, then the heatmap, months, taste and records for
 * `?period=` (this month by default), in the user's time zone. Everything is computed by `statsReport`.
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

  const [{ data: profile }, rows, t, tb] = await Promise.all([
    supabase.from("profiles").select("time_zone, username").eq("id", userId).single(),
    statsRows(supabase, userId),
    getTranslations("Stats"),
    getTranslations("Badges"),
  ]);
  const empty = rows.entries.length === 0 && rows.logs.length === 0 && rows.reads.length === 0;
  const timeZone = profile?.time_zone ?? "UTC";
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
  const badges = empty
    ? []
    : await badgeAlbum(supabase, userId, rows, timeZone, now).catch((error: unknown) => {
        console.error(error);
        return [];
      });
  const earned = badges.filter((b) => b.earnedAt !== null).length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-10 pb-28">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="font-hand text-2xl leading-none text-muted-foreground">{t("subtitle")}</p>
      </header>
      {empty ? (
        <StatsEmpty />
      ) : (
        <>
          <PeriodTabs period={period} />
          <Headline report={report} period={period}>
            {report.card && <ShareStats card={report.card} username={profile?.username ?? null} host={host} />}
          </Headline>
          {period === "year" && (
            <Link
              href={`/review/${year}`}
              className="flex min-h-11 items-center justify-center rounded-2xl border-2 border-dashed border-brand/50 px-4 font-hand text-2xl text-brand hover:bg-brand-soft/50"
            >
              {t("yearReviewLink", { year })}
            </Link>
          )}
          <Heatmap report={report} />
          <MonthBars months={report.months} />
          <Taste report={report} />
          <Records report={report} />
          <MilestoneShelf milestones={milestones} username={profile?.username ?? null} host={host} />
          {badges.length > 0 && (
            <PaperCard id="stickers" className="flex scroll-mt-6 flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">{tb("album")}</h2>
                <p className="font-hand text-xl leading-none text-muted-foreground">{tb("albumCount", { count: earned, total: badges.length })}</p>
              </div>
              <p className="text-sm text-muted-foreground">{tb("albumHint")}</p>
              <StickerAlbum badges={badges} />
            </PaperCard>
          )}
        </>
      )}
    </main>
  );
}
