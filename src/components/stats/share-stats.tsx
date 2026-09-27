"use client";

import { Share2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Celebration } from "@/components/celebration";
import type { CardRecap } from "@/core/cards/types";
import { recapCardData } from "@/core/stats/recap";

/** "Share stats" (S1 stats): the period's numbers as a Bold Stats card (Collage one swipe away), in the celebration. */
export function ShareStats({ card, username, host }: { card: CardRecap; username: string | null; host: string }) {
  const t = useTranslations("Stats");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
      >
        <Share2Icon className="size-4" aria-hidden="true" />
        {t("share")}
      </button>
      {open && (
        <Celebration data={recapCardData(card)} source={{ kind: "stats", ready: true }} username={username} host={host} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
