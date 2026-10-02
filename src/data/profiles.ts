// Public profiles and account data export (S1 profile & privacy, ADR 0027). Server only.
import { collectPages } from "@/core/account";
import { albumLayout, type AlbumLayout } from "@/core/album";
import { posterUrl } from "@/core/catalog/images";
import type { UserClient } from "./supabase-server";

export type PublicProfile =
  /** `blockedId`: the viewer blocked this profile (their page offers Unblock). */
  | { isPrivate: true; username: string; blockedId?: string }
  | {
      isPrivate: false;
      id: string;
      username: string;
      displayName: string | null;
      bio: string | null;
      avatarUrl: string | null;
      joinedAt: string;
      /** How its owner arranged the album (ADR 0069). */
      layout: AlbumLayout;
    };

/** The safe subset of a profile by username (`public_profile()`), or null when nobody has that name. */
export async function publicProfile(db: UserClient, username: string): Promise<PublicProfile | null> {
  const { data, error } = await db.rpc("public_profile", { p_username: username });
  if (error) throw new Error(`public_profile failed: ${error.message}`);
  // Generated types say non-null; a private profile returns nulls for everything but the name.
  const row = data[0] as
    | {
        id: string | null;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        is_private: boolean;
        created_at: string | null;
        blocked_by_me: boolean;
        bio: string | null;
        album_order: string[] | null;
        album_hidden: string[] | null;
        shelf_pins: string[] | null;
      }
    | undefined;
  if (!row) return null;
  if (row.blocked_by_me && row.id) return { isPrivate: true, username: row.username, blockedId: row.id };
  if (row.is_private || !row.id || !row.created_at) return { isPrivate: true, username: row.username };
  return {
    isPrivate: false,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    joinedAt: row.created_at,
    layout: albumLayout(row.album_order, row.album_hidden, row.shelf_pins),
  };
}

export type WatchingTitle = { id: string; kind: string; name: string; posterUrl: string | null };

/** What a public profile is watching now, most recently touched first. */
export async function currentlyWatching(db: UserClient, userId: string, limit: number): Promise<WatchingTitle[]> {
  const { data, error } = await db
    .from("entries")
    .select("title:titles!inner(id, source, kind, name, poster_path)")
    .eq("user_id", userId)
    .eq("status", "watching")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`entries read failed: ${error.message}`);
  return data.map(({ title }) => ({
    id: title.id,
    kind: title.kind,
    name: title.name,
    posterUrl: posterUrl(title.source, title.poster_path),
  }));
}

/**
 * Everything the user has stored with us, as they can read it (RLS: their own rows, deleted ones included),
 * for Settings → Export my data (GDPR/PDPA/CCPA). Each table is read in pages, so nothing is cut off at the
 * API's row limit.
 */
export async function exportAccount(db: UserClient, user: { id: string; email: string | undefined; createdAt: string }) {
  const table = <T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) =>
    collectPages(async (from, to) => {
      const { data, error } = await read(from, to);
      if (error) throw new Error(`export read failed: ${error.message}`);
      return data ?? [];
    });

  const [
    profile,
    entries,
    episodeLogs,
    readingLogs,
    cards,
    weeklyRecaps,
    subscriptions,
    avoidTopics,
    follows,
    stamps,
    blocks,
    badges,
    challenges,
    clubs,
    sceneWarnings,
    sceneWarningVotes,
    quizAnswers,
    feedback,
  ] = await Promise.all([
    db
      .from("profiles")
      .select("username, display_name, bio, avatar_url, locale, time_zone, country, visibility, theme, email_recaps, reel_reminders, album_order, album_hidden, shelf_pins, created_at, updated_at")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) throw new Error(`export read failed: ${error.message}`);
        return data;
      }),
    table((from, to) =>
      db
        .from("entries")
        .select("id, status, finished_at, rating, review, hours_played, finisher_no, finish_share, finish_members, created_at, updated_at, deleted_at, title:titles(source, kind, external_id, name, year)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("episode_logs")
        .select("id, season, episode, runtime_min, watched_at, created_at, updated_at, deleted_at, title:titles(source, kind, external_id, name)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("reading_logs")
        .select("id, unit, position, read_at, created_at, updated_at, deleted_at, title:titles(source, kind, external_id, name)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("cards")
        .select("id, kind, entry_id, episode_log_id, reading_log_id, template_id, size, params, image_path, shared_at, created_at, updated_at, deleted_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("weekly_recaps")
        .select("id, week_start, stats, card_id, notified_at, created_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    // Pro (ADR 0034): what Stripe told us, no payment details (those stay at Stripe).
    table((from, to) =>
      db
        .from("subscriptions")
        .select("stripe_subscription_id, status, price_id, current_period_end, cancel_at_period_end, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at")
        .range(from, to),
    ),
    // Content warnings (ADR 0035): the DTDD topic ids the user avoids, unticked ones included.
    table((from, to) =>
      db
        .from("user_avoid_topics")
        .select("id, topic_id, created_at, updated_at, deleted_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    // Social (ADR 0037): whom the user follows, the Stamps they gave and whom they blocked (profile and entry ids).
    table((from, to) =>
      db
        .from("follows")
        .select("id, followee_id, created_at, updated_at, deleted_at")
        .eq("follower_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("stamps")
        .select("id, entry_id, created_at, updated_at, deleted_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("blocks")
        .select("id, blocked_id, created_at, updated_at, deleted_at")
        .eq("blocker_id", user.id)
        .order("id")
        .range(from, to),
    ),
    // Badges (ADR 0038): the stickers awarded, when they were earned and by which title's finish.
    table((from, to) =>
      db
        .from("user_badges")
        .select("id, badge, earned_at, created_at, title:titles(source, kind, external_id, name)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    // Challenges and clubs (ADR 0040): the monthly challenges joined (progress, completion) and the clubs joined.
    table((from, to) =>
      db
        .from("challenge_joins")
        .select("id, month, slug, progress, completed_at, created_at, updated_at, deleted_at, title:titles(source, kind, external_id, name)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("club_members")
        .select("id, club, created_at, updated_at, deleted_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    // Scene warnings and the quiz (ADR 0043): the warnings the user added, their votes and their quiz answers.
    table((from, to) =>
      db
        .from("scene_warnings")
        .select("id, topic, season, episode, start_sec, end_sec, unit, position, status, confirms, disputes, created_at, updated_at, deleted_at, title:titles(source, kind, external_id, name)")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("scene_warning_votes")
        .select("id, warning_id, vote, created_at, updated_at, deleted_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    table((from, to) =>
      db
        .from("quiz_answers")
        .select("id, warning_id, choice, served_at, answered_at, counted, too_fast, question:quiz_questions(topic, title:titles(source, kind, external_id, name))")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    // Beta reports (ADR 0055): what the user reported and what became of it.
    table((from, to) =>
      db
        .from("feedback")
        .select("id, kind, message, page, error_ref, device, locale, status, created_at, updated_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
  ]);

  return {
    format: "mystonie-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null, createdAt: user.createdAt },
    profile,
    entries,
    episodeLogs,
    readingLogs,
    cards,
    weeklyRecaps,
    subscriptions,
    avoidTopics,
    follows,
    stamps,
    blocks,
    badges,
    challenges,
    clubs,
    sceneWarnings,
    sceneWarningVotes,
    quizAnswers,
    feedback,
  };
}
