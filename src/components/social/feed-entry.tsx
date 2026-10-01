"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { Stars } from "@/cards/parts";
import { isRare } from "@/core/finish-share";
import type { FeedItem } from "@/core/social";
import { Link } from "@/i18n/navigation";
import { formatShare } from "@/lib/share";
import { Sticker } from "../badges/sticker";
import { Avatar } from "./avatar";
import { StampButton } from "./stamp-button";

const TILTS = ["rotate-[-0.6deg]", "rotate-[0.5deg]", "rotate-[-0.3deg]", "rotate-[0.7deg]"];

/**
 * One finish in the Following feed, pasted into the album: who, when, the poster (or their shared card), the rating
 * and a handwritten review, the stickers that finish earned, and the Stamp. `readOnly` (signed-out visitors of a club
 * page) shows the Stamp count without the button.
 */
export function FeedEntry({ item, now, index, readOnly = false }: { item: FeedItem; now: number; index: number; readOnly?: boolean }) {
  const t = useTranslations("Social");
  const tb = useTranslations("Badges");
  const format = useFormatter();
  const name = item.user.displayName || item.user.username;
  const titleHref = `/title/${item.title.kind}/${item.title.externalId}`;
  const cardImage = item.card?.imageUrl;

  return (
    <article className={`relative flex flex-col gap-3 rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border ${TILTS[index % TILTS.length]}`}>
      <span aria-hidden="true" className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-3deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      <header className="flex items-center gap-3">
        <Link href={`/u/${item.user.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:opacity-90">
          <Avatar name={name} url={item.user.avatarUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{item.mine ? t("you") : name}</span>
            <span className="text-xs text-muted-foreground">
              {t("finishedWhen", { when: format.relativeTime(new Date(item.finishedAt), now) })}
            </span>
          </span>
        </Link>
      </header>

      <div className="flex gap-4">
        {cardImage && item.card ? (
          <Link href={`/c/${item.card.id}`} className="w-28 shrink-0 rotate-[1.5deg] self-start rounded-md shadow-md transition-transform hover:-translate-y-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- the card PNG from storage, already sized */}
            <img src={cardImage} alt={t("cardAlt", { name: item.title.name })} loading="lazy" className="w-full rounded-md" />
          </Link>
        ) : (
          <Link
            href={titleHref}
            aria-hidden="true"
            tabIndex={-1}
            className="relative aspect-[2/3] w-20 shrink-0 self-start overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border"
          >
            {item.title.posterUrl && <Image src={item.title.posterUrl} alt="" fill unoptimized sizes="80px" className="object-cover" />}
          </Link>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="flex flex-wrap items-center gap-2 font-display text-xs font-extrabold tracking-[0.12em] text-brand uppercase [&:lang(th)]:tracking-normal">
            {t("finishedLabel")}
            {isRare(item.finishShare) && (
              // A rare finish (ADR 0067), as a little inked seal.
              <span className="-rotate-3 rounded-full border-2 border-double border-brand/70 px-2 py-0.5 tracking-normal normal-case">
                {t("rareFinish", { share: formatShare(format, item.finishShare) })}
              </span>
            )}
          </p>
          <Link href={titleHref} className="font-display text-lg leading-tight font-extrabold break-words hover:underline">
            {item.title.name}
            {item.title.year && <span className="ml-1.5 text-sm font-medium text-muted-foreground">{item.title.year}</span>}
          </Link>
          {item.rating !== null && (
            <div className="flex items-center text-brand">
              <Stars rating={item.rating} className="gap-0.5 text-base" />
              <span className="sr-only">{t("rated", { rating: item.rating })}</span>
            </div>
          )}
          {item.review && <p className="font-hand text-xl leading-snug break-words whitespace-pre-line">{item.review}</p>}
          {item.badges.map((id) => (
            <p key={id} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sticker id={id} size="xs" />
              {tb("earnedInFeed", { name: tb(`items.${id}.name`) })}
            </p>
          ))}
        </div>
      </div>
      {item.badges.length > 0 && (
        // The sticker itself, slapped onto the corner of the page.
        <span aria-hidden="true" className="absolute -top-3 right-3 flex -space-x-4">
          {item.badges.slice(0, 3).map((id, i) => (
            <Sticker key={id} id={id} size="sm" className={i % 2 ? "rotate-6" : "-rotate-12"} />
          ))}
        </span>
      )}

      {!((item.mine || readOnly) && item.stampCount === 0) && (
        <footer className="flex items-center justify-end border-t border-dashed border-border pt-2">
          <StampButton entryId={item.entryId} stamped={item.stamped} count={item.stampCount} mine={item.mine || readOnly} />
        </footer>
      )}
    </article>
  );
}
