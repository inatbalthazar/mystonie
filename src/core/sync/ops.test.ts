import { describe, expect, it } from "vitest";
import { parseEntryPatch, parseNewEntry } from "../collection/entries";
import { parseEpisodeLog } from "../collection/episodes";
import { parseReadingLog } from "../collection/reading";
import { keptIds, MAX_ATTEMPTS, opOutcome, opRequest, retryDelay, wasSuperseded, withKeptIds, type OpTitle, type SyncOp } from "./ops";

const AT = "2026-09-27T18:30:00.000Z";
const NOW = Date.parse("2026-09-27T20:00:00Z");
const ENTRY = "01926000-0000-7000-8000-000000000001";
const LOG = "01926000-0000-7000-8000-000000000002";
const LOG2 = "01926000-0000-7000-8000-000000000003";
const SERVER = "01926000-0000-7000-8000-0000000000ff";

const dune: OpTitle = { source: "tmdb", kind: "movie", externalId: "693134", name: "Dune: Part Two", year: 2024, posterUrl: null };
const show: OpTitle = { source: "tmdb", kind: "series", externalId: "66732", name: "Stranger Things", year: 2016, posterUrl: null };
const manga: OpTitle = { source: "anilist", kind: "manga", externalId: "30013", name: "One Piece", year: 1997, posterUrl: null };

describe("opRequest", () => {
  it("makes the same route handler calls as before, with when the change was made", () => {
    expect(opRequest({ at: AT, op: { type: "entry.add", entryId: ENTRY, title: dune, status: "finished", finishedAt: AT } })).toEqual({
      method: "POST",
      url: "/api/entries",
      body: { id: ENTRY, title: { source: "tmdb", kind: "movie", externalId: "693134" }, status: "finished", finishedAt: AT, editedAt: AT },
    });
    expect(opRequest({ at: AT, op: { type: "entry.remove", entryId: ENTRY, title: dune } })).toEqual({
      method: "PATCH",
      url: `/api/entries/${ENTRY}`,
      body: { deleted: true, editedAt: AT },
    });
    expect(opRequest({ at: AT, op: { type: "episode.unlog", logId: LOG, title: show, season: 1, episode: 2 } })).toEqual({
      method: "PATCH",
      url: `/api/episodes/${LOG}`,
      body: { deleted: true },
    });
  });

  it("sends bodies the route handlers accept, keeping the device's time", () => {
    const ops: SyncOp[] = [
      { type: "entry.add", entryId: ENTRY, title: dune, status: "want", finishedAt: null },
      { type: "entry.status", entryId: ENTRY, title: dune, status: "finished", finishedAt: "2026-09-01T12:00:00.000Z" },
      { type: "entry.notes", entryId: ENTRY, title: dune, rating: 4.5, review: "Sand everywhere" },
      { type: "entry.remove", entryId: ENTRY, title: dune },
      { type: "episodes.log", title: show, episodes: [{ id: LOG, season: 1, episode: 1, runtimeMin: 48 }] },
      { type: "reading.log", logId: LOG, title: manga, unit: "chapter", position: 1100 },
    ];
    const [add, status, notes, remove, episodes, reading] = ops.map((op) => opRequest({ op, at: AT }).body);
    expect(parseNewEntry(add, NOW)).toMatchObject({ status: "want", editedAt: AT });
    expect(parseEntryPatch(status, NOW)).toMatchObject({ status: "finished", finishedAt: "2026-09-01T12:00:00.000Z", editedAt: AT });
    expect(parseEntryPatch(notes, NOW)).toMatchObject({ notes: { rating: 4.5, review: "Sand everywhere" }, editedAt: AT });
    expect(parseEntryPatch(remove, NOW)).toEqual({ deleted: true, editedAt: AT });
    expect(parseEpisodeLog(episodes, NOW)).toEqual({ externalId: "66732", episodes: [{ id: LOG, season: 1, episode: 1 }], watchedAt: AT });
    expect(parseReadingLog(reading, NOW)).toMatchObject({ id: LOG, kind: "manga", unit: "chapter", position: 1100, readAt: AT });
  });

  it("sends a game's hours with its notes only when the op has them (S3 games)", () => {
    const game: OpTitle = { source: "rawg", kind: "game", externalId: "3328", name: "The Witcher 3", year: 2015, posterUrl: null };
    const hours = opRequest({ at: AT, op: { type: "entry.notes", entryId: ENTRY, title: game, rating: 5, review: null, hoursPlayed: 187 } }).body;
    expect(hours).toEqual({ rating: 5, review: null, hoursPlayed: 187, editedAt: AT });
    expect(parseEntryPatch(hours, NOW)).toMatchObject({ notes: { rating: 5, review: null, hoursPlayed: 187 } });
    const cleared = opRequest({ at: AT, op: { type: "entry.notes", entryId: ENTRY, title: game, rating: 5, review: null, hoursPlayed: null } }).body;
    expect(cleared).toMatchObject({ hoursPlayed: null });
    const none = opRequest({ at: AT, op: { type: "entry.notes", entryId: ENTRY, title: dune, rating: 5, review: null } }).body;
    expect("hoursPlayed" in none).toBe(false);
  });
});

describe("opOutcome", () => {
  const add: SyncOp = { type: "entry.add", entryId: ENTRY, title: dune, status: "want", finishedAt: null };
  const edit: SyncOp = { type: "entry.status", entryId: ENTRY, title: dune, status: "watching", finishedAt: null };

  it("is done on success, and on a 404 for something already gone", () => {
    expect(opOutcome(add, 201)).toBe("done");
    expect(opOutcome(edit, 404)).toBe("done");
    expect(opOutcome({ type: "episode.unlog", logId: LOG, title: show, season: 1, episode: 1 }, 404)).toBe("done");
  });

  it("tries server trouble again, waits for sign-in or the right account, and refuses the rest", () => {
    for (const status of [408, 429, 500, 503]) expect(opOutcome(add, status)).toBe("retry");
    expect(opOutcome(add, 401)).toBe("signed_out");
    expect(opOutcome(edit, 409)).toBe("account");
    expect(opOutcome(add, 400)).toBe("failed");
    expect(opOutcome(add, 404)).toBe("failed"); // no such title in the catalog
    expect(opOutcome(edit, 403)).toBe("failed");
  });
});

describe("retryDelay", () => {
  it("backs off from 2 s to 5 min, and waits at least as long as the server asks", () => {
    expect([1, 2, 3, 4].map((n) => retryDelay(n))).toEqual([2_000, 4_000, 8_000, 16_000]);
    expect(retryDelay(20)).toBe(300_000);
    expect(retryDelay(1, 60)).toBe(60_000);
    expect(retryDelay(1, 3600)).toBe(300_000);
    expect(MAX_ATTEMPTS).toBeGreaterThan(3);
  });
});

describe("kept ids", () => {
  it("swaps in the entry the server kept when the title was already in the collection", () => {
    const add: SyncOp = { type: "entry.add", entryId: ENTRY, title: dune, status: "finished", finishedAt: AT };
    const ids = keptIds(add, { entry: { id: SERVER } });
    expect([...ids]).toEqual([[ENTRY, SERVER]]);
    expect(withKeptIds({ type: "entry.notes", entryId: ENTRY, title: dune, rating: 5, review: null }, ids)).toMatchObject({ entryId: SERVER });
    expect(withKeptIds({ type: "entry.remove", entryId: "other", title: dune }, ids)).toMatchObject({ entryId: "other" });
    expect(keptIds(add, { entry: { id: ENTRY } }).size).toBe(0);
    expect(keptIds(add, null).size).toBe(0);
  });

  it("swaps in logs the server already had", () => {
    const log: SyncOp = {
      type: "episodes.log",
      title: show,
      episodes: [
        { id: LOG, season: 1, episode: 1, runtimeMin: 50 },
        { id: LOG2, season: 1, episode: 2, runtimeMin: 50 },
      ],
    };
    const ids = keptIds(log, { logs: [{ id: SERVER, season: 1, episode: 1 }, { id: LOG2, season: 1, episode: 2 }], status: "watching" });
    expect([...ids]).toEqual([[LOG, SERVER]]);
    expect(withKeptIds({ type: "episode.unlog", logId: LOG, title: show, season: 1, episode: 1 }, ids)).toMatchObject({ logId: SERVER });

    const read: SyncOp = { type: "reading.log", logId: LOG, title: manga, unit: "chapter", position: 5 };
    expect([...keptIds(read, { logId: SERVER, logs: [], status: "watching" })]).toEqual([[LOG, SERVER]]);
  });

  it("reads a superseded answer", () => {
    expect(wasSuperseded({ entry: {}, superseded: true })).toBe(true);
    expect(wasSuperseded({ entry: {} })).toBe(false);
    expect(wasSuperseded(null)).toBe(false);
  });
});
