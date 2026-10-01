// The dot on the nav island's Feed tab (ADR 0054): something about you happened (a Stamp on your finish, a new
// follower) since you last opened the feed. Home and the feed render on the server and know the times; this device
// remembers them, so the island (in every page, static) can show the dot without asking the server.

/** What a device remembers, for one account at a time. Times are ISO strings from the server. */
export type FeedNews = {
  user: string;
  /** The newest Stamp or follow about you, as Home last saw it. */
  latest: string | null;
  /** When you last opened the feed (or when this device first saw the account, so old news isn't new). */
  seen: string;
};

/** Home's render: the newest activity about `user` at `now`. A new device or account starts with nothing new. */
export function feedNewsOnHome(stored: FeedNews | null, user: string, latest: string | null, now: string): FeedNews {
  if (!stored || stored.user !== user) return { user, latest, seen: now };
  return { ...stored, latest };
}

/** The feed's render at `now`: everything up to now is seen. */
export function feedNewsOnFeed(stored: FeedNews | null, user: string, now: string): FeedNews {
  return { user, latest: stored?.user === user ? stored.latest : null, seen: now };
}

/** Whether the Feed tab shows its dot. */
export function hasFeedNews(news: FeedNews | null): boolean {
  if (!news?.latest) return false;
  return Date.parse(news.latest) > Date.parse(news.seen);
}

const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** What a device stored (JSON), or null when it's missing or malformed. */
export function parseFeedNews(raw: string | null): FeedNews | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.user !== "string" || !isTime(v.seen) || (v.latest !== null && !isTime(v.latest))) return null;
    return { user: v.user, latest: v.latest, seen: v.seen };
  } catch {
    return null;
  }
}
