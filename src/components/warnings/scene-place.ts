"use client";

import { useTranslations } from "next-intl";
import { formatTimecode, type ScenePlace, type SceneTopicSlug } from "@/core/scene-warnings";

/**
 * Where a scene warning happens, as a short line: "S2 · E5 · 41:10–42:30", "1:02:13", "Chapter 12", or "Throughout"
 * for a warning about the whole title.
 */
export function usePlaceLabel(): (place: ScenePlace) => string {
  const t = useTranslations("SceneWarnings");
  return (place) => {
    const parts: string[] = [];
    if (place.season !== null && place.episode !== null) parts.push(t("episodeCode", { season: place.season, episode: place.episode }));
    if (place.startSec !== null) {
      const from = formatTimecode(place.startSec);
      parts.push(place.endSec !== null && place.endSec !== place.startSec ? t("timeRange", { from, to: formatTimecode(place.endSec) }) : from);
    }
    if (place.unit !== null && place.position !== null) parts.push(t("position", { unit: place.unit, position: place.position }));
    return parts.length > 0 ? parts.join(" · ") : t("throughout");
  };
}

/** "a dog dies" → "A dog dies", where CSS can't do it (inside a <select>). */
export const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A topic's name in the viewer's language ("a dog dies"). */
export function useTopicName(): (slug: SceneTopicSlug) => string {
  const t = useTranslations("WarningTopics");
  return (slug) => t(`names.${slug}`);
}
