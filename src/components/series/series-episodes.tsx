"use client";

import { CheckIcon, ImageIcon, PartyPopperIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Episode } from "@/core/catalog/types";
import { crossedMilestone } from "@/core/cards/saved";
import type { CardData, CardProgress } from "@/core/cards/types";
import type { CollectionItem, EntryNotes, EntryStatus } from "@/core/collection/entries";
import { episodeKey, nextEpisode, seriesComplete, seriesProgress, type EpisodeRef } from "@/core/collection/episodes";
import { formatRuntime } from "@/core/format/runtime";
import { uuidv7 } from "@/core/ids";
import type { OpTitle } from "@/core/sync/ops";
import { overlayEpisodes, overlayTitleState, type EntrySnapshot, type TitleState } from "@/core/sync/overlay";
import { localDateKey } from "@/core/stats/period";
import { cn } from "@/lib/utils";
import { Celebration } from "../celebration";
import { useMilestones } from "../milestone-celebration";
import { send, useOverlayOps } from "../offline/outbox";

export type Logged = EpisodeRef & { id: string };

/** The series as card inputs (everything but the date and progress). */
export type SeriesCard = Omit<CardData, "finishedOn" | "progress">;

/** The user's entry for the series, when there is one (finish cards and their rating / review). */
export type SeriesEntry = EntrySnapshot;

type LogResponse = { logs: Logged[]; status: EntryStatus };

/** The entry the server answered with, as the series and reading pages hold it. */
export function entrySnapshot(body: unknown): { status: EntryStatus; entry: SeriesEntry } | null {
  const saved = (body as { entry?: CollectionItem } | null)?.entry;
  if (!saved) return null;
  return {
    status: saved.status,
    entry: { id: saved.id, finishedAt: saved.finishedAt, rating: saved.rating ?? null, review: saved.review ?? null, finisherNo: saved.finisherNo ?? null },
  };
}

/**
 * A series' seasons and episodes with one-tap logging (S1 collection → Series): "Next episode",
 * tap an episode to log or un-log it, "Mark season watched", and "Finished the series? 🎉" once every
 * episode of an ended series is logged. Logs show at once and go through the outbox, so they work offline too
 * (S3 offline); one the server refuses drops out with a notice.
 */
export function SeriesEpisodes({
  userId,
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
  /** Who is signed in: the owner of the logs made here. */
  userId: string;
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
  const title: OpTitle = useMemo(
    () => ({ source: "tmdb", kind: "series", externalId, name: card.name, year: card.year ?? null, posterUrl: card.posterUrl ?? null }),
    [externalId, card.name, card.year, card.posterUrl],
  );
  // The server's logs and entry (fresh ones arrive with a refresh), with the changes on this device laid over them.
  const [baseLogs, setBaseLogs] = useState<Logged[]>(initialLogs);
  const [baseState, setBaseState] = useState<TitleState>({ status: initialStatus, entry: initialEntry });
  const [from, setFrom] = useState({ initialLogs, initialStatus, initialEntry });
  if (from.initialLogs !== initialLogs || from.initialStatus !== initialStatus || from.initialEntry !== initialEntry) {
    setFrom({ initialLogs, initialStatus, initialEntry });
    setBaseLogs(initialLogs);
    setBaseState({ status: initialStatus, entry: initialEntry });
  }
  const ops = useOverlayOps(userId);
  const logs = useMemo(() => overlayEpisodes(title, baseLogs, ops), [title, baseLogs, ops]);
  const { status, entry, sync: entrySync } = useMemo(() => overlayTitleState(title, baseState, ops), [title, baseState, ops]);
  const [askFinish, setAskFinish] = useState(false);
  const [notice, setNotice] = useState("");
  // A Progress card offered after a log (not forced), and the open celebration.
  const [offer, setOffer] = useState<{ logId: string; progress: CardProgress } | null>(null);
  const [celebrating, setCelebrating] = useState<"finish" | "progress" | null>(null);
  const [animate, setAnimate] = useState(false);
  // A log or a finish can cross a milestone (500 episodes, 1,000 hours): its card follows, once nothing else is open.
  const milestones = useMilestones({ username, host });

  const logged = new Map(logs.map((l) => [episodeKey(l), l]));
  const progress = seriesProgress(episodes, logs, today);
  const next = nextEpisode(episodes, logs, today);
  const seasons = [...new Set(episodes.filter((e) => e.season > 0).map((e) => e.season))].sort((a, b) => a - b);
  // Which season starts open. Fixed after the first render, so logging doesn't fold what the user opened.
  const [openSeason] = useState(() => next?.season ?? seasons[0]);
  const format = useFormatter();
  const airDate = (date: string) => format.dateTime(new Date(`${date}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" });

  const runtimes = new Map(episodes.map((e) => [episodeKey(e), e.runtimeMin ?? card.runtimeMin ?? null]));

  async function log(refs: EpisodeRef[]) {
    const fresh = refs
      .filter((r) => !logged.has(episodeKey(r)))
      .map((r) => ({ id: uuidv7(), season: r.season, episode: r.episode, runtimeMin: runtimes.get(episodeKey(r)) ?? null }));
    if (fresh.length === 0) return;
    setNotice(fresh.length === 1 ? t("loggedOne", { season: fresh[0]!.season, episode: fresh[0]!.episode }) : t("loggedMany", { count: fresh.length }));
    // What comes next is worked out here, so it works offline too: the Progress card (downloadable at once, shared
    // once saved), or "Finished the series?" after the last episode.
    const now = [...logs, ...fresh];
    const after = seriesProgress(episodes, now, today);
    if (status !== "finished" && seriesComplete(after, ended)) {
      setAskFinish(true);
      setOffer(null);
    } else {
      setOffer(progressOffer(fresh, now, progress.watched, after.watched, after.aired));
    }
    const saved = await send(userId, { type: "episodes.log", title, episodes: fresh });
    if (!saved.ok) {
      setOffer(null);
      setAskFinish(false);
      return setNotice(t("logError"));
    }
    const result = saved.body as LogResponse;
    setBaseLogs(result.logs);
    setBaseState((cur) => ({ ...cur, status: result.status }));
    // An episode logged before on another device keeps its log: the card points at that one.
    setOffer((cur) => cur && { ...cur, logId: result.logs.find((l) => l.season === cur.progress.season && l.episode === cur.progress.episode)?.id ?? cur.logId });
    milestones.check();
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
    setNotice(t("unlogged", { season: entry.season, episode: entry.episode }));
    setOffer((cur) => (cur?.logId === entry.id ? null : cur));
    const saved = await send(userId, { type: "episode.unlog", logId: entry.id, title, season: entry.season, episode: entry.episode });
    if (!saved.ok) return setNotice(t("logError"));
    setBaseLogs((cur) => cur.filter((l) => l.id !== entry.id));
  }

  async function finish() {
    setAskFinish(false);
    setOffer(null);
    setNotice(t("finishedNotice"));
    // Celebrate first: the card shows now and can be shared once the entry is saved.
    setAnimate(true);
    setCelebrating("finish");
    const saved = await send(userId, { type: "entry.add", entryId: entry?.id ?? uuidv7(), title, status: "finished", finishedAt: new Date().toISOString() });
    if (!saved.ok) {
      setCelebrating(null);
      return setNotice(t("logError"));
    }
    const kept = entrySnapshot(saved.body);
    if (kept) setBaseState(kept);
    if (!saved.superseded) milestones.check();
  }

  async function closeCelebration(notes: EntryNotes | null) {
    setCelebrating(null);
    if (!notes || !entry) return;
    const saved = await send(userId, { type: "entry.notes", entryId: entry.id, title, ...notes });
    if (!saved.ok) return setNotice(t("logError"));
    const kept = entrySnapshot(saved.body);
    if (kept) setBaseState(kept);
  }

  const finishCard: CardData = {
    ...card,
    rating: entry?.rating ?? null,
    review: entry?.review ?? null,
    finisherNo: entry?.finisherNo ?? null,
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
          source={{ kind: "finish", entryId: entry?.id ?? "", ready: !!entry?.id && status === "finished" && !entrySync }}
          survivedFor={{ kind: "series", externalId }}
          animate={animate}
          username={username}
          host={host}
          onClose={closeCelebration}
        />
      )}
      {celebrating === "progress" && offer && (
        <Celebration
          data={{ ...card, finishedOn: today, progress: offer.progress }}
          source={{ kind: "progress", episodeLogId: offer.logId, ready: !logs.find((l) => l.id === offer.logId)?.sync }}
          username={username}
          host={host}
          onClose={() => setCelebrating(null)}
        />
      )}
      {!celebrating && milestones.node}

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
                        disabled={!out}
                        aria-pressed={!!entry}
                        onClick={() => (entry ? unlog(entry) : log([e]))}
                        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full ring-2",
                            entry ? "bg-brand text-brand-foreground ring-brand" : "ring-border",
                            // Saved on this device, not on the server yet: a dashed stamp.
                            entry?.sync === "waiting" && "bg-brand/60 ring-brand/60 outline-2 outline-offset-2 outline-brand/60 outline-dashed",
                          )}
                        >
                          {entry && <CheckIcon className="size-4" aria-hidden="true" />}
                          {entry?.sync === "waiting" && <span className="sr-only">{t("waitingToSync")}</span>}
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
