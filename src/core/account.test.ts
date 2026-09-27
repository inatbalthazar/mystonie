import { describe, expect, it } from "vitest";
import { collectPages, formatPrefs, normalizeUsername, parseAccountPatch, parsePrefs } from "./account";

const locales = ["en", "th"];

describe("parseAccountPatch", () => {
  it("maps each setting to its column", () => {
    expect(
      parseAccountPatch(
        {
          username: " @Jane_Doe ",
          displayName: "  Jane   Doe ",
          avatarUrl: null,
          locale: "th",
          timeZone: "Asia/Bangkok",
          theme: "dark",
          visibility: "private",
          emailRecaps: false,
        },
        locales,
      ),
    ).toEqual({
      username: "jane_doe",
      display_name: "Jane Doe",
      avatar_url: null,
      locale: "th",
      time_zone: "Asia/Bangkok",
      theme: "dark",
      visibility: "private",
      email_recaps: false,
    });
  });

  it("keeps only the fields that were sent", () => {
    expect(parseAccountPatch({ theme: "light" }, locales)).toEqual({ theme: "light" });
  });

  it("clears the display name when it is empty or null", () => {
    expect(parseAccountPatch({ displayName: "   " }, locales)).toEqual({ display_name: null });
    expect(parseAccountPatch({ displayName: null }, locales)).toEqual({ display_name: null });
  });

  it("counts display name length in characters, not UTF-16 units", () => {
    expect(parseAccountPatch({ displayName: "🎬".repeat(50) }, locales)).toEqual({ display_name: "🎬".repeat(50) });
    expect(parseAccountPatch({ displayName: "a".repeat(51) }, locales)).toBeNull();
  });

  it.each([
    [{}],
    [null],
    [[]],
    [{ username: "ab" }],
    [{ username: "no spaces" }],
    [{ username: "émile" }],
    [{ username: "a".repeat(21) }],
    [{ avatarUrl: "https://example.com/me.png" }],
    [{ locale: "fr" }],
    [{ timeZone: "../../etc" }],
    [{ theme: "blue" }],
    [{ visibility: "friends" }],
    [{ emailRecaps: "yes" }],
    [{ theme: "dark", locale: "xx" }],
  ])("rejects %j", (body) => {
    expect(parseAccountPatch(body, locales)).toBeNull();
  });
});

describe("normalizeUsername", () => {
  it("drops the @ and lower-cases", () => {
    expect(normalizeUsername("  @KimJiWon ")).toBe("kimjiwon");
  });
});

describe("preferences cookie", () => {
  it("round-trips", () => {
    expect(parsePrefs(formatPrefs({ locale: "th", theme: "dark" }), locales)).toEqual({ locale: "th", theme: "dark" });
  });

  it.each([undefined, "", "th", "fr.dark", "th.blue", "th.dark.x"])("ignores %j", (value) => {
    expect(parsePrefs(value, locales)).toBeNull();
  });
});

describe("collectPages", () => {
  it("reads until a short page comes back", async () => {
    const all = Array.from({ length: 5 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await collectPages(async (from, to) => {
      calls.push([from, to]);
      return all.slice(from, to + 1);
    }, 2);
    expect(rows).toEqual(all);
    expect(calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("asks once more after an exactly full last page", async () => {
    let calls = 0;
    const rows = await collectPages(async (from) => {
      calls += 1;
      return from === 0 ? ["a", "b"] : [];
    }, 2);
    expect(rows).toEqual(["a", "b"]);
    expect(calls).toBe(2);
  });
});
