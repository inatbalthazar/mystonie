import { describe, expect, it } from "vitest";
import type { CollectionItem } from "../collection/entries";
import type { OpTitle, SyncOp } from "./ops";
import {
  overlayCollection,
  overlayEpisodes,
  overlayReadingLogs,
  overlayReadLogs,
  overlayTitleState,
  overlayWatchLogs,
  type OverlayOp,
} from "./overlay";

const AT = "2026-09-27T18:30:00.000Z";
const id = (n: number) => `01926000-0000-7000-8000-${String(n).padStart(12, "0")}`;

const dune: OpTitle = { source: "tmdb", kind: "movie", externalId: "693134", name: "Dune: Part Two", year: 2024, posterUrl: null };
const show: OpTitle = { source: "tmdb", kind: "series", externalId: "66732", name: "Stranger Things", year: 2016, posterUrl: null };
const manga: OpTitle = { source: "anilist", kind: "manga", externalId: "30013", name: "One Piece", year: 1997, posterUrl: null };

const saved = (title: OpTitle, over: Partial<CollectionItem> = {}): CollectionItem => ({
  id: id(900 + Number(title.externalId.slice(-2))),
  status: "want",
  finishedAt: null,
  addedAt: "2026-09-01T00:00:00.000Z",
  rating: null,
  review: null,
  title: { ...title, id: `title-${title.externalId}` },
  ...over,
});

const waiting = (op: SyncOp, at = AT): OverlayOp => ({ op, at, state: "waiting" });

describe("overlayCollection", () => {
  it("shows a title added offline, marked as waiting, newest first", () => {
    const list = overlayCollection([saved(show)], [waiting({ type: "entry.add", entryId: id(1), title: dune, status: "finished", finishedAt: AT })]);
    expect(list.map((i) => [i.title.name, i.status, i.sync ?? null])).toEqual([
      ["Dune: Part Two", "finished", "waiting"],
      ["Stranger Things", "want", null],
    ]);
    expect(list[0]).toMatchObject({ id: id(1), finishedAt: AT, addedAt: AT });
  });

  it("applies edits in order by title, whatever id the entry has on the server", () => {
    const base = [saved(dune)];
    const ops = [
      waiting({ type: "entry.add", entryId: id(1), title: dune, status: "watching", finishedAt: null }),
      waiting({ type: "entry.status", entryId: id(1), title: dune, status: "finished", finishedAt: null }, "2026-09-27T19:00:00.000Z"),
      { op: { type: "entry.notes", entryId: id(1), title: dune, rating: 4, review: "Big" }, at: AT, state: "sending" } as OverlayOp,
    ];
    const [item] = overlayCollection(base, ops);
    // The server's entry keeps its id; a finish without a date is dated when it was made.
    expect(item).toMatchObject({ id: base[0]!.id, status: "finished", finishedAt: "2026-09-27T19:00:00.000Z", rating: 4, review: "Big", sync: "waiting" });
  });

  it("lays a game's hours over its entry, and keeps them when notes come without any (S3 games)", () => {
    const game: OpTitle = { source: "rawg", kind: "game", externalId: "3328", name: "The Witcher 3", year: 2015, posterUrl: null };
    const [played] = overlayCollection([{ ...saved(game), hoursPlayed: 40 }], [waiting({ type: "entry.notes", entryId: id(7), title: game, rating: 5, review: null, hoursPlayed: 187 })]);
    expect(played).toMatchObject({ rating: 5, hoursPlayed: 187 });
    const [kept] = overlayCollection([{ ...saved(game), hoursPlayed: 40 }], [waiting({ type: "entry.notes", entryId: id(7), title: game, rating: 4, review: null })]);
    expect(kept).toMatchObject({ rating: 4, hoursPlayed: 40 });
  });

  it("removes, and a log puts a title on the Watching shelf (a watchlist title moves on)", () => {
    const base = [saved(dune), saved(show)];
    const list = overlayCollection(base, [
      waiting({ type: "entry.remove", entryId: base[0]!.id, title: dune }),
      waiting({ type: "episodes.log", title: show, episodes: [{ id: id(2), season: 1, episode: 1, runtimeMin: 50 }] }),
      waiting({ type: "reading.log", logId: id(3), title: manga, unit: "chapter", position: 12 }),
    ]);
    expect(list.map((i) => [i.title.name, i.status])).toEqual([
      ["One Piece", "watching"],
      ["Stranger Things", "watching"],
    ]);
    // An edit of a title that is gone does nothing.
    expect(overlayCollection([], [waiting({ type: "entry.status", entryId: id(5), title: dune, status: "watching", finishedAt: null })])).toEqual([]);
  });

  it("changes nothing for an op the server already applied, and leaves no mark", () => {
    const base = [saved(dune, { status: "finished", finishedAt: AT })];
    const list = overlayCollection(base, [{ op: { type: "entry.add", entryId: id(1), title: dune, status: "finished", finishedAt: AT }, at: AT, state: "settled" }]);
    expect(list).toEqual(base);
  });
});

describe("log overlays", () => {
  it("adds waiting episode logs to the collection's numbers for titles the server has, and takes un-logged ones out", () => {
    const items = [saved(show)];
    const logs = [{ id: id(10), titleId: "title-66732", runtimeMin: 50, watchedAt: "2026-09-20T00:00:00.000Z" }];
    const ops = [
      waiting({ type: "episodes.log", title: show, episodes: [{ id: id(11), season: 1, episode: 2, runtimeMin: 45 }] }),
      waiting({ type: "episode.unlog", logId: id(10), title: show, season: 1, episode: 1 }),
      waiting({ type: "episodes.log", title: { ...show, externalId: "1" }, episodes: [{ id: id(12), season: 1, episode: 1, runtimeMin: 45 }] }),
    ];
    expect(overlayWatchLogs(logs, items, ops)).toEqual([{ id: id(11), titleId: "title-66732", runtimeMin: 45, watchedAt: AT }]);
  });

  it("adds a reading point once", () => {
    const items = [saved(manga)];
    const logs = [{ id: id(20), titleId: "title-30013", unit: "chapter" as const, position: 10, readAt: "2026-09-20T00:00:00.000Z" }];
    const ops = [
      waiting({ type: "reading.log", logId: id(21), title: manga, unit: "chapter", position: 10 }),
      waiting({ type: "reading.log", logId: id(22), title: manga, unit: "chapter", position: 11 }),
    ];
    expect(overlayReadLogs(logs, items, ops).map((l) => l.id)).toEqual([id(20), id(22)]);
  });

  it("gives a series page its waiting episodes, marked, and un-logs by id or episode", () => {
    const logs = [
      { id: id(30), season: 1, episode: 1 },
      { id: id(31), season: 1, episode: 2 },
    ];
    const ops = [
      waiting({
        type: "episodes.log",
        title: show,
        episodes: [
          { id: id(32), season: 1, episode: 2, runtimeMin: 50 },
          { id: id(33), season: 1, episode: 3, runtimeMin: 50 },
        ],
      }),
      waiting({ type: "episode.unlog", logId: id(99), title: show, season: 1, episode: 1 }),
      waiting({ type: "episodes.log", title: dune, episodes: [{ id: id(34), season: 1, episode: 4, runtimeMin: 50 }] }),
    ];
    expect(overlayEpisodes(show, logs, ops)).toEqual([
      { id: id(31), season: 1, episode: 2 },
      { id: id(33), season: 1, episode: 3, sync: "waiting" },
    ]);
  });

  it("gives a reading page its waiting points; a point already logged stays as it was", () => {
    const logs = [{ id: id(40), unit: "chapter" as const, position: 5, readAt: "2026-09-20T00:00:00.000Z" }];
    const list = overlayReadingLogs(manga, logs, [
      waiting({ type: "reading.log", logId: id(41), title: manga, unit: "chapter", position: 5 }),
      waiting({ type: "reading.log", logId: id(42), title: manga, unit: "chapter", position: 6 }),
      waiting({ type: "reading.unlog", logId: id(40), title: manga, unit: "chapter", position: 5 }),
    ]);
    expect(list).toEqual([{ id: id(42), unit: "chapter", position: 6, readAt: AT, sync: "waiting" }]);
  });
});

describe("overlayTitleState", () => {
  it("finishes, rates and removes a title, and a log starts it", () => {
    const start = { status: "want" as const, entry: { id: id(50), finishedAt: null, rating: null, review: null } };
    expect(overlayTitleState(show, start, [waiting({ type: "episodes.log", title: show, episodes: [{ id: id(51), season: 1, episode: 1, runtimeMin: 50 }] })])).toEqual({
      ...start,
      status: "watching",
    });
    const finished = overlayTitleState(show, start, [
      waiting({ type: "entry.add", entryId: id(52), title: show, status: "finished", finishedAt: null }),
      waiting({ type: "entry.notes", entryId: id(52), title: show, rating: 5, review: "Wow" }),
    ]);
    expect(finished).toEqual({ status: "finished", entry: { id: id(50), finishedAt: AT, rating: 5, review: "Wow" }, sync: "waiting" });
    expect(overlayTitleState(show, start, [waiting({ type: "entry.remove", entryId: id(50), title: show })])).toEqual({ status: null, entry: null, sync: "waiting" });
    // Other titles' ops don't count.
    expect(overlayTitleState(show, start, [waiting({ type: "entry.remove", entryId: id(9), title: dune })])).toEqual(start);
  });

  it("a finish from nothing gets the op's entry id until the server answers", () => {
    expect(overlayTitleState(manga, { status: null, entry: null }, [waiting({ type: "entry.add", entryId: id(60), title: manga, status: "finished", finishedAt: AT })])).toEqual({
      status: "finished",
      entry: { id: id(60), finishedAt: AT, rating: null, review: null },
      sync: "waiting",
    });
  });
});
