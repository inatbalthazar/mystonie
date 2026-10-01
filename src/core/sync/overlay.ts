// What the collection looks like with the changes still on this device (S3 offline, ADR 0042): the server's data (from
// the page, which may be a copy saved for offline use) with the ops laid over it, in order. Each overlay is
// idempotent: laying an op the server already applied over its answer changes nothing, so an op can stay laid over
// until fresh data arrives.
import { sortCollection, titleKey, type CollectionItem, type CollectionTitle, type EntryStatus } from "../collection/entries";
import { episodeKey, type EpisodeRef } from "../collection/episodes";
import type { ReadingUnit } from "../collection/reading";
import type { ReadLog, WatchLog } from "../collection/view";
import type { SyncOp } from "./ops";

/** How far a change is: being sent now, or waiting on this device (offline, or the server asked to wait). */
export type SyncMark = "sending" | "waiting";

/** An op to lay over the server's data. `settled`: the server has it; fresh data just hasn't arrived yet. */
export type OverlayOp = { op: SyncOp; at: string; state: SyncMark | "settled" };

export type Synced<T> = T & { sync?: SyncMark };

type TitleRef = Pick<CollectionTitle, "source" | "kind" | "externalId">;

/** The mark a row gets from one more op: waiting beats sending; a settled op adds none. */
function marked(current: SyncMark | undefined, state: OverlayOp["state"]): { sync?: SyncMark } {
  const sync = state === "settled" ? current : current === "waiting" || state === "waiting" ? "waiting" : "sending";
  return sync ? { sync } : {};
}

const finishDate = (status: EntryStatus, finishedAt: string | null, at: string) => (status === "finished" ? (finishedAt ?? at) : null);

/** What an `entry.notes` op sets: the rating and review, and a game's hours when the op carries them. */
function notesOf(op: Extract<SyncOp, { type: "entry.notes" }>): { rating: number | null; review: string | null; hoursPlayed?: number | null } {
  return { rating: op.rating, review: op.review, ...(op.hoursPlayed === undefined ? {} : { hoursPlayed: op.hoursPlayed }) };
}

/**
 * The collection with the ops laid over it: adds, status changes (by title, so an entry the server kept under another
 * id still matches), ratings and reviews, removals, and titles a log puts on the Watching shelf.
 */
export function overlayCollection(items: readonly CollectionItem[], ops: readonly OverlayOp[]): Synced<CollectionItem>[] {
  const list: Synced<CollectionItem>[] = [...items];
  for (const { op, at, state } of ops) {
    const key = titleKey(op.title);
    const i = list.findIndex((item) => titleKey(item.title) === key);
    const cur = i >= 0 ? list[i]! : null;
    const put = (next: Synced<CollectionItem>) => (i >= 0 ? (list[i] = next) : list.push(next));
    switch (op.type) {
      case "entry.add":
      case "entry.status": {
        const columns = { status: op.status, finishedAt: finishDate(op.status, op.finishedAt, at) };
        if (cur) put({ ...cur, ...columns, ...marked(cur.sync, state) });
        else if (op.type === "entry.add") put({ id: op.entryId, addedAt: at, title: { ...op.title }, ...columns, ...marked(undefined, state) });
        break;
      }
      case "entry.notes":
        if (cur) put({ ...cur, ...notesOf(op), ...marked(cur.sync, state) });
        break;
      case "entry.remove":
        if (cur) list.splice(i, 1);
        break;
      case "episodes.log":
      case "reading.log": {
        const id = op.type === "reading.log" ? op.logId : (op.episodes[0]?.id ?? at);
        if (!cur) put({ id, addedAt: at, title: { ...op.title }, status: "watching", finishedAt: null, ...marked(undefined, state) });
        else if (cur.status === "want") put({ ...cur, status: "watching", finishedAt: null, ...marked(cur.sync, state) });
        break;
      }
      default:
        break; // un-logging doesn't change the entry
    }
  }
  return sortCollection(list);
}

/** Title ids (`titles` rows) by title key, for logs of titles the server already has. */
function titleIds(items: readonly CollectionItem[]): Map<string, string> {
  return new Map(items.flatMap((i) => (i.title.id ? [[titleKey(i.title), i.title.id] as const] : [])));
}

/** The collection's episode logs (summary and series rows) with the ones still on this device. */
export function overlayWatchLogs(logs: readonly WatchLog[], items: readonly CollectionItem[], ops: readonly OverlayOp[]): WatchLog[] {
  const ids = titleIds(items);
  let list = [...logs];
  for (const { op, at } of ops) {
    if (op.type === "episodes.log") {
      const titleId = ids.get(titleKey(op.title));
      if (!titleId) continue; // counted once the server has the title
      const have = new Set(list.map((l) => l.id));
      for (const e of op.episodes) if (!have.has(e.id)) list.push({ id: e.id, titleId, runtimeMin: e.runtimeMin, watchedAt: at });
    } else if (op.type === "episode.unlog") {
      list = list.filter((l) => l.id !== op.logId);
    }
  }
  return list;
}

/** The collection's reading logs (Read tab) with the ones still on this device. */
export function overlayReadLogs(logs: readonly ReadLog[], items: readonly CollectionItem[], ops: readonly OverlayOp[]): ReadLog[] {
  const ids = titleIds(items);
  let list = [...logs];
  for (const { op, at } of ops) {
    if (op.type === "reading.log") {
      const titleId = ids.get(titleKey(op.title));
      const logged = list.some((l) => l.titleId === titleId && l.unit === op.unit && l.position === op.position);
      if (titleId && !logged) list.push({ id: op.logId, titleId, unit: op.unit, position: op.position, readAt: at });
    } else if (op.type === "reading.unlog") {
      list = list.filter((l) => l.id !== op.logId);
    }
  }
  return list;
}

const ofTitle = (title: TitleRef, ops: readonly OverlayOp[]) => {
  const key = titleKey(title);
  return ops.filter(({ op }) => titleKey(op.title) === key);
};

export type EpisodeLogged = EpisodeRef & { id: string };

/** A series' episode logs (series page, Up next) with the ones still on this device. */
export function overlayEpisodes(title: TitleRef, logs: readonly EpisodeLogged[], ops: readonly OverlayOp[]): Synced<EpisodeLogged>[] {
  let list: Synced<EpisodeLogged>[] = [...logs];
  for (const { op, state } of ofTitle(title, ops)) {
    if (op.type === "episodes.log") {
      const done = new Set(list.map(episodeKey));
      for (const e of op.episodes) {
        if (!done.has(episodeKey(e))) list.push({ id: e.id, season: e.season, episode: e.episode, ...marked(undefined, state) });
      }
    } else if (op.type === "episode.unlog") {
      list = list.filter((l) => l.id !== op.logId && !(l.season === op.season && l.episode === op.episode));
    }
  }
  return list;
}

export type ReadingLogged = { id: string; unit: ReadingUnit; position: number; readAt: string };

/** A book's or manga's reading logs (reading page) with the ones still on this device. A point already logged stays. */
export function overlayReadingLogs(title: TitleRef, logs: readonly ReadingLogged[], ops: readonly OverlayOp[]): Synced<ReadingLogged>[] {
  let list: Synced<ReadingLogged>[] = [...logs];
  for (const { op, at, state } of ofTitle(title, ops)) {
    if (op.type === "reading.log") {
      if (!list.some((l) => l.unit === op.unit && l.position === op.position)) {
        list.push({ id: op.logId, unit: op.unit, position: op.position, readAt: at, ...marked(undefined, state) });
      }
    } else if (op.type === "reading.unlog") {
      list = list.filter((l) => l.id !== op.logId && !(l.unit === op.unit && l.position === op.position));
    }
  }
  return list;
}

/** A title's entry as the series and reading pages hold it. */
export type EntrySnapshot = {
  id: string;
  finishedAt: string | null;
  rating: number | null;
  review: string | null;
  /** A game: the hours played. */
  hoursPlayed?: number | null;
  finishShare?: number | null;
};

export type TitleState = { status: EntryStatus | null; entry: EntrySnapshot | null };

/** A title's status and entry (series and reading pages) with the changes still on this device. */
export function overlayTitleState(title: TitleRef, state: TitleState, ops: readonly OverlayOp[]): Synced<TitleState> {
  let { status, entry } = state;
  let sync: SyncMark | undefined;
  for (const { op, at, state: opState } of ofTitle(title, ops)) {
    switch (op.type) {
      case "entry.add":
      case "entry.status":
        status = op.status;
        entry = { ...(entry ?? { id: op.entryId, rating: null, review: null }), finishedAt: finishDate(op.status, op.finishedAt, at) };
        sync = marked(sync, opState).sync;
        break;
      case "entry.notes":
        if (entry) entry = { ...entry, ...notesOf(op) };
        sync = marked(sync, opState).sync;
        break;
      case "entry.remove":
        status = null;
        entry = null;
        sync = marked(sync, opState).sync;
        break;
      case "episodes.log":
      case "reading.log":
        if (status === null || status === "want") status = "watching";
        break;
      default:
        break;
    }
  }
  return { status, entry, ...(sync ? { sync } : {}) };
}
