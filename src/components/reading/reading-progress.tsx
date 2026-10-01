"use client";

import { ImageIcon, PartyPopperIcon, XIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import type { ReadingKind } from "@/core/catalog/types";
import { readingProgress } from "@/core/cards/saved";
import type { CardData, CardReading } from "@/core/cards/types";
import type { EntryNotes, EntryStatus } from "@/core/collection/entries";
import { READING_SECONDS, readingAmounts, readingPosition, unitsFor, unitTotal, type ReadingLengths, type ReadingLog, type ReadingUnit } from "@/core/collection/reading";
import { formatRuntime } from "@/core/format/runtime";
import { uuidv7 } from "@/core/ids";
import type { OpTitle } from "@/core/sync/ops";
import { overlayReadingLogs, overlayTitleState, type EntrySnapshot, type ReadingLogged, type TitleState } from "@/core/sync/overlay";
import { localDateKey } from "@/core/stats/period";
import { cn } from "@/lib/utils";
import { Celebration } from "../celebration";
import { useMilestones } from "../milestone-celebration";
import { send, useOverlayOps } from "../offline/outbox";
import { entrySnapshot } from "../series/series-episodes";

export type ReadLogged = ReadingLogged;

/** The book or manga as card inputs (everything but the date and progress). */
export type ReadingCard = Omit<CardData, "finishedOn" | "reading" | "progress">;

/** The user's entry for the title, when there is one (finish cards and their rating / review). */
export type ReadingEntry = EntrySnapshot;

const HISTORY = 8;

const asLogs = (logs: readonly ReadLogged[]): ReadingLog[] => logs.map((l) => ({ ...l, titleId: "title" }));

/**
 * Reading progress for a book or manga (S2 books & manga): where the reader is, one tap to log the next page, chapter or
 * volume (or type any number: catching up on chapter 1100 is one log), the recent log with undo, a Progress card
 * offered after each log, and "Finished it? 🎉" once the end is reached. Logs show at once and go through the outbox,
 * so they work offline too (S3 offline); one the server refuses drops out with a notice.
 */
export function ReadingProgress({
  userId,
  kind,
  externalId,
  lengths,
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
  kind: ReadingKind;
  externalId: string;
  lengths: ReadingLengths;
  initialLogs: ReadLogged[];
  initialStatus: EntryStatus | null;
  initialEntry: ReadingEntry | null;
  timeZone: string;
  card: ReadingCard;
  username: string;
  host: string;
}) {
  const t = useTranslations("Reading");
  const locale = useLocale();
  const format = useFormatter();
  const inputId = useId();
  const [today] = useState(() => localDateKey(Date.now(), timeZone));
  const title: OpTitle = useMemo(
    () => ({ source: kind === "book" ? "google_books" : "anilist", kind, externalId, name: card.name, year: card.year ?? null, posterUrl: card.posterUrl ?? null }),
    [kind, externalId, card.name, card.year, card.posterUrl],
  );
  // The server's logs and entry (fresh ones arrive with a refresh), with the changes on this device laid over them.
  const [baseLogs, setBaseLogs] = useState<ReadLogged[]>(initialLogs);
  const [baseState, setBaseState] = useState<TitleState>({ status: initialStatus, entry: initialEntry });
  const [from, setFrom] = useState({ initialLogs, initialStatus, initialEntry });
  if (from.initialLogs !== initialLogs || from.initialStatus !== initialStatus || from.initialEntry !== initialEntry) {
    setFrom({ initialLogs, initialStatus, initialEntry });
    setBaseLogs(initialLogs);
    setBaseState({ status: initialStatus, entry: initialEntry });
  }
  const ops = useOverlayOps(userId);
  const logs = useMemo(() => overlayReadingLogs(title, baseLogs, ops), [title, baseLogs, ops]);
  const { status, entry, sync: entrySync } = useMemo(() => overlayTitleState(title, baseState, ops), [title, baseState, ops]);
  // Manga: chapters unless only volumes were logged so far.
  const [unit, setUnit] = useState<ReadingUnit>(() => {
    const units = unitsFor(kind);
    return units.find((u) => readingPosition(initialLogs, u) > 0) ?? units[0]!;
  });
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState("");
  const [askFinish, setAskFinish] = useState(false);
  const [offer, setOffer] = useState<{ logId: string; reading: CardReading } | null>(null);
  const [celebrating, setCelebrating] = useState<"finish" | "progress" | null>(null);
  const [animate, setAnimate] = useState(false);
  // Finishing can cross a milestone (the 100th title): its card follows the Finish card.
  const milestones = useMilestones({ username, host });

  const n = (v: number) => format.number(v);
  const position = readingPosition(logs, unit);
  const total = unitTotal(lengths, unit);
  const seconds = readingAmounts(asLogs(logs)).reduce((sum, { log, amount }) => sum + amount * READING_SECONDS[log.unit], 0);
  const label = (u: ReadingUnit, p: number) => t("position", { unit: u, n: n(p) });
  const next = position + 1;
  const canNext = !total || next <= total;

  async function log(target: number) {
    if (!Number.isInteger(target) || target < 1) return;
    if (total && target > total) return setNotice(t("pastEnd", { total: label(unit, total) }));
    const logId = uuidv7();
    setValue("");
    setNotice(t("logged", { position: label(unit, target) }));
    // The Progress card and "Finished it?" are worked out here, so they work offline too (a point logged before keeps
    // its log, as on the server).
    const already = logs.find((l) => l.unit === unit && l.position === target);
    const now = already ? logs : [...logs, { id: logId, unit, position: target, readAt: new Date().toISOString() }];
    if (status !== "finished" && total && readingPosition(now, unit) >= total) setAskFinish(true);
    setOffer({ logId: already?.id ?? logId, reading: readingProgress(lengths, asLogs(logs), asLogs(now), unit, target) });
    const saved = await send(userId, { type: "reading.log", logId, title, unit, position: target });
    if (!saved.ok) {
      setOffer(null);
      setAskFinish(false);
      return setNotice(t("logError"));
    }
    const result = saved.body as { logs: ReadLogged[]; logId: string; status: EntryStatus };
    setBaseLogs(result.logs);
    setBaseState((cur) => ({ ...cur, status: result.status }));
    setOffer((cur) => (cur?.logId === logId ? { ...cur, logId: result.logId } : cur));
  }

  async function unlog(item: ReadLogged) {
    setOffer((cur) => (cur?.logId === item.id ? null : cur));
    setNotice(t("unlogged", { position: label(item.unit, item.position) }));
    const saved = await send(userId, { type: "reading.unlog", logId: item.id, title, unit: item.unit, position: item.position });
    if (!saved.ok) return setNotice(t("logError"));
    setBaseLogs((cur) => cur.filter((l) => l.id !== item.id));
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
    finishShare: entry?.finishShare ?? null,
    finishedOn: entry?.finishedAt ? localDateKey(Date.parse(entry.finishedAt), timeZone) : today,
  };
  const history = [...logs].sort((a, b) => Date.parse(b.readAt) - Date.parse(a.readAt) || (a.id < b.id ? 1 : -1)).slice(0, HISTORY);
  const units = unitsFor(kind);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold">
            {position > 0 ? t("reached", { position: label(unit, position) }) : t("reachedNone")}
          </span>
          {status && <span className="text-muted-foreground">{t("status", { status })}</span>}
        </div>
        {total && (
          <>
            <div
              role="progressbar"
              aria-label={t("progressLabel")}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={Math.min(position, total)}
              aria-valuetext={t("progress", { read: n(Math.min(position, total)), total: t("count", { unit, count: total }) })}
              className="h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.min(100, (position / total) * 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">{t("progress", { read: n(Math.min(position, total)), total: t("count", { unit, count: total }) })}</p>
          </>
        )}
        {seconds > 0 && <p className="text-xs text-muted-foreground">{t("readTime", { time: formatRuntime(Math.round(seconds / 60), locale) })}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_24px_-14px_rgb(0_0_0/0.35)] ring-1 ring-border">
        {units.length > 1 && (
          <div role="group" aria-label={t("units")} className="flex gap-1 self-start rounded-full bg-muted p-1">
            {units.map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
                className={cn(
                  "min-h-10 rounded-full px-4 text-sm font-semibold transition-colors",
                  unit === u ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("unit", { unit: u })}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          disabled={!canNext}
          onClick={() => log(next)}
          className="h-14 rounded-2xl bg-brand text-lg font-extrabold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50"
        >
          {t("logNext", { unit, n: n(next) })}
        </button>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void log(Number(value));
          }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-semibold">
              {t("where", { unit })}
            </label>
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              max={total ?? 100000}
              step={1}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base tabular-nums"
            />
          </div>
          <button type="submit" className="h-12 shrink-0 rounded-xl px-5 font-bold ring-1 ring-border hover:bg-muted">
            {t("logIt")}
          </button>
        </form>
      </section>

      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {notice}
      </p>

      {offer && !askFinish && (
        <section
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 pl-4",
            offer.reading.milestone ? "border-2 border-dashed border-brand/60 bg-brand-soft/40" : "bg-card ring-1 ring-border",
          )}
        >
          <p className="min-w-0 font-semibold">
            {offer.reading.milestone
              ? t("milestoneOffer", { milestone: offer.reading.milestone })
              : t("progressOffer", { position: label(offer.reading.unit, offer.reading.position) })}
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

      {status !== "finished" && !askFinish && (logs.length > 0 || status) && (
        <button type="button" onClick={finish} className="h-11 self-start rounded-xl px-4 text-sm font-semibold ring-1 ring-border hover:bg-muted">
          {t("markFinished")}
        </button>
      )}

      {history.length > 0 && (
        <section aria-labelledby="reading-history" className="flex flex-col gap-2">
          <h2 id="reading-history" className="font-display text-lg font-extrabold">
            {t("history")}
          </h2>
          <ul className="flex flex-col divide-y divide-dashed divide-border rounded-2xl bg-card px-4 ring-1 ring-border">
            {history.map((item) => (
              <li key={item.id} className={cn("flex min-h-12 items-center justify-between gap-3", item.sync && "opacity-60")}>
                <span className="text-sm tabular-nums">
                  {t("historyItem", {
                    position: label(item.unit, item.position),
                    date: format.dateTime(new Date(item.readAt), { dateStyle: "medium", timeZone }),
                  })}
                  {item.sync === "waiting" && <span className="text-muted-foreground"> · {t("waitingToSync")}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => unlog(item)}
                  aria-label={t("remove", { position: label(item.unit, item.position) })}
                  className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {celebrating === "finish" && (
        <Celebration
          data={finishCard}
          source={{ kind: "finish", entryId: entry?.id ?? "", ready: !!entry?.id && status === "finished" && !entrySync }}
          animate={animate}
          username={username}
          host={host}
          onClose={closeCelebration}
        />
      )}
      {celebrating === "progress" && offer && (
        <Celebration
          data={{ ...card, finishedOn: today, reading: offer.reading }}
          source={{ kind: "progress", episodeLogId: null, readingLogId: offer.logId, ready: !logs.find((l) => l.id === offer.logId)?.sync }}
          username={username}
          host={host}
          onClose={() => setCelebrating(null)}
        />
      )}
      {!celebrating && milestones.node}
    </div>
  );
}
