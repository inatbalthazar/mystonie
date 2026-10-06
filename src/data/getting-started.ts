import type { GettingStartedFacts } from "@/core/getting-started";
import { officialAccounts } from "./official";
import type { UserClient } from "./supabase-server";

/**
 * The getting-started checklist's counts (stage 4), as head-only counts so nothing but numbers is read. "Installed" is
 * seen in the browser, not here.
 */
export async function gettingStartedFacts(db: UserClient, userId: string): Promise<Omit<GettingStartedFacts, "installed">> {
  const head = { count: "exact", head: true } as const;
  // Following Stonie and the team comes with a new account (ADR 0098): only people you chose tick "follow someone".
  const officials = [...(await officialAccounts(db)).keys()];
  const follows = db.from("follows").select("id", head).eq("follower_id", userId).is("deleted_at", null);
  const [entries, cards, avoidTopics, following, clubs] = await Promise.all([
    db.from("entries").select("id", head).eq("user_id", userId).is("deleted_at", null),
    db.from("cards").select("id", head).eq("user_id", userId).is("deleted_at", null),
    db.from("user_avoid_topics").select("topic_id", head).eq("user_id", userId).is("deleted_at", null),
    officials.length > 0 ? follows.not("followee_id", "in", `(${officials.join(",")})`) : follows,
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
