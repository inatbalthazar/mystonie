import type { GettingStartedFacts } from "@/core/getting-started";
import type { UserClient } from "./supabase-server";

/**
 * The getting-started checklist's counts (stage 4), as head-only counts so nothing but numbers is read. "Installed" is
 * seen in the browser, not here.
 */
export async function gettingStartedFacts(db: UserClient, userId: string): Promise<Omit<GettingStartedFacts, "installed">> {
  const head = { count: "exact", head: true } as const;
  const [entries, cards, avoidTopics, following, clubs] = await Promise.all([
    db.from("entries").select("id", head).eq("user_id", userId).is("deleted_at", null),
    db.from("cards").select("id", head).eq("user_id", userId).is("deleted_at", null),
    db.from("user_avoid_topics").select("topic_id", head).eq("user_id", userId).is("deleted_at", null),
    db.from("follows").select("id", head).eq("follower_id", userId).is("deleted_at", null),
    db.from("club_members").select("club", head).eq("user_id", userId).is("deleted_at", null),
  ]);
  const failed = [entries, cards, avoidTopics, following, clubs].find((r) => r.error);
  if (failed?.error) throw new Error(`getting-started counts failed: ${failed.error.message}`);
  return {
    entries: entries.count ?? 0,
    cards: cards.count ?? 0,
    avoidTopics: avoidTopics.count ?? 0,
    following: following.count ?? 0,
    clubs: clubs.count ?? 0,
  };
}
