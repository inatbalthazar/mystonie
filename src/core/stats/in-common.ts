import type { StatsEntry } from "./summary";

/**
 * What a visitor and the profile they look at both finished (ADR 0077): the profile's live finishes, newest first,
 * whose titles are among the visitor's (`mine`, title ids). Each title once.
 */
export function finishedInCommon(theirs: readonly StatsEntry[], mine: ReadonlySet<string>): string[] {
  const finished = theirs
    .filter((e) => e.status === "finished" && !e.deletedAt && mine.has(e.titleId))
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  return [...new Set(finished.map((e) => e.titleId))];
}
