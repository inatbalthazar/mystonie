"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Episode } from "@/core/catalog/types";
import { nextEpisode } from "@/core/collection/episodes";
import { uuidv7 } from "@/core/ids";
import type { OpTitle } from "@/core/sync/ops";
import { overlayEpisodes } from "@/core/sync/overlay";
import { localDateKey } from "@/core/stats/period";
import { Link } from "@/i18n/navigation";
import { send, useOverlayOps } from "../offline/outbox";
import type { Logged } from "./series-episodes";

export type UpNextSeries = {
  externalId: string;
  name: string;
  posterUrl: string | null;
  episodes: Episode[];
  logs: Logged[];
};

const seriesTitle = (s: UpNextSeries): OpTitle => ({ source: "tmdb", kind: "series", externalId: s.externalId, name: s.name, year: null, posterUrl: s.posterUrl });

/**
 * "Up next" (S1 collection): the next episode of every series being watched, logged in one tap. Logs go through the
 * outbox (S3 offline), so this works offline too; the server's logs come with the page, the ones waiting on this
 * device are laid over them.
 */
export function UpNext({ userId, series, timeZone }: { userId: string; series: UpNextSeries[]; timeZone: string }) {
  const t = useTranslations("Series");
  const [today] = useState(() => localDateKey(Date.now(), timeZone));
  const [notice, setNotice] = useState("");
  const ops = useOverlayOps(userId);

  const cards = series.flatMap((s) => {
    const next = nextEpisode(s.episodes, overlayEpisodes(seriesTitle(s), s.logs, ops), today);
    return next ? [{ ...s, next }] : [];
  });
  if (cards.length === 0 && !notice) return null;

  async function log(s: UpNextSeries, next: Episode) {
    setNotice(t("loggedNamed", { name: s.name, season: next.season, episode: next.episode }));
    const saved = await send(userId, {
      type: "episodes.log",
      title: seriesTitle(s),
      episodes: [{ id: uuidv7(), season: next.season, episode: next.episode, runtimeMin: next.runtimeMin }],
    });
    if (!saved.ok) setNotice(t("logError"));
  }

  return (
    <section aria-labelledby="up-next" className="mb-4 flex flex-col gap-3">
      <h2 id="up-next" className="font-display text-xl font-extrabold">
        {t("upNext")}
      </h2>
      <p role="status" className="sr-only">
        {notice}
      </p>
      <ul className="flex flex-col gap-2">
        {cards.map(({ next, ...s }) => (
          <li key={s.externalId} className="flex items-center gap-3 rounded-2xl bg-card p-2 pr-3 ring-1 ring-border">
            <span className="relative aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-md bg-muted">
              {s.posterUrl && <Image src={s.posterUrl} alt="" fill unoptimized sizes="44px" className="object-cover" />}
            </span>
            <Link href={`/title/series/${s.externalId}`} className="flex min-w-0 flex-1 flex-col hover:underline">
              <span className="truncate font-semibold">{s.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {t("episodeCode", { season: next.season, episode: next.episode })}
                {next.name && ` · ${next.name}`}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => log(s, next)}
              aria-label={t("logNamed", { name: s.name, season: next.season, episode: next.episode })}
              className="h-11 shrink-0 rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground hover:bg-brand/90 press"
            >
              {t("logEpisode", { episode: next.episode })}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
