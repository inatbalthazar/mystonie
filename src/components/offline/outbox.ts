"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { uuidv7 } from "@/core/ids";
import { keptIds, MAX_ATTEMPTS, opOutcome, opRequest, retryDelay, wasSuperseded, withKeptIds, type OutboxItem, type SyncOp } from "@/core/sync/ops";
import type { OverlayOp } from "@/core/sync/overlay";
import { clearOutbox, deleteFromOutbox, readOutbox, writeOutbox } from "./idb";
import { forgetRecentTitles } from "./recent-titles";
import { clearSavedPages } from "./saved-pages";

// The outbox (S3 offline, ADR 0042). Every change to the collection goes through `send`: it shows at once (components
// lay waiting ops over the server's data with `useOverlayOps`), is kept in IndexedDB, and is sent in order whenever
// there is a connection: right away when online, else when the connection comes back or the app opens again.

/** An op the server has, still laid over the page until fresh data arrives (`pruneSettled`). */
export type SettledOp = { item: OutboxItem; superseded: boolean; at: number };

export type OutboxState = {
  /** The queue kept on this device has been read (nothing is sent before). */
  loaded: boolean;
  online: boolean;
  items: readonly OutboxItem[];
  /** The op being sent right now. */
  sending: string | null;
  settled: readonly SettledOp[];
  /** Changes that had to wait (`waited`) and just went through: "3 changes synced", for a few seconds. */
  synced: { count: number; at: number } | null;
};

/** What `send` resolves to once the server has answered for good (it stays pending while the op waits). */
export type OpResult = { ok: true; body: unknown; superseded: boolean } | { ok: false };

const SERVER_STATE: OutboxState = { loaded: false, online: true, items: [], sending: null, settled: [], synced: null };
const PROBE_MAX_MS = 30_000;
/** How long "3 changes synced" stays. */
const SYNCED_MS = 4_000;
/** The last account that opened a page with its data on this device. */
const LAST_USER_KEY = "mystonie.user";

let state: OutboxState = SERVER_STATE;
const listeners = new Set<() => void>();
const settledListeners = new Set<() => void>();
const waiters = new Map<string, (result: OpResult) => void>();
/** Ops that had to wait: made or queued while offline, held for sign-in, or left from an earlier visit. */
const waited = new Set<string>();
/** Who is signed in on this page, once a page with the user's data says so (`useOverlayOps`). */
let user: string | null = null;
let started = false;
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeDelay = 2_000;
let syncedTimer: ReturnType<typeof setTimeout> | null = null;

function update(patch: Partial<OutboxState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

// IndexedDB can be blocked (private windows): then changes are still sent, they just don't survive a reload.
const persist = (items: readonly OutboxItem[]) => void (items.length > 0 && writeOutbox(items).catch(() => {}));
const forget = (ids: readonly string[]) => void (ids.length > 0 && deleteFromOutbox(ids).catch(() => {}));

function replace(changed: readonly OutboxItem[]) {
  if (changed.length === 0) return;
  const byId = new Map(changed.map((item) => [item.id, item]));
  update({ items: state.items.map((item) => byId.get(item.id) ?? item) });
  persist(changed);
}

function resolveWaiter(id: string, result: OpResult) {
  waiters.get(id)?.(result);
  waiters.delete(id);
}

/** Reads the queue kept on this device and starts sending. Once per page load (SyncProvider, or the first `send`). */
export function startOutbox() {
  if (started) return;
  started = true;
  // Opened offline: say so at once (quick add offers recent titles instead of a search that can't work).
  if (!navigator.onLine) goOffline();
  readOutbox()
    .catch(() => [] as OutboxItem[])
    .then((saved) => {
      for (const item of saved) waited.add(item.id);
      // Changes held while signed out get another go: this page may have a session again.
      const woken = saved.map((item) => (item.state === "held" && item.reason === "signed_out" ? { ...item, state: "queued" as const, reason: undefined } : item));
      const known = new Set(state.items.map((item) => item.id));
      const items = [...woken.filter((item) => !known.has(item.id)), ...state.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      update({ loaded: true, items });
      persist(woken.filter((item, i) => item !== saved[i]));
      if (navigator.onLine) void flush();
      else goOffline();
    });
}

/**
 * Queues a change made by `userId` and sends it as soon as it can. Resolves with the server's answer, or `ok: false`
 * when the server refused it (then it is shown under "couldn't be saved"). While offline it stays pending.
 */
export function send(userId: string, op: SyncOp): Promise<OpResult> {
  startOutbox();
  const item: OutboxItem = { id: uuidv7(), userId, at: new Date().toISOString(), op, attempts: 0, state: "queued" };
  if (!state.online) waited.add(item.id);
  update({ items: [...state.items, item] });
  persist([item]);
  const result = new Promise<OpResult>((resolve) => waiters.set(item.id, resolve));
  void flush();
  return result;
}

function settle(item: OutboxItem, body: unknown) {
  // The server kept its own entry or log (already there): queued ops that point at ours must use it.
  const ids = keptIds(item.op, body);
  const rest = state.items.filter((i) => i.id !== item.id);
  const items = rest.map((i) => {
    const op = withKeptIds(i.op, ids);
    return op === i.op ? i : { ...i, op };
  });
  const now = Date.now();
  const hadToWait = waited.delete(item.id) || item.attempts > 0;
  const superseded = wasSuperseded(body);
  update({
    items,
    settled: [...state.settled, { item, superseded, at: now }],
    // One note for the whole batch: it counts on while it's up.
    ...(hadToWait ? { synced: { count: (state.synced?.count ?? 0) + 1, at: now } } : {}),
  });
  if (hadToWait) hideSyncedLater();
  forget([item.id]);
  persist(items.filter((i, k) => i !== rest[k]));
  resolveWaiter(item.id, { ok: true, body, superseded });
}

/** "N changes synced" goes a few seconds after the last of the waiting changes went through. */
function hideSyncedLater() {
  if (syncedTimer) clearTimeout(syncedTimer);
  syncedTimer = setTimeout(() => {
    syncedTimer = null;
    const more = state.online && state.items.some((i) => i.state === "queued" && waited.has(i.id));
    if (more) hideSyncedLater();
    else update({ synced: null });
  }, SYNCED_MS);
}

function fail(item: OutboxItem, reason: OutboxItem["reason"]) {
  waited.delete(item.id);
  replace([{ ...item, state: "failed", reason, notBefore: undefined }]);
  resolveWaiter(item.id, { ok: false });
}

function hold(item: OutboxItem, reason: OutboxItem["reason"]) {
  waited.add(item.id);
  replace([{ ...item, state: "held", reason }]);
}

function scheduleRetry(ms: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, ms);
}

/** Sends queued ops in order until the queue is empty, the connection drops, or one has to wait. */
export async function flush(): Promise<void> {
  if (flushing || !state.loaded || !state.online) return;
  flushing = true;
  let settledAny = false;
  try {
    for (;;) {
      if (!state.online) break;
      const next = state.items.find((item) => item.state === "queued");
      if (!next) break;
      // Another account's change never lands in this one.
      if (user && next.userId !== user) {
        hold(next, "account");
        continue;
      }
      const wait = (next.notBefore ?? 0) - Date.now();
      if (wait > 0) {
        scheduleRetry(wait);
        break;
      }
      update({ sending: next.id });
      const request = opRequest(next);
      let response: Response;
      try {
        response = await fetch(request.url, {
          method: request.method,
          headers: { "Content-Type": "application/json", "X-Mystonie-User": next.userId },
          body: JSON.stringify(request.body),
        });
      } catch {
        update({ sending: null });
        goOffline();
        break;
      }
      const body: unknown = await response.json().catch(() => null);
      update({ sending: null });
      const outcome = opOutcome(next.op, response.status);
      if (outcome === "done") {
        settle(next, body);
        settledAny = true;
      } else if (outcome === "retry") {
        const attempts = next.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) fail(next, "server");
        else replace([{ ...next, attempts, notBefore: Date.now() + retryDelay(attempts, Number(response.headers.get("Retry-After")) || null) }]);
      } else if (outcome === "failed") {
        fail(next, "invalid");
      } else if (outcome === "account") {
        hold(next, "account");
      } else {
        // Signed out: everything else would be refused too. They go again once signed in.
        hold(next, "signed_out");
        break;
      }
    }
  } finally {
    flushing = false;
  }
  if (settledAny) for (const listener of settledListeners) listener();
}

/** Whether the server can be reached (a HEAD for a tiny file, never answered by the service worker). */
async function reachable(): Promise<boolean> {
  try {
    await fetch("/manifest.webmanifest", { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(5_000) });
    return true;
  } catch {
    return false;
  }
}

function stopProbing() {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = null;
  probeDelay = 2_000;
}

/** Offline: checks back every 2 s, then less often (up to 30 s), until the server answers. */
export function goOffline() {
  for (const item of state.items) waited.add(item.id);
  if (state.online) update({ online: false });
  if (probeTimer) return;
  const tick = async () => {
    if (await reachable()) {
      stopProbing();
      update({ online: true });
      void flush();
      return;
    }
    probeDelay = Math.min(probeDelay * 2, PROBE_MAX_MS);
    probeTimer = setTimeout(tick, probeDelay);
  };
  probeTimer = setTimeout(tick, probeDelay);
}

/** Checks the connection now (back online, the app in front again) and sends what waits. True when online. */
export async function checkConnection(): Promise<boolean> {
  const ok = await reachable();
  if (!ok) {
    goOffline();
    return false;
  }
  stopProbing();
  if (!state.online) update({ online: true });
  await flush();
  return true;
}

/** Someone else signed in on this device since the last page with user data: what was saved for the last one goes. */
function noteUser(userId: string) {
  try {
    const last = window.localStorage.getItem(LAST_USER_KEY);
    if (last === userId) return;
    window.localStorage.setItem(LAST_USER_KEY, userId);
    if (!last) return;
  } catch {
    return; // storage blocked: sign-out still clears it
  }
  forgetRecentTitles();
  void clearSavedPages();
}

/** Tells the outbox who is signed in: that account's held changes go, another account's wait. */
export function setOutboxUser(userId: string) {
  if (user === userId) return;
  user = userId;
  noteUser(userId);
  replace(
    state.items.flatMap((item) =>
      item.state === "held" && (item.userId === userId || item.reason === "signed_out") ? [{ ...item, state: "queued" as const, reason: undefined }] : [],
    ),
  );
  void flush();
}

/** "Try again": failed or waiting ops go now. */
export function retryOps(ids: readonly string[]) {
  const retry = new Set(ids);
  replace(
    state.items.flatMap((item) =>
      retry.has(item.id) && item.state !== "held" ? [{ ...item, state: "queued" as const, attempts: 0, notBefore: undefined, reason: undefined }] : [],
    ),
  );
  void flush();
}

/** "Discard": the change is dropped from this device. */
export function discardOps(ids: readonly string[]) {
  const gone = new Set(ids);
  for (const id of ids) {
    waited.delete(id);
    resolveWaiter(id, { ok: false });
  }
  update({ items: state.items.filter((item) => !gone.has(item.id)) });
  forget(ids);
}

/** Everything waiting on this device goes (signing out). */
export async function clearOutboxOps() {
  for (const id of [...waiters.keys()]) resolveWaiter(id, { ok: false });
  waited.clear();
  update({ items: [], settled: [], synced: null, sending: null });
  await clearOutbox().catch(() => {});
}

/** Fresh data from the server arrived (a refresh that started at `before`): ops settled before it are in it. */
export function pruneSettled(before: number) {
  const keep = state.settled.filter((s) => s.at >= before);
  if (keep.length !== state.settled.length) update({ settled: keep });
}

/** Called after a send settled one or more ops (SyncProvider refreshes the page's data). */
export function onSettled(listener: () => void): () => void {
  settledListeners.add(listener);
  return () => settledListeners.delete(listener);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOutbox(): OutboxState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}

/** Online as far as the outbox knows (the browser's events, and whether requests go through). True on the server. */
export const useOnline = () => useOutbox().online;

/** The ops to lay over `userId`'s data, in order: those the server has but the page doesn't yet, then those waiting. */
export function overlayOps(current: OutboxState, userId: string): OverlayOp[] {
  const settled = current.settled
    .filter((s) => !s.superseded && s.item.userId === userId)
    .map((s): OverlayOp => ({ op: s.item.op, at: s.item.at, state: "settled" }));
  const waiting = current.items
    .filter((item) => item.userId === userId && (item.state === "queued" || (item.state === "held" && item.reason === "signed_out")))
    .map(
      (item): OverlayOp => ({
        op: item.op,
        at: item.at,
        state: item.id === current.sending || (current.online && item.state === "queued" && !item.notBefore) ? "sending" : "waiting",
      }),
    );
  return [...settled, ...waiting];
}

/** `overlayOps` for a component showing `userId`'s data; also tells the outbox who is signed in. */
export function useOverlayOps(userId: string): OverlayOp[] {
  const current = useOutbox();
  useEffect(() => setOutboxUser(userId), [userId]);
  return useMemo(() => overlayOps(current, userId), [current, userId]);
}
