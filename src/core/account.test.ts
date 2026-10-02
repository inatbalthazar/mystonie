import { describe, expect, it } from "vitest";
import { bioFits, collectPages, formatPrefs, normalizeBio, normalizeUsername, parseAccountPatch, parsePrefs } from "./account";

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
          country: "TH",
          theme: "dark",
          visibility: "private",
          emailRecaps: false,
          reelReminders: true,
          atlasPublic: true,
        },
        locales,
      ),
    ).toEqual({
      username: "jane_doe",
      display_name: "Jane Doe",
      avatar_url: null,
      locale: "th",
      time_zone: "Asia/Bangkok",
      country: "TH",
      theme: "dark",
      visibility: "private",
      email_recaps: false,
      reel_reminders: true,
      atlas_public: true,
    });
  });

  it("takes the album as arranged: its order, hidden sections and shelf favourites (ADR 0069)", () => {
    const pin = "00000000-0000-4000-8000-000000000001";
    expect(parseAccountPatch({ albumOrder: ["shelf", "cards"], albumHidden: ["saved"], shelfPins: [pin, pin] }, locales)).toEqual({
      album_order: ["shelf", "cards"],
      album_hidden: ["saved"],
      shelf_pins: [pin],
    });
    expect(parseAccountPatch({ albumOrder: ["feed"] }, locales)).toBeNull();
    // The Atlas hides with its own switch.
    expect(parseAccountPatch({ albumHidden: ["atlas"] }, locales)).toBeNull();
    expect(parseAccountPatch({ shelfPins: ["x"] }, locales)).toBeNull();
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

  it("tidies a bio, keeps its line breaks, and clears it when empty (ADR 0057)", () => {
    expect(parseAccountPatch({ bio: "  Ghibli   forever 🌿 \r\n\n\n  slowly\tfinishing One Piece  " }, locales)).toEqual({
      bio: "Ghibli forever 🌿\nslowly finishing One Piece",
    });
    expect(parseAccountPatch({ bio: " \n " }, locales)).toEqual({ bio: null });
    expect(parseAccountPatch({ bio: null }, locales)).toEqual({ bio: null });
    expect(parseAccountPatch({ bio: 42 }, locales)).toBeNull();
  });

  it("takes a bio of up to 160 characters and 4 lines", () => {
    expect(parseAccountPatch({ bio: "🎬".repeat(160) }, locales)).toEqual({ bio: "🎬".repeat(160) });
    expect(parseAccountPatch({ bio: "a".repeat(161) }, locales)).toBeNull();
    expect(parseAccountPatch({ bio: "a\nb\nc\nd" }, locales)).toEqual({ bio: "a\nb\nc\nd" });
    expect(parseAccountPatch({ bio: "a\nb\nc\nd\ne" }, locales)).toBeNull();
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
    [{ country: "th" }],
    [{ country: "ZZ" }],
    [{ country: null }],
    [{ theme: "blue" }],
    [{ visibility: "friends" }],
    [{ emailRecaps: "yes" }],
    [{ reelReminders: 1 }],
    [{ atlasPublic: "on" }],
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

describe("normalizeBio", () => {
  it("drops control characters but keeps emoji sequences", () => {
    expect(normalizeBio("hi\u0000\u0007 there 👩‍🚀")).toBe("hi there 👩‍🚀");
    expect(bioFits(normalizeBio("x".repeat(160)))).toBe(true);
  });
});

