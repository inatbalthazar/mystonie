"use client";

import { Share2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Celebration } from "@/components/celebration";
import type { CardRecap } from "@/core/cards/types";
import { recapCardData } from "@/core/stats/recap";

/** "Share my year": the Year in Review card (Yearbook first; Bold Stats and Collage one swipe away), in the celebration. */
export function ShareYear({ card, username, host }: { card: CardRecap; username: string | null; host: string }) {
  const t = useTranslations("Review");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 text-lg font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
      >
        <Share2Icon className="size-5" aria-hidden="true" />
        {t("share")}
      </button>
      {open && (
        <Celebration data={recapCardData(card)} source={{ kind: "year_review", ready: true }} animate username={username} host={host} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
