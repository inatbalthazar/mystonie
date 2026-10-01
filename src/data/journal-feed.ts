// The Journal as a feed (stage 4, ADR 0052): rows with their picture and Stamps, the reader's own Stamps and Saves,
// and For you from the reader's collection. Server only. Runs as the reader (RLS) or as a visitor (anon).
import { posterUrl } from "@/core/catalog/images";
import { sourceForKind, type TitleKind } from "@/core/catalog/types";
import { isEntryStatus } from "@/core/collection/entries";
import { uuidv7 } from "@/core/ids";
import { collectionSignals, hasSignals, rankForYou, titleKey, type CollectionSignals, type FeedArticle, type ForYouReason, type JournalMarkKind } from "@/core/journal-feed";
import { journalList } from "./journal";
import { insertLive, type SocialWrite } from "./social";
import type { UserClient } from "./supabase-server";

/** How many of the reader's latest entries For you reads for their taste in kinds and genres. */
const TASTE_ENTRIES = 300;

export type JournalMarks = { stamped: Set<string>; saved: Map<string, string> };
const noMarks = (): JournalMarks => ({ stamped: new Set(), saved: new Map() });

/** Stamps per article, for everyone; `slug` asks for one article only. */
export async function journalStampCounts(db: UserClient, slug?: string): Promise<Map<string, number>> {
  const query = db.rpc("journal_stamp_counts");
  const { data, error } = await (slug ? query.eq("slug", slug) : query);
  if (error) throw new Error(`journal_stamp_counts failed: ${error.message}`);
  return new Map(data.map((r) => [r.slug, r.stamps]));
}

/** The reader's live Stamps, and Saves with when they were saved, newest first. */
export async function myJournalMarks(db: UserClient, viewerId: string): Promise<JournalMarks> {
  const { data, error } = await db
    .from("journal_marks")
    .select("slug, kind, created_at")
    .eq("user_id", viewerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`journal_marks read failed: ${error.message}`);
  const marks = noMarks();
  for (const r of data) {
    if (r.kind === "stamp") marks.stamped.add(r.slug);
    else marks.saved.set(r.slug, r.created_at);
  }
  return marks;
}

/** Stamps or saves an article for the reader, or takes it back (a soft delete; a new mark is a new row). */
export async function setJournalMark(db: UserClient, viewerId: string, slug: string, kind: JournalMarkKind, on: boolean): Promise<SocialWrite> {
  if (on) return insertLive(db.from("journal_marks").insert({ id: uuidv7(), slug, kind }), "journal_marks");
  const { error } = await db
    .from("journal_marks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", viewerId)
    .eq("slug", slug)
    .eq("kind", kind)
    .is("deleted_at", null);
  if (error) throw new Error(`journal_marks update failed: ${error.message}`);
  return "ok";
}

/** The reader's saved articles in `locale`, last saved first (Me's "Saved to read"). */
export async function savedArticles(db: UserClient, viewerId: string, locale: string): Promise<{ slug: string; locale: string; title: string; minutes: number }[]> {
  const [marks, list] = await Promise.all([myJournalMarks(db, viewerId), journalList(locale)]);
  const bySlug = new Map(list.map((a) => [a.slug, a]));
  return [...marks.saved.keys()].flatMap((slug) => {
    const a = bySlug.get(slug);
    return a ? [{ slug, locale: a.locale, title: a.meta.title, minutes: a.minutes }] : [];
  });
}

type TitleRef = { kind: TitleKind; externalId: string };
type CachedTitle = { posterUrl: string | null; genres: string[] };

/** The articles' titles from the catalog cache (public): posters for the rows, genres for For you. */
async function cachedTitles(db: UserClient, refs: readonly TitleRef[]): Promise<Map<string, CachedTitle>> {
  const out = new Map<string, CachedTitle>();
  if (refs.length === 0) return out;
  const { data, error } = await db
    .from("titles")
    .select("kind, source, external_id, poster_path, genres")
    .in("external_id", [...new Set(refs.map((r) => r.externalId))]);
  if (error) {
    console.error(`titles read failed: ${error.message}`);
    return out;
  }
  const wanted = new Set(refs.map((r) => titleKey(r.kind, r.externalId)));
  for (const r of data) {
    const key = titleKey(r.kind, r.external_id);
    if (!wanted.has(key) || r.source !== sourceForKind(r.kind as TitleKind)) continue;
    out.set(key, { posterUrl: posterUrl(r.source, r.poster_path, "w185"), genres: r.genres });
  }
  return out;
}

/** The reader's entries of the articles' titles and, with `taste`, their latest entries' kinds and genres. */
async function readerSignals(db: UserClient, viewerId: string, refs: readonly TitleRef[], taste: boolean): Promise<CollectionSignals> {
  const ids = [...new Set(refs.map((r) => r.externalId))];
  const [matches, recent] = await Promise.all([
    ids.length
      ? db.from("entries").select("status, title:titles!inner(kind, external_id, name)").eq("user_id", viewerId).is("deleted_at", null).in("title.external_id", ids)
      : null,
    taste
      ? db
          .from("entries")
          .select("status, title:titles!inner(kind, genres)")
          .eq("user_id", viewerId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(TASTE_ENTRIES)
      : null,
  ]);
  if (matches?.error) throw new Error(`entries read failed: ${matches.error.message}`);
  if (recent?.error) throw new Error(`entries read failed: ${recent.error.message}`);
  const wanted = new Set(refs.map((r) => titleKey(r.kind, r.externalId)));
  return collectionSignals(
    (matches?.data ?? []).flatMap((r) =>
      isEntryStatus(r.status) && wanted.has(titleKey(r.title.kind, r.title.external_id))
        ? [{ status: r.status, kind: r.title.kind, externalId: r.title.external_id, name: r.title.name }]
        : [],
    ),
    (recent?.data ?? []).flatMap((r) => (isEntryStatus(r.status) ? [{ status: r.status, kind: r.title.kind, genres: r.title.genres }] : [])),
  );
}

export type JournalFeed = {
  /** Newest first. */
  articles: FeedArticle[];
  /** For you's order (slugs), when it was asked for. */
  forYou: string[] | null;
  /** The reader's saved articles, last saved first. */
  saved: string[];
  /** Whether the reader's collection gave For you anything to go on. */
  personal: boolean;
};

/**
 * The Journal's articles in `locale` as rows: the picture (cover, else the first cached poster), Stamps, and for a
 * signed-in reader their own Stamps and Saves. `forYou: "rank"` also orders them For you; "reasons" only says
 * which of the reader's titles each one shows (the Following feed). `limit` keeps the newest few. A database
 * problem leaves the rows plain rather than failing the page.
 */
export async function journalFeed(
  locale: string,
  { db, viewerId, forYou = false, limit }: { db: UserClient | null; viewerId: string | null; forYou?: "rank" | "reasons" | false; limit?: number },
): Promise<JournalFeed> {
  const all = await journalList(locale);
  const list = all.slice(0, limit);
  const refs = list.flatMap((a) => a.titles);
  const soft = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
    promise.catch((error: unknown) => {
      console.error(error);
      return fallback;
    });
  const reader = db && viewerId ? { db, viewerId } : null;
  const [counts, marks, titles, signals] = await Promise.all([
    db ? soft(journalStampCounts(db), new Map<string, number>()) : new Map<string, number>(),
    reader ? soft(myJournalMarks(reader.db, reader.viewerId), noMarks()) : noMarks(),
    db ? cachedTitles(db, refs) : new Map<string, CachedTitle>(),
    reader && forYou ? soft(readerSignals(reader.db, reader.viewerId, refs, forYou === "rank"), null) : null,
  ]);

  const ranked = signals
    ? rankForYou(
        list.map((a) => ({
          slug: a.slug,
          date: a.meta.date,
          featured: a.meta.featured,
          titles: a.titles.map((t) => ({ ...t, genres: titles.get(titleKey(t.kind, t.externalId))?.genres ?? [] })),
        })),
        signals,
        new Date().toISOString().slice(0, 10),
      )
    : null;
  const reasons = new Map<string, ForYouReason | null>(ranked?.map((r) => [r.slug, r.reason]) ?? []);

  return {
    articles: list.map((a) => ({
      slug: a.slug,
      locale: a.locale,
      title: a.meta.title,
      description: a.meta.description,
      date: a.meta.date,
      minutes: a.minutes,
      author: a.meta.author,
      avatar: a.meta.avatar,
      profile: a.meta.profile,
      image: a.meta.cover ?? a.titles.map((t) => titles.get(titleKey(t.kind, t.externalId))?.posterUrl).find((url) => !!url) ?? null,
      featured: a.meta.featured,
      draft: a.meta.draft,
      stamps: counts.get(a.slug) ?? 0,
      stamped: marks.stamped.has(a.slug),
      saved: marks.saved.has(a.slug),
      reason: reasons.get(a.slug) ?? null,
    })),
    forYou: forYou === "rank" && ranked ? ranked.map((r) => r.slug) : null,
    // Only articles that are still published (one taken down stays saved, out of sight).
    saved: [...marks.saved.keys()].filter((slug) => all.some((a) => a.slug === slug)),
    personal: signals ? hasSignals(signals) : false,
  };
}
