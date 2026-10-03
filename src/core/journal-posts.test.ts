import { describe, expect, it } from "vitest";
import { uuidv7 } from "./ids";
import { parseWriterBody } from "./journal";
import { articlePath } from "./journal-feed";
import {
  adminEmails,
  excerptOf,
  filterArticles,
  filtersQuery,
  isAdminEmail,
  parseJournalFilters,
  parsePostWrite,
  parseReview,
  parseSubject,
  postState,
  sortArticles,
  subjectKey,
  subjectKinds,
} from "./journal-posts";

const LOCALES = ["en", "th"];
const LONG = "Past Lives is a quiet film about the people we might have been. It made me call an old friend the next day.";
const write = (extra: Record<string, unknown> = {}) => ({
  id: uuidv7(),
  locale: "en",
  title: "  Why  Past Lives stayed with me ",
  description: "",
  body: LONG,
  tags: ["review"],
  subjects: ["movie:666277", "place:KR"],
  spoilers: false,
  publish: true,
  feature: true,
  ...extra,
});

describe("parseWriterBody", () => {
  it("keeps the Markdown subset but turns links, images and title cards into text", () => {
    const blocks = parseWriterBody("## Why\n\n**Go** see [it](https://spam.example)\n\n![x](https://img.example/a.jpg)\n\n@[movie:603](The Matrix)");
    expect(blocks[0]).toMatchObject({ type: "heading" });
    expect(blocks[1]).toEqual({
      type: "paragraph",
      children: [
        { type: "strong", children: [{ type: "text", text: "Go" }] },
        { type: "text", text: " see [it](https://spam.example)" },
      ],
    });
    expect(blocks.slice(2).map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
  });
});

describe("subjects", () => {
  it("reads titles of every catalog and countries, and nothing else", () => {
    expect(parseSubject("movie:603")).toEqual({ kind: "movie", externalId: "603" });
    expect(parseSubject("book:zyTCAlFPjgYC")).toEqual({ kind: "book", externalId: "zyTCAlFPjgYC" });
    expect(parseSubject("place:JP")).toEqual({ kind: "place", country: "JP" });
    for (const bad of ["movie:abc", "place:XX", "place:jp", "song:1", "603", 603]) expect(parseSubject(bad)).toBeNull();
    expect(subjectKey({ kind: "place", country: "JP" })).toBe("place:JP");
    expect(subjectKinds([{ kind: "place" }, { kind: "book" }, { kind: "movie" }, { kind: "movie" }])).toEqual(["movie", "book", "place"]);
  });
});

describe("parsePostWrite", () => {
  it("cleans up a published article and keeps its subjects once each", () => {
    const parsed = parsePostWrite(write({ subjects: ["movie:666277", "movie:666277", "place:KR"] }), LOCALES);
    expect(parsed).toMatchObject({
      ok: true,
      post: { title: "Why Past Lives stayed with me", description: null, tags: ["review"], publish: true, feature: true },
    });
    if (parsed.ok) expect(parsed.post.subjects).toHaveLength(2);
  });

  it("lets a draft be just a title", () => {
    expect(parsePostWrite(write({ body: "", tags: [], subjects: [], publish: false, feature: true }), LOCALES)).toMatchObject({
      ok: true,
      post: { publish: false, feature: false },
    });
  });

  it("asks a published article for a category, enough text and few web addresses", () => {
    expect(parsePostWrite(write({ tags: [] }), LOCALES)).toEqual({ ok: false, problem: "tags" });
    expect(parsePostWrite(write({ body: "Loved it." }), LOCALES)).toEqual({ ok: false, problem: "short" });
    expect(parsePostWrite(write({ body: `${LONG} http://a.example http://b.example www.c.example https://d.example` }), LOCALES)).toEqual({
      ok: false,
      problem: "links",
    });
  });

  it("refuses what doesn't fit", () => {
    expect(parsePostWrite(write({ title: " " }), LOCALES)).toEqual({ ok: false, problem: "title" });
    expect(parsePostWrite(write({ title: "x".repeat(121) }), LOCALES)).toEqual({ ok: false, problem: "title" });
    expect(parsePostWrite(write({ description: "x".repeat(201) }), LOCALES)).toEqual({ ok: false, problem: "description" });
    expect(parsePostWrite(write({ body: "x".repeat(20_001) }), LOCALES)).toEqual({ ok: false, problem: "body" });
    expect(parsePostWrite(write({ tags: ["review", "gossip"] }), LOCALES)).toEqual({ ok: false, problem: "tags" });
    expect(parsePostWrite(write({ tags: ["review", "list", "guide", "travel"] }), LOCALES)).toEqual({ ok: false, problem: "tags" });
    expect(parsePostWrite(write({ subjects: ["movie:1", "movie:2", "movie:3", "movie:4", "movie:5", "movie:6", "movie:7"] }), LOCALES)).toEqual({
      ok: false,
      problem: "subjects",
    });
    expect(parsePostWrite(write({ subjects: ["place:XX"] }), LOCALES)).toEqual({ ok: false, problem: "subjects" });
    expect(parsePostWrite(write({ locale: "fr" }), LOCALES)).toEqual({ ok: false, problem: "locale" });
    expect(parsePostWrite(write({ id: "not-a-uuid" }), LOCALES)).toEqual({ ok: false, problem: "invalid" });
    expect(parsePostWrite(null, LOCALES)).toEqual({ ok: false, problem: "invalid" });
  });
});

describe("excerptOf", () => {
  it("takes the opening text without markup, cut at a space", () => {
    expect(excerptOf("## Hi\n\n**Bold** words.")).toBe("Hi Bold words.");
    expect(excerptOf("")).toBeNull();
    const cut = excerptOf("word ".repeat(80))!;
    expect([...cut].length).toBeLessThanOrEqual(160);
    expect(cut.endsWith("word…")).toBe(true);
  });
});

describe("postState", () => {
  it("says where an article stands", () => {
    const p = { publishedAt: "2026-10-03T10:00:00Z", hiddenAt: null, featureRequest: null };
    expect(postState({ ...p, publishedAt: null })).toBe("draft");
    expect(postState(p)).toBe("published");
    expect(postState({ ...p, featureRequest: "pending" })).toBe("pending");
    expect(postState({ ...p, featureRequest: "approved" })).toBe("featured");
    expect(postState({ ...p, featureRequest: "declined" })).toBe("declined");
    expect(postState({ ...p, featureRequest: "approved", hiddenAt: "2026-10-04T00:00:00Z" })).toBe("hidden");
  });
});

describe("the team's review", () => {
  it("reads an action with an optional note", () => {
    const id = uuidv7();
    expect(parseReview({ id, action: "approve" })).toEqual({ id, action: "approve", note: null });
    expect(parseReview({ id, action: "decline", note: " Needs more about the film. " })).toEqual({ id, action: "decline", note: "Needs more about the film." });
    expect(parseReview({ id, action: "delete" })).toBeNull();
    expect(parseReview({ id, action: "hide", note: "x".repeat(301) })).toBeNull();
  });

  it("knows the team by its addresses", () => {
    expect([...adminEmails(" Team@Mystonie.com, nope, b@x.io ,")]).toEqual(["team@mystonie.com", "b@x.io"]);
    expect(isAdminEmail("team@mystonie.com", "TEAM@mystonie.com")).toBe(true);
    expect(isAdminEmail(undefined, "team@mystonie.com")).toBe(false);
    expect(isAdminEmail("team@mystonie.com", undefined)).toBe(false);
  });
});

describe("the Journal's filters and sort", () => {
  it("reads the query, For you only signed in", () => {
    expect(parseJournalFilters({ tag: "review", kind: "place", sort: "top" }, true)).toEqual({ tag: "review", kind: "place", sort: "top" });
    expect(parseJournalFilters({ tag: "nope", kind: "song" }, true)).toEqual({ tag: null, kind: null, sort: "for_you" });
    expect(parseJournalFilters({ sort: "for_you" }, false)).toEqual({ tag: null, kind: null, sort: "new" });
    expect(filtersQuery({ tag: "list", kind: null, sort: "for_you" }, true)).toEqual({ tag: "list" });
    expect(filtersQuery({ tag: null, kind: "game", sort: "new" }, true)).toEqual({ kind: "game", sort: "new" });
  });

  const a = (slug: string, date: string, stamps: number, tags: string[], kinds: string[], publishedAt: string | null = null) => ({ slug, date, stamps, tags, kinds, publishedAt });
  const list = [
    a("team-old", "2026-09-01", 9, ["guide"], ["movie"]),
    a(uuidv7(Date.parse("2026-10-02T08:00:00Z")), "2026-10-02", 2, ["review"], ["series", "place"], "2026-10-02T08:00:00Z"),
    a("team-new", "2026-10-02", 2, ["review", "list"], ["book"]),
  ];

  it("filters by tag and kind", () => {
    expect(filterArticles(list, { tag: "review", kind: null }).map((x) => x.date)).toEqual(["2026-10-02", "2026-10-02"]);
    expect(filterArticles(list, { tag: "review", kind: "place" })).toHaveLength(1);
    expect(filterArticles(list, { tag: null, kind: "game" })).toEqual([]);
  });

  it("sorts newest first (a team article at the end of its day), or by Stamps", () => {
    expect(sortArticles(list, "new").map((x) => x.slug.slice(0, 8))).toEqual(["team-new", list[1]!.slug.slice(0, 8), "team-old"]);
    expect(sortArticles(list, "top")[0]!.slug).toBe("team-old");
  });

  it("puts members' articles under /journal/u/", () => {
    const id = uuidv7();
    expect(articlePath(id)).toBe(`/journal/u/${id}`);
    expect(articlePath("ten-shows")).toBe("/journal/ten-shows");
  });
});
