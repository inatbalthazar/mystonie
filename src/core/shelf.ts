// The Shelf on public profiles (S3 badges & shelf): every live finish, newest first.
import type { TitleKind } from "./catalog/types";
import type { StatsEntry } from "./stats/summary";

export type ShelfTitle = { id: string; kind: TitleKind; name: string; posterUrl: string | null };

/** The newest `max` finished titles (ties by title id, so the order is stable) and how many more there are. */
export function shelfItems(titles: readonly ShelfTitle[], entries: readonly StatsEntry[], max: number): { items: ShelfTitle[]; more: number } {
  const byId = new Map(titles.map((t) => [t.id, t]));
  const finished = entries
    .flatMap((e) => {
      const title = byId.get(e.titleId);
      const at = e.finishedAt ? Date.parse(e.finishedAt) : NaN;
      return !e.deletedAt && e.status === "finished" && title && !Number.isNaN(at) ? [{ at, title }] : [];
    })
    .sort((a, b) => b.at - a.at || a.title.id.localeCompare(b.title.id));
  return { items: finished.slice(0, max).map((f) => f.title), more: Math.max(0, finished.length - max) };
}
