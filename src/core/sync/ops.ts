// Offline-first (S3 offline, ADR 0042): every change to the collection is an op. The device keeps ops in a queue (the
// outbox) and sends them in order, when there is a connection, to the same route handlers as before, with the time
// the change was made so the later edit wins. Pure: the browser queue is src/components/offline/outbox.ts, and a
// future Expo app can reuse this with its own storage.
import type { CollectionTitle, EntryStatus } from "../collection/entries";
import type { ReadingUnit } from "../collection/reading";

/** A title as an op carries it: enough to show it before the server answers. */
export type OpTitle = Pick<CollectionTitle, "source" | "kind" | "externalId" | "name" | "year" | "posterUrl">;

export type OpEpisode = { id: string; season: number; episode: number; runtimeMin: number | null };

export type SyncOp =
  | { type: "entry.add"; entryId: string; title: OpTitle; status: EntryStatus; finishedAt: string | null }
  | { type: "entry.status"; entryId: string; title: OpTitle; status: EntryStatus; finishedAt: string | null }
  | { type: "entry.notes"; entryId: string; title: OpTitle; rating: number | null; review: string | null; hoursPlayed?: number | null }
  | { type: "entry.remove"; entryId: string; title: OpTitle }
  | { type: "episodes.log"; title: OpTitle; episodes: OpEpisode[] }
  | { type: "episode.unlog"; logId: string; title: OpTitle; season: number; episode: number }
  | { type: "reading.log"; logId: string; title: OpTitle; unit: ReadingUnit; position: number }
  | { type: "reading.unlog"; logId: string; title: OpTitle; unit: ReadingUnit; position: number };

/**
 * A change waiting on this device.
 * - `queued`: sent when there is a connection (after `notBefore` when the server had a problem);
 * - `failed`: the server refused it (or kept failing): shown with Retry and Discard, never sent on its own;
 * - `held`: made in another account than the one signed in now (`account`), or signed out (`signed_out`).
 */
export type OutboxItem = {
  /** UUID v7: also the order ops are sent in. */
  id: string;
  /** The account that made the change (sent as `X-Mystonie-User`, so it never lands in another account). */
  userId: string;
  /** When the change was made, by the device's clock (ISO). */
  at: string;
  op: SyncOp;
  /** Failed sends so far (server errors and rate limits; being offline doesn't count). */
  attempts: number;
  state: "queued" | "failed" | "held";
  notBefore?: number;
  reason?: "invalid" | "server" | "account" | "signed_out";
};

export type OpRequest = { method: "POST" | "PATCH"; url: string; body: Record<string, unknown> };

const ref = (title: OpTitle) => ({ source: title.source, kind: title.kind, externalId: title.externalId });

/** The route handler call an op makes. */
export function opRequest({ op, at }: Pick<OutboxItem, "op" | "at">): OpRequest {
  switch (op.type) {
    case "entry.add":
      return { method: "POST", url: "/api/entries", body: { id: op.entryId, title: ref(op.title), status: op.status, finishedAt: op.finishedAt, editedAt: at } };
    case "entry.status":
      return { method: "PATCH", url: `/api/entries/${op.entryId}`, body: { status: op.status, finishedAt: op.finishedAt, editedAt: at } };
    case "entry.notes":
      return {
        method: "PATCH",
        url: `/api/entries/${op.entryId}`,
        body: { rating: op.rating, review: op.review, ...(op.hoursPlayed === undefined ? {} : { hoursPlayed: op.hoursPlayed }), editedAt: at },
      };
    case "entry.remove":
      return { method: "PATCH", url: `/api/entries/${op.entryId}`, body: { deleted: true, editedAt: at } };
    case "episodes.log":
      return {
        method: "POST",
        url: "/api/episodes",
        body: { externalId: op.title.externalId, episodes: op.episodes.map(({ id, season, episode }) => ({ id, season, episode })), watchedAt: at },
      };
    case "episode.unlog":
      return { method: "PATCH", url: `/api/episodes/${op.logId}`, body: { deleted: true } };
    case "reading.log":
      return {
        method: "POST",
        url: "/api/reading",
        body: { id: op.logId, kind: op.title.kind, externalId: op.title.externalId, unit: op.unit, position: op.position, readAt: at },
      };
    case "reading.unlog":
      return { method: "PATCH", url: `/api/reading/${op.logId}`, body: { deleted: true } };
  }
}

export type OpOutcome = "done" | "retry" | "failed" | "signed_out" | "account";

/**
 * What an answer means for the op. A 404 on an edit or removal means the entry or log is already gone (removed on
 * another device, or an earlier try went through), so there is nothing left to do; on an add, the catalog has no such
 * title. Timeouts, rate limits and server errors are tried again; anything else is refused for good.
 */
export function opOutcome(op: SyncOp, status: number): OpOutcome {
  if (status >= 200 && status < 300) return "done";
  if (status === 404) return op.type === "entry.add" || op.type === "episodes.log" || op.type === "reading.log" ? "failed" : "done";
  if (status === 401) return "signed_out";
  if (status === 409) return "account";
  if (status === 408 || status === 429 || status >= 500) return "retry";
  return "failed";
}

/** After this many server errors in a row an op is shown as failed (Retry, Discard) instead of tried on its own. */
export const MAX_ATTEMPTS = 6;

/** Wait before try `attempts + 1`: 2 s, 4 s, 8 s … up to 5 min, or what the server asked for (`Retry-After`). */
export function retryDelay(attempts: number, retryAfterSeconds: number | null = null): number {
  const backoff = Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
  return retryAfterSeconds && retryAfterSeconds > 0 ? Math.min(5 * 60_000, Math.max(backoff, retryAfterSeconds * 1000)) : backoff;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** `superseded` in a saved entry's answer: a later edit from another device stayed (ADR 0042). */
export const wasSuperseded = (body: unknown) => isObject(body) && body.superseded === true;

/**
 * Ids the server kept instead of ours: the title was already in the collection (its entry), or the episode or reading
 * point was already logged (its log). Ops still queued must use them.
 */
export function keptIds(op: SyncOp, body: unknown): Map<string, string> {
  const ids = new Map<string, string>();
  if (!isObject(body)) return ids;
  if (op.type === "entry.add" && isObject(body.entry) && typeof body.entry.id === "string" && body.entry.id !== op.entryId) {
    ids.set(op.entryId, body.entry.id);
  }
  if (op.type === "episodes.log" && Array.isArray(body.logs)) {
    const kept = new Map<string, string>();
    for (const log of body.logs) {
      if (isObject(log) && typeof log.id === "string") kept.set(`${log.season}:${log.episode}`, log.id);
    }
    for (const e of op.episodes) {
      const id = kept.get(`${e.season}:${e.episode}`);
      if (id && id !== e.id) ids.set(e.id, id);
    }
  }
  if (op.type === "reading.log" && typeof body.logId === "string" && body.logId !== op.logId) ids.set(op.logId, body.logId);
  return ids;
}

/** The op with ids the server kept (`keptIds`) swapped in. */
export function withKeptIds(op: SyncOp, ids: ReadonlyMap<string, string>): SyncOp {
  if (ids.size === 0) return op;
  switch (op.type) {
    case "entry.status":
    case "entry.notes":
    case "entry.remove":
      return ids.has(op.entryId) ? { ...op, entryId: ids.get(op.entryId)! } : op;
    case "episode.unlog":
    case "reading.unlog":
      return ids.has(op.logId) ? { ...op, logId: ids.get(op.logId)! } : op;
    default:
      return op;
  }
}
