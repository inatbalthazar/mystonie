"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import type { BadgeNews } from "@/core/badges";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { Sticker } from "./sticker";

const SHOWN = 3;

/**
 * "New sticker!" (S3 badges & shelf): the badges a save just earned, slapped onto a paper note above the tab bar
 * with the stamp animation (none with reduced motion). It stays until closed, and links to the sticker album.
 */
export function BadgeToast({ badges, onClose }: { badges: BadgeNews[]; onClose: () => void }) {
  const t = useTranslations("Badges");
  const first = badges[0]!;

  useEffect(() => {
    for (const b of badges) track("badge_earned", { badge: b.id });
  }, [badges]);

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
      <div className="pointer-events-auto relative flex w-full max-w-sm motion-safe:animate-rise items-center gap-3 rounded-2xl bg-card p-3 pr-12 shadow-[0_2px_4px_rgb(0_0_0/0.08),0_18px_36px_-14px_rgb(0_0_0/0.5)] ring-1 ring-border">
        <span aria-hidden="true" className="absolute -top-2.5 left-8 h-5 w-16 -rotate-3 rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/15 dark:bg-brand/30" />
        <span className="flex shrink-0 -space-x-5">
          {badges.slice(0, SHOWN).map((b) => (
            <Sticker key={b.id} id={b.id} size="sm" className="motion-safe:animate-stamp motion-reduce:-rotate-6" />
          ))}
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="font-display text-lg leading-tight font-extrabold">{t("newSticker", { count: badges.length })}</p>
          <p className="text-sm leading-snug font-semibold [overflow-wrap:anywhere]">
            {badges.map((b) => t(`items.${b.id}.name`)).join(" · ")}
          </p>
          {badges.length === 1 && first.titleName && (
            <p className="font-hand text-lg leading-tight text-muted-foreground [overflow-wrap:anywhere]">{t("newStickerWith", { name: first.titleName })}</p>
          )}
          <Link href="/stats#stickers" onClick={onClose} className="-my-2 flex min-h-11 items-center self-start text-sm font-bold text-brand underline-offset-4 hover:underline">
            {t("seeAlbum")}
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
