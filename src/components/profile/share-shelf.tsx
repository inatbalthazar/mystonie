"use client";

import { Share2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Celebration } from "@/components/celebration";
import type { CardData, CardShelf } from "@/core/cards/types";

/**
 * "Share my shelf" under the Shelf on Me (ADR 0095): the Shelf's top ten as a card, favourites numbered first, in the
 * celebration's share sheet like every card. Made when tapped (today's date in the viewer's zone).
 */
export function ShareShelf({ shelf, username, host }: { shelf: CardShelf; username: string | null; host: string }) {
  const t = useTranslations("Album");
  const tc = useTranslations("Card");
  const [sharing, setSharing] = useState<CardData | null>(null);

  function share() {
    setSharing({ kind: "movie", name: tc("shelfName"), posterUrl: null, finishedOn: new Date().toLocaleDateString("en-CA"), shelf });
  }

  return (
    <>
      <button type="button" onClick={share} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-brand">
        <Share2Icon className="size-4" aria-hidden="true" />
        {t("shareShelf")}
      </button>
      {sharing && <Celebration data={sharing} source={{ kind: "shelf", ready: true }} username={username} host={host} onClose={() => setSharing(null)} />}
    </>
  );
}
