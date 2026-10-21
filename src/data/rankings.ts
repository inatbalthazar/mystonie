// Rankings (ADR 0099): the ✓ marks on a ranking, from the owner's own rows, and the rankings in the Following feed. Server only.
import { parseCardData } from "@/core/cards/saved";
import type { TitleKind } from "@/core/catalog/types";
import { markDone, parseRef, titleRef, type CardRanking } from "@/core/rankings";
import type { FeedRanking } from "@/core/social";
import { userPlaces, userRegions } from "./atlas";
import { publicImageUrl } from "./cards";
import { officialAccounts, officialOf } from "./official";
import type { UserClient } from "./supabase-server";

/**
 * A ranking with its ✓ marks from the owner's own rows (ADR 0099): the titles they finished, the countries they've
 * been to or lived in, the regions they marked. Whatever the browser sent is replaced. Null for other cards.
 */
export async function rankingDone(db: UserClient, userId: string, ranking: CardRanking | null | undefined): Promise<CardRanking | null> {
  if (!ranking) return null;
  const refs = ranking.items.map((item) => parseRef(item.ref));
  const titles = refs.flatMap((r) => (r?.type === "title" ? [r] : []));
  const wantsPlaces = refs.some((r) => r?.type === "country" || r?.type === "region");
  const [finished, places, regions] = await Promise.all([
    titles.length > 0
      ? db
          .from("entries")
          .select("title:titles!inner(kind, external_id)")
          .eq("user_id", userId)
          .eq("status", "finished")
          .is("deleted_at", null)
          .in(
            "titles.external_id",
            titles.map((t) => t.externalId),
          )
          .limit(100)
          .then(({ data, error }) => {
            if (error) throw new Error(`entries read failed: ${error.message}`);
            return new Set(data.map(({ title }) => titleRef(title.kind as TitleKind, title.external_id)));
          })
      : new Set<string>(),
    wantsPlaces ? userPlaces(db, userId) : [],
    refs.some((r) => r?.type === "region") ? userRegions(db, userId) : [],
  ]);
  const visited = new Set<string>([...places.filter((p) => p.status !== "want").map((p) => p.country), ...regions]);
  return markDone(ranking, finished, visited);
}

/** How many rankings the Following feed takes in with its first page, and on the Rankings filter. */
export const FEED_RANKINGS = 10;
export const FEED_RANKINGS_ONLY = 30;

/**
 * The ranking and tier list cards shared by the people the viewer follows and by the viewer, newest first, for the
 * Following feed (ADR 0099, step 3). Cards whose data no longer parses are left out.
 */
export async function followingRankings(db: UserClient, viewerId: string, limit = FEED_RANKINGS): Promise<FeedRanking[]> {
  const [{ data, error }, officials] = await Promise.all([db.rpc("following_rankings", { p_limit: limit }), officialAccounts(db)]);
  if (error) throw new Error(`following_rankings failed: ${error.message}`);
  return data.flatMap((r) => {
    const card = parseCardData(r.params as Record<string, unknown>);
    const imageUrl = publicImageUrl(r.image_path);
    if (!card?.ranking || !imageUrl) return [];
    const { items, tiers } = card.ranking;
    // A tier list's best first: its top row's things, then the next row's.
    const ordered = tiers ? [...items].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0)) : items;
    return [
      {
        cardId: r.card_id,
        type: tiers ? "tier" : "top",
        sharedAt: new Date(r.shared_at).toISOString(),
        imageUrl,
        name: card.name,
        count: items.length,
        preview: ordered.slice(0, 3).map((i) => i.name),
        user: {
          id: r.user_id,
          username: r.username,
          displayName: r.display_name ?? null,
          avatarUrl: r.avatar_url ?? null,
          official: officialOf(officials, r.user_id),
        },
        mine: r.user_id === viewerId,
      },
    ];
  });
}
