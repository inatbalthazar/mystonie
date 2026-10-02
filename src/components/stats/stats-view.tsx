import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CountUp } from "@/components/motion/count-up";
import { PaperCard } from "@/components/paper-card";
import type { StatsPeriod } from "@/core/cards/types";
import { CREDIT_ROLES } from "@/core/catalog/credits";
import { formatRuntime } from "@/core/format/runtime";
import { addDays } from "@/core/stats/recap";
import type { MonthBar, Ranked, RankedPerson, StatsReport } from "@/core/stats/report";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// The stats page's sections (S1 stats). Server components: every number comes from `statsReport`, and the
// charts are plain elements coloured with theme tokens (ADR 0026), so they need no client JavaScript.

const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);

function useRuntime() {
  const locale = useLocale();
  return (minutes: number) => (minutes > 0 ? formatRuntime(minutes, locale) : "0");
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">{children}</h2>;
}

/**
 * This week / month / year / all time, as links (`?period=`), so each period is a plain server render. Each takes its
 * label's width plus a share of the rest, so "This month" stays on one line at 360px (and wraps only if it must).
 * `pathname`: Me's Stats, or someone's (`/u/<username>/stats`, ADR 0077), whose periods replace the history entry.
 */
export function PeriodTabs({ period, pathname = "/stats" }: { period: StatsPeriod; pathname?: string }) {
  const t = useTranslations("Stats");
  return (
    <nav aria-label={t("periodsLabel")} data-tabs className="flex gap-1 rounded-xl bg-muted p-1">
      {(["week", "month", "year", "all"] as const).map((p) => (
        <Link
          key={p}
          href={{ pathname, query: { period: p } }}
          replace={pathname !== "/stats"}
          data-tab
          aria-current={p === period ? "page" : undefined}
          className={cn(
            "flex h-11 flex-auto items-center justify-center rounded-lg px-1 text-center text-sm leading-tight font-semibold text-muted-foreground transition-colors hover:text-foreground",
            p === period && "bg-card text-foreground shadow-sm ring-1 ring-border",
          )}
        >
          {t("period", { period: p })}
        </Link>
      ))}
    </nav>
  );
}

/** The big numbers, Strava-style, on a ticket pasted into the album. `visitor`: someone else's ("This month"). */
export function Headline({ report, period, visitor = false, children }: { report: StatsReport; period: StatsPeriod; visitor?: boolean; children?: ReactNode }) {
  const t = useTranslations("Stats");
  const locale = useLocale();
  const runtime = useRuntime();
  const stats = [
    { label: t("watchTime"), value: runtime(report.totals.minutes) },
    { label: t("titlesFinished"), value: report.totals.finished.toLocaleString(locale) },
    { label: t("episodesWatched"), value: report.totals.episodes.toLocaleString(locale) },
  ];
  // Reading (S2 books & manga), once there is some in the period: the same numbers as the Read tab's header.
  const { reading } = report;
  const read = [
    { label: t("readingTime"), value: runtime(reading.minutes), show: true },
    { label: t("pagesRead"), value: reading.pages.toLocaleString(locale), show: reading.pages > 0 },
    { label: t("chaptersRead"), value: reading.chapters.toLocaleString(locale), show: reading.chapters > 0 },
    { label: t("volumesRead"), value: reading.volumes.toLocaleString(locale), show: reading.volumes > 0 },
  ].filter((s) => s.show);
  const hasReading = reading.minutes > 0 || reading.finished > 0;
  // Games (S3 games), once one was finished in the period: the same numbers as the Play tab's header.
  const { play } = report;
  const played = [
    { label: t("playTime"), value: runtime(play.minutes) },
    { label: t("gamesFinished"), value: play.finished.toLocaleString(locale) },
  ];
  return (
    <PaperCard className="flex flex-col gap-4">
      <p className="font-hand text-2xl leading-none text-muted-foreground">{t(visitor ? "headlineVisitor" : "headline", { period })}</p>
      <Figures stats={stats} />
      {hasReading && (
        <div className="flex flex-col gap-2 border-t-2 border-dashed border-border pt-4">
          <Figures stats={read} />
          <p className="text-xs text-muted-foreground">{t("readingHint")}</p>
        </div>
      )}
      {play.finished > 0 && (
        <div className="flex flex-col gap-2 border-t-2 border-dashed border-border pt-4">
          <Figures stats={played} />
          <p className="text-xs text-muted-foreground">{t("playHint")}</p>
        </div>
      )}
      {report.card ? children : <p className="text-sm text-muted-foreground">{t("emptyPeriod")}</p>}
    </PaperCard>
  );
}

function Figures({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <dl
      className={cn(
        "grid divide-x-2 divide-dashed divide-border",
        stats.length > 3 ? "grid-cols-2 gap-y-3 sm:grid-cols-4" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {stats.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col gap-1 px-2 first:pl-0 last:pr-0">
          <dt className="text-[11px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">{s.label}</dt>
          <dd className="font-display text-2xl leading-tight font-extrabold tabular-nums break-words sm:text-4xl">
            <CountUp value={s.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const HEAT = ["bg-foreground/8", "bg-brand/30", "bg-brand/55", "bg-brand/80", "bg-brand"];
const heatLevel = (count: number) => (count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4);

/** GitHub-style calendar of the last 53 weeks: a column per week, a row per weekday. */
export function Heatmap({ report }: { report: StatsReport }) {
  const t = useTranslations("Stats");
  const format = useFormatter();
  const cells: { day: string; count: number }[] = [];
  for (let day = report.heatmap.from; day <= report.heatmap.to; day = addDays(day, 1)) cells.push({ day, count: report.heatmap.days[day] ?? 0 });

  return (
    <PaperCard className="flex flex-col gap-3">
      <SectionTitle>{t("activity")}</SectionTitle>
      <p className="text-sm text-muted-foreground">{t("activityHint")}</p>
      {/* Fixed-size squares that scroll sideways on phones. The rtl wrapper starts the scroll at the right end (today). */}
      <div dir="rtl" className="-mx-1 overflow-x-auto px-1 pb-1">
        <div dir="ltr" className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
        {cells.map(({ day, count }) => {
          const label = t("dayCell", { date: format.dateTime(dayDate(day), { dateStyle: "medium", timeZone: "UTC" }), count });
          return <span key={day} title={label} aria-label={count > 0 ? label : undefined} role={count > 0 ? "img" : undefined} className={cn("size-3 rounded-[3px]", HEAT[heatLevel(count)])} />;
        })}
        </div>
      </div>
      <div aria-hidden="true" className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        {t("less")}
        {HEAT.map((c) => (
          <span key={c} className={cn("size-3 rounded-[2px]", c)} />
        ))}
        {t("more")}
      </div>
    </PaperCard>
  );
}

/** Watch time per month, as bars; the finish count sits under each month. */
export function MonthBars({ months }: { months: MonthBar[] }) {
  const t = useTranslations("Stats");
  const format = useFormatter();
  const runtime = useRuntime();
  const max = Math.max(1, ...months.map((m) => m.minutes));
  return (
    <PaperCard className="flex flex-col gap-3">
      <SectionTitle>{t("perMonth")}</SectionTitle>
      <p className="text-sm text-muted-foreground">{t("perMonthHint")}</p>
      <ol className="grid h-40 grid-cols-12 items-end gap-1">
        {months.map((m) => (
          <li key={m.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
            <span className="sr-only">
              {t("monthBar", { month: format.dateTime(monthDate(m.month), { month: "long", year: "numeric", timeZone: "UTC" }), time: runtime(m.minutes), count: m.finished })}
            </span>
            <span aria-hidden="true" className="w-full rounded-t-[3px] bg-chart-1" style={{ height: `${m.minutes > 0 ? Math.max(3, (m.minutes / max) * 100) : 0}%` }} />
            <span aria-hidden="true" className="h-0.5 w-full bg-border" />
            <span aria-hidden="true" className="text-[10px] leading-none font-semibold text-muted-foreground">
              {format.dateTime(monthDate(m.month), { month: "narrow", timeZone: "UTC" })}
            </span>
            <span aria-hidden="true" className={cn("text-[10px] leading-none font-bold tabular-nums", m.finished ? "text-brand" : "text-transparent")}>
              {m.finished}
            </span>
          </li>
        ))}
      </ol>
    </PaperCard>
  );
}

function RankedList({ title, items, name }: { title: string; items: Ranked[]; name: (key: string) => string }) {
  const t = useTranslations("Stats");
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">{title}</h3>
      <ol className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-semibold">{name(i.key)}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{t("titleCount", { count: i.count })}</span>
            </div>
            <span aria-hidden="true" className="h-1.5 rounded-full bg-chart-2" style={{ width: `${(i.count / max) * 100}%` }} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Movies vs series vs books & manga vs games (watching, reading and play time), top genres and top original languages
 * in the period.
 */
export function Taste({ report }: { report: StatsReport }) {
  const t = useTranslations("Stats");
  const locale = useLocale();
  const runtime = useRuntime();
  const { movie, series, reading, play } = report.split;
  const total = movie.minutes + series.minutes + reading.minutes + play.minutes;
  const kinds = [
    [t("movies"), movie, "bg-chart-1"],
    [t("series"), series, "bg-chart-3"],
    ...(reading.minutes > 0 || reading.finished > 0 ? [[t("reading"), reading, "bg-chart-4"] as const] : []),
    ...(play.minutes > 0 || play.finished > 0 ? [[t("games"), play, "bg-chart-2"] as const] : []),
  ] as const;
  const languages = (() => {
    try {
      return new Intl.DisplayNames([locale], { type: "language" });
    } catch {
      return null;
    }
  })();
  const languageName = (code: string) => {
    try {
      return languages?.of(code) ?? code;
    } catch {
      return code;
    }
  };

  return (
    <PaperCard className="flex flex-col gap-4">
      <SectionTitle>{t("taste")}</SectionTitle>
      {report.genres.length === 0 && total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tasteEmpty")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-muted">
              {kinds.map(([label, v, dot]) => (
                <span key={label} className={dot} style={{ width: `${total ? (v.minutes / total) * 100 : 0}%` }} />
              ))}
            </div>
            <dl className={cn("grid gap-2 text-sm", kinds.length > 2 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
              {kinds.map(([label, v, dot]) => (
                <div key={label} className="flex min-w-0 flex-col">
                  <dt className="flex items-center gap-1.5 font-semibold">
                    <span aria-hidden="true" className={cn("size-2.5 rounded-full", dot)} />
                    {label}
                  </dt>
                  <dd className="text-muted-foreground">{t("kindSplit", { count: v.finished, time: runtime(v.minutes) })}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {report.genres.length > 0 && <RankedList title={t("topGenres")} items={report.genres} name={(g) => g} />}
            {report.languages.length > 0 && <RankedList title={t("topLanguages")} items={report.languages} name={languageName} />}
          </div>
        </>
      )}
    </PaperCard>
  );
}

/** A round photo (a square white chip for a studio's logo), or the name's initials while there is none. */
function PersonImage({ person, logo }: { person: RankedPerson; logo: boolean }) {
  const initials = person.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-11 shrink-0 items-center justify-center overflow-hidden font-display text-sm font-extrabold ring-1 ring-border",
        logo ? "rounded-lg bg-white text-neutral-700" : "rounded-full bg-muted text-muted-foreground",
      )}
    >
      {person.imageUrl ? (
        <Image src={person.imageUrl} alt="" fill unoptimized sizes="44px" className={logo ? "object-contain p-1" : "object-cover"} />
      ) : (
        initials
      )}
    </span>
  );
}

/**
 * Favourite actors, directors & creators, studios, authors and developers (stage 4): who made the titles finished in
 * the period, top 5 of each. Hidden while no finished title has credits.
 */
export function Favourites({ report }: { report: StatsReport }) {
  const t = useTranslations("Stats");
  const runtime = useRuntime();
  const roles = CREDIT_ROLES.filter((role) => report.people[role].length > 0);
  if (roles.length === 0) return null;
  return (
    <PaperCard className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <SectionTitle>{t("favourites")}</SectionTitle>
        <p className="text-sm text-muted-foreground">{t("favouritesHint")}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {roles.map((role) => (
          <div key={role} className="flex min-w-0 flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">{t("favouriteRole", { role })}</h3>
            <ol className="flex flex-col gap-2">
              {report.people[role].map((person) => (
                <li key={person.id} className="flex min-w-0 items-center gap-3">
                  <PersonImage person={person} logo={role === "studio"} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{person.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{t("personDetail", { count: person.titles, time: runtime(person.minutes) })}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </PaperCard>
  );
}

/** Records as little stickers stuck on the page, each leaning its own way. */
export function Records({ report }: { report: StatsReport }) {
  const t = useTranslations("Stats");
  const format = useFormatter();
  const runtime = useRuntime();
  const { longestMovie, longestSeries, busiestMonth, longestStreak } = report.records;
  const items = [
    { label: t("longestMovie"), value: longestMovie?.name, detail: longestMovie && runtime(longestMovie.minutes) },
    { label: t("longestSeries"), value: longestSeries?.name, detail: longestSeries && runtime(longestSeries.minutes) },
    {
      label: t("busiestMonth"),
      value: busiestMonth && format.dateTime(monthDate(busiestMonth.month), { month: "long", year: "numeric", timeZone: "UTC" }),
      detail: busiestMonth && runtime(busiestMonth.minutes),
    },
    {
      label: t("longestStreak"),
      value: longestStreak && t("streakDays", { count: longestStreak.days }),
      detail: longestStreak && format.dateTimeRange(dayDate(longestStreak.from), dayDate(longestStreak.to), { month: "short", day: "numeric", timeZone: "UTC" }),
    },
  ];
  const tilts = ["-rotate-1", "rotate-1", "rotate-[0.5deg]", "-rotate-[0.5deg]"];
  return (
    <section aria-labelledby="stats-records" className="flex flex-col gap-3">
      <h2 id="stats-records" className="font-display text-xl font-extrabold tracking-[-0.02em]">
        {t("records")}
      </h2>
      <dl className="grid grid-cols-2 gap-3">
        {items.map((r, i) => (
          <div key={r.label} className={cn("flex min-w-0 flex-col gap-1 rounded-xl bg-card p-3 shadow-sm ring-1 ring-border", tilts[i])}>
            <dt className="text-[11px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">{r.label}</dt>
            <dd className="flex min-w-0 flex-col">
              <span className={cn("line-clamp-2 font-display text-lg leading-tight font-extrabold break-words", !r.value && "text-muted-foreground")}>
                {r.value ?? t("noRecord")}
              </span>
              {r.detail && <span className="text-sm text-muted-foreground">{r.detail}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Nothing logged at all: the page points to logging the first title. */
export function StatsEmpty() {
  const t = useTranslations("Stats");
  return (
    <PaperCard className="flex flex-col items-start gap-3">
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{t("emptyTitle")}</h2>
      <p className="text-muted-foreground">{t("emptyBody")}</p>
      <Link
        href={{ pathname: "/collection", query: { add: "1" } }}
        className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
      >
        {t("emptyCta")}
      </Link>
    </PaperCard>
  );
}
