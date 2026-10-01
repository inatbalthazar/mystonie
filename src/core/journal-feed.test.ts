import { describe, expect, it } from "vitest";
import {
  articleFeedTime,
  collectionSignals,
  hasSignals,
  feedTabForJournal,
  feedTabs,
  interleaveArticles,
  parseJournalMark,
  pickFeedTab,
  rankForYou,
  type RankableArticle,
} from "./journal-feed";

describe("feedTabs", () => {
  it("gives visitors the articles only", () => {
    expect(feedTabs({ signedIn: false, saved: 0 })).toEqual(["articles"]);
    expect(feedTabs({ signedIn: false, saved: 3 })).toEqual(["articles"]);
  });

  it("starts with Following when signed in, and adds Saved once something is saved", () => {
    expect(feedTabs({ signedIn: true, saved: 0 })).toEqual(["following", "articles"]);
    expect(feedTabs({ signedIn: true, saved: 1 })).toEqual(["following", "articles", "saved"]);
  });

  it("picks the asked tab when it's there, else the first", () => {
    const tabs = feedTabs({ signedIn: true, saved: 0 });
    expect(pickFeedTab("articles", tabs)).toBe("articles");
    expect(pickFeedTab(undefined, tabs)).toBe("following");
    expect(pickFeedTab("saved", tabs)).toBe("following");
    expect(pickFeedTab(["articles"], tabs)).toBe("following");
    expect(pickFeedTab("following", ["articles"])).toBe("articles");
  });

  it("sends the Journal's old tabs to the articles, and Saved to Saved", () => {
    expect(feedTabForJournal("saved")).toBe("saved");
    for (const tab of ["for-you", "latest", "featured", undefined, ["saved"]]) expect(feedTabForJournal(tab)).toBe("articles");
  });
});

describe("parseJournalMark", () => {
  it("takes a slug, a kind and on", () => {
    expect(parseJournalMark({ slug: "ten-shows", kind: "stamp", on: true })).toEqual({ slug: "ten-shows", kind: "stamp", on: true });
    expect(parseJournalMark({ slug: "ten-shows", kind: "save", on: false })).toEqual({ slug: "ten-shows", kind: "save", on: false });
  });

  it("refuses anything else", () => {
    expect(parseJournalMark(null)).toBeNull();
    expect(parseJournalMark([])).toBeNull();
    expect(parseJournalMark({ slug: "Ten Shows", kind: "stamp", on: true })).toBeNull();
    expect(parseJournalMark({ slug: "ten-shows", kind: "like", on: true })).toBeNull();
    expect(parseJournalMark({ slug: "ten-shows", kind: "save", on: "yes" })).toBeNull();
  });
});

describe("collectionSignals", () => {
  it("keys the matches and weighs kinds and genres of recent entries", () => {
    const s = collectionSignals(
      [{ status: "want", kind: "movie", externalId: "603", name: "The Matrix" }],
      [
        { status: "finished", kind: "movie", genres: ["Action", "Science Fiction"] },
        { status: "watching", kind: "series", genres: ["Drama", " action "] },
        { status: "want", kind: "movie", genres: ["Drama"] },
        { status: "finished", kind: "movie", genres: [] },
      ],
    );
    expect(s.entries.get("movie:603")).toEqual({ status: "want", name: "The Matrix" });
    expect(s.kinds.get("movie")).toBe(0.75);
    expect(s.kinds.get("series")).toBe(0.25);
    // action 2, drama 1.5 (want counts half), science fiction 1.
    expect(s.genres.get("action")).toBe(1);
    expect(s.genres.get("drama")).toBe(0.75);
    expect(s.genres.get("science fiction")).toBe(0.5);
    expect(hasSignals(s)).toBe(true);
  });

  it("is empty for an empty collection", () => {
    const s = collectionSignals([], []);
    expect(hasSignals(s)).toBe(false);
    expect(s.genres.size).toBe(0);
  });
});

describe("rankForYou", () => {
  const today = "2026-10-01";
  const article = (slug: string, date: string, titles: RankableArticle["titles"] = [], featured = false): RankableArticle => ({
    slug,
    date,
    featured,
    titles,
  });
  const empty = collectionSignals([], []);

  it("is newest first for an empty collection, with a nudge for featured ones", () => {
    const list = [article("old", "2026-08-01"), article("new", "2026-09-30"), article("mid", "2026-09-10")];
    expect(rankForYou(list, empty, today).map((r) => r.slug)).toEqual(["new", "mid", "old"]);
    const featured = [article("new", "2026-09-30"), article("pick", "2026-09-29", [], true)];
    expect(rankForYou(featured, empty, today).map((r) => r.slug)).toEqual(["pick", "new"]);
    expect(rankForYou(featured, empty, today).every((r) => r.reason === null)).toBe(true);
  });

  it("puts articles about the reader's titles first, with the strongest one as the reason", () => {
    const signals = collectionSignals(
      [
        { status: "finished", kind: "movie", externalId: "603", name: "The Matrix" },
        { status: "want", kind: "series", externalId: "1396", name: "Breaking Bad" },
      ],
      [],
    );
    const ranked = rankForYou(
      [
        article("new-other", "2026-10-01", [{ kind: "movie", externalId: "1", genres: [] }]),
        article("matrix-and-bb", "2026-07-01", [
          { kind: "movie", externalId: "603", genres: [] },
          { kind: "series", externalId: "1396", genres: [] },
        ]),
        article("matrix", "2026-09-01", [{ kind: "movie", externalId: "603", genres: [] }]),
      ],
      signals,
      today,
    );
    expect(ranked.map((r) => r.slug)).toEqual(["matrix-and-bb", "matrix", "new-other"]);
    expect(ranked[0]!.reason).toEqual({ status: "want", kind: "series", name: "Breaking Bad" });
    expect(ranked[1]!.reason).toEqual({ status: "finished", kind: "movie", name: "The Matrix" });
    expect(ranked[2]!.reason).toBeNull();
  });

  it("prefers the reader's kinds and genres when no title matches", () => {
    const signals = collectionSignals(
      [],
      [
        { status: "finished", kind: "book", genres: ["Fantasy"] },
        { status: "finished", kind: "book", genres: ["Fantasy", "Romance"] },
      ],
    );
    const ranked = rankForYou(
      [
        article("games", "2026-09-30", [{ kind: "game", externalId: "3498", genres: ["Action"] }]),
        article("books", "2026-09-20", [{ kind: "book", externalId: "abc", genres: ["fantasy"] }]),
        article("essay", "2026-09-29"),
      ],
      signals,
      today,
    );
    expect(ranked.map((r) => r.slug)).toEqual(["books", "games", "essay"]);
  });
});

describe("interleaveArticles", () => {
  const entry = (id: string, finishedAt: string) => ({ id, finishedAt });
  const art = (slug: string, date: string) => ({ slug, date });
  const ids = (slots: ReturnType<typeof interleaveArticles<{ id: string; finishedAt: string }, { slug: string; date: string }>>) =>
    slots.map((s) => (s.type === "entry" ? s.item.id : `@${s.article.slug}`));

  it("places an article at the end of its day, above that day's finishes", () => {
    expect(articleFeedTime("2026-10-01")).toBe(Date.parse("2026-10-01T23:59:59.999Z"));
    const items = [entry("a", "2026-10-02T08:00:00Z"), entry("b", "2026-10-01T20:00:00Z"), entry("c", "2026-09-20T10:00:00Z")];
    expect(ids(interleaveArticles(items, [art("new", "2026-10-01"), art("older", "2026-09-25")], true))).toEqual(["a", "@new", "b", "@older", "c"]);
  });

  it("keeps older articles back until their page is loaded, then adds a few after the last finish", () => {
    const items = [entry("a", "2026-10-01T08:00:00Z")];
    const articles = [art("x", "2026-09-01"), art("y", "2026-08-01"), art("z", "2026-07-01"), art("w", "2026-06-01")];
    expect(ids(interleaveArticles(items, articles, false))).toEqual(["a"]);
    expect(ids(interleaveArticles(items, articles, true))).toEqual(["a", "@x", "@y", "@z"]);
    expect(ids(interleaveArticles(items, articles, true, 1))).toEqual(["a", "@x"]);
  });

  it("shows the newest articles in an empty feed", () => {
    expect(ids(interleaveArticles([], [art("old", "2026-01-01"), art("new", "2026-09-01")], true))).toEqual(["@new", "@old"]);
  });
});
