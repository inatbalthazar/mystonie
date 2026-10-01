// Reel of the Day (stage 4 daily game, ADR 0048): the day's movie and the plays. The day's pick and every grade happen
// here, on the server (service role); clients only read their own plays and days that are over.
import { parseCredits } from "@/core/catalog/credits";
import { posterUrl } from "@/core/catalog/images";
import { uuidv7 } from "@/core/ids";
import {
  gradeReel,
  pickReel,
  reelNumber,
  reelPoolPages,
  streakAfter,
  type ReelAnswer,
  type ReelGuess,
  type ReelPlay,
} from "@/core/reel";
import { addDays } from "@/core/stats/recap";
import type { Json } from "./database.types";
import { adminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";
import { saveTitle } from "./titles";
import { reelPoolPage, titleDetails } from "./tmdb";

export type Reel = { day: string; number: number; answer: ReelAnswer; posterPath: string | null; posterUrl: string | null };

const REEL_TITLE = "title:titles!inner(external_id, name, year, genres, credits, poster_path, tagline:raw->>tagline)";

type ReelRow = {
  day: string;
  title: { external_id: string; name: string; year: number | null; genres: string[]; credits: unknown; poster_path: string | null; tagline: string | null };
};

function toReel(row: ReelRow): Reel {
  const credits = parseCredits(row.title.credits) ?? [];
  const tagline = row.title.tagline?.trim() || null;
  return {
    day: row.day,
    number: reelNumber(row.day),
    answer: {
      externalId: row.title.external_id,
      name: row.title.name,
      year: row.title.year,
      genres: row.title.genres,
      actor: credits.find((c) => c.role === "actor")?.name ?? null,
      director: credits.find((c) => c.role === "director")?.name ?? null,
      tagline,
    },
    posterPath: row.title.poster_path,
    posterUrl: posterUrl("tmdb", row.title.poster_path, "w342"),
  };
}

/** A day's reel as stored, or null (not picked yet, or no database). */
export async function storedReel(day: string): Promise<Reel | null> {
  const db = adminClient();
  if (!db) return null;
  const { data, error } = await db.from("daily_reels").select(`day, ${REEL_TITLE}`).eq("day", day).maybeSingle();
  if (error) throw new Error(`daily_reels read failed: ${error.message}`);
  return data ? toReel(data as unknown as ReelRow) : null;
}

/**
 * `day`'s reel, picking it on the day's first request: a movie from the pool with a poster that was never a reel,
 * fetched fresh from TMDB (with its credits and tagline). Two servers picking at once pick the same movie, and the
 * database keeps one. Null without a database; throws when TMDB fails and nothing is stored.
 */
export async function ensureReel(day: string): Promise<Reel | null> {
  const stored = await storedReel(day);
  if (stored) return stored;
  const db = adminClient();
  if (!db) return null;

  const { data: past, error } = await db.from("daily_reels").select("title:titles!inner(external_id)");
  if (error) throw new Error(`daily_reels read failed: ${error.message}`);
  const used = new Set(past.map((r) => (r.title as unknown as { external_id: string }).external_id));
  let pick: string | null = null;
  for (const page of reelPoolPages(day)) {
    pick = pickReel(await reelPoolPage(page), used, day);
    if (pick) break;
  }
  if (!pick) throw new Error("the reel pool is used up");

  const details = await titleDetails("movie", pick);
  const titleId = details && (await saveTitle(details.title, details.raw));
  if (!titleId) throw new Error(`reel ${pick} could not be cached`);
  const { error: insertError } = await db
    .from("daily_reels")
    .upsert({ day, number: reelNumber(day), title_id: titleId }, { onConflict: "day", ignoreDuplicates: true });
  if (insertError) throw new Error(`daily_reels write failed: ${insertError.message}`);
  return storedReel(day);
}

/** A stored play's guesses (kept as JSON), checked again. */
function storedGuesses(v: unknown): ReelGuess[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((g) =>
    typeof g === "object" && g !== null && typeof g.externalId === "string" && typeof g.name === "string" ? [{ externalId: g.externalId, name: g.name }] : [],
  );
}

export type StoredPlay = { guesses: ReelGuess[]; streak: number | null; solved: boolean; finished: boolean };

/** The user's play of `day` (read as the user: their own row), or null. */
export async function reelPlay(db: UserClient, userId: string, day: string): Promise<StoredPlay | null> {
  const { data, error } = await db.from("reel_plays").select("guesses, streak, solved, finished_at").eq("user_id", userId).eq("day", day).maybeSingle();
  if (error) throw new Error(`reel_plays read failed: ${error.message}`);
  return data ? { guesses: storedGuesses(data.guesses), streak: data.streak, solved: data.solved, finished: data.finished_at !== null } : null;
}

/**
 * Records a signed-in play's guesses (already merged with the stored ones) and, when they end it, its streak (from
 * the day before's play). Returns the streak once finished, else null.
 */
export async function saveReelPlay(userId: string, reel: Reel, guesses: readonly ReelGuess[], exists: boolean): Promise<number | null> {
  const db = adminClient();
  if (!db) throw new Error("no database");
  const grade = gradeReel(reel.answer.externalId, guesses);
  let streak: number | null = null;
  if (grade.done) {
    const { data: previous, error } = await db
      .from("reel_plays")
      .select("day, solved, streak")
      .eq("user_id", userId)
      .eq("day", addDays(reel.day, -1))
      .not("finished_at", "is", null)
      .maybeSingle();
    if (error) throw new Error(`reel_plays read failed: ${error.message}`);
    streak = streakAfter(grade.solved, previous && { day: previous.day, solved: previous.solved, streak: previous.streak ?? 0 }, reel.day);
  }
  const row = {
    guesses: grade.guesses as unknown as Json,
    solved: grade.solved,
    finished_at: grade.done ? new Date().toISOString() : null,
    streak,
  };
  const { error } = exists
    ? await db.from("reel_plays").update(row).eq("user_id", userId).eq("day", reel.day).is("finished_at", null)
    : await db.from("reel_plays").insert({ id: uuidv7(), user_id: userId, day: reel.day, ...row });
  if (error) throw new Error(`reel_plays write failed: ${error.message}`);
  return streak;
}

/** The user's finished plays, for their stats (read as the user). */
export async function reelHistory(db: UserClient, userId: string): Promise<ReelPlay[]> {
  const { data, error } = await db
    .from("reel_plays")
    .select("day, solved, guesses")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .order("day", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`reel_plays read failed: ${error.message}`);
  return data.map((p) => ({ day: p.day, solved: p.solved, guesses: Array.isArray(p.guesses) ? p.guesses.length : 0 }));
}

/** The day before's reel, now public (the page's "Yesterday's reel"). Null when there was none. */
export async function yesterdaysReel(today: string): Promise<Reel | null> {
  return storedReel(addDays(today, -1)).catch((error: unknown) => {
    console.error(error);
    return null;
  });
}
