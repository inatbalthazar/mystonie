// Fandom clubs (S3 challenges & clubs, ADR 0040). The catalogue and each club's title filter are src/core/clubs.ts.
// Membership rows are the user's own (RLS); other people's are readable when their profile is public and unblocked.
// Member totals, the club feed and what members are on lately come from security definer functions that apply the
// same visibility rules.
import { posterUrl } from "@/core/catalog/images";
import type { CatalogSource, TitleKind } from "@/core/catalog/types";
import { clubRpcFilter, isClubSlug, type Club, type ClubSlug } from "@/core/clubs";
import { uuidv7 } from "@/core/ids";
import type { FeedItem } from "@/core/social";
import type { TrendingTitle } from "@/core/trending";
import { feedItems, insertLive, type FollowedPerson, type SocialWrite } from "./social";
import type { UserClient } from "./supabase-server";

const FEED_LIMIT = 20;
const TRENDING_DAYS = 30;
const TRENDING_LIMIT = 6;

/** How many people are in each club (private members count, as a number only). */
export async function clubCounts(db: UserClient): Promise<Map<string, number>> {
  const { data, error } = await db.rpc("club_counts");
  if (error) throw new Error(`club_counts failed: ${error.message}`);
  return new Map(data.map((r) => [r.club, r.members]));
}

/** The clubs a person is in, in the order they joined. Someone else's only when their profile is public. */
export async function userClubs(db: UserClient, userId: string): Promise<ClubSlug[]> {
  const { data, error } = await db.from("club_members").select("club").eq("user_id", userId).is("deleted_at", null).order("created_at").limit(100);
  if (error) throw new Error(`club_members read failed: ${error.message}`);
  return data.flatMap((row) => (isClubSlug(row.club) ? [row.club] : []));
}

/** The people the viewer follows who are in the club. */
export async function friendsInClub(db: UserClient, following: readonly FollowedPerson[], club: ClubSlug): Promise<FollowedPerson[]> {
  if (following.length === 0) return [];
  const byId = new Map(following.map((p) => [p.id, p]));
  const { data, error } = await db
    .from("club_members")
    .select("user_id")
    .eq("club", club)
    .in("user_id", [...byId.keys()].slice(0, 200))
    .is("deleted_at", null)
    .limit(200);
  if (error) throw new Error(`club_members read failed: ${error.message}`);
  return data.flatMap((row) => byId.get(row.user_id) ?? []);
}

/** The latest finishes of titles that fit the club, by its members the viewer can see (and the viewer). */
export async function clubFeed(db: UserClient, viewerId: string | null, club: Club): Promise<FeedItem[]> {
  const { data, error } = await db.rpc("club_feed", { p_club: club.slug, ...clubRpcFilter(club), p_limit: FEED_LIMIT });
  if (error) throw new Error(`club_feed failed: ${error.message}`);
  return feedItems(db, viewerId ?? "", data);
}

/** Titles that fit the club which most members finished, watched or read in the last 30 days (from 3 people). */
export async function clubTrending(db: UserClient, club: Club): Promise<TrendingTitle[]> {
  const { data, error } = await db.rpc("club_trending", { p_club: club.slug, ...clubRpcFilter(club), p_days: TRENDING_DAYS, p_limit: TRENDING_LIMIT });
  if (error) throw new Error(`club_trending failed: ${error.message}`);
  return data.map((r): TrendingTitle => {
    const imageUrl = posterUrl(r.source as CatalogSource, r.poster_path);
    return {
      source: r.source as CatalogSource,
      kind: r.kind as TitleKind,
      externalId: r.external_id,
      name: r.name,
      ...(r.year ? { year: r.year } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      people: r.people,
    };
  });
}

/** Joins a club (a new live row) or leaves it (soft delete). */
export async function setClub(db: UserClient, userId: string, club: ClubSlug, join: boolean): Promise<SocialWrite> {
  if (join) return insertLive(db.from("club_members").insert({ id: uuidv7(), club }), "club_members");
  const { error } = await db
    .from("club_members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("club", club)
    .is("deleted_at", null);
  if (error) throw new Error(`club_members update failed: ${error.message}`);
  return "ok";
}
