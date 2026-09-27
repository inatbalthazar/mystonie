"use client";

import { useEffect, useState } from "react";
import { CardPreview } from "@/cards/card-preview";
import { usePosterPalette } from "@/cards/use-poster-palette";
import type { TemplateId } from "@/core/cards/templates";
import type { CardData, CardSize } from "@/core/cards/types";
import { track } from "@/lib/analytics";

/**
 * A shared card on `/c/[id]`: the uploaded PNG, or (no upload yet, or it failed to load) the same card
 * re-rendered from its saved inputs.
 */
export function SharedCardImage({
  imageUrl,
  alt,
  templateId,
  size,
  data,
  host,
}: {
  imageUrl: string | null;
  alt: string;
  templateId: TemplateId;
  size: CardSize;
  data: CardData;
  host: string;
}) {
  const [broken, setBroken] = useState(false);
  const palette = usePosterPalette(data.posterUrl);
  if (imageUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a user PNG from Storage, shown as is
      <img
        src={imageUrl}
        alt={alt}
        width={1080}
        height={size === "story" ? 1920 : 1350}
        onError={() => setBroken(true)}
        className="h-auto w-full rounded-xl"
      />
    );
  }
  return (
    <div role="img" aria-label={alt}>
      <CardPreview template={templateId} data={data} size={size} palette={palette} host={host} />
    </div>
  );
}

// Card visit → sign-up attribution. localStorage (not session) so the email-link tab still counts;
// only a template id and a time, nothing personal.
const KEY = "mystonie.fromCard";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** On `/c/[id]`: remembers that this visitor came from a card. */
export function RememberCardVisit({ tpl }: { tpl: string }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ tpl, at: Date.now() }));
    } catch {
      // Storage blocked: attribution is best effort.
    }
  }, [tpl]);
  return null;
}

/** On the signed-in landing page: `signup_from_card` once, when a new account follows a card visit. */
export function SignupFromCard({ newAccount }: { newAccount: boolean }) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      window.localStorage.removeItem(KEY);
      const visit = JSON.parse(raw) as { tpl?: unknown; at?: unknown };
      if (newAccount && typeof visit.at === "number" && Date.now() - visit.at < MAX_AGE_MS) {
        track("signup_from_card", typeof visit.tpl === "string" ? { tpl: visit.tpl } : {});
      }
    } catch {
      // Storage blocked or garbage: skip.
    }
  }, [newAccount]);
  return null;
}
