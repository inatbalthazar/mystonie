"use client";

import { LayoutGridIcon, ListIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { ENTRY_STATUSES, isEntryStatus } from "@/core/collection/entries";
import {
  COLLECTION_SHELVES,
  COLLECTION_SORTS,
  isCollectionSort,
  type CollectionFilter,
  type CollectionLayout,
  type CollectionShelf,
  type CollectionSort,
} from "@/core/collection/view";
import { formatRuntime } from "@/core/format/runtime";
import type { ReadTotals } from "@/core/stats/reading";
import type { WatchTotals } from "@/core/stats/summary";
import { cn } from "@/lib/utils";

/**
 * The summary header (S1 collection → Collection view): a pasted-in ticket with watch time, titles finished
 * and episodes watched for the current filter. Always the sum of the rows below it.
 */
export function CollectionSummary({ totals, year }: { totals: WatchTotals; year: number | null }) {
  const t = useTranslations("Collection");
  const locale = useLocale();
  const stats = [
    { label: t("watchTime"), value: totals.minutes > 0 ? formatRuntime(totals.minutes, locale) : "0" },
    { label: t("titlesFinished"), value: totals.finished.toLocaleString(locale) },
    { label: t("episodesWatched"), value: totals.episodes.toLocaleString(locale) },
  ];
  return <SummaryTicket stats={stats} year={year} />;
}

/**
 * The Read tab's header (S2 books & manga): estimated reading time, books and manga finished, and pages / chapters /
 * volumes read (the ones there are). Always the sum of the rows below it.
 */
export function ReadSummary({ totals, year }: { totals: ReadTotals; year: number | null }) {
  const t = useTranslations("Collection");
  const locale = useLocale();
  const amounts = [
    { label: t("pagesRead"), value: totals.pages },
    { label: t("chaptersRead"), value: totals.chapters },
    { label: t("volumesRead"), value: totals.volumes },
  ].filter((a, i) => a.value > 0 || (i === 0 && totals.chapters === 0 && totals.volumes === 0));
  const stats = [
    { label: t("readTime"), value: totals.minutes > 0 ? formatRuntime(totals.minutes, locale) : "0" },
    { label: t("titlesRead"), value: totals.finished.toLocaleString(locale) },
    ...amounts.map((a) => ({ label: a.label, value: a.value.toLocaleString(locale) })),
  ];
  return <SummaryTicket stats={stats} year={year} hint={t("readTimeHint")} />;
}

function SummaryTicket({ stats, year, hint }: { stats: { label: string; value: string }[]; year: number | null; hint?: string }) {
  const t = useTranslations("Collection");
  return (
    <section aria-labelledby="collection-summary" className="relative mt-2 rounded-2xl bg-card px-4 pt-5 pb-4 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_24px_-14px_rgb(0_0_0/0.35)] ring-1 ring-border">
      {/* Tape holding the ticket onto the page. */}
      <span aria-hidden="true" className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-[-3deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/15 dark:bg-brand/30" />
      <h2 id="collection-summary" className="font-hand text-2xl leading-none text-muted-foreground">
        {t("summaryTitle", { year: year ?? "all" })}
      </h2>
      <dl className={cn("mt-3 grid divide-x-2 divide-dashed divide-border", stats.length > 3 ? "grid-cols-2 gap-y-3 sm:grid-cols-4" : "grid-cols-3")}>
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-1 px-2 first:pl-0 last:pr-0">
            <dt className="text-[11px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase">{s.label}</dt>
            <dd className="font-display text-xl leading-tight font-extrabold tabular-nums break-words sm:text-2xl">{s.value}</dd>
          </div>
        ))}
      </dl>
      {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}

/**
 * Watch · Read (S2 books & manga): the album's divider tabs. Movies and series on one, books and manga on the other;
 * each tab has its own header, filters and rows.
 */
export function ShelfTabs({ shelf, onShelf }: { shelf: CollectionShelf; onShelf: (shelf: CollectionShelf) => void }) {
  const t = useTranslations("Collection");
  return (
    <div role="group" aria-label={t("shelves")} className="flex gap-2 border-b-2 border-border">
      {COLLECTION_SHELVES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={shelf === value}
          onClick={() => onShelf(value)}
          className={cn(
            "-mb-0.5 min-h-11 rounded-t-xl border-2 border-b-0 px-5 font-display text-lg font-extrabold transition-colors",
            shelf === value
              ? "border-border bg-card text-foreground shadow-[0_-4px_10px_-8px_rgb(0_0_0/0.3)]"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t("shelf", { shelf: value })}
        </button>
      ))}
    </div>
  );
}

const selectClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring";

/** Year / status filters, sort and the tiles/list toggle. */
export function CollectionControls({
  years,
  filter,
  sort,
  layout,
  count,
  onFilter,
  onSort,
  onLayout,
}: {
  years: number[];
  filter: CollectionFilter;
  sort: CollectionSort;
  layout: CollectionLayout;
  count: number;
  onFilter: (filter: CollectionFilter) => void;
  onSort: (sort: CollectionSort) => void;
  onLayout: (layout: CollectionLayout) => void;
}) {
  const t = useTranslations("Collection");
  const id = useId();
  const labelClass = "text-xs font-semibold text-muted-foreground";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-year`} className={labelClass}>
            {t("filterYear")}
          </label>
          <select
            id={`${id}-year`}
            value={filter.year ?? ""}
            onChange={(e) => onFilter({ ...filter, year: e.target.value ? Number(e.target.value) : null })}
            className={selectClass}
          >
            <option value="">{t("allTime")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-status`} className={labelClass}>
            {t("status")}
          </label>
          <select
            id={`${id}-status`}
            value={filter.status ?? ""}
            onChange={(e) => onFilter({ ...filter, status: isEntryStatus(e.target.value) ? e.target.value : null })}
            className={selectClass}
          >
            <option value="">{t("allStatuses")}</option>
            {ENTRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t("statusLabel", { status: s, shelf: filter.shelf ?? "watch" })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-sort`} className={labelClass}>
            {t("sort")}
          </label>
          <select
            id={`${id}-sort`}
            value={sort}
            onChange={(e) => isCollectionSort(e.target.value) && onSort(e.target.value)}
            className={selectClass}
          >
            {COLLECTION_SORTS.map((s) => (
              <option key={s} value={s}>
                {t("sortLabel", { sort: s })}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("count", { count })}
        </p>
        <div role="group" aria-label={t("layout")} className="flex rounded-xl bg-muted p-1">
          {(
            [
              ["list", ListIcon],
              ["tiles", LayoutGridIcon],
            ] as const
          ).map(([value, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={layout === value}
              aria-label={t("layoutLabel", { layout: value })}
              onClick={() => onLayout(value)}
              className={cn(
                "flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground",
                layout === value && "bg-card text-foreground shadow-sm ring-1 ring-border",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
