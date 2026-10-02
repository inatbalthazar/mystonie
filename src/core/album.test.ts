import { describe, expect, it } from "vitest";
import { ALBUM_SECTIONS, albumHidden, albumOrder, HIDEABLE_SECTIONS, moveSection, parseAlbumSections, parseStatsSections, statsHidden } from "./album";

describe("albumOrder", () => {
  it("is the default order when nothing was arranged", () => {
    expect(albumOrder(null)).toEqual([...ALBUM_SECTIONS]);
    expect(albumOrder([])).toEqual([...ALBUM_SECTIONS]);
  });

  it("follows the saved order and adds what it doesn't name at the end, in the default order", () => {
    expect(albumOrder(["shelf", "clubs"])).toEqual(["shelf", "clubs", "watching", "stickers", "atlas", "patches", "saved"]);
    // The cards left the album (ADR 0076): an old saved order skips them.
    expect(albumOrder(["cards", "shelf"])).toEqual(["shelf", "watching", "stickers", "atlas", "patches", "clubs", "saved"]);
  });

  it("skips unknown sections (one removed later) and repeats", () => {
    expect(albumOrder(["gone", "clubs", "clubs", 3]).slice(0, 2)).toEqual(["clubs", "watching"]);
    expect(albumOrder(["gone", "clubs", "clubs"])).toHaveLength(ALBUM_SECTIONS.length);
  });
});

describe("albumHidden", () => {
  it("keeps only sections the album's switch hides (the Atlas has its own)", () => {
    expect(albumHidden(["saved", "atlas", "nope", "stickers"])).toEqual(["stickers", "saved"]);
    expect(albumHidden(null)).toEqual([]);
    expect(HIDEABLE_SECTIONS).not.toContain("atlas");
  });
});

describe("parseAlbumSections", () => {
  it("takes known sections and drops repeats", () => {
    expect(parseAlbumSections(["shelf", "clubs", "shelf"])).toEqual(["shelf", "clubs"]);
    expect(parseAlbumSections(["shelf", "cards"])).toBeNull();
    expect(parseAlbumSections([])).toEqual([]);
  });

  it("rejects anything else", () => {
    expect(parseAlbumSections(["shelf", "feed"])).toBeNull();
    expect(parseAlbumSections("shelf")).toBeNull();
    expect(parseAlbumSections(["atlas"], HIDEABLE_SECTIONS)).toBeNull();
  });
});

describe("moveSection", () => {
  const order = albumOrder(null);

  it("moves a section and keeps the others in order", () => {
    expect(moveSection(order, "shelf", 0).slice(0, 4)).toEqual(["shelf", "watching", "stickers", "atlas"]);
    expect(moveSection(order, "watching", 2).slice(0, 4)).toEqual(["shelf", "stickers", "watching", "atlas"]);
  });

  it("clamps past either end", () => {
    expect(moveSection(order, "watching", -3)).toEqual(order);
    expect(moveSection(order, "watching", 99).at(-1)).toBe("watching");
  });
});

describe("statsHidden", () => {
  it("keeps the known sections, in page order", () => {
    expect(statsHidden(["records", "nope", "activity", "records"])).toEqual(["activity", "records"]);
    expect(statsHidden(null)).toEqual([]);
  });
});

describe("parseStatsSections", () => {
  it("accepts known sections, in page order without repeats", () => {
    expect(parseStatsSections(["milestones", "numbers", "numbers"])).toEqual(["numbers", "milestones"]);
    expect(parseStatsSections([])).toEqual([]);
  });

  it("rejects anything else", () => {
    expect(parseStatsSections(["shelf"])).toBeNull();
    expect(parseStatsSections("activity")).toBeNull();
    expect(parseStatsSections(null)).toBeNull();
  });
});
