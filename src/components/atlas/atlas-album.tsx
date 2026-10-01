"use client";

import { useTranslations } from "next-intl";
import { atlasSummary, isVisited, type Place } from "@/core/atlas";
import { Link } from "@/i18n/navigation";
import { useWorldMap, WorldMap, type MapTone } from "./world-map";

/**
 * The Atlas on the album (stage 4, ADR 0059): the Been layer's map and its numbers, shown when the owner turned "Show
 * my Atlas on my profile" on (RLS keeps the places from visitors otherwise). Wanted countries stay off it.
 */
export function AtlasAlbum({ places, owner }: { places: Place[]; owner: boolean }) {
  const t = useTranslations("Atlas");
  const map = useWorldMap();
  const visited = places.filter(isVisited);
  const summary = atlasSummary(visited, []);
  const tones = new Map<string, MapTone>(visited.map((p) => [p.country, p.status]));

  return (
    <section aria-labelledby="atlas" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="atlas" className="font-display text-xl font-extrabold">
          {t("title")}
        </h2>
        <p className="font-hand text-xl leading-none text-muted-foreground">
          {t("albumCount", { countries: summary.been, continents: summary.continents })}
        </p>
      </div>
      <div className="-rotate-[0.6deg] overflow-hidden rounded-2xl shadow-sm ring-1 ring-border">
        <WorldMap map={map} tones={tones} label={t("mapBeenAlt", { count: summary.been })} />
      </div>
      {owner && (
        <Link href="/atlas" className="flex min-h-11 items-center self-start text-sm font-semibold text-brand">
          {t("openAtlas")}
        </Link>
      )}
    </section>
  );
}
