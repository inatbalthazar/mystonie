"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Stars } from "@/cards/parts";
import type { FeedItem } from "@/core/social";
import { Link } from "@/i18n/navigation";
import { previewClass, ShowAll } from "../show-all";
import { Avatar } from "../social/avatar";
import { StampButton } from "../social/stamp-button";

const PREVIEW = 3;

/** The reviews on a title page, three at first, then "Show all" (mobile checklist, ADR 0050). */
export function ReviewList({ items, now }: { items: FeedItem[]; now: number }) {
  const t = useTranslations("Social");
  const format = useFormatter();
  const [all, setAll] = useState(false);
  return (
    <>
      <ul className="flex flex-col">
        {items.map((item, i) => {
          const name = item.user.displayName || item.user.username;
          return (
            <li key={item.entryId} className={`${previewClass(i, all, PREVIEW, PREVIEW) ?? ""} border-b border-dashed border-border py-3 first:pt-0 last:border-b-0 last:pb-0`}>
              <article className="flex gap-3">
                <Link href={`/u/${item.user.username}`} className="shrink-0 self-start rounded-full hover:opacity-90">
                  <Avatar name={name} url={item.user.avatarUrl} className="size-9" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <Link href={`/u/${item.user.username}`} className="truncate font-semibold hover:underline">
                      {item.mine ? t("you") : name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{t("finishedWhen", { when: format.relativeTime(new Date(item.finishedAt), now) })}</span>
                  </p>
                  {item.rating !== null && (
                    <div className="flex items-center text-brand">
                      <Stars rating={item.rating} className="gap-0.5 text-sm" />
                      <span className="sr-only">{t("rated", { rating: item.rating })}</span>
                    </div>
                  )}
                  <p className="font-hand text-xl leading-snug break-words whitespace-pre-line">{item.review}</p>
                  {!(item.mine && item.stampCount === 0) && (
                    <div className="flex justify-end">
                      <StampButton entryId={item.entryId} stamped={item.stamped} count={item.stampCount} mine={item.mine} />
                    </div>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      {items.length > PREVIEW && <ShowAll open={all} onToggle={() => setAll(!all)} count={items.length} />}
    </>
  );
}
