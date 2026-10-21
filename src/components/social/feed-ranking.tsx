"use client";

import { ListOrderedIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { FeedRanking } from "@/core/social";
import { Link } from "@/i18n/navigation";
import { Avatar } from "./avatar";
import { OfficialLabel } from "./official-label";

const TILTS = ["rotate-[0.5deg]", "rotate-[-0.6deg]", "rotate-[0.7deg]", "rotate-[-0.3deg]"];

/**
 * A ranking or tier list in the Following feed (ADR 0099, step 3), pasted into the album like a finish: who and when,
 * the card itself (to its page), the list's name and its first few things, and "Rank these your way" to start your
 * own from it. Your own rankings show without it.
 */
export function FeedRankingPost({ ranking, now, index }: { ranking: FeedRanking; now: number; index: number }) {
  const t = useTranslations("Social");
  const format = useFormatter();
  const name = ranking.user.displayName || ranking.user.username;
  const kind = { type: ranking.type, count: ranking.count };

  return (
    <article className={`relative flex flex-col gap-3 rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border ${TILTS[index % TILTS.length]}`}>
      <span aria-hidden="true" className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[2deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      <header className="flex items-center gap-3">
        <Link href={`/u/${ranking.user.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:opacity-90">
          <Avatar name={name} url={ranking.user.avatarUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold">{ranking.mine ? t("you") : name}</span>
              <OfficialLabel official={ranking.user.official} />
            </span>
            <span className="text-xs text-muted-foreground">{t("rankedWhen", { ...kind, when: format.relativeTime(new Date(ranking.sharedAt), now) })}</span>
          </span>
        </Link>
      </header>

      <div className="flex gap-4">
        <Link href={`/c/${ranking.cardId}`} className="w-32 shrink-0 rotate-[-1.5deg] self-start rounded-md shadow-md transition-transform hover:-translate-y-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- the card PNG from storage, already sized */}
          <img src={ranking.imageUrl} alt={t("rankingAlt", { name: ranking.name })} loading="lazy" className="w-full rounded-md" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="font-display text-xs font-extrabold tracking-[0.12em] text-brand uppercase [&:lang(th)]:tracking-normal">{t("rankingLabel", kind)}</p>
          <Link href={`/c/${ranking.cardId}`} className="font-display text-lg leading-tight font-extrabold break-words hover:underline">
            {ranking.name}
          </Link>
          <ol className="flex flex-col gap-0.5 text-sm">
            {ranking.preview.map((thing, i) => (
              <li key={`${i}-${thing}`} className="flex min-w-0 gap-1.5">
                {ranking.type === "top" && <span className="w-4 shrink-0 text-right font-display font-extrabold text-brand tabular-nums">{i + 1}</span>}
                <span className="truncate">{thing}</span>
              </li>
            ))}
            {ranking.count > ranking.preview.length && <li className="text-xs text-muted-foreground">{t("rankingMore", { count: ranking.count - ranking.preview.length })}</li>}
          </ol>
        </div>
      </div>

      {!ranking.mine && (
        <footer className="flex items-center justify-end border-t border-dashed border-border pt-2">
          <Link
            href={{ pathname: "/rank", query: { from: ranking.cardId } }}
            className="flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand hover:bg-brand-soft/60 dark:hover:bg-brand/15"
          >
            <ListOrderedIcon className="size-4" aria-hidden="true" />
            {t("rankRemix")}
          </Link>
        </footer>
      )}
    </article>
  );
}
