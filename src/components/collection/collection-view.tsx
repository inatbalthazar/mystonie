"use client";

import { ImageIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore } from "react";
import { isReadingKind, type SearchResult } from "@/core/catalog/types";
import {
  finishedAtForDate,
  sortCollection,
  statusColumns,
  titleKey,
  type CollectionItem,
  type EntryNotes,
  type EntryStatus,
} from "@/core/collection/entries";
import {
  collectionRows,
  collectionYears,
  isCollectionLayout,
  shelfOf,
  sortRows,
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
import { localDateKey } from "@/core/stats/period";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CardData } from "@/core/cards/types";
import { Celebration } from "../celebration";
import { Sheet } from "../sheet";
import { CollectionControls, CollectionSummary, ReadSummary, ShelfTabs } from "./collection-header";
import { QuickAdd } from "./quick-add";

type Row = CollectionItem & { pending?: boolean };

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

/** Drops `?add=1` (the header ➕) and `pick` once the sheet closes, so the next ➕ tap opens it again. */
function clearAddParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("add")) return;
  url.searchParams.delete("add");
  url.searchParams.delete("pick");
  window.history.replaceState(null, "", url);
}

async function send(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ entry?: CollectionItem }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/**
 * The signed-in user's collection with quick add and editing. Changes show at once (optimistic) and roll
 * back with a notice if the server refuses them.
 */
export function CollectionView({
  initialItems,
  logs,
  readLogs,
  timeZone,
  username,
  host,
  startAdding = false,
  startWith = null,
}: {
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
}) {
  const t = useTranslations("Collection");
  const locale = useLocale();
  const [items, setItems] = useState<Row[]>(initialItems);
  const [filter, setFilter] = useState<CollectionFilter>({ year: null, status: null });
  // Watch · Read. Starts where the picked title belongs, or on Read when there's nothing to watch.
  const [shelf, setShelf] = useState<CollectionShelf>(() =>
    startWith ? shelfOf({ title: startWith }) : initialItems.length > 0 && initialItems.every((i) => shelfOf(i) === "read") ? "read" : "watch",
  );
  const [sort, setSort] = useState<CollectionSort>("finished");
  const layout = useSyncExternalStore(subscribeLayout, readLayout, () => "list" as const);
  const [adding, setAdding] = useState(startAdding);
  const [editing, setEditing] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  // The celebration + card for a finished title (by title key: the saved entry may get another id).
  const [celebrating, setCelebrating] = useState<{ key: string; animate: boolean } | null>(null);
  const celebrated = celebrating && items.find((i) => titleKey(i.title) === celebrating.key && i.finishedAt);

  function replace(key: string, next: Row | null, cur: Row[]): Row[] {
    const rest = cur.filter((i) => titleKey(i.title) !== key);
    return sortCollection(next ? [next, ...rest] : rest);
  }

  function closeAdd() {
    setAdding(false);
    clearAddParam();
  }

  async function add(result: SearchResult, status: EntryStatus, finishedAt: string | null) {
    closeAdd();
    const title = {
      source: result.source,
      kind: result.kind,
      externalId: result.externalId,
      name: result.name,
      year: result.year ?? null,
      posterUrl: result.imageUrl ?? null,
    };
    const key = titleKey(title);
    const existing = items.find((i) => titleKey(i.title) === key);
    const optimistic: Row = {
      ...(existing ?? { id: uuidv7(), addedAt: new Date().toISOString(), title }),
      ...statusColumns(status, finishedAt, Date.now()),
      pending: true,
    };
    setItems((cur) => replace(key, optimistic, cur));
    setShelf(shelfOf({ title }));
    setNotice(t("added", { name: title.name }));
    if (status === "finished") setCelebrating({ key, animate: true }); // celebrate first, sync after
    try {
      const { entry } = await send("/api/entries", "POST", { id: optimistic.id, title, status, finishedAt: optimistic.finishedAt });
      setItems((cur) => replace(key, entry!, cur));
    } catch {
      setItems((cur) => replace(key, existing ?? null, cur));
      setNotice(t("addError", { name: title.name }));
    }
  }

  async function update(item: Row, change: { status: EntryStatus; finishedAt: string | null } | { deleted: true }) {
    setEditing(null);
    const key = titleKey(item.title);
    setItems((cur) => replace(key, "deleted" in change ? null : { ...item, ...change, pending: true }, cur));
    setNotice("deleted" in change ? t("removed", { name: item.title.name }) : "");
    if (!("deleted" in change) && change.status === "finished" && item.status !== "finished") setCelebrating({ key, animate: true });
    try {
      const { entry } = await send(`/api/entries/${item.id}`, "PATCH", change);
      if (entry) setItems((cur) => replace(key, entry, cur));
    } catch {
      setItems((cur) => replace(key, item, cur));
      setNotice(t("saveError"));
    }
  }

  /** Rating / review typed in the celebration: shown at once, saved on the entry. */
  async function saveNotes(item: Row, notes: EntryNotes) {
    const key = titleKey(item.title);
    setItems((cur) => cur.map((i) => (titleKey(i.title) === key ? { ...i, ...notes } : i)));
    try {
      await send(`/api/entries/${item.id}`, "PATCH", notes);
    } catch {
      setItems((cur) => cur.map((i) => (titleKey(i.title) === key ? { ...i, rating: item.rating, review: item.review } : i)));
      setNotice(t("saveError"));
    }
  }

  function closeCelebration(notes: EntryNotes | null) {
    setCelebrating(null);
    if (notes && celebrated) void saveNotes(celebrated, notes);
  }

  const shelfItems = items.filter((i) => shelfOf(i) === shelf);
  const years = collectionYears(shelfItems, logs, timeZone, readLogs);
  // A year with nothing left in it (its last finish date was moved) falls back to all time.
  const activeFilter = { ...(filter.year !== null && !years.includes(filter.year) ? { ...filter, year: null } : filter), shelf };
  const rows = sortRows(collectionRows(items, logs, activeFilter, timeZone, readLogs), sort, locale);

  return (
    <>
      {items.length > 0 && (
        <div className="flex flex-col gap-4">
          <ShelfTabs shelf={shelf} onShelf={setShelf} />
          {shelf === "read" ? (
            <ReadSummary totals={summarizeReadRows(rows)} year={activeFilter.year} />
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
              <EntryTile row={row} tilt={i} onEdit={() => setEditing(row.item)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.item.id}>
              <EntryRow row={row} timeZone={timeZone} onEdit={() => setEditing(row.item)} />
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

      <QuickAdd open={adding} onClose={closeAdd} onAdd={add} timeZone={timeZone} initialPick={startWith} />
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
          source={{ kind: "finish", entryId: celebrated.id, ready: !celebrated.pending }}
          animate={celebrating.animate}
          username={username}
          host={host}
          onClose={closeCelebration}
        />
      )}
    </>
  );
}

/**
 * "2h 36m (156 min)" for a movie; "12 / 42 episodes · 9h 10m" for a series; "Chapter 1,100 · 91h 40m read" for a
 * manga, "Page 120 / 320" for a book (short: without the extras).
 */
function useLength() {
  const t = useTranslations("Collection");
  const locale = useLocale();
  return ({ item, lengthMin, episodesLogged, reached }: CollectionRow<Row>, short = false): string => {
    const { title } = item;
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

function EntryRow({ row, timeZone, onEdit }: { row: CollectionRow<Row>; timeZone: string; onEdit: () => void }) {
  const { item } = row;
  const t = useTranslations("Collection");
  const home = useTranslations("Home");
  const format = useFormatter();
  const length = useLength()(row);
  const genres = item.title.genres?.length ? format.list(item.title.genres.slice(0, 2), { type: "unit" }) : "";
  const date = format.dateTime(new Date(item.finishedAt ?? item.addedAt), { dateStyle: "medium", timeZone });
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={t("edit", { name: item.title.name })}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-2xl bg-card p-2 pr-4 text-left shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_-10px_rgb(0_0_0/0.25)] ring-1 ring-border transition-colors hover:ring-brand/40",
        item.pending && "opacity-70",
      )}
    >
      <span className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.title.posterUrl && <Image src={item.title.posterUrl} alt="" fill unoptimized sizes="56px" className="object-cover" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 font-semibold leading-snug">{item.title.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {home("titleMeta", { kind: item.title.kind, year: item.title.year ?? "none" })}
          {genres && ` · ${genres}`}
        </span>
        {length && <span className="text-xs font-medium tabular-nums">{length}</span>}
        <span className="text-xs text-muted-foreground">
          {item.pending ? t("saving") : item.finishedAt ? t("finishedDate", { date }) : t("addedDate", { date })}
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
function EntryTile({ row, tilt, onEdit }: { row: CollectionRow<Row>; tilt: number; onEdit: () => void }) {
  const { item } = row;
  const t = useTranslations("Collection");
  const length = useLength()(row, true);
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={t("edit", { name: item.title.name })}
      className={cn("group flex w-full flex-col gap-1.5 text-left", TILTS[tilt % TILTS.length], item.pending && "opacity-70")}
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
    rating: item.rating ?? null,
    review: item.review ?? null,
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

      {item.status === "finished" && item.finishedAt && !item.pending && (
        <button
          type="button"
          onClick={onCard}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand-soft"
        >
          <ImageIcon className="size-5" aria-hidden="true" />
          {t("makeCard")}
        </button>
      )}

      {item.title.kind !== "movie" && (
        <Link
          href={`/title/${item.title.kind}/${item.title.externalId}`}
          className="flex h-12 items-center justify-center rounded-2xl font-semibold ring-1 ring-border hover:bg-muted"
        >
          {item.title.kind === "series" ? t("episodes") : t("readingProgress")}
        </Link>
      )}

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
