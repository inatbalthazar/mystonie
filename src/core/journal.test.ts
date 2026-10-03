import { describe, expect, it } from "vitest";
import {
  isJournalSlug,
  isSafeHref,
  isSafeImage,
  journalIndex,
  JournalError,
  journalTitles,
  parseInline,
  parseJournal,
  readingMinutes,
  type JournalVersion,
} from "./journal";

const head = (extra = "") => `---\ntitle: "Ten shows to finish in a weekend"\ndescription: Short ones.\ndate: 2026-10-01\n${extra}---\n`;

describe("parseJournal", () => {
  it("reads the frontmatter", () => {
    const { meta } = parseJournal(`${head("author: Stonie\ncover: /journal/weekend.jpg\n")}\nHello.`);
    expect(meta).toEqual({
      title: "Ten shows to finish in a weekend",
      description: "Short ones.",
      date: "2026-10-01",
      cover: "/journal/weekend.jpg",
      author: "Stonie",
      avatar: null,
      profile: null,
      featured: false,
      draft: false,
      tags: [],
    });
    expect(parseJournal(`${head("draft: true\n")}Hi`).meta.draft).toBe(true);
  });

  it("reads up to three known tags, in any case and with dashes or spaces", () => {
    expect(parseJournal(`${head("tags: Review, on-this-day, behind the scenes\n")}Hi`).meta.tags).toEqual(["review", "on_this_day", "behind_the_scenes"]);
    expect(() => parseJournal(`${head("tags: gossip\n")}Hi`)).toThrow(JournalError);
    expect(() => parseJournal(`${head("tags: review, list, guide, travel\n")}Hi`)).toThrow(/up to 3/);
  });

  it("reads the byline's photo and profile, and featured", () => {
    const { meta } = parseJournal(`${head("avatar: /journal/authors/me.jpg\nprofile: @Inat_B\nfeatured: true\n")}Hi`);
    expect(meta).toMatchObject({ avatar: "/journal/authors/me.jpg", profile: "inat_b", featured: true });
  });

  it("drops a comment after a value, as in the README's example, but keeps a # in quotes", () => {
    const { meta } = parseJournal(
      "---\ntitle: 'Top 10 #1 picks' # quoted\ndescription: Short.\ndate: 2026-10-01   # the day\ncover: /journal/a.jpg      # optional\ndraft: true                      # optional\n---\nHi",
    );
    expect(meta).toMatchObject({ title: "Top 10 #1 picks", date: "2026-10-01", cover: "/journal/a.jpg", draft: true });
  });

  it("refuses a file with missing or wrong frontmatter", () => {
    expect(() => parseJournal("Hello")).toThrow(JournalError);
    expect(() => parseJournal("---\ntitle: A\ndate: 2026-10-01\n---\nHi")).toThrow(/description/);
    expect(() => parseJournal("---\ntitle: A\ndescription: B\ndate: 2026-02-30\n---\nHi")).toThrow(/date/);
    expect(() => parseJournal(`${head("cover: javascript:alert(1)\n")}Hi`)).toThrow(/cover/);
    expect(() => parseJournal(`${head("draft: yes\n")}Hi`)).toThrow(/draft/);
    expect(() => parseJournal(`${head("featured: 1\n")}Hi`)).toThrow(/featured/);
    expect(() => parseJournal(`${head("avatar: http://example.com/me.jpg\n")}Hi`)).toThrow(/avatar/);
    expect(() => parseJournal(`${head("profile: no spaces please\n")}Hi`)).toThrow(/profile/);
    expect(() => parseJournal(head())).toThrow(/no text/);
  });

  it("parses headings, paragraphs, lists, quotes, rules, images and title cards", () => {
    const { blocks } = parseJournal(
      `${head()}
## Why short shows

They end.
Fast.

- one
- two **bold**
  wraps here

1. first
2. second

> A quote
> goes on

---

![A couch](/journal/couch.jpg)

@[series:1396](Breaking Bad)
@[movie:603]
`,
    );
    expect(blocks).toEqual([
      { type: "heading", level: 2, children: [{ type: "text", text: "Why short shows" }] },
      { type: "paragraph", children: [{ type: "text", text: "They end. Fast." }] },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two " }, { type: "strong", children: [{ type: "text", text: "bold" }] }, { type: "text", text: " wraps here" }]],
      },
      { type: "list", ordered: true, items: [[{ type: "text", text: "first" }], [{ type: "text", text: "second" }]] },
      { type: "quote", children: [{ type: "text", text: "A quote goes on" }] },
      { type: "rule" },
      { type: "image", src: "/journal/couch.jpg", alt: "A couch" },
      { type: "title", kind: "series", externalId: "1396", label: "Breaking Bad" },
      { type: "title", kind: "movie", externalId: "603", label: null },
    ]);
  });

  it("refuses a bad title card or image", () => {
    expect(() => parseJournal(`${head()}@[movie:abc]`)).toThrow(/not a title/);
    expect(() => parseJournal(`${head()}@[podcast:1]`)).toThrow(/not a title/);
    expect(() => parseJournal(`${head()}![x](http://evil.example/a.png)`)).toThrow(/images/);
  });
});

describe("parseInline", () => {
  it("parses emphasis, code and links", () => {
    expect(parseInline("a *b* _c_ `d` [e](/reel)")).toEqual([
      { type: "text", text: "a " },
      { type: "em", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
      { type: "text", text: " " },
      { type: "link", href: "/reel", children: [{ type: "text", text: "e" }] },
    ]);
  });

  it("keeps unsafe links, snake_case and escapes as text", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([{ type: "text", text: "[x](javascript:alert(1))" }]);
    expect(parseInline("snake_case_name")).toEqual([{ type: "text", text: "snake_case_name" }]);
    expect(parseInline("2 * 3 = 6")).toEqual([{ type: "text", text: "2 * 3 = 6" }]);
    expect(parseInline("\\*not em\\*")).toEqual([{ type: "text", text: "*not em*" }]);
  });
});

describe("helpers", () => {
  it("checks slugs, links and images", () => {
    expect(isJournalSlug("ten-shows-2026")).toBe(true);
    expect(isJournalSlug("Ten Shows")).toBe(false);
    expect(isJournalSlug("../etc")).toBe(false);
    expect(isSafeHref("/collection")).toBe(true);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(isSafeHref("https://example.com/a")).toBe(true);
    expect(isSafeHref("mailto:hi@example.com")).toBe(true);
    expect(isSafeHref("data:text/html,x")).toBe(false);
    expect(isSafeImage("/journal/a.jpg")).toBe(true);
    expect(isSafeImage("/journal/../secret")).toBe(false);
    expect(isSafeImage("/other.jpg")).toBe(false);
  });

  it("lists the titles once each", () => {
    const { blocks } = parseJournal(`${head()}@[movie:603]\n\n@[book:abcdefghijkl]\n\n@[movie:603](Again)`);
    expect(journalTitles(blocks)).toEqual([
      { kind: "movie", externalId: "603" },
      { kind: "book", externalId: "abcdefghijkl" },
    ]);
  });

  it("estimates reading time for spaced and Thai text", () => {
    expect(readingMinutes(parseJournal(`${head()}word`).blocks)).toBe(1);
    expect(readingMinutes(parseJournal(`${head()}${"word ".repeat(690)}`).blocks)).toBe(3);
    expect(readingMinutes(parseJournal(`${head()}${"ก".repeat(2100)}`).blocks)).toBe(3);
  });
});

describe("journalIndex", () => {
  const v = (slug: string, locale: string, date: string, draft = false): JournalVersion => ({
    slug,
    locale,
    meta: { title: `${slug}-${locale}`, description: "", date, cover: null, author: null, avatar: null, profile: null, featured: false, draft, tags: [] },
  });
  const all = [v("a", "en", "2026-10-01"), v("a", "th", "2026-10-01"), v("b", "en", "2026-10-05"), v("c", "th", "2026-09-01"), v("d", "en", "2026-10-09", true)];

  it("picks the reader's language, then English, newest first", () => {
    expect(journalIndex(all, "th", "en", false).map((x) => `${x.slug}:${x.locale}`)).toEqual(["b:en", "a:th", "c:th"]);
    expect(journalIndex(all, "en", "en", false).map((x) => `${x.slug}:${x.locale}`)).toEqual(["b:en", "a:en", "c:th"]);
  });

  it("shows drafts only when asked", () => {
    expect(journalIndex(all, "en", "en", true)[0]!.slug).toBe("d");
  });
});
