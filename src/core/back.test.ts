import { describe, expect, it } from "vitest";
import { BACK_STACK_MAX, backPage, backParent, backTitle, hasBack, parseBackStack, previousEntry, stepBack } from "./back";

describe("hasBack", () => {
  it("has no button on the tabs, their own tabs and the sign-in steps", () => {
    for (const path of [
      "/",
      "/home",
      "/collection",
      "/collection/",
      "/collection/atlas",
      "/feed",
      "/me",
      "/stats",
      "/me/cards",
      "/auth",
      "/auth/confirm",
      "/offline",
    ]) {
      expect(hasBack(path), path).toBe(false);
    }
  });

  it("has one everywhere else", () => {
    for (const path of [
      "/collection/atlas/jp",
      "/title/movie/496243",
      "/people",
      "/settings",
      "/settings/warnings",
      "/u/someone",
      "/c/abc",
      "/privacy",
      "/nope",
    ]) {
      expect(hasBack(path), path).toBe(true);
    }
  });
});

describe("backParent", () => {
  it("goes up a level", () => {
    expect(backParent("/collection/atlas/th")).toEqual({ href: "/collection/atlas", signedIn: true });
    expect(backParent("/title/series/66732")).toEqual({ href: "/collection", signedIn: true });
    expect(backParent("/people")).toEqual({ href: "/home", signedIn: true });
    expect(backParent("/clubs/horror")).toEqual({ href: "/clubs", signedIn: true });
    expect(backParent("/review/2026")).toEqual({ href: "/stats", signedIn: true });
    expect(backParent("/settings")).toEqual({ href: "/me", signedIn: true });
    expect(backParent("/settings/import")).toEqual({ href: "/settings", signedIn: true });
    expect(backParent("/quiz")).toEqual({ href: "/home", signedIn: true });
  });

  it("takes anyone from an article to the feed, where the articles are listed", () => {
    expect(backParent("/journal/how-to-write")).toEqual({ href: "/feed", signedIn: false });
  });

  it("has none for pages that only go back, or have no button", () => {
    for (const path of ["/u/someone", "/c/abc", "/privacy", "/terms", "/home", "/collection/atlas"]) {
      expect(backParent(path), path).toBeNull();
    }
  });
});

describe("backPage", () => {
  it("names the main pages", () => {
    expect(backPage("/collection")).toEqual({ kind: "named", page: "collection" });
    expect(backPage("/collection/atlas")).toEqual({ kind: "named", page: "atlas" });
    expect(backPage("/settings/")).toEqual({ kind: "named", page: "settings" });
    expect(backPage("/")).toEqual({ kind: "named", page: "landing" });
  });

  it("names a country by its code and a profile by its username", () => {
    expect(backPage("/collection/atlas/jp")).toEqual({ kind: "country", country: "JP" });
    expect(backPage("/u/mina")).toEqual({ kind: "profile", username: "mina" });
    expect(backPage("/u/mina/stats")).toEqual({ kind: "profile", username: "mina" });
  });

  it("leaves the rest to the page's title", () => {
    expect(backPage("/title/movie/1")).toEqual({ kind: "page" });
    expect(backPage("/clubs/horror")).toEqual({ kind: "page" });
  });
});

describe("stepBack and previousEntry", () => {
  it("pushes new pages and names the one before", () => {
    let stack = stepBack([], "/feed", false);
    stack = stepBack(stack, "/people", false);
    expect(previousEntry(stack, "/people")).toEqual({ path: "/feed" });
    expect(previousEntry(stack, "/feed")).toBeNull();
  });

  it("pops on a step back, and pushes on a link to the same page", () => {
    const stack = [{ path: "/feed" }, { path: "/people" }];
    expect(stepBack(stack, "/feed", true)).toEqual([{ path: "/feed" }]);
    expect(stepBack(stack, "/feed", false)).toEqual([{ path: "/feed" }, { path: "/people" }, { path: "/feed" }]);
  });

  it("pushes on a forward step", () => {
    expect(stepBack([{ path: "/feed" }], "/people", true)).toEqual([{ path: "/feed" }, { path: "/people" }]);
  });

  it("swaps a profile's tabs in place: back from its Stats goes where the profile came from (ADR 0077)", () => {
    let stack = stepBack([{ path: "/feed" }], "/u/mina", false);
    stack = stepBack(stack, "/u/mina/stats", false);
    expect(stack).toEqual([{ path: "/feed" }, { path: "/u/mina/stats" }]);
    expect(previousEntry(stack, "/u/mina/stats")).toEqual({ path: "/feed" });
    expect(stepBack(stack, "/u/other", false)).toHaveLength(3);
  });

  it("keeps the stack on a reload or a new query", () => {
    const stack = [{ path: "/feed" }, { path: "/collection", title: "Your collection" }];
    expect(stepBack(stack, "/collection?shelf=read", false)).toEqual(stack);
  });

  it("keeps the last pages only", () => {
    let stack = stepBack([], "/a0", false);
    for (let i = 1; i < 40; i++) stack = stepBack(stack, `/a${i}`, false);
    expect(stack).toHaveLength(BACK_STACK_MAX);
    expect(stack.at(-1)).toEqual({ path: "/a39" });
  });
});

describe("backTitle", () => {
  it("drops the site name", () => {
    expect(backTitle("Parasite · Mystonie")).toBe("Parasite");
    expect(backTitle("Mystonie")).toBeUndefined();
    expect(backTitle("")).toBeUndefined();
  });
});

describe("parseBackStack", () => {
  it("keeps valid entries only", () => {
    expect(parseBackStack([{ path: "/feed" }, { path: "x" }, null, { path: "/people", title: "People" }, { path: "/a", title: 3 }])).toEqual([
      { path: "/feed" },
      { path: "/people", title: "People" },
    ]);
    expect(parseBackStack("nope")).toEqual([]);
  });
});
