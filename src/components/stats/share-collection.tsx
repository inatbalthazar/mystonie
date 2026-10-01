"use client";

import { BookOpenIcon, FilmIcon, Gamepad2Icon, Share2Icon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Celebration } from "@/components/celebration";
import { COLLECTION_AREAS, type CardRecap, type CollectionArea } from "@/core/cards/types";
import { recapCardData } from "@/core/stats/recap";

const ICONS: Record<CollectionArea, LucideIcon> = { watch: FilmIcon, read: BookOpenIcon, play: Gamepad2Icon };

type Cards = Partial<Record<CollectionArea, CardRecap>>;

/**
 * "Share my collection" (stage 4): one all-time card per area, watched, read and played apart (everything together is
 * the stats page's "Share stats"). Each opens the celebration with that area's Bold Stats card (Collage one swipe
 * away). With `area` (the collection page, whose Watch · Read · Play tabs already say which): one button for that
 * area. Without (the profile): a button per area that has anything in it.
 */
export function ShareCollection({ cards, area, username, host }: { cards: Cards; area?: CollectionArea; username: string | null; host: string }) {
  const t = useTranslations("Stats");
  const [open, setOpen] = useState<CollectionArea | null>(null);
  const areas = COLLECTION_AREAS.filter((a) => cards[a] && (!area || a === area));
  const card = open ? cards[open] : undefined;
  const celebration = card && (
    <Celebration data={recapCardData(card)} source={{ kind: "stats", ready: true }} username={username} host={host} onClose={() => setOpen(null)} />
  );
  if (areas.length === 0) return null;

  if (area) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(area)}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
        >
          <Share2Icon className="size-4" aria-hidden="true" />
          {t("shareAreaAll", { area })}
        </button>
        {celebration}
      </>
    );
  }
  return (
    <div role="group" aria-labelledby="share-collection" className="flex flex-wrap items-center gap-2">
      <span id="share-collection" className="w-full text-sm font-semibold text-muted-foreground">
        {t("shareCollection")}
      </span>
      {areas.map((a) => {
        const Icon = ICONS[a];
        return (
          <button
            key={a}
            type="button"
            onClick={() => setOpen(a)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-border hover:bg-muted"
          >
            <Icon className="size-4" aria-hidden="true" />
            {t("shareArea", { area: a })}
          </button>
        );
      })}
      {celebration}
    </div>
  );
}
