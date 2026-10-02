// The dots on the nav island's Feed tab and inside the feed (ADR 0054, ADR 0074). A dot says something waits for you:
// - **Following:** a Stamp on your finish or a new follower ("Lately"), or a finish by someone you follow, since you
//   last opened the Following tab;
// - **Articles:** a Journal article newer than the newest you saw on the Articles tab;
// - **Reel:** today's Reel of the Day isn't finished yet.
// The server says what's newest (`GET /api/feed/news`); this device remembers what you've seen, so the island (in
// every page, static) shows the dots without a server render.

/** What `GET /api/feed/news` answers. Times are ISO strings from the server. */
export type FeedFacts = {
  user: string;
  /** The server's clock when it answered. */
  now: string;
  /** The newest Stamp on your finishes or follow of you. */
  aboutYou: string | null;
  /** The newest finish by someone you follow. */
  friends: string | null;
  /** The newest article, as `articleKey`. */
  article: string | null;
  /** Today's Reel of the Day (`reelDay`) and whether you finished it. */
  reel: { day: string; done: boolean };
};

/** What a device remembers, for one account at a time. */
export type FeedNews = {
  user: string;
  /** The last answer (null until the first one). */
  facts: Omit<FeedFacts, "user" | "now"> | null;
  /** When this device last asked (its own clock, ms), so it doesn't ask on every page. */
  checkedAt: number;
  /** When the Following tab was last opened (server time; or when this device first saw the account). */
  seenFollowing: string;
  /** The newest article when the Articles tab was last opened (or when this device first saw the account). */
  seenArticle: string | null;
  /** A reel day finished on this device since the last answer. */
  reelDoneOn: string | null;
};

export type FeedDots = { following: boolean; articles: boolean; reel: boolean };

/** How long an answer is fresh enough not to ask again on the next page. */
export const FEED_NEWS_FRESH_MS = 60_000;

/** An article's place in the newest-first order, comparable across answers. */
export const articleKey = (date: string, slug: string) => `${date}/${slug}`;

const keyDate = (key: string) => key.slice(0, 10);

/**
 * A new answer at `checkedAt`. A device or account seen for the first time starts with nothing new, so old activity
 * and old articles don't light a dot; today's reel still does. Another account on the device starts over.
 */
export function withFacts(stored: FeedNews | null, facts: FeedFacts, checkedAt: number): FeedNews {
  const { user, now, ...rest } = facts;
  if (!stored || stored.user !== user) return { user, facts: rest, checkedAt, seenFollowing: now, seenArticle: rest.article, reelDoneOn: null };
  // A tab opened before the first answer marked what it saw; the articles' backlog isn't news either.
  return { ...stored, facts: rest, checkedAt, seenArticle: stored.facts ? stored.seenArticle : (stored.seenArticle ?? rest.article) };
}

/** A device that has no answer for `user` yet: everything up to `now` is seen. */
const fresh = (user: string, now: string): FeedNews => ({ user, facts: null, checkedAt: 0, seenFollowing: now, seenArticle: null, reelDoneOn: null });

/** The Following tab rendered at the server's `now`: everything up to then is seen. */
export function seenFollowing(stored: FeedNews | null, user: string, now: string): FeedNews {
  return stored?.user === user ? { ...stored, seenFollowing: now } : fresh(user, now);
}

/** The Articles tab rendered with `article` (`articleKey`) as the newest: it and older are seen. */
export function seenArticles(stored: FeedNews | null, user: string, now: string, article: string | null): FeedNews {
  return { ...(stored?.user === user ? stored : fresh(user, now)), seenArticle: article };
}

/** Today's reel (`day`) finished on this device: its dot goes before the next answer says so. */
export function reelDone(stored: FeedNews | null, day: string): FeedNews | null {
  return stored && { ...stored, reelDoneOn: day };
}

/** Whether to ask the server again at `nowMs` (device clock). */
export function needsCheck(stored: FeedNews | null, nowMs: number): boolean {
  return !stored?.facts || nowMs - stored.checkedAt >= FEED_NEWS_FRESH_MS || nowMs < stored.checkedAt;
}

/** Which dots show on `today` (`reelDay`). Nothing lights before the first answer. */
export function feedDots(news: FeedNews | null, today: string): FeedDots {
  const f = news?.facts;
  if (!news || !f) return { following: false, articles: false, reel: false };
  const seen = Date.parse(news.seenFollowing);
  const following = [f.aboutYou, f.friends].some((at) => at !== null && Date.parse(at) > seen);
  const articles =
    f.article !== null && f.article !== news.seenArticle && (news.seenArticle === null || keyDate(f.article) >= keyDate(news.seenArticle));
  const reel = news.reelDoneOn !== today && !(f.reel.day === today && f.reel.done);
  return { following, articles, reel };
}

const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isTimeOrNull = (v: unknown) => v === null || isTime(v);
const isStringOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";

function parseFacts(v: unknown): FeedNews["facts"] | undefined {
  if (v === null) return null;
  if (typeof v !== "object") return undefined;
  const f = v as Record<string, unknown>;
  const reel = f.reel as Record<string, unknown> | null | undefined;
  if (!isTimeOrNull(f.aboutYou) || !isTimeOrNull(f.friends) || !isStringOrNull(f.article)) return undefined;
  if (typeof reel !== "object" || reel === null || typeof reel.day !== "string" || typeof reel.done !== "boolean") return undefined;
  return {
    aboutYou: f.aboutYou as string | null,
    friends: f.friends as string | null,
    article: f.article,
    reel: { day: reel.day, done: reel.done },
  };
}

/** What a device stored (JSON), or null when it's missing, malformed or from an older version. */
export function parseFeedNews(raw: string | null): FeedNews | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const facts = parseFacts(v.facts);
    if (typeof v.user !== "string" || facts === undefined || typeof v.checkedAt !== "number" || !isTime(v.seenFollowing)) return null;
    if (!isStringOrNull(v.seenArticle) || !isStringOrNull(v.reelDoneOn)) return null;
    return { user: v.user, facts, checkedAt: v.checkedAt, seenFollowing: v.seenFollowing, seenArticle: v.seenArticle, reelDoneOn: v.reelDoneOn };
  } catch {
    return null;
  }
}
