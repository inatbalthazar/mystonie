import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PaperCard } from "@/components/paper-card";
import { formatRuntime } from "@/core/format/runtime";
import type { ReviewTitle, YearReview } from "@/core/stats/year-review";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Year in Review's album pages (S2 milestones & recaps, ADR 0031). Server components: every number comes from
// `yearInReview`, i.e. `statsReport` for the year, so it matches the stats page's "This year".

const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);
const TILTS = ["-rotate-3", "rotate-2", "-rotate-1", "rotate-3", "-rotate-2"];

function useRuntime() {
  const locale = useLocale();
  return (minutes: number) => (minutes > 0 ? formatRuntime(minutes, locale) : "0");
}

function Title({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{children}</h2>;
}

/** A poster pasted in with a strip of tape. */
function Pasted({ title, className, sizes }: { title: ReviewTitle; className?: string; sizes: string }) {
  return (
    <div className={cn("relative bg-card p-1.5 shadow-md ring-1 ring-border", className)}>
      <span aria-hidden="true" className="absolute -top-2 left-1/2 z-10 h-4 w-12 -translate-x-1/2 -rotate-3 rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10" />
      <div className="relative aspect-[2/3] overflow-hidden rounded-[3px] bg-muted">
        {title.posterUrl && <Image src={title.posterUrl} alt="" fill unoptimized sizes={sizes} className="object-cover" />}
      </div>
    </div>
  );
}

/** The album's cover: the year, stamped. */
export function ReviewCover({ review, children }: { review: YearReview; children?: ReactNode }) {
  const t = useTranslations("Review");
  return (
    <PaperCard stamp={t("stamp")} className="flex flex-col gap-3 overflow-hidden">
      <p className="font-hand text-2xl leading-none text-muted-foreground">{t("cover", { year: review.year, complete: String(review.complete) })}</p>
      <p className="font-display text-8xl leading-[0.85] font-extrabold tracking-[-0.05em] tabular-nums sm:text-9xl">{review.year}</p>
      <p className="text-muted-foreground">{t("coverBody")}</p>
      {children}
    </PaperCard>
  );
}

/** The big numbers: watching, then reading and playing (when there was some), then active days. */
export function ReviewNumbers({ review }: { review: YearReview }) {
  const t = useTranslations("Review");
  const locale = useLocale();
  const runtime = useRuntime();
  const { totals, reading, play, activeDays } = review.report;
  const n = (v: number) => v.toLocaleString(locale);
  const stats = [
    { label: t("watchTime"), value: runtime(totals.minutes) },
    { label: t("titlesFinished"), value: n(totals.finished) },
    { label: t("episodes"), value: n(totals.episodes) },
    ...(reading.minutes > 0 ? [{ label: t("readingTime"), value: runtime(reading.minutes) }] : []),
    ...(reading.pages > 0 ? [{ label: t("pagesRead"), value: n(reading.pages) }] : []),
    ...(reading.chapters > 0 ? [{ label: t("chaptersRead"), value: n(reading.chapters) }] : []),
    ...(play.finished > 0 ? [{ label: t("gamesFinished"), value: n(play.finished) }] : []),
    ...(play.minutes > 0 ? [{ label: t("playTime"), value: runtime(play.minutes) }] : []),
    { label: t("activeDays"), value: n(activeDays) },
  ];
  return (
    <PaperCard className="flex flex-col gap-4">
      <Title>{t("numbers")}</Title>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-1 border-l-2 border-dashed border-border pl-3">
            <dt className="text-[11px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">{s.label}</dt>
            <dd className="font-display text-3xl leading-tight font-extrabold tabular-nums break-words sm:text-4xl">{s.value}</dd>
          </div>
        ))}
      </dl>
    </PaperCard>
  );
}

/** The year's top titles, pasted in a row, with the time each took. */
export function ReviewTop({ review }: { review: YearReview }) {
  const t = useTranslations("Review");
  const runtime = useRuntime();
  const top = review.report.topTitles;
  if (top.length === 0) return null;
  return (
    <section aria-labelledby="review-top" className="flex flex-col gap-3">
      <h2 id="review-top" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
        {t("top")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("topHint")}</p>
      <ol className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5">
        {top.map((title, i) => (
          <li key={`${title.name}-${i}`} className="flex min-w-0 flex-col gap-2">
            <Pasted title={title} className={TILTS[i % TILTS.length]} sizes="(min-width: 640px) 120px, 30vw" />
            <p className="flex min-w-0 flex-col text-sm leading-tight">
              <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{title.name}</span>
              <span className="text-muted-foreground">{runtime(title.minutes)}</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Watch time per month of the year (the stats page's bars, but always January to December). */
export function ReviewMonths({ review }: { review: YearReview }) {
  const t = useTranslations("Review");
  const ts = useTranslations("Stats");
  const format = useFormatter();
  const runtime = useRuntime();
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${review.year}-${String(i + 1).padStart(2, "0")}`;
    return review.report.months.find((m) => m.month === month) ?? { month, minutes: 0, finished: 0 };
  });
  const max = Math.max(1, ...months.map((m) => m.minutes));
  const busiest = review.report.records.busiestMonth?.month;
  return (
    <PaperCard className="flex flex-col gap-3">
      <Title>{t("byMonth")}</Title>
      <ol className="grid h-40 grid-cols-12 items-end gap-1">
        {months.map((m) => (
          <li key={m.month} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
            <span className="sr-only">
              {ts("monthBar", { month: format.dateTime(monthDate(m.month), { month: "long", timeZone: "UTC" }), time: runtime(m.minutes), count: m.finished })}
            </span>
            <span
              aria-hidden="true"
              className={cn("w-full rounded-t-[3px]", m.month === busiest ? "bg-brand" : "bg-chart-1")}
              style={{ height: `${m.minutes > 0 ? Math.max(3, (m.minutes / max) * 100) : 0}%` }}
            />
            <span aria-hidden="true" className="h-0.5 w-full bg-border" />
            <span aria-hidden="true" className="text-[10px] leading-none font-semibold text-muted-foreground">
              {format.dateTime(monthDate(m.month), { month: "narrow", timeZone: "UTC" })}
            </span>
          </li>
        ))}
      </ol>
    </PaperCard>
  );
}

/** The year's first and last finish, side by side like two photos. */
export function ReviewBookends({ review }: { review: YearReview }) {
  const t = useTranslations("Review");
  const format = useFormatter();
  const ends = [
    review.firstFinish && { label: t("firstFinish"), title: review.firstFinish },
    review.lastFinish && review.lastFinish !== review.firstFinish && { label: t("lastFinish", { complete: String(review.complete) }), title: review.lastFinish },
  ].filter((e) => !!e);
  if (ends.length === 0) return null;
  return (
    <PaperCard className="flex flex-col gap-4">
      <Title>{t("bookends")}</Title>
      <div className="grid grid-cols-2 gap-4">
        {ends.map((e, i) => (
          <figure key={e.label} className="flex min-w-0 flex-col gap-2">
            <Pasted title={e.title} className={cn("w-full max-w-36", TILTS[i])} sizes="144px" />
            <figcaption className="flex min-w-0 flex-col text-sm leading-tight">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase [&:lang(th)]:tracking-normal">{e.label}</span>
              <span className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">{e.title.name}</span>
              <span className="font-hand text-lg text-muted-foreground">{format.dateTime(dayDate(e.title.on), { dateStyle: "medium", timeZone: "UTC" })}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </PaperCard>
  );
}

/** Milestones reached during the year, as a short carved list. */
export function ReviewMilestones({ review }: { review: YearReview }) {
  const t = useTranslations("Review");
  const tc = useTranslations("Card");
  const format = useFormatter();
  if (review.milestones.length === 0) return null;
  return (
    <PaperCard className="flex flex-col gap-3">
      <Title>{t("milestones")}</Title>
      <ul className="flex flex-col gap-2">
        {review.milestones.map((m) => (
          <li key={`${m.metric}-${m.value}`} className="flex items-baseline gap-3">
            <span className="shrink-0 font-display text-2xl font-extrabold tabular-nums">{format.number(m.value)}</span>
            <span className="min-w-0 text-sm">
              <span className="font-semibold">{tc("milestoneLabel", { metric: m.metric })}</span>
              <span className="text-muted-foreground">
                {" · "}
                {format.dateTime(dayDate(m.on), { month: "short", day: "numeric", timeZone: "UTC" })}
                {" · "}
                {m.title.name}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </PaperCard>
  );
}

/** Nothing watched or read that year. */
export function ReviewEmpty({ year }: { year: number }) {
  const t = useTranslations("Review");
  return (
    <PaperCard className="flex flex-col items-start gap-3">
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{t("emptyTitle", { year })}</h2>
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
