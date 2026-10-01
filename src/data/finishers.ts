// Finishers on a title page (S3 finishers & the board, ADR 0039; rare finishes, ADR 0067): how many people finished
// the title on Mystonie and what share of everyone that is, whether the viewer did, and the people they follow who
// did, newest first. No numbers: a finish isn't a race. Read as the viewer, so private and blocked profiles never show.
import type { BoardPerson } from "@/core/board";
import { liveShare } from "@/core/finish-share";
import { myFollowing } from "./social";
import type { UserClient } from "./supabase-server";

export type TitleFinisher = BoardPerson & { finishedAt: string };
export type TitleFinishers = { count: number; share: number | null; mine: boolean; friends: TitleFinisher[] };

const FRIENDS_MAX = 20;

export async function titleFinishers(db: UserClient, viewerId: string, titleId: string): Promise<TitleFinishers> {
  const [{ data: counted, error: countError }, { data: members, error: membersError }, { data: own, error: ownError }, following] = await Promise.all(
    [
      db.from("title_finish_counts").select("finishers").eq("title_id", titleId).maybeSingle(),
      db.rpc("member_count"),
      db.from("entries").select("status").eq("user_id", viewerId).eq("title_id", titleId).is("deleted_at", null).maybeSingle(),
      myFollowing(db),
    ],
  );
  if (countError) throw new Error(`title_finish_counts read failed: ${countError.message}`);
  if (membersError) throw new Error(`member_count failed: ${membersError.message}`);
  if (ownError) throw new Error(`entries read failed: ${ownError.message}`);

  const byId = new Map(following.map((p) => [p.id, p]));
  const friends: TitleFinisher[] = [];
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("entries")
      .select("user_id, finished_at")
      .in("user_id", ids.slice(i, i + 100))
      .eq("title_id", titleId)
      .eq("status", "finished")
      .is("deleted_at", null);
    if (error) throw new Error(`entries read failed: ${error.message}`);
    for (const row of data) {
      const person = byId.get(row.user_id);
      if (person && row.finished_at) friends.push({ ...person, finishedAt: row.finished_at });
    }
  }
  friends.sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  const count = counted?.finishers ?? 0;
  return {
    count,
    share: liveShare(count, members ?? 0),
    mine: own?.status === "finished",
    friends: friends.slice(0, FRIENDS_MAX),
  };
}
