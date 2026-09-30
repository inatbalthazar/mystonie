// The board (S3 finishers & the board, ADR 0039): the viewer and the people they follow, ranked by this week's or
// month's time. Read as the viewer: RLS gives nothing for private or blocked profiles, so they never show up.
import { BOARD_PEOPLE_MAX, boardStart, rankBoard, type BoardPeriod, type BoardPerson, type BoardRow } from "@/core/board";
import { periodRecaps } from "./activity";
import { myFollowing } from "./social";
import type { UserClient } from "./supabase-server";

/** The board for the period containing `now` in the viewer's time zone. */
export async function friendBoard(
  db: UserClient,
  viewer: BoardPerson,
  period: BoardPeriod,
  timeZone: string,
  now: number,
): Promise<{ start: string; rows: BoardRow[]; following: number }> {
  const following = await myFollowing(db);
  const people: BoardPerson[] = [viewer, ...following.slice(0, BOARD_PEOPLE_MAX)];
  const start = boardStart(period, now, timeZone);
  const recaps = await periodRecaps(
    db,
    people.map((p) => p.id),
    period,
    start,
    timeZone,
  );
  return { start, rows: rankBoard(people.map((p) => ({ ...p, recap: recaps.get(p.id) ?? null })), viewer.id), following: following.length };
}
