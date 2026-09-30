// The outbox on this device (S3 offline, ADR 0042): one IndexedDB database with one store of ops, keyed by op id.
// Calls reject when IndexedDB is blocked (some private windows); callers carry on without it, so changes are still
// sent, they just don't survive a reload.
import type { OutboxItem } from "@/core/sync/ops";

const DB = "mystonie";
const STORE = "outbox";

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading (a later version of this file): let it.
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("indexedDB blocked"));
    });
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function readOutbox(): Promise<OutboxItem[]> {
  return (await run<OutboxItem[]>("readonly", (store) => store.getAll() as IDBRequest<OutboxItem[]>)) ?? [];
}

export async function writeOutbox(items: readonly OutboxItem[]): Promise<void> {
  await run("readwrite", (store) => {
    for (const item of items) store.put(item);
  });
}

export async function deleteFromOutbox(ids: readonly string[]): Promise<void> {
  await run("readwrite", (store) => {
    for (const id of ids) store.delete(id);
  });
}

export async function clearOutbox(): Promise<void> {
  await run("readwrite", (store) => store.clear());
}
