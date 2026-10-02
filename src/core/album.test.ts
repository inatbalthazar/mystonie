import { describe, expect, it } from "vitest";
import { ALBUM_SECTIONS, albumHidden, albumOrder, HIDEABLE_SECTIONS, moveSection, parseAlbumSections } from "./album";

describe("albumOrder", () => {
  it("is the default order when nothing was arranged", () => {
    expect(albumOrder(null)).toEqual([...ALBUM_SECTIONS]);
    expect(albumOrder([])).toEqual([...ALBUM_SECTIONS]);
  });

  it("follows the saved order and adds what it doesn't name at the end, in the default order", () => {
    expect(albumOrder(["shelf", "cards"])).toEqual(["shelf", "cards", "watching", "stickers", "atlas", "patches", "clubs", "saved"]);
  });

  it("skips unknown sections (one removed later) and repeats", () => {
    expect(albumOrder(["gone", "clubs", "clubs", 3]).slice(0, 2)).toEqual(["clubs", "cards"]);
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
    expect(parseAlbumSections(["shelf", "cards", "shelf"])).toEqual(["shelf", "cards"]);
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
    expect(moveSection(order, "shelf", 0).slice(0, 4)).toEqual(["shelf", "cards", "watching", "stickers"]);
    expect(moveSection(order, "cards", 2).slice(0, 4)).toEqual(["watching", "shelf", "cards", "stickers"]);
  });

  it("clamps past either end", () => {
    expect(moveSection(order, "cards", -3)).toEqual(order);
    expect(moveSection(order, "cards", 99).at(-1)).toBe("cards");
  });
});
