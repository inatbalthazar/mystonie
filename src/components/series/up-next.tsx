"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Episode } from "@/core/catalog/types";
import { nextEpisode } from "@/core/collection/episodes";
import { uuidv7 } from "@/core/ids";
import { localDateKey } from "@/core/stats/period";
import { Link } from "@/i18n/navigation";
import { postEpisodes, type Logged } from "./series-episodes";

export type UpNextSeries = {
  externalId: string;
  name: string;
  posterUrl: string | null;
  episodes: Episode[];
  logs: Logged[];
};

/** "Up next" (S1 collection): the next episode of every series being watched, logged in one tap. */
export function UpNext({ series, timeZone }: { series: UpNextSeries[]; timeZone: string }) {
  const t = useTranslations("Series");
  const [today] = useState(() => localDateKey(Date.now(), timeZone));
  const [logs, setLogs] = useState(() => new Map(series.map((s) => [s.externalId, s.logs])));
  const [notice, setNotice] = useState("");

  const cards = series.flatMap((s) => {
    const next = nextEpisode(s.episodes, logs.get(s.externalId) ?? [], today);
    return next ? [{ ...s, next }] : [];
  });
  if (cards.length === 0 && !notice) return null;

  async function log(s: UpNextSeries, next: Episode) {
    const before = logs.get(s.externalId) ?? [];
    const entry = { id: uuidv7(), season: next.season, episode: next.episode, pending: true };
    setLogs((cur) => new Map(cur).set(s.externalId, [...before, entry]));
    setNotice(t("loggedNamed", { name: s.name, season: next.season, episode: next.episode }));
    try {
      const result = await postEpisodes(s.externalId, [entry]);
      setLogs((cur) => new Map(cur).set(s.externalId, result.logs));
    } catch {
      setLogs((cur) => new Map(cur).set(s.externalId, before));
      setNotice(t("logError"));
    }
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
              className="h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-bold text-brand-foreground hover:bg-brand/90"
            >
              {t("logEpisode", { episode: next.episode })}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
