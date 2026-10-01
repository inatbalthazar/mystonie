import { describe, expect, it } from "vitest";
import { feedNewsOnFeed, feedNewsOnHome, hasFeedNews, parseFeedNews } from "./feed-news";

const T0 = "2026-10-01T08:00:00.000Z";
const T1 = "2026-10-01T09:00:00.000Z";
const T2 = "2026-10-01T10:00:00.000Z";

describe("the Feed tab's dot", () => {
  it("starts clean on a new device: old activity isn't news", () => {
    const news = feedNewsOnHome(null, "a", T0, T1);
    expect(news).toEqual({ user: "a", latest: T0, seen: T1 });
    expect(hasFeedNews(news)).toBe(false);
  });

  it("shows a Stamp or follower that came after the feed was last opened, until it's opened again", () => {
    const first = feedNewsOnHome(null, "a", null, T0);
    expect(hasFeedNews(first)).toBe(false);
    const stamped = feedNewsOnHome(first, "a", T1, T2);
    expect(hasFeedNews(stamped)).toBe(true);
    const opened = feedNewsOnFeed(stamped, "a", T2);
    expect(opened).toEqual({ user: "a", latest: T1, seen: T2 });
    expect(hasFeedNews(opened)).toBe(false);
    expect(hasFeedNews(feedNewsOnHome(opened, "a", T1, T2))).toBe(false);
  });

  it("forgets the last account's news when another signs in on the device", () => {
    const a = feedNewsOnHome(feedNewsOnHome(null, "a", null, T0), "a", T1, T1);
    expect(hasFeedNews(a)).toBe(true);
    expect(hasFeedNews(feedNewsOnHome(a, "b", T0, T2))).toBe(false);
    expect(feedNewsOnFeed(a, "b", T2)).toEqual({ user: "b", latest: null, seen: T2 });
  });

  it("reads back only what it wrote", () => {
    const news = { user: "a", latest: T1, seen: T0 };
    expect(parseFeedNews(JSON.stringify(news))).toEqual(news);
    expect(parseFeedNews(JSON.stringify({ ...news, latest: null }))).toEqual({ ...news, latest: null });
    expect(parseFeedNews(null)).toBeNull();
    expect(parseFeedNews("{")).toBeNull();
    expect(parseFeedNews(JSON.stringify({ user: "a", latest: "soon", seen: T0 }))).toBeNull();
    expect(parseFeedNews(JSON.stringify({ latest: T1, seen: T0 }))).toBeNull();
  });
});
