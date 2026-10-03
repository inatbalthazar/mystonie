"use client";

import { ArrowDownUpIcon, PenLineIcon, ShapesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { JOURNAL_TAGS } from "@/core/journal";
import { filtersQuery, JOURNAL_SORTS, SUBJECT_KINDS, type JournalFilters as Filters } from "@/core/journal-posts";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The Journal's filters and sort (ADR 0092), above its rows: the categories as a row of chips that swipes sideways
 * on phones, then what it's about (Movies, Books, Places…) and the order (For you, Newest, Most stamped) as two
 * native pickers, and Write for a signed-in reader. Everything lives in the address (`?tag=&kind=&sort=`).
 */
export function JournalFilters({ filters, signedIn }: { filters: Filters; signedIn: boolean }) {
  const t = useTranslations("Journal");
  const router = useRouter();
  const ids = useId();
  const href = (next: Partial<Filters>) => ({ pathname: "/feed", query: { tab: "articles", ...filtersQuery({ ...filters, ...next }, signedIn) } });
  const go = (next: Partial<Filters>) => router.replace(href(next), { scroll: false });
  const sorts = signedIn ? JOURNAL_SORTS : JOURNAL_SORTS.filter((s) => s !== "for_you");
  const chip = (on: boolean) =>
    cn(
      "flex h-9 shrink-0 snap-start items-center rounded-full px-4 text-sm font-bold whitespace-nowrap ring-1 transition-colors",
      on ? "bg-foreground text-background ring-foreground" : "bg-card ring-border hover:ring-brand/50",
    );

  return (
    <div role="group" aria-label={t("filtersLabel")} className="-mt-2 flex flex-col gap-3">
      <nav aria-label={t("tagsLabel")} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Link href={href({ tag: null })} replace scroll={false} aria-current={filters.tag === null ? "true" : undefined} className={chip(filters.tag === null)}>
          {t("allTags")}
        </Link>
        {JOURNAL_TAGS.map((tag) => (
          <Link key={tag} href={href({ tag })} replace scroll={false} aria-current={filters.tag === tag ? "true" : undefined} className={chip(filters.tag === tag)}>
            {t("tag", { tag })}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <label htmlFor={`${ids}-kind`} className="sr-only">
          {t("kindLabel")}
        </label>
        <span className="relative flex min-w-0 flex-1 items-center">
          <ShapesIcon aria-hidden="true" className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <select
            id={`${ids}-kind`}
            value={filters.kind ?? ""}
            onChange={(e) => go({ kind: (e.target.value || null) as Filters["kind"] })}
            className="h-10 w-full min-w-0 appearance-none rounded-full bg-card pr-2 pl-8 text-sm font-semibold ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value="">{t("kindOption", { kind: "all" })}</option>
            {SUBJECT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t("kindOption", { kind })}
              </option>
            ))}
          </select>
        </span>
        <label htmlFor={`${ids}-sort`} className="sr-only">
          {t("sortLabel")}
        </label>
        <span className="relative flex min-w-0 flex-1 items-center">
          <ArrowDownUpIcon aria-hidden="true" className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <select
            id={`${ids}-sort`}
            value={filters.sort}
            onChange={(e) => go({ sort: e.target.value as Filters["sort"] })}
            className="h-10 w-full min-w-0 appearance-none rounded-full bg-card pr-2 pl-8 text-sm font-semibold ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {sorts.map((sort) => (
              <option key={sort} value={sort}>
                {t("sort", { sort })}
              </option>
            ))}
          </select>
        </span>
        {signedIn && (
          <Link
            href="/journal/write"
            aria-label={t("writeLabel")}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
          >
            <PenLineIcon className="size-4" aria-hidden="true" />
            {t("write")}
          </Link>
        )}
      </div>
    </div>
  );
}
