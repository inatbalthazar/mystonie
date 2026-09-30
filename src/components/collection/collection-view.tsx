"use client";

import { ImageIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { isReadingKind, type SearchResult } from "@/core/catalog/types";
import {
  finishedAtForDate,
  sortCollection,
  statusColumns,
  titleKey,
  type CollectionItem,
  type CollectionTitle,
  type EntryNotes,
  type EntryStatus,
} from "@/core/collection/entries";
import {
  collectionRows,
  collectionYears,
  isCollectionLayout,
  shelfOf,
  sortRows,
  summarizePlayRows,
  summarizeReadRows,
  summarizeRows,
  type CollectionFilter,
  type CollectionLayout,
  type CollectionRow,
  type CollectionShelf,
  type CollectionSort,
  type ReadLog,
  type WatchLog,
} from "@/core/collection/view";
import { formatMinutes, formatRuntime } from "@/core/format/runtime";
import { uuidv7 } from "@/core/ids";
import type { OpTitle } from "@/core/sync/ops";
import { overlayCollection, overlayReadLogs, overlayWatchLogs, type Synced } from "@/core/sync/overlay";
import { localDateKey } from "@/core/stats/period";
import type { BadgeTopic } from "@/core/warnings";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CardData } from "@/core/cards/types";
import { Celebration } from "../celebration";
import { useMilestones } from "../milestone-celebration";
import { send, useOverlayOps } from "../offline/outbox";
import { Sheet } from "../sheet";
import { useWarningLabel, WarningBadge } from "../warnings/warning-badge";
import { CollectionControls, CollectionSummary, PlaySummary, ReadSummary, ShelfTabs } from "./collection-header";
import { QuickAdd } from "./quick-add";

/** A row as shown: the server's entry with the changes still on this device laid over it (S3 offline). */
type Row = Synced<CollectionItem>;

const EDIT_ORDER: EntryStatus[] = ["finished", "watching", "want"];

// Tiles or list, remembered on this device (S1 collection → View toggle, ADR 0023).
const LAYOUT_KEY = "mystonie.collection.layout";
const layoutListeners = new Set<() => void>();

function readLayout(): CollectionLayout {
  try {
    const value = window.localStorage.getItem(LAYOUT_KEY);
    return isCollectionLayout(value) ? value : "list";
  } catch {
    return "list";
  }
}

function writeLayout(layout: CollectionLayout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Blocked storage (private mode): the toggle still works, it just isn't remembered.
  }
  layoutListeners.forEach((listener) => listener());
}

function subscribeLayout(listener: () => void) {
  layoutListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    layoutListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const noSubscribe = () => () => {};
const readAddParam = () => new URLSearchParams(window.location.search).get("add") === "1";

/** Drops `?add=1` (the header ➕) and `pick` once the sheet closes, so the next ➕ tap opens it again. */
function clearAddParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("add")) return;
  url.searchParams.delete("add");
  url.searchParams.delete("pick");
  window.history.replaceState(null, "", url);
}

const opTitle = (title: CollectionTitle): OpTitle => ({
  source: title.source,
  kind: title.kind,
  externalId: title.externalId,
  name: title.name,
  year: title.year,
  posterUrl: title.posterUrl,
});

/** The entry the server answered with, if any. */
const savedEntry = (body: unknown) => (body as { entry?: CollectionItem } | null)?.entry ?? null;

/**
 * The signed-in user's collection with quick add and editing. Changes show at once and go through the outbox
 * (S3 offline): sent right away when online, kept on this device and sent later when not. A change the server
 * refuses drops out with a notice.
 */
export function CollectionView({
  userId,
  initialItems,
  logs,
  readLogs,
  timeZone,
  username,
  host,
  startAdding = false,
  startWith = null,
  warnings = {},
}: {
  /** Who is signed in: the owner of the changes made here. */
  userId: string;
  initialItems: CollectionItem[];
  /** The user's episode logs (runtime and time), for the series rows and the summary. */
  logs: WatchLog[];
  /** The user's reading logs, for the book and manga rows and the Read tab's summary. */
  readLogs: ReadLog[];
  timeZone: string;
  /** For the card footer (`@username`) and the site shown on cards. */
  username: string;
  host: string;
  startAdding?: boolean;
  /** Opens quick add on this title's status step (a trending title tapped on Home). */
  startWith?: SearchResult | null;
  /** Content warnings: by title id, the user's avoid-topics each title has a Yes for (badges; DTDD's and our own). */
  warnings?: Record<string, BadgeTopic[]>;
}) {
  const t = useTranslations("Collection");
  const locale = useLocale();
  // The server's entries (fresh ones arrive with a refresh), with the changes on this device laid over them.
  const [base, setBase] = useState<CollectionItem[]>(initialItems);
  const [baseFrom, setBaseFrom] = useState(initialItems);
  if (baseFrom !== initialItems) {
    setBaseFrom(initialItems);
    setBase(initialItems);
  }
  const ops = useOverlayOps(userId);
  const items: Row[] = useMemo(() => overlayCollection(base, ops), [base, ops]);
  const watchLogs = useMemo(() => overlayWatchLogs(logs, items, ops), [logs, items, ops]);
  const readingLogs = useMemo(() => overlayReadLogs(readLogs, items, ops), [readLogs, items, ops]);
  const [filter, setFilter] = useState<CollectionFilter>({ year: null, status: null });
  // Watch · Read · Play. Starts where the picked title belongs, or on the one tab with anything on it.
  const [shelf, setShelf] = useState<CollectionShelf>(() => {
    if (startWith) return shelfOf({ title: startWith });
    const shelves = new Set(initialItems.map(shelfOf));
    return shelves.size === 1 ? [...shelves][0]! : "watch";
  });
  const [sort, setSort] = useState<CollectionSort>("finished");
  const layout = useSyncExternalStore(subscribeLayout, readLayout, () => "list" as const);
  const [adding, setAdding] = useState(startAdding);
  const [editing, setEditing] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  // The celebration + card for a finished title (by title key: the saved entry may get another id).
  const [celebrating, setCelebrating] = useState<{ key: string; animate: boolean } | null>(null);
  const celebrated = celebrating && items.find((i) => titleKey(i.title) === celebrating.key && i.finishedAt);
  // A finish can cross a milestone (the 100th title, 1,000 hours): its card follows the Finish card.
  const milestones = useMilestones({ username, host });

  // Offline, the page comes from this device's saved copy, made without `?add=1`: the ➕ link still opens quick add.
  const addInUrl = useSyncExternalStore(noSubscribe, readAddParam, () => false);

  /** The server's answer replaces its entry in `base` (by title: the server may keep another id). */
  function keep(key: string, next: CollectionItem | null) {
    setBase((cur) => {
      const rest = cur.filter((i) => titleKey(i.title) !== key);
      return sortCollection(next ? [next, ...rest] : rest);
    });
  }

  function closeAdd() {
    setAdding(false);
    clearAddParam();
  }

  async function add(result: SearchResult, status: EntryStatus, finishedAt: string | null) {
    closeAdd();
    const title: OpTitle = {
      source: result.source,
      kind: result.kind,
      externalId: result.externalId,
      name: result.name,
      year: result.year ?? null,
      posterUrl: result.imageUrl ?? null,
    };
    const key = titleKey(title);
    const existing = items.find((i) => titleKey(i.title) === key);
    setShelf(shelfOf({ title }));
    setNotice(t("added", { name: title.name }));
    if (status === "finished") setCelebrating({ key, animate: true }); // celebrate first, sync after
    const columns = statusColumns(status, finishedAt, Date.now());
    const saved = await send(userId, { type: "entry.add", entryId: existing?.id ?? uuidv7(), title, ...columns });
    if (!saved.ok) return setNotice(t("addError", { name: title.name }));
    keep(key, savedEntry(saved.body));
    if (saved.superseded) setNotice(t("changedElsewhere", { name: title.name }));
    else if (status === "finished") milestones.check();
  }

  async function update(item: Row, change: { status: EntryStatus; finishedAt: string | null } | { deleted: true }) {
    setEditing(null);
    const title = opTitle(item.title);
    const key = titleKey(title);
    const removing = "deleted" in change;
    const finishing = !removing && change.status === "finished" && item.status !== "finished";
    setNotice(removing ? t("removed", { name: title.name }) : "");
    if (finishing) setCelebrating({ key, animate: true });
    const saved = await send(
      userId,
      removing ? { type: "entry.remove", entryId: item.id, title } : { type: "entry.status", entryId: item.id, title, ...change },
    );
    if (!saved.ok) return setNotice(t("saveError"));
    const entry = savedEntry(saved.body);
    if (entry || removing) keep(key, entry);
    if (saved.superseded) setNotice(t("changedElsewhere", { name: title.name }));
    else if (finishing) milestones.check();
  }

  /** Rating / review typed in the celebration: shown at once, saved on the entry. */
  async function saveNotes(item: Row, notes: EntryNotes) {
    const title = opTitle(item.title);
    const saved = await send(userId, { type: "entry.notes", entryId: item.id, title, ...notes });
    if (!saved.ok) return setNotice(t("saveError"));
    const entry = savedEntry(saved.body);
    if (entry) keep(titleKey(title), entry);
    if (saved.superseded) setNotice(t("changedElsewhere", { name: title.name }));
  }

  function closeCelebration(notes: EntryNotes | null) {
    setCelebrating(null);
    if (notes && celebrated) void saveNotes(celebrated, notes);
  }

  const shelfItems = items.filter((i) => shelfOf(i) === shelf);
  const years = collectionYears(shelfItems, watchLogs, timeZone, readingLogs);
  // A year with nothing left in it (its last finish date was moved) falls back to all time.
  const activeFilter = { ...(filter.year !== null && !years.includes(filter.year) ? { ...filter, year: null } : filter), shelf };
  const rows = sortRows(collectionRows(items, watchLogs, activeFilter, timeZone, readingLogs), sort, locale);

  return (
    <>
      {items.length > 0 && (
        <div className="flex flex-col gap-4">
          <ShelfTabs shelf={shelf} onShelf={setShelf} />
          {shelf === "read" ? (
            <ReadSummary totals={summarizeReadRows(rows)} year={activeFilter.year} />
          ) : shelf === "play" ? (
            <PlaySummary totals={summarizePlayRows(rows)} year={activeFilter.year} />
          ) : (
            <CollectionSummary totals={summarizeRows(rows)} year={activeFilter.year} />
          )}
          <CollectionControls
            years={years}
            filter={activeFilter}
            sort={sort}
            layout={layout}
            count={rows.length}
            onFilter={setFilter}
            onSort={setSort}
            onLayout={writeLayout}
          />
        </div>
      )}
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {notice}
      </p>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-border px-6 py-12 text-center">
          <p className="font-hand text-3xl text-muted-foreground">{t("emptyTitle")}</p>
          <p className="max-w-xs text-sm text-muted-foreground">{t("emptyBody")}</p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-12 rounded-2xl bg-brand px-6 font-bold text-brand-foreground shadow-sm hover:bg-brand/90"
          >
            {t("addFirst")}
          </button>
          <Link href="/settings/import" className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {t("importLink")}
          </Link>
        </div>
      ) : shelfItems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-10 text-center">
          <p className="font-hand text-2xl text-muted-foreground">{t("emptyShelf", { shelf })}</p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-11 rounded-xl bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90"
          >
            {t("addToShelf", { shelf })}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-10 text-center">
          <p className="font-hand text-2xl text-muted-foreground">{t("noMatches")}</p>
          <button
            type="button"
            onClick={() => setFilter({ year: null, status: null })}
            className="h-11 rounded-xl px-5 font-semibold ring-1 ring-border hover:bg-muted"
          >
            {t("clearFilters")}
          </button>
        </div>
      ) : layout === "tiles" ? (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
          {rows.map((row, i) => (
            <li key={row.item.id}>
              <EntryTile row={row} tilt={i} warning={warnings[row.item.title.id ?? ""]} onEdit={() => setEditing(row.item)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.item.id}>
              <EntryRow row={row} timeZone={timeZone} warning={warnings[row.item.title.id ?? ""]} onEdit={() => setEditing(row.item)} />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setAdding(true)}
        aria-label={t("add")}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex size-16 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-4 ring-background hover:bg-brand/90 sm:right-[max(1rem,calc(50%-18rem))]"
      >
        <PlusIcon className="size-8" aria-hidden="true" />
      </button>

      <QuickAdd open={adding || addInUrl} onClose={closeAdd} onAdd={add} timeZone={timeZone} initialPick={startWith} />
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.title.name ?? ""} closeLabel={t("close")}>
        {editing && (
          <EntryEditor
            item={editing}
            timeZone={timeZone}
            onSave={(change) => update(editing, change)}
            onCard={() => {
              setEditing(null);
              setCelebrating({ key: titleKey(editing.title), animate: false });
            }}
          />
        )}
      </Sheet>
      {celebrating && celebrated && (
        <Celebration
          key={celebrating.key}
          data={cardData(celebrated, timeZone)}
          source={{ kind: "finish", entryId: celebrated.id, ready: !celebrated.sync }}
          survivedFor={
            celebrated.title.source === "tmdb" && (celebrated.title.kind === "movie" || celebrated.title.kind === "series")
              ? { kind: celebrated.title.kind, externalId: celebrated.title.externalId }
              : undefined
          }
          animate={celebrating.animate}
          username={username}
          host={host}
          onClose={closeCelebration}
        />
      )}
      {!celebrating && milestones.node}
    </>
  );
}

/**
 * "2h 36m (156 min)" for a movie; "12 / 42 episodes · 9h 10m" for a series; "Chapter 1,100 · 91h 40m read" for a
 * manga, "Page 120 / 320" for a book; "68h played" for a game with the player's hours, else "About 43h on average"
 * (RAWG's average playtime) (short: without the extras).
 */
function useLength() {
  const t = useTranslations("Collection");
  const locale = useLocale();
  return ({ item, lengthMin, episodesLogged, reached }: CollectionRow<Row>, short = false): string => {
    const { title } = item;
    if (title.kind === "game") {
      if (!lengthMin) return "";
      const time = formatRuntime(lengthMin, locale);
      return item.hoursPlayed ? t("playedLength", { time }) : short ? t("averageShort", { time }) : t("averageLength", { time });
    }
    if (isReadingKind(title.kind)) {
      const n = (v: number) => v.toLocaleString(locale);
      const total = (v: number | null | undefined) => (v ? n(v) : "none");
      const progress =
        reached.page > 0
          ? t("readPages", { read: n(reached.page), total: total(title.pageCount) })
          : reached.chapter > 0
            ? t("readChapters", { read: n(reached.chapter), total: total(title.chapterCount) })
            : reached.volume > 0
              ? t("readVolumes", { read: n(reached.volume), total: total(title.volumeCount) })
              : title.pageCount
                ? t("pageCount", { count: title.pageCount })
                : title.chapterCount
                  ? t("chapterCount", { count: title.chapterCount })
                  : title.volumeCount
                    ? t("volumeCount", { count: title.volumeCount })
                    : "";
      if (short || !lengthMin || !progress) return progress;
      return t("readLength", { progress, time: formatRuntime(lengthMin, locale) });
    }
    if (item.title.kind === "movie") {
      if (!lengthMin) return "";
      const runtime = formatRuntime(lengthMin, locale);
      return short ? runtime : t("movieLength", { runtime, minutes: formatMinutes(lengthMin, locale) });
    }
    const episodes = t("seriesEpisodes", { watched: episodesLogged, total: item.title.episodeCount ?? "none" });
    if (short || !lengthMin) return episodes;
    return t("seriesLength", { episodes, time: formatRuntime(lengthMin, locale) });
  };
}

function EntryRow({ row, timeZone, warning, onEdit }: { row: CollectionRow<Row>; timeZone: string; warning?: BadgeTopic[]; onEdit: () => void }) {
  const { item } = row;
  const t = useTranslations("Collection");
  const warningLabel = useWarningLabel()(warning);
  const home = useTranslations("Home");
  const format = useFormatter();
  const length = useLength()(row);
  const genres = item.title.genres?.length ? format.list(item.title.genres.slice(0, 2), { type: "unit" }) : "";
  const date = format.dateTime(new Date(item.finishedAt ?? item.addedAt), { dateStyle: "medium", timeZone });
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={[t("edit", { name: item.title.name }), warningLabel].filter(Boolean).join(". ")}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-2xl bg-card p-2 pr-4 text-left shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)] ring-1 ring-border transition-colors hover:ring-brand/40",
        item.sync && "opacity-70",
      )}
    >
      <span className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.title.posterUrl && <Image src={item.title.posterUrl} alt="" fill unoptimized sizes="56px" className="object-cover" />}
        {warningLabel && <WarningBadge label={warningLabel} className="absolute top-0.5 right-0.5 size-6" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 font-semibold leading-snug">{item.title.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {home("titleMeta", { kind: item.title.kind, year: item.title.year ?? "none" })}
          {genres && ` · ${genres}`}
        </span>
        {length && <span className="text-xs font-medium tabular-nums">{length}</span>}
        <span className="text-xs text-muted-foreground">
          {item.sync === "waiting"
            ? t("waitingToSync")
            : item.sync
              ? t("saving")
              : item.finishedAt
                ? t("finishedDate", { date, shelf: shelfOf(item) })
                : t("addedDate", { date })}
        </span>
      </span>
      <StatusStamp status={item.status} shelf={shelfOf(item)} />
    </button>
  );
}

const TILTS = ["rotate-[-1.5deg]", "rotate-[1deg]", "rotate-[-0.5deg]", "rotate-[1.5deg]"];

/**
 * A poster pasted into the album (tiles view): a paper frame, a slight tilt that alternates down the
 * page, the status stamp on the corner and the length under it.
 */
function EntryTile({ row, tilt, warning, onEdit }: { row: CollectionRow<Row>; tilt: number; warning?: BadgeTopic[]; onEdit: () => void }) {
  const { item } = row;
  const t = useTranslations("Collection");
  const warningLabel = useWarningLabel()(warning);
  const length = useLength()(row, true);
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={[t("edit", { name: item.title.name }), warningLabel].filter(Boolean).join(". ")}
      className={cn("group flex w-full flex-col gap-1.5 text-left", TILTS[tilt % TILTS.length], item.sync && "opacity-70")}
    >
      <span className="relative block rounded-md bg-card p-1 pb-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_18px_-12px_rgb(0_0_0/0.4)] ring-1 ring-border transition-transform group-hover:-translate-y-0.5 group-hover:ring-brand/40">
        <span className="relative block aspect-[2/3] overflow-hidden rounded-[3px] bg-muted">
          {item.title.posterUrl ? (
            <Image src={item.title.posterUrl} alt="" fill unoptimized sizes="(min-width: 640px) 150px, 33vw" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center p-2 text-center font-display text-xs font-bold break-words text-muted-foreground">
              {item.title.name}
            </span>
          )}
        </span>
        {warningLabel && <WarningBadge label={warningLabel} className="absolute -top-2 -right-2" />}
        <span className="absolute inset-x-0 -bottom-2.5 flex justify-center">
          <span className="rounded-md bg-card/95">
            <StatusStamp status={item.status} shelf={shelfOf(item)} small />
          </span>
        </span>
      </span>
      <span className="mt-1.5 line-clamp-2 text-xs leading-snug font-semibold">{item.title.name}</span>
      {length && <span className="-mt-1 text-[11px] text-muted-foreground tabular-nums">{length}</span>}
    </button>
  );
}

/** The status as a small rubber stamp (scrapbook): FINISHED in brand ink, the others quieter. */
function StatusStamp({ status, shelf, small = false }: { status: EntryStatus; shelf: CollectionShelf; small?: boolean }) {
  const t = useTranslations("Collection");
  return (
    <span
      className={cn(
        "shrink-0 rotate-[-6deg] rounded-md border-2 px-1.5 py-0.5 font-display font-extrabold whitespace-nowrap uppercase select-none [&:lang(th)]:tracking-normal",
        small ? "rotate-[-4deg] px-1 text-[9px] tracking-[0.06em]" : "text-[10px] tracking-[0.14em]",
        status === "finished" && "border-brand text-brand",
        status === "watching" && "border-foreground/60 text-foreground/80",
        status === "want" && "border-dashed border-muted-foreground text-muted-foreground",
      )}
    >
      {t("statusLabel", { status, shelf })}
    </span>
  );
}

/** A finished entry as card inputs (the finish day in the user's time zone). */
function cardData(item: Row, timeZone: string): CardData {
  const { title } = item;
  return {
    kind: title.kind,
    name: title.name,
    year: title.year,
    posterUrl: title.posterUrl,
    genres: title.genres,
    runtimeMin: title.runtimeMin,
    episodeCount: title.episodeCount,
    pageCount: title.pageCount,
    chapterCount: title.chapterCount,
    volumeCount: title.volumeCount,
    playtimeHours: title.playtimeHours ?? null,
    hoursPlayed: item.hoursPlayed ?? null,
    rating: item.rating ?? null,
    review: item.review ?? null,
    finisherNo: item.finisherNo ?? null,
    finishedOn: localDateKey(Date.parse(item.finishedAt ?? item.addedAt), timeZone),
  };
}

function EntryEditor({
  item,
  timeZone,
  onSave,
  onCard,
}: {
  item: Row;
  timeZone: string;
  onSave: (change: { status: EntryStatus; finishedAt: string | null } | { deleted: true }) => void;
  /** "Make a card" for a finished entry. */
  onCard: () => void;
}) {
  const t = useTranslations("Collection");
  const groupId = useId();
  const dateId = useId();
  const [today] = useState(() => localDateKey(Date.now(), timeZone));
  const originalDate = item.finishedAt ? localDateKey(Date.parse(item.finishedAt), timeZone) : today;
  const [status, setStatus] = useState<EntryStatus>(item.status);
  const [date, setDate] = useState(originalDate);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Keep the exact time when the day didn't change (ordering within a day stays as it was).
  const finishedAt =
    status !== "finished" ? null : item.finishedAt && date === originalDate ? item.finishedAt : finishedAtForDate(date, timeZone);
  const valid = status !== "finished" || !!finishedAt;

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend id={groupId} className="mb-2 text-sm font-semibold">
          {t("status")}
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {EDIT_ORDER.map((s) => (
            <label
              key={s}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-2 text-center text-sm font-semibold ring-1 ring-border has-[:checked]:bg-brand has-[:checked]:text-brand-foreground has-[:checked]:ring-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              )}
            >
              <input type="radio" name={groupId} value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
              {t("statusLabel", { status: s, shelf: shelfOf(item) })}
            </label>
          ))}
        </div>
      </fieldset>

      {status === "finished" && (
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={dateId} className="text-sm font-semibold">
            {t("finishedOn")}
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            max={today}
            min="1900-01-01"
            required
            onChange={(e) => setDate(e.target.value)}
            className="h-11 rounded-lg border border-input bg-card px-2"
          />
        </div>
      )}

      {item.status === "finished" && item.finishedAt && !item.sync && (
        <button
          type="button"
          onClick={onCard}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand-soft"
        >
          <ImageIcon className="size-5" aria-hidden="true" />
          {t("makeCard")}
        </button>
      )}

      <Link
        href={`/title/${item.title.kind}/${item.title.externalId}`}
        className="flex h-12 items-center justify-center rounded-2xl font-semibold ring-1 ring-border hover:bg-muted"
      >
        {item.title.kind === "series"
          ? t("episodes")
          : item.title.kind === "movie"
            ? t("whereToWatch")
            : item.title.kind === "game"
              ? t("aboutGame")
              : t("readingProgress")}
      </Link>

      <button
        type="button"
        disabled={!valid}
        onClick={() => onSave({ status, finishedAt })}
        className="h-12 rounded-2xl bg-brand font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50"
      >
        {t("save")}
      </button>
      <button
        type="button"
        onClick={() => (confirmRemove ? onSave({ deleted: true }) : setConfirmRemove(true))}
        className="h-11 self-center rounded-xl px-4 text-sm font-semibold text-destructive hover:bg-destructive/10"
      >
        {confirmRemove ? t("removeConfirm") : t("remove")}
      </button>
    </div>
  );
}
