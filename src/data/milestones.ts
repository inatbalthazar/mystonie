// The check after a save: milestones (S2 milestones & recaps, ADR 0031), badges (S3 badges & shelf, ADR 0038) and
// monthly challenges (S3 challenges & clubs, ADR 0040), from one read of the user's rows (RLS: their own rows and
// profile). Which milestones to celebrate is decided in src/core/stats/milestones.ts, and `profiles.milestones_seen`
// remembers what was already announced; badges are awarded in ./badges.ts, challenge progress in ./challenges.ts.
import type { BadgeNews } from "@/core/badges";
import type { CardData } from "@/core/cards/types";
import { announceMilestones, milestoneCardData, parseMilestonesSeen, reachedMilestones } from "@/core/stats/milestones";
import { syncBadges } from "./badges";
import { syncChallenges } from "./challenges";
import { statsRows } from "./stats";
import type { UserClient } from "./supabase-server";

/**
 * The milestones to celebrate now and the challenges just completed, as card inputs, and the badges just earned
 * (usually none of them). Remembers them as announced, awarded and completed. Called after a finish or a log; safe to call again (each is announced once). `quiet`
 * records them without celebrating (after an import, whose own card is the celebration and whose history isn't
 * news).
 */
export async function checkProgress(
  db: UserClient,
  userId: string,
  now: number,
  quiet = false,
): Promise<{ milestones: CardData[]; badges: BadgeNews[]; challenges: CardData[] }> {
  const [{ data: profile, error }, rows] = await Promise.all([
    db.from("profiles").select("time_zone, milestones_seen").eq("id", userId).single(),
    statsRows(db, userId),
  ]);
  if (error) throw new Error(`profiles read failed: ${error.message}`);
  const reached = reachedMilestones(rows.titles, rows.entries, rows.logs);
  const { announce, seen, changed } = announceMilestones(reached, parseMilestonesSeen(profile.milestones_seen), now);
  const [badges, challenges] = await Promise.all([
    syncBadges(db, userId, rows, profile.time_zone, now),
    syncChallenges(db, userId, rows, profile.time_zone, now),
    changed &&
      db
        .from("profiles")
        .update({ milestones_seen: seen })
        .eq("id", userId)
        .then(({ error: updateError }) => {
          if (updateError) throw new Error(`profiles update failed: ${updateError.message}`);
        }),
  ]);
  if (quiet) return { milestones: [], badges: [], challenges: [] };
  const titleById = new Map(rows.titles.map((t) => [t.id, t]));
  return {
    milestones: announce.flatMap((m) => {
      const title = titleById.get(m.titleId);
      return title ? [milestoneCardData(m, title, profile.time_zone)] : [];
    }),
    badges: badges.celebrate.map((b) => ({ id: b.id, titleName: (b.titleId && titleById.get(b.titleId)?.name) || null })),
    challenges: challenges.completed,
  };
}
