"use client";

import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SearchResult } from "@/core/catalog/types";
import { sceneTopicForDtdd } from "@/core/scene-warnings";
import { BADGE_TITLES_MAX, type BadgeTopic } from "@/core/warnings";
import { cn } from "@/lib/utils";

/**
 * "Content warning: a dog dies and spiders": what a warning badge says (for labels on the element around it). Our own
 * topics (S3) are named in the viewer's language; other DoesTheDogDie topics by DTDD's (English) name.
 */
export function useWarningLabel(): (topics: readonly BadgeTopic[] | undefined) => string | null {
  const t = useTranslations("Warnings");
  const format = useFormatter();
  const nameOf = useTopicName();
  return (topics) => {
    const named = (topics ?? []).flatMap((topic) => {
      const name = nameOf(topic);
      return name ? [name] : [];
    });
    return named.length > 0 ? t("badge", { topics: format.list(named, { type: "conjunction" }) }) : null;
  };
}

/** A topic's name: ours (S3) in the viewer's language, other DoesTheDogDie topics by DTDD's (English) name. */
export function useTopicName(): (topic: BadgeTopic) => string | null {
  const names = useTranslations("WarningTopics");
  return (topic) => {
    const ours = sceneTopicForDtdd(topic.id);
    return ours ? names(`names.${ours}`) : (topic.name ?? null);
  };
}

/**
 * S2 content warnings: a small warning sticker on a poster whose title has a Yes for one of the user's avoid-topics.
 * Decorative: the element around it carries the words (`useWarningLabel`), and `title` shows them on hover.
 */
export function WarningBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      title={label}
      className={cn(
        "flex size-7 rotate-[-8deg] items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md ring-2 ring-card",
        className,
      )}
    >
      <TriangleAlertIcon className="size-4" />
    </span>
  );
}

/**
 * Stage 4, "Check a title before you watch": a quiet check sticker on a Want-to-watch poster that DoesTheDogDie knows
 * and that has nothing from the user's avoid-topics. Decorative, like `WarningBadge`.
 */
export function ClearBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      title={label}
      className={cn("flex size-7 rotate-[6deg] items-center justify-center rounded-full bg-card text-brand shadow-md ring-2 ring-brand/30", className)}
    >
      <CheckIcon className="size-4" strokeWidth={3} />
    </span>
  );
}

/**
 * Warning badges for search results (`/api/warnings/badges`: cached DTDD data and our own warnings), by
 * `kind:externalId`. Signed-in screens only; anything that fails just shows no badges.
 */
export function useSearchBadges(results: readonly SearchResult[] | null): Record<string, BadgeTopic[]> {
  const [badges, setBadges] = useState<{ key: string; badges: Record<string, BadgeTopic[]> }>({ key: "", badges: {} });
  const titles = (results ?? []).slice(0, BADGE_TITLES_MAX).map((r) => ({ kind: r.kind, externalId: r.externalId }));
  const key = titles.map((t) => `${t.kind}:${t.externalId}`).join(",");

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch("/api/warnings/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: key.split(",").map((k) => ({ kind: k.split(":")[0], externalId: k.slice(k.indexOf(":") + 1) })) }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ badges: Record<string, BadgeTopic[]> }>) : null))
      .then((body) => body && setBadges({ key, badges: body.badges }))
      .catch(() => {});
    return () => controller.abort();
  }, [key]);

  return badges.key === key ? badges.badges : {};
}
