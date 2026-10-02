import { describe, expect, it } from "vitest";
import {
  articleKey,
  feedDots,
  needsCheck,
  parseFeedNews,
  reelDone,
  seenArticles,
  seenFollowing,
  withFacts,
  type FeedFacts,
} from "./feed-news";

const T0 = "2026-10-01T08:00:00.000Z";
const T1 = "2026-10-01T09:00:00.000Z";
const T2 = "2026-10-01T10:00:00.000Z";
const TODAY = "2026-10-01";
const OLD = articleKey("2026-09-20", "old");
const NEW = articleKey("2026-10-01", "new");

const facts = (over: Partial<FeedFacts> = {}): FeedFacts => ({
  user: "a",
  now: T1,
  aboutYou: null,
  friends: null,
  article: OLD,
  reel: { day: TODAY, done: true },
  ...over,
});

describe("the feed's dots", () => {
  it("lights nothing before the first answer", () => {
    expect(feedDots(null, TODAY)).toEqual({ following: false, articles: false, reel: false });
    expect(feedDots(seenFollowing(null, "a", T0), TODAY)).toEqual({ following: false, articles: false, reel: false });
  });

  it("starts clean on a new device: old activity and old articles aren't news", () => {
    const news = withFacts(null, facts({ aboutYou: T0, friends: T0 }), 1);
    expect(feedDots(news, TODAY)).toEqual({ following: false, articles: false, reel: false });
  });

  it("shows a finish by someone you follow, or a Stamp or follower, until the Following tab is opened", () => {
    const first = withFacts(null, facts({ now: T0 }), 1);
    const friend = withFacts(first, facts({ friends: T1, now: T2 }), 2);
    expect(feedDots(friend, TODAY).following).toBe(true);
    const stamped = withFacts(first, facts({ aboutYou: T1, now: T2 }), 2);
    expect(feedDots(stamped, TODAY).following).toBe(true);
    const opened = seenFollowing(friend, "a", T2);
    expect(feedDots(opened, TODAY).following).toBe(false);
    expect(feedDots(withFacts(opened, facts({ friends: T1, now: T2 }), 3), TODAY).following).toBe(false);
  });

  it("shows a new article until the Articles tab is opened", () => {
    const first = withFacts(null, facts(), 1);
    const published = withFacts(first, facts({ article: NEW }), 2);
    expect(feedDots(published, TODAY).articles).toBe(true);
    const read = seenArticles(published, "a", T2, NEW);
    expect(feedDots(read, TODAY).articles).toBe(false);
    // An older article coming back to the top (the newest was unpublished) isn't news.
    expect(feedDots(withFacts(read, facts({ article: OLD }), 3), TODAY).articles).toBe(false);
  });

  it("doesn't count the backlog when a tab was opened before the first answer", () => {
    const opened = seenFollowing(null, "a", T0);
    expect(feedDots(withFacts(opened, facts({ article: NEW, friends: T1 }), 1), TODAY)).toEqual({ following: true, articles: false, reel: false });
  });

  it("shows today's reel until it's finished, here or anywhere", () => {
    const unplayed = withFacts(null, facts({ reel: { day: TODAY, done: false } }), 1);
    expect(feedDots(unplayed, TODAY).reel).toBe(true);
    expect(feedDots(reelDone(unplayed, TODAY), TODAY).reel).toBe(false);
    expect(feedDots(withFacts(unplayed, facts(), 2), TODAY).reel).toBe(false);
    // Midnight UTC: yesterday's finished reel doesn't cover today's.
    expect(feedDots(withFacts(unplayed, facts(), 2), "2026-10-02").reel).toBe(true);
    expect(reelDone(null, TODAY)).toBeNull();
  });

  it("forgets the last account's news when another signs in on the device", () => {
    const a = withFacts(withFacts(null, facts({ now: T0 }), 1), facts({ friends: T1, now: T2 }), 2);
    expect(feedDots(a, TODAY).following).toBe(true);
    expect(feedDots(withFacts(a, facts({ user: "b", friends: T1, now: T2 }), 3), TODAY).following).toBe(false);
    expect(seenFollowing(a, "b", T2)).toMatchObject({ user: "b", facts: null });
  });

  it("asks again once an answer is a minute old", () => {
    const news = withFacts(null, facts(), 1_000);
    expect(needsCheck(null, 1_000)).toBe(true);
    expect(needsCheck(seenFollowing(null, "a", T0), 1_000)).toBe(true);
    expect(needsCheck(news, 30_000)).toBe(false);
    expect(needsCheck(news, 61_000)).toBe(true);
    expect(needsCheck(news, 0)).toBe(true); // the clock went back
  });

  it("reads back only what it wrote", () => {
    const news = reelDone(seenArticles(withFacts(null, facts({ friends: T0 }), 5), "a", T2, NEW), TODAY);
    expect(parseFeedNews(JSON.stringify(news))).toEqual(news);
    const empty = seenFollowing(null, "a", T0);
    expect(parseFeedNews(JSON.stringify(empty))).toEqual(empty);
    expect(parseFeedNews(null)).toBeNull();
    expect(parseFeedNews("{")).toBeNull();
    // ADR 0054's older shape.
    expect(parseFeedNews(JSON.stringify({ user: "a", latest: T1, seen: T0 }))).toBeNull();
    expect(parseFeedNews(JSON.stringify({ ...news, seenFollowing: "soon" }))).toBeNull();
    expect(parseFeedNews(JSON.stringify({ ...news, facts: { ...news!.facts, reel: null } }))).toBeNull();
  });
});
