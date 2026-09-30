"use client";

import { useCallback, useState, type ReactNode } from "react";
import { BadgeToast } from "@/components/badges/badge-toast";
import { Celebration } from "@/components/celebration";
import type { BadgeNews } from "@/core/badges";
import type { CardData } from "@/core/cards/types";

/**
 * Milestone cards (ADR 0031), badges (ADR 0038) and completed challenges (ADR 0040): `check()` after a finish or a log
 * has been saved asks the server whether it crossed a milestone, earned a sticker or completed a challenge. Each
 * milestone and challenge opens its own celebration in turn, then the new stickers show in one toast. Render `node` when nothing else is being celebrated, so both wait for the Finish card
 * to close.
 */
export function useMilestones({ username, host }: { username: string | null; host: string }): { check: () => void; node: ReactNode } {
  const [queue, setQueue] = useState<CardData[]>([]);
  const [badges, setBadges] = useState<BadgeNews[]>([]);

  const check = useCallback(() => {
    fetch("/api/milestones", { method: "POST" })
      .then((res) =>
        res.ok ? (res.json() as Promise<{ milestones: CardData[]; badges?: BadgeNews[]; challenges?: CardData[] }>) : { milestones: [], badges: [], challenges: [] },
      )
      .then(({ milestones, badges: earned = [], challenges = [] }) => {
        if (milestones.length + challenges.length > 0) setQueue((cur) => [...cur, ...milestones, ...challenges]);
        if (earned.length > 0) setBadges((cur) => [...cur, ...earned.filter((b) => !cur.some((c) => c.id === b.id))]);
      })
      .catch((error: unknown) => console.error(error));
  }, []);

  const current = queue[0];
  const node = current?.milestone || current?.challenge ? (
    <Celebration
      key={current.milestone ? `${current.milestone.metric}-${current.milestone.value}` : `${current.challenge?.month}-${current.challenge?.slug}`}
      data={current}
      source={{ kind: current.milestone ? "milestone" : "challenge", ready: true }}
      animate
      username={username}
      host={host}
      onClose={() => setQueue((cur) => cur.slice(1))}
    />
  ) : badges.length > 0 ? (
    <BadgeToast key={badges.map((b) => b.id).join()} badges={badges} onClose={() => setBadges([])} />
  ) : null;
  return { check, node };
}
