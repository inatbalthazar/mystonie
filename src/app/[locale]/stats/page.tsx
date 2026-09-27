import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShareStats } from "@/components/stats/share-stats";
import { Headline, Heatmap, MonthBars, PeriodTabs, Records, StatsEmpty, Taste } from "@/components/stats/stats-view";
import { localizedPath } from "@/core/auth";
import { STATS_PERIODS, type StatsPeriod } from "@/core/cards/types";
import { weekStartFor } from "@/core/stats/period";
import { statsReport } from "@/core/stats/report";
import { statsRows } from "@/data/stats";
import { userClient } from "@/data/supabase-server";
import { redirect } from "@/i18n/navigation";
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

  const [{ data: profile }, rows, t] = await Promise.all([
    supabase.from("profiles").select("time_zone, username").eq("id", userId).single(),
    statsRows(supabase, userId),
    getTranslations("Stats"),
  ]);
  const empty = rows.entries.length === 0 && rows.logs.length === 0 && rows.reads.length === 0;
  const report = statsReport(
    rows.titles,
    rows.entries,
    rows.logs,
    {
      period,
      timeZone: profile?.time_zone ?? "UTC",
      weekStart: weekStartFor(locale),
      // eslint-disable-next-line react-hooks/purity -- a server render, once per request
      now: Date.now(),
    },
    rows.reads,
  );

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
            {report.card && <ShareStats card={report.card} username={profile?.username ?? null} host={siteUrl().host} />}
          </Headline>
          <Heatmap report={report} />
          <MonthBars months={report.months} />
          <Taste report={report} />
          <Records report={report} />
        </>
      )}
    </main>
  );
}
