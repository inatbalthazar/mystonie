"use client";

import { CheckIcon, ImageIcon, PartyPopperIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Episode } from "@/core/catalog/types";
import { crossedMilestone } from "@/core/cards/saved";
import type { CardData, CardProgress } from "@/core/cards/types";
import type { CollectionItem, EntryNotes, EntryStatus } from "@/core/collection/entries";
import { episodeKey, nextEpisode, seriesComplete, seriesProgress, type EpisodeRef } from "@/core/collection/episodes";
import { formatRuntime } from "@/core/format/runtime";
import { uuidv7 } from "@/core/ids";
import { localDateKey } from "@/core/stats/period";
import { cn } from "@/lib/utils";
import { Celebration } from "../celebration";

export type Logged = EpisodeRef & { id: string; pending?: boolean };

/** The series as card inputs (everything but the date and progress). */
export type SeriesCard = Omit<CardData, "finishedOn" | "progress">;

/** The user's entry for the series, when there is one (finish cards and their rating / review). */
export type SeriesEntry = { id: string; finishedAt: string | null; rating: number | null; review: string | null };

type LogResponse = { logs: Logged[]; status: EntryStatus };

/** POST /api/episodes. Throws on failure. */
export async function postEpisodes(externalId: string, episodes: Logged[]): Promise<LogResponse> {
  const res = await fetch("/api/episodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ externalId, episodes: episodes.map(({ id, season, episode }) => ({ id, season, episode })) }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/**
 * A series' seasons and episodes with one-tap logging (S1 collection → Series): "Next episode",
 * tap an episode to log or un-log it, "Mark season watched", and "Finished the series? 🎉" once every
 * episode of an ended series is logged. Optimistic, rolled back on failure.
 */
export function SeriesEpisodes({
  externalId,
  episodes,
  ended,
  initialLogs,
  initialStatus,
  initialEntry,
  timeZone,
  card,
  username,
  host,
}: {
  externalId: string;
  episodes: Episode[];
  ended: boolean;
  initialLogs: Logged[];
  initialStatus: EntryStatus | null;
  initialEntry: SeriesEntry | null;
  timeZone: string;
  card: SeriesCard;
  username: string;
  host: string;
}) {
  const t = useTranslations("Series");
  const locale = useLocale();
  const [today] = useState(() => localDateKey(Date.now(), timeZone));
  const [logs, setLogs] = useState<Logged[]>(initialLogs);
  const [status, setStatus] = useState<EntryStatus | null>(initialStatus);
  const [askFinish, setAskFinish] = useState(false);
  const [notice, setNotice] = useState("");
  const [entry, setEntry] = useState<SeriesEntry | null>(initialEntry);
  // A Progress card offered after a log (not forced), and the open celebration.
  const [offer, setOffer] = useState<{ logId: string; progress: CardProgress } | null>(null);
  const [celebrating, setCelebrating] = useState<"finish" | "progress" | null>(null);
  const [animate, setAnimate] = useState(false);

  const logged = new Map(logs.map((l) => [episodeKey(l), l]));
  const progress = seriesProgress(episodes, logs, today);
  const next = nextEpisode(episodes, logs, today);
  const seasons = [...new Set(episodes.filter((e) => e.season > 0).map((e) => e.season))].sort((a, b) => a - b);
  // Which season starts open. Fixed after the first render, so logging doesn't fold what the user opened.
  const [openSeason] = useState(() => next?.season ?? seasons[0]);
  const format = useFormatter();
  const airDate = (date: string) => format.dateTime(new Date(`${date}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" });

  async function log(refs: EpisodeRef[]) {
    const fresh = refs.filter((r) => !logged.has(episodeKey(r))).map((r) => ({ ...r, id: uuidv7(), pending: true }));
    if (fresh.length === 0) return;
    const before = logs;
    setLogs((cur) => [...cur, ...fresh]);
    setNotice(fresh.length === 1 ? t("loggedOne", { season: fresh[0]!.season, episode: fresh[0]!.episode }) : t("loggedMany", { count: fresh.length }));
    try {
      const result = await postEpisodes(externalId, fresh);
      setLogs(result.logs);
      setStatus(result.status);
      const after = seriesProgress(episodes, result.logs, today);
      if (result.status !== "finished" && seriesComplete(after, ended)) {
        setAskFinish(true);
        setOffer(null);
      } else {
        setOffer(progressOffer(fresh, result.logs, progress.watched, after.watched, after.aired));
      }
    } catch {
      setLogs(before);
      setNotice(t("logError"));
    }
  }

  /** The Progress card for the furthest episode just logged: how far along, watched time, milestone crossed. */
  function progressOffer(fresh: EpisodeRef[], saved: Logged[], before: number, after: number, aired: number) {
    const last = [...fresh].sort((a, b) => a.season - b.season || a.episode - b.episode).at(-1)!;
    const log = saved.find((l) => episodeKey(l) === episodeKey(last));
    if (!log || aired === 0) return null;
    const done = new Set(saved.map(episodeKey));
    let watchedMin = 0;
    for (const e of episodes) if (e.season > 0 && done.has(episodeKey(e))) watchedMin += e.runtimeMin ?? card.runtimeMin ?? 0;
    return {
      logId: log.id,
      progress: {
        season: last.season,
        episode: last.episode,
        watched: after,
        total: aired,
        watchedMin: watchedMin || null,
        milestone: crossedMilestone(before, after, aired),
      },
    };
  }

  async function unlog(entry: Logged) {
    const before = logs;
    setLogs((cur) => cur.filter((l) => l.id !== entry.id));
    setNotice(t("unlogged", { season: entry.season, episode: entry.episode }));
    try {
      const res = await fetch(`/api/episodes/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleted: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setLogs(before);
      setNotice(t("logError"));
    }
  }

  async function finish() {
    setAskFinish(false);
    setOffer(null);
    const before = status;
    const beforeEntry = entry;
    setStatus("finished");
    setNotice(t("finishedNotice"));
    // Celebrate first: the card shows now and can be shared once the entry is saved.
    setEntry((cur) => (cur ? { ...cur, finishedAt: new Date().toISOString() } : null));
    setAnimate(true);
    setCelebrating("finish");
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: uuidv7(), title: { source: "tmdb", kind: "series", externalId }, status: "finished" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const saved = (await res.json()).entry as CollectionItem;
      setEntry({ id: saved.id, finishedAt: saved.finishedAt, rating: saved.rating ?? null, review: saved.review ?? null });
    } catch {
      setStatus(before);
      setEntry(beforeEntry);
      setCelebrating(null);
      setNotice(t("logError"));
    }
  }

  async function closeCelebration(notes: EntryNotes | null) {
    setCelebrating(null);
    if (!notes || !entry) return;
    const before = entry;
    setEntry({ ...entry, ...notes });
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setEntry(before);
      setNotice(t("logError"));
    }
  }

  const finishCard: CardData = {
    ...card,
    rating: entry?.rating ?? null,
    review: entry?.review ?? null,
    finishedOn: entry?.finishedAt ? localDateKey(Date.parse(entry.finishedAt), timeZone) : today,
  };

  const label = (e: EpisodeRef) => t("episodeCode", { season: e.season, episode: e.episode });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold">{t("progress", { watched: progress.watched, total: progress.aired })}</span>
          {status && <span className="text-muted-foreground">{t("status", { status })}</span>}
        </div>
        <div
          role="progressbar"
          aria-label={t("progressLabel")}
          aria-valuemin={0}
          aria-valuemax={progress.aired}
          aria-valuenow={progress.watched}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress.aired ? (progress.watched / progress.aired) * 100 : 0}%` }} />
        </div>
      </section>

      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {notice}
      </p>

      {offer && !askFinish && (
        <section
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 pl-4",
            offer.progress.milestone ? "border-2 border-dashed border-brand/60 bg-brand-soft/40" : "bg-card ring-1 ring-border",
          )}
        >
          <p className="min-w-0 font-semibold">
            {offer.progress.milestone
              ? t("milestoneOffer", { milestone: offer.progress.milestone })
              : t("progressOffer", { season: offer.progress.season, episode: offer.progress.episode })}
          </p>
          <button
            type="button"
            onClick={() => {
              setAnimate(false);
              setCelebrating("progress");
            }}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-foreground hover:bg-brand/90"
          >
            <ImageIcon className="size-4" aria-hidden="true" />
            {t("makeProgressCard")}
          </button>
        </section>
      )}

      {status === "finished" && entry?.finishedAt && (
        <button
          type="button"
          onClick={() => {
            setAnimate(false);
            setCelebrating("finish");
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand-soft"
        >
          <ImageIcon className="size-5" aria-hidden="true" />
          {t("makeFinishCard")}
        </button>
      )}

      {celebrating === "finish" && (
        <Celebration
          data={finishCard}
          source={{ kind: "finish", entryId: entry?.id ?? "", ready: !!entry?.id && status === "finished" }}
          animate={animate}
          username={username}
          host={host}
          onClose={closeCelebration}
        />
      )}
      {celebrating === "progress" && offer && (
        <Celebration
          data={{ ...card, finishedOn: today, progress: offer.progress }}
          source={{ kind: "progress", episodeLogId: offer.logId, ready: true }}
          username={username}
          host={host}
          onClose={() => setCelebrating(null)}
        />
      )}

      {askFinish && (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-brand/60 bg-brand-soft/40 p-4">
          <p className="flex items-center gap-2 font-display text-lg font-extrabold">
            <PartyPopperIcon className="size-5 text-brand" aria-hidden="true" />
            {t("askFinish")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={finish} className="h-11 rounded-xl bg-brand px-5 font-bold text-brand-foreground hover:bg-brand/90">
              {t("markFinished")}
            </button>
            <button type="button" onClick={() => setAskFinish(false)} className="h-11 rounded-xl px-5 font-semibold ring-1 ring-border hover:bg-muted">
              {t("notYet")}
            </button>
          </div>
        </section>
      )}

      {next ? (
        <button
          type="button"
          onClick={() => log([next])}
          className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-brand px-5 py-3 text-left text-brand-foreground shadow-sm hover:bg-brand/90"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold tracking-wide uppercase opacity-80">{t("nextEpisode")}</span>
            <span className="truncate font-bold">
              {label(next)}
              {next.name && ` · ${next.name}`}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-brand-foreground/15 px-3 py-1 text-sm font-bold">{t("logIt")}</span>
        </button>
      ) : (
        progress.aired > 0 && <p className="font-hand text-2xl text-muted-foreground">{t("caughtUp")}</p>
      )}

      {episodes.length === 0 && <p className="text-sm text-muted-foreground">{t("noEpisodes")}</p>}

      {seasons.map((season) => {
        const inSeason = episodes.filter((e) => e.season === season).sort((a, b) => a.episode - b.episode);
        const aired = inSeason.filter((e) => e.airDate !== null && e.airDate <= today);
        const watched = aired.filter((e) => logged.has(episodeKey(e))).length;
        return (
          <details key={season} open={season === openSeason} className="group rounded-2xl bg-card ring-1 ring-border">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold">
              <span>{t("season", { season })}</span>
              <span className="text-sm text-muted-foreground">{t("seasonProgress", { watched, total: aired.length })}</span>
            </summary>
            <div className="flex flex-col gap-1 px-2 pb-3">
              {watched < aired.length && (
                <button
                  type="button"
                  onClick={() => log(aired)}
                  className="mx-2 mb-1 h-11 self-start rounded-xl px-4 text-sm font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand-soft"
                >
                  {t("markSeason", { season })}
                </button>
              )}
              <ul className="flex flex-col">
                {inSeason.map((e) => {
                  const entry = logged.get(episodeKey(e));
                  const out = e.airDate !== null && e.airDate <= today;
                  return (
                    <li key={e.episode}>
                      <button
                        type="button"
                        disabled={!out || entry?.pending}
                        aria-pressed={!!entry}
                        onClick={() => (entry ? unlog(entry) : log([e]))}
                        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full ring-2",
                            entry ? "bg-brand text-brand-foreground ring-brand" : "ring-border",
                          )}
                        >
                          {entry && <CheckIcon className="size-4" aria-hidden="true" />}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">
                            {label(e)}
                            {e.name && ` · ${e.name}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {!out
                              ? e.airDate
                                ? t("airs", { date: airDate(e.airDate) })
                                : t("notAired")
                              : e.runtimeMin
                                ? formatRuntime(e.runtimeMin, locale)
                                : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        );
      })}
    </div>
  );
}
