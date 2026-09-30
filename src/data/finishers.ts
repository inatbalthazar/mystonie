// Finisher #N on a title page (S3 finishers & the board, ADR 0039): how many people finished the title on Mystonie,
// the viewer's own number, and the people they follow who finished it, in finishing order (the title's leaderboard
// among friends). Read as the viewer, so private and blocked profiles never show.
import type { BoardPerson } from "@/core/board";
import { myFollowing } from "./social";
import type { UserClient } from "./supabase-server";

export type TitleFinisher = BoardPerson & { number: number; finishedAt: string };
export type TitleFinishers = { count: number; mine: number | null; friends: TitleFinisher[] };

const FRIENDS_MAX = 20;

export async function titleFinishers(db: UserClient, viewerId: string, titleId: string): Promise<TitleFinishers> {
  const [{ data: counted, error: countError }, { data: own, error: ownError }, following] = await Promise.all([
    db.from("title_finish_counts").select("finishers").eq("title_id", titleId).maybeSingle(),
    db.from("entries").select("status, finisher_no").eq("user_id", viewerId).eq("title_id", titleId).is("deleted_at", null).maybeSingle(),
    myFollowing(db),
  ]);
  if (countError) throw new Error(`title_finish_counts read failed: ${countError.message}`);
  if (ownError) throw new Error(`entries read failed: ${ownError.message}`);

  const byId = new Map(following.map((p) => [p.id, p]));
  const friends: TitleFinisher[] = [];
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("entries")
      .select("user_id, finisher_no, finished_at")
      .in("user_id", ids.slice(i, i + 100))
      .eq("title_id", titleId)
      .eq("status", "finished")
      .is("deleted_at", null)
      .not("finisher_no", "is", null);
    if (error) throw new Error(`entries read failed: ${error.message}`);
    for (const row of data) {
      const person = byId.get(row.user_id);
      if (person && row.finisher_no && row.finished_at) friends.push({ ...person, number: row.finisher_no, finishedAt: row.finished_at });
    }
  }
  friends.sort((a, b) => a.number - b.number);
  return {
    count: counted?.finishers ?? 0,
    mine: own?.status === "finished" ? (own.finisher_no ?? null) : null,
    friends: friends.slice(0, FRIENDS_MAX),
  };
}
