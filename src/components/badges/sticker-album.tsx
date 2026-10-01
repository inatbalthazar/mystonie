"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import type { AlbumBadge } from "@/core/badges";
import { cn } from "@/lib/utils";
import { Sheet } from "../sheet";
import { previewClass, ShowAll } from "../show-all";
import { Sticker } from "./sticker";

const TILTS = ["-rotate-6", "rotate-3", "-rotate-2", "rotate-6", "rotate-1", "-rotate-4"];

/**
 * Badges as an album page of stickers (S3 badges & shelf). Earned ones are stuck in at a tilt; with `locked`, the
 * ones still to earn show as dashed spots with their progress. Tapping one tells how it is earned, and when it was.
 * Earned ones come first, then the closest to earning; past two rows the rest wait behind "Show all".
 */
export function StickerAlbum({ badges, compact = false, className }: { badges: AlbumBadge[]; compact?: boolean; className?: string }) {
  const t = useTranslations("Badges");
  const format = useFormatter();
  const [open, setOpen] = useState<AlbumBadge | null>(null);
  const [all, setAll] = useState(false);
  const ratio = (b: AlbumBadge) => (b.earnedAt !== null ? 2 : b.progress / Math.max(1, b.target));
  const sorted = badges.map((b, i) => ({ b, i })).sort((x, y) => ratio(y.b) - ratio(x.b) || x.i - y.i).map(({ b }) => b);
  const [phone, wide] = compact ? [8, 12] : [6, 10];
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <>
      <ul className={cn("grid gap-x-2", compact ? "grid-cols-4 gap-y-2 sm:grid-cols-6" : "grid-cols-3 gap-y-4 sm:grid-cols-5", className)}>
        {sorted.map((b, i) => {
          const earned = b.earnedAt !== null;
          return (
            <li key={b.id} className={previewClass(i, all, phone, wide)}>
              <button
                type="button"
                onClick={() => setOpen(b)}
                aria-haspopup="dialog"
                className="group flex min-h-11 w-full flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Sticker id={b.id} size={compact ? "sm" : "md"} locked={!earned} className={cn("transition-transform group-hover:scale-105", earned && TILTS[i % TILTS.length])} />
                <span className={cn("leading-tight font-bold [overflow-wrap:anywhere]", compact ? "text-[11px]" : "text-xs", !earned && "text-muted-foreground")}>{t(`items.${b.id}.name`)}</span>
                {!earned && (
                  <span className="text-[11px] leading-none text-muted-foreground tabular-nums">{t("progress", { progress: b.progress, target: b.target })}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {badges.length > phone && <ShowAll open={all} onToggle={() => setAll(!all)} count={badges.length} hiddenFromSm={badges.length <= wide} />}
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? t(`items.${open.id}.name`) : ""} closeLabel={t("close")}>
        {open && (
          <div className="flex flex-col items-center gap-3 pb-2 text-center">
            <Sticker id={open.id} size="lg" locked={open.earnedAt === null} className={open.earnedAt ? "-rotate-6" : undefined} />
            <p className="text-lg font-semibold">{t(`items.${open.id}.how`)}</p>
            {open.earnedAt ? (
              <p className="font-hand text-2xl leading-tight text-muted-foreground">
                {open.titleName ? t("earnedWith", { date: date(open.earnedAt), name: open.titleName }) : t("earnedOn", { date: date(open.earnedAt) })}
              </p>
            ) : (
              <div className="flex w-full max-w-xs flex-col gap-1.5">
                <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((open.progress / open.target) * 100)}%` }} />
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">{t("notYet", { progress: open.progress, target: open.target })}</p>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
