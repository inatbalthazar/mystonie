import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { FreshPage } from "@/components/motion/fresh-page";
import { PageTransition } from "@/components/motion/page-transition";
import { SwipeArea } from "@/components/motion/swipe-area";
import { PaperCard } from "@/components/paper-card";
import { AlbumCover } from "@/components/profile/album-cover";
import { ProfileTabs } from "@/components/profile/me-tabs";
import { profileTabs } from "@/lib/profile-tabs";
import { hasPosts } from "@/data/journal-posts";
import { MilestoneShelf } from "@/components/stats/milestone-shelf";
import { Favourites, Headline, Heatmap, MonthBars, PeriodTabs, Records, Taste } from "@/components/stats/stats-view";
import { STATS_SECTIONS, type StatsSection } from "@/core/album";
import { localizedPath } from "@/core/auth";
import { STATS_PERIODS, type StatsPeriod } from "@/core/cards/types";
import { CREDIT_ROLES } from "@/core/catalog/credits";
import { finishedInCommon } from "@/core/stats/in-common";
import { milestoneCardData, reachedMilestones } from "@/core/stats/milestones";
import { weekStartFor } from "@/core/stats/period";
import { statsReport, type ReportTitle } from "@/core/stats/report";
import { followCounts } from "@/data/social";
import { statsRows } from "@/data/stats";
import type { UserClient } from "@/data/supabase-server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import { ClosedProfile, loadProfile } from "../profile";

/** Posters shown in "In common"; the rest is a count. */
const IN_COMMON_MAX = 8;

const isPeriod = (value: unknown): value is StatsPeriod => (STATS_PERIODS as readonly unknown[]).includes(value);

export async function generateMetadata({ params }: PageProps<"/[locale]/u/[username]/stats">): Promise<Metadata> {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  const loaded = await loadProfile(username);
  if (!loaded) return { robots: { index: false } };
  const { profile } = loaded;
  const t = await getTranslations({ locale, namespace: "Profile" });
  if (profile.isPrivate) return { title: `${t("privateTitle")} · Mystonie`, robots: { index: false, follow: false } };
  return {
    title: `${t("statsMetaTitle", { name: profile.displayName ?? `@${profile.username}` })} · Mystonie`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/u/${profile.username}/stats` },
  };
}

/**
 * Someone's Stats tab (ADR 0077), next to their album: the same report as Me's Stats for `?period=`, minus the parts
 * they keep to themselves (`statsHidden`), with no sharing, no sticker album and no year in review. Computed in the
 * viewer's time zone (a visitor never learns the owner's). A signed-in visitor also sees what they both finished.
 */
export default async function ProfileStatsPage({ params, searchParams }: PageProps<"/[locale]/u/[username]/stats">) {
  const { locale: raw, username } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const query = await searchParams;
  const period: StatsPeriod = isPeriod(query.period) ? query.period : "month";
  const loaded = await loadProfile(username);
  if (!loaded) notFound();
  const { db, profile } = loaded;
  const { data: auth } = await db.auth.getClaims();
  const viewerId = auth?.claims.sub ?? null;
  if (profile.isPrivate) return <ClosedProfile db={db} profile={profile} viewerId={viewerId} />;

  const isOwner = viewerId === profile.id;
  const allHidden = profile.statsHidden.length >= STATS_SECTIONS.length;
  const [rows, counts, viewer, t, ts, journal] = await Promise.all([
    statsRows(db, profile.id),
    followCounts(db, profile.id).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
    viewerId && !isOwner ? viewerFacts(db, viewerId) : null,
    getTranslations("Profile"),
    getTranslations("Stats"),
    hasPosts(db, profile.id),
  ]);
  const tabs = profileTabs({ stats: !allHidden, journal });
  const cover = (
    <AlbumCover
      profile={profile}
      owner={isOwner}
      counts={counts}
      follow={isOwner ? undefined : { signedIn: !!viewerId, next: localizedPath(`/u/${profile.username}/stats`, locale, routing.defaultLocale) }}
    />
  );

  const timeZone = viewer?.timeZone ?? "UTC";
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();
  const report = statsReport(rows.titles, rows.entries, rows.logs, { period, timeZone, weekStart: weekStartFor(locale), now }, rows.reads);
  const titleById = new Map(rows.titles.map((title) => [title.id, title]));
  const milestones = reachedMilestones(rows.titles, rows.entries, rows.logs)
    .reverse()
    .map((m) => milestoneCardData(m, titleById.get(m.titleId)!, timeZone));
  const empty = rows.entries.length === 0 && rows.logs.length === 0 && rows.reads.length === 0;
  const common = viewer
    ? finishedInCommon(rows.entries, viewer.finished)
        .map((id) => titleById.get(id))
        .filter((title): title is ReportTitle => !!title)
    : null;

  const parts: Record<StatsSection, ReactNode> = {
    numbers: <Headline report={report} period={period} visitor />,
    activity: <Heatmap report={report} />,
    months: <MonthBars months={report.months} />,
    taste: <Taste report={report} />,
    favourites: CREDIT_ROLES.some((role) => report.people[role].length > 0) && <Favourites report={report} />,
    records: <Records report={report} />,
    milestones: <MilestoneShelf milestones={milestones} username={profile.username} host={siteUrl().host} visitor />,
  };
  const shown = STATS_SECTIONS.filter((section) => !profile.statsHidden.includes(section) && parts[section]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-10 pb-16">
      <FreshPage />
      {cover}
      {!allHidden && <ProfileTabs username={profile.username} current="stats" tabs={tabs} />}
      <SwipeArea prev={`/u/${profile.username}`} next={journal ? `/u/${profile.username}/journal` : undefined} replace className="flex flex-col gap-8">
        {allHidden ? (
          <Note
            action={
              <Link href={`/u/${profile.username}`} replace className="flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
                {t("backToAlbum")}
              </Link>
            }
          >
            {t("statsAllHidden", { username: profile.username })}
          </Note>
        ) : (
          <>
            {common && common.length > 0 && <InCommon titles={common} />}
            {empty ? (
              <Note>{t("statsNothing")}</Note>
            ) : (
              <>
                <PeriodTabs period={period} pathname={`/u/${profile.username}/stats`} />
                <PageTransition key={period}>
                  <div className="flex flex-col gap-8">
                    {shown.map((section) => (
                      <div key={section} data-stats-part={section}>
                        {parts[section]}
                      </div>
                    ))}
                    {shown.length === 0 && <p className="text-sm text-muted-foreground">{ts("emptyPeriod")}</p>}
                  </div>
                </PageTransition>
              </>
            )}
          </>
        )}
      </SwipeArea>
    </main>
  );
}

/** The visitor's own time zone and finished titles (their rows: RLS lets them read their own). */
async function viewerFacts(db: UserClient, viewerId: string): Promise<{ timeZone: string; finished: Set<string> } | null> {
  const [{ data: me, error }, { data: entries, error: entriesError }] = await Promise.all([
    db.from("profiles").select("time_zone").eq("id", viewerId).single(),
    db.from("entries").select("title_id").eq("user_id", viewerId).eq("status", "finished").is("deleted_at", null).limit(5000),
  ]);
  if (error || entriesError) {
    console.error(`viewer read failed: ${(error ?? entriesError)?.message}`);
    return null;
  }
  return { timeZone: me.time_zone, finished: new Set(entries.map((e) => e.title_id)) };
}

/** A short line in a dashed box: nothing to show, or kept private. */
function Note({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border px-6 py-8 text-center">
      <p className="font-hand text-2xl text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

/** What the visitor and this profile both finished (at least one), newest of theirs first: a row of posters and a count. */
async function InCommon({ titles }: { titles: ReportTitle[] }) {
  const t = await getTranslations("Profile");
  return (
    <PaperCard labelledBy="in-common" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="in-common" className="font-display text-xl font-extrabold tracking-[-0.02em]">
          {t("inCommonTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("inCommonCount", { count: titles.length })}</p>
      </div>
      <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 py-1 [scrollbar-width:none]">
          {titles.slice(0, IN_COMMON_MAX).map((title, i) => (
            <li key={title.id} title={title.name} className={`w-[22%] shrink-0 snap-start sm:w-24 ${i % 2 ? "rotate-[1.5deg]" : "rotate-[-1.5deg]"}`}>
              <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border">
                {title.posterUrl && <Image src={title.posterUrl} alt="" fill unoptimized sizes="96px" className="object-cover" />}
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-medium">{title.name}</p>
            </li>
          ))}
          {titles.length > IN_COMMON_MAX && (
            <li className="flex shrink-0 items-center px-2 font-hand text-xl text-muted-foreground">{t("inCommonMore", { count: titles.length - IN_COMMON_MAX })}</li>
          )}
      </ul>
    </PaperCard>
  );
}
