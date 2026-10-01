"use client";

import { NotebookPenIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { StampButton } from "@/components/social/stamp-button";
import type { ArticlePlace } from "@/core/analytics";
import type { FeedArticle } from "@/core/journal-feed";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { SaveButton, ShareButton } from "./article-actions";
import { Byline } from "./byline";

const TILTS = ["rotate-[-0.6deg]", "rotate-[0.5deg]", "rotate-[-0.3deg]", "rotate-[0.7deg]"];

/**
 * One Journal article as a feed row (ADR 0052), Medium-style in the album's paper: the byline, the title and
 * description with the picture as a taped-in polaroid beside them, why For you picked it, then the date, reading
 * time, Stamp, Save and Share. The whole row opens the article; the byline and the buttons sit above that link.
 * In the Following feed (`card`), it's a taped paper card headed "From the Journal". `signInNext` (visitors) turns
 * Stamp and Save into links to sign in.
 */
export function ArticleRow({
  article: a,
  place,
  now,
  index = 0,
  card = false,
  signInNext,
}: {
  article: FeedArticle;
  place: ArticlePlace;
  /** The server's clock, for "this year" (no year on the date then). */
  now: number;
  index?: number;
  card?: boolean;
  signInNext?: string;
}) {
  const t = useTranslations("Journal");
  const format = useFormatter();
  const locale = useLocale();
  const day = new Date(`${a.date}T00:00:00Z`);
  const thisYear = day.getUTCFullYear() === new Date(now).getUTCFullYear();
  const date = format.dateTime(day, { month: "short", day: "numeric", ...(thisYear ? {} : { year: "numeric" }), timeZone: "UTC" });
  const written = a.locale === locale ? undefined : a.locale;

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-2",
        card ? `rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border ${TILTS[index % TILTS.length]}` : "py-5",
      )}
    >
      {card && (
        <span aria-hidden="true" className="pointer-events-none absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-3deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      )}
      <div className="flex min-h-6 items-center justify-between gap-3">
        {card ? (
          <p className="flex items-center gap-1.5 font-display text-xs font-extrabold tracking-[0.12em] text-brand uppercase [&:lang(th)]:tracking-normal">
            <NotebookPenIcon className="size-4" aria-hidden="true" />
            {t("latest")}
          </p>
        ) : (
          <Byline author={a.author} avatar={a.avatar} profile={a.profile} className={a.profile ? "relative z-10" : undefined} />
        )}
        {a.featured && (
          <span className="shrink-0 -rotate-3 rounded-full border-2 border-double border-brand/70 px-2 py-0.5 font-display text-[11px] font-extrabold tracking-[0.1em] text-brand uppercase [&:lang(th)]:tracking-normal">
            {t("featured")}
          </span>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 lang={written} className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em] text-balance break-words">
            {/* The row's link: stretched over the whole row, so it opens from anywhere but the buttons. */}
            <Link
              href={`/journal/${a.slug}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {a.title}
            </Link>
          </h2>
          <p lang={written} className="line-clamp-2 text-sm text-muted-foreground">
            {a.description}
          </p>
        </div>
        {a.image && (
          // The picture, as a polaroid taped beside the text (taps go through to the row's link).
          <span aria-hidden="true" className={cn("pointer-events-none relative mt-1 shrink-0 self-start rounded-[3px] bg-card p-1 pb-3 shadow-md ring-1 ring-border", index % 2 ? "rotate-[2deg]" : "rotate-[-2deg]")}>
            <span className="absolute -top-1.5 left-1/2 z-10 h-3 w-8 -translate-x-1/2 rotate-[-4deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
            <span className="relative block size-18 overflow-hidden rounded-[2px] bg-muted">
              <Image src={a.image} alt="" fill unoptimized sizes="72px" className="object-cover" />
            </span>
          </span>
        )}
      </div>

      {a.reason && <p className="font-hand text-lg leading-tight text-brand">{t("reason", { status: a.reason.status, kind: a.reason.kind, name: a.reason.name })}</p>}

      <footer className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <time dateTime={a.date}>{date}</time>
          <span aria-hidden="true">·</span>
          <span>{t("readTime", { minutes: a.minutes })}</span>
          {written && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{t("inLanguage", { language: new Intl.DisplayNames([locale], { type: "language" }).of(written) ?? written })}</span>}
          {a.draft && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{t("draft")}</span>}
        </p>
        <div className="relative z-10 ml-auto flex items-center gap-1">
          <StampButton article={{ slug: a.slug, place }} stamped={a.stamped} count={a.stamps} mine={false} compact signInNext={signInNext} />
          <SaveButton slug={a.slug} saved={a.saved} place={place} compact signInNext={signInNext} />
          <ShareButton slug={a.slug} title={a.title} place={place} compact />
        </div>
      </footer>
    </article>
  );
}
