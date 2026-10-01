// The Journal in the feed (stage 4, ADR 0052, ADR 0062): the feed's tabs (Following, Articles, Saved), the For you
// order picked from the reader's collection, Stamps and Saves on articles, and where articles go in the Following feed.
import type { TitleKind } from "./catalog/types";
import type { EntryStatus } from "./collection/entries";
import { isJournalSlug } from "./journal";

export const FEED_TABS = ["following", "articles", "saved"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

/**
 * The feed's tabs, in order (ADR 0062): Following (the people you follow, with the newest articles among them) needs
 * an account, Saved an account with something saved. Articles is always there, and is all a visitor gets.
 */
export function feedTabs({ signedIn, saved }: { signedIn: boolean; saved: number }): FeedTab[] {
  return FEED_TABS.filter((tab) => tab === "articles" || (signedIn && (tab === "following" || saved > 0)));
}

/** `?tab=` as one of `tabs`, else the first one (Following when signed in, else Articles). */
export function pickFeedTab(raw: unknown, tabs: readonly FeedTab[]): FeedTab {
  return typeof raw === "string" && (tabs as readonly string[]).includes(raw) ? (raw as FeedTab) : (tabs[0] ?? "articles");
}

/** The feed's tab an old `/journal?tab=` link lands on: Saved stays Saved, the rest are the articles. */
export const feedTabForJournal = (raw: unknown): Exclude<FeedTab, "following"> => (raw === "saved" ? "saved" : "articles");

export const JOURNAL_MARK_KINDS = ["stamp", "save"] as const;
export type JournalMarkKind = (typeof JOURNAL_MARK_KINDS)[number];

/** POST /api/journal/marks `{ slug, kind, on }`: a Stamp or a Save on an article, given or taken back. */
export function parseJournalMark(body: unknown): { slug: string; kind: JournalMarkKind; on: boolean } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (!isJournalSlug(b.slug) || !(JOURNAL_MARK_KINDS as readonly unknown[]).includes(b.kind) || typeof b.on !== "boolean") return null;
  return { slug: b.slug, kind: b.kind as JournalMarkKind, on: b.on };
}

/** Why For you put an article high: a title it shows that's in the reader's collection. */
export type ForYouReason = { status: EntryStatus; kind: TitleKind; name: string };

/** What a row of the Journal (or an article in the Following feed) shows. */
export type FeedArticle = {
  slug: string;
  /** The language of the version shown: the reader's, or English when it isn't written in theirs. */
  locale: string;
  title: string;
  description: string;
  /** `YYYY-MM-DD`. */
  date: string;
  minutes: number;
  author: string | null;
  avatar: string | null;
  profile: string | null;
  /** The cover, else the poster of the first title it shows. */
  image: string | null;
  featured: boolean;
  draft: boolean;
  stamps: number;
  stamped: boolean;
  saved: boolean;
  reason: ForYouReason | null;
};

/** A title an article shows as a card, with its genres from the catalog cache (none when it isn't cached). */
export type ArticleTitle = { kind: TitleKind; externalId: string; genres: readonly string[] };

/** What For you weighs about an article. */
export type RankableArticle = { slug: string; date: string; featured: boolean; titles: readonly ArticleTitle[] };

/** What the reader's collection says, for For you. */
export type CollectionSignals = {
  /** The reader's entries of the titles the articles show, by `kind:externalId`. */
  entries: ReadonlyMap<string, { status: EntryStatus; name: string }>;
  /** Each kind's share of the reader's recent entries (0–1). */
  kinds: ReadonlyMap<string, number>;
  /** Genres (lower case) among the reader's recent entries, the most common one at 1. */
  genres: ReadonlyMap<string, number>;
};

export const titleKey = (kind: string, externalId: string) => `${kind}:${externalId}`;

/**
 * The signals For you weighs, from the reader's entries of the articles' titles (`matches`) and their latest
 * entries (`recent`). Want counts half towards a taste: it's a wish, not a finish.
 */
export function collectionSignals(
  matches: readonly { status: EntryStatus; kind: string; externalId: string; name: string }[],
  recent: readonly { status: EntryStatus; kind: string; genres: readonly string[] }[],
): CollectionSignals {
  const entries = new Map(matches.map((m) => [titleKey(m.kind, m.externalId), { status: m.status, name: m.name }]));
  const kindCounts = new Map<string, number>();
  const genreWeights = new Map<string, number>();
  for (const r of recent) {
    kindCounts.set(r.kind, (kindCounts.get(r.kind) ?? 0) + 1);
    const weight = r.status === "want" ? 0.5 : 1;
    for (const g of new Set(r.genres.map((g) => g.trim().toLowerCase()).filter(Boolean))) genreWeights.set(g, (genreWeights.get(g) ?? 0) + weight);
  }
  const top = Math.max(0, ...genreWeights.values());
  return {
    entries,
    kinds: new Map([...kindCounts].map(([k, n]) => [k, n / recent.length])),
    genres: new Map([...genreWeights].map(([g, w]) => [g, top > 0 ? w / top : 0])),
  };
}

/** Whether the reader's collection gives For you anything to go on (else For you is newest first). */
export const hasSignals = (s: CollectionSignals) => s.entries.size > 0 || s.kinds.size > 0;

/** A title of the article in the reader's collection: on their list (want) counts most, then in progress, then finished. */
const STATUS_POINTS: Record<EntryStatus, number> = { want: 3, watching: 2.5, finished: 1.5 };
const DIRECT_MAX = 6;
const GENRE_WEIGHT = 2;
const KIND_WEIGHT = 1.5;
/** New articles start at 2 and halve every three weeks. */
const FRESH_START = 2;
const FRESH_HALF_LIFE_DAYS = 21;
const FEATURED_BONUS = 0.5;
const DAY_MS = 86_400_000;

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/**
 * For you: the articles in the order that suits the reader, with the reason when a title they show is in the
 * reader's collection. Titles in it count most (on their list, then in progress, then finished), then how well the
 * titles' genres and kinds match what they collect lately, then how new the article is; featured ones get a nudge.
 * With an empty collection it's newest first. `today` is `YYYY-MM-DD`.
 */
export function rankForYou(
  articles: readonly RankableArticle[],
  signals: CollectionSignals,
  today: string,
): { slug: string; score: number; reason: ForYouReason | null }[] {
  const now = Date.parse(`${today}T00:00:00Z`);
  return articles
    .map((a) => {
      let direct = 0;
      let reason: ForYouReason | null = null;
      for (const t of a.titles) {
        const mine = signals.entries.get(titleKey(t.kind, t.externalId));
        if (!mine) continue;
        direct += STATUS_POINTS[mine.status];
        if (!reason || STATUS_POINTS[mine.status] > STATUS_POINTS[reason.status]) reason = { status: mine.status, kind: t.kind, name: mine.name };
      }
      const genre = mean(a.titles.map((t) => Math.max(0, ...t.genres.map((g) => signals.genres.get(g.trim().toLowerCase()) ?? 0))));
      const kind = mean(a.titles.map((t) => signals.kinds.get(t.kind) ?? 0));
      const ageDays = Math.max(0, (now - Date.parse(`${a.date}T00:00:00Z`)) / DAY_MS);
      const fresh = FRESH_START * 0.5 ** (ageDays / FRESH_HALF_LIFE_DAYS);
      const score = Math.min(direct, DIRECT_MAX) + GENRE_WEIGHT * genre + KIND_WEIGHT * kind + fresh + (a.featured ? FEATURED_BONUS : 0);
      return { slug: a.slug, date: a.date, score, reason };
    })
    .sort((x, y) => y.score - x.score || y.date.localeCompare(x.date) || x.slug.localeCompare(y.slug))
    .map(({ slug, score, reason }) => ({ slug, score, reason }));
}

/** How many of the newest articles the Following feed takes in, and how many may follow its last finish. */
export const FEED_ARTICLES = 6;
export const FEED_TRAILING = 3;

/** An article's place in time in the Following feed: the end of its day (UTC), so a new one tops that day's finishes. */
export const articleFeedTime = (date: string) => Date.parse(`${date}T23:59:59.999Z`);

export type FeedSlot<I, A> = { type: "entry"; item: I } | { type: "article"; article: A };

/**
 * The Following feed with Journal articles in it, like posts from an account everyone follows: each article sits
 * by its date among the finishes (newest first), but only among the pages loaded so far. Once the feed has no more
 * pages (`complete`), up to `trailing` older articles follow its last finish, so a new account's empty feed still
 * shows the newest ones.
 */
export function interleaveArticles<I extends { finishedAt: string }, A extends { date: string }>(
  items: readonly I[],
  articles: readonly A[],
  complete: boolean,
  trailing = FEED_TRAILING,
): FeedSlot<I, A>[] {
  const queue = [...articles].sort((a, b) => articleFeedTime(b.date) - articleFeedTime(a.date));
  const out: FeedSlot<I, A>[] = [];
  let next = 0;
  for (const item of items) {
    const at = Date.parse(item.finishedAt);
    while (next < queue.length && articleFeedTime(queue[next]!.date) >= at) out.push({ type: "article", article: queue[next++]! });
    out.push({ type: "entry", item });
  }
  if (complete) {
    for (let n = 0; n < trailing && next < queue.length; n++) out.push({ type: "article", article: queue[next++]! });
  }
  return out;
}
