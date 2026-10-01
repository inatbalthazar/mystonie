import { describe, expect, it } from "vitest";
import { anilistCredits, catalogCredits, creditImageUrl, googleBooksCredits, parseCredits, rawgCredits, tmdbCredits } from "./credits";
import rawgWitcher from "./fixtures/rawg-game-3328.json";

// Trimmed from `/movie/496243?append_to_response=credits` (Parasite).
const parasite = {
  id: 496243,
  title: "Parasite",
  production_companies: [
    { id: 4399, name: "Barunson E&A", logo_path: "/aZ4hAsPtHyBDXk3qBXQZbnFkxFo.png" },
    { id: 7036, name: "CJ Entertainment", logo_path: null },
  ],
  credits: {
    cast: [
      { id: 1273, name: "Choi Woo-shik", order: 1, profile_path: "/9ZwWgm3aFVr8qQ4WnNvkM4y7Bca.jpg" },
      { id: 20738, name: "Song Kang-ho", order: 0, profile_path: "/lSaBxfxKIOdz3pqZxY8k8sLtXXW.jpg" },
      { id: 1024395, name: "Park So-dam", order: 3, profile_path: null },
      { id: 115290, name: "Lee Sun-kyun", order: 2, profile_path: "/not a path" },
      { id: 21688, name: "Cho Yeo-jeong", order: 4 },
      { id: 1255881, name: "Jang Hye-jin", order: 5 },
      { name: "No id", order: 6 },
    ],
    crew: [
      { id: 21684, name: "Bong Joon Ho", job: "Screenplay", profile_path: "/t9R8YCvMkaTnGsSLbVjQjCGrUnP.jpg" },
      { id: 21684, name: "Bong Joon Ho", job: "Director", profile_path: "/t9R8YCvMkaTnGsSLbVjQjCGrUnP.jpg" },
      { id: 21684, name: "Bong Joon Ho", job: "Director", profile_path: "/t9R8YCvMkaTnGsSLbVjQjCGrUnP.jpg" },
      { id: 1, name: "Someone", job: "Editor" },
    ],
  },
};

describe("tmdbCredits", () => {
  it("keeps the top-billed cast by order, the directors once and the studios", () => {
    const credits = tmdbCredits("movie", parasite)!;
    expect(credits.filter((c) => c.role === "actor").map((c) => c.name)).toEqual([
      "Song Kang-ho",
      "Choi Woo-shik",
      "Lee Sun-kyun",
      "Park So-dam",
      "Cho Yeo-jeong",
    ]);
    expect(credits.find((c) => c.name === "Lee Sun-kyun")!.image).toBeNull();
    expect(credits.filter((c) => c.role === "director")).toEqual([
      { role: "director", id: "21684", name: "Bong Joon Ho", image: "/t9R8YCvMkaTnGsSLbVjQjCGrUnP.jpg" },
    ]);
    expect(credits.filter((c) => c.role === "studio")).toEqual([
      { role: "studio", id: "4399", name: "Barunson E&A", image: "/aZ4hAsPtHyBDXk3qBXQZbnFkxFo.png" },
      { role: "studio", id: "7036", name: "CJ Entertainment", image: null },
    ]);
  });

  it("uses a series' creators as its directors", () => {
    const series = {
      id: 66732,
      name: "Stranger Things",
      created_by: [{ id: 1179419, name: "Matt Duffer", profile_path: null }, { id: 1179422, name: "Ross Duffer" }],
      credits: { cast: [{ id: 35029, name: "Millie Bobby Brown", order: 0 }], crew: [{ id: 9, name: "Shawn Levy", job: "Director" }] },
    };
    expect(tmdbCredits("series", series)!.filter((c) => c.role === "director").map((c) => c.name)).toEqual(["Matt Duffer", "Ross Duffer"]);
  });

  it("is null without credits in the body (not fetched yet), and survives junk", () => {
    expect(tmdbCredits("movie", { id: 1, title: "X" })).toBeNull();
    expect(tmdbCredits("movie", null)).toBeNull();
    expect(tmdbCredits("movie", { credits: { cast: "nope", crew: [null, 3] }, production_companies: {} })).toEqual([]);
  });
});

describe("other catalogs", () => {
  it("takes a book's authors, keyed by name", () => {
    expect(googleBooksCredits({ volumeInfo: { authors: ["Ursula K. Le Guin", " ", "Ursula K. Le Guin", 4] } })).toEqual([
      { role: "author", id: "ursula k. le guin", name: "Ursula K. Le Guin", image: null },
    ]);
    expect(googleBooksCredits({ volumeInfo: {} })).toEqual([]);
    expect(googleBooksCredits({})).toBeNull();
  });

  it("takes a manga's story and art staff from AniList", () => {
    const body = {
      data: {
        Media: {
          id: 30013,
          staff: {
            edges: [
              { role: "Story & Art", node: { id: 96881, name: { full: "Eiichiro Oda" }, image: { medium: "https://s4.anilist.co/file/anilistcdn/staff/medium/n96881-abc.jpg" } } },
              { role: "Translator (English)", node: { id: 1, name: { full: "Someone" } } },
              { role: "Art", node: { id: 2, name: { full: "Artist" }, image: { medium: "https://evil.example/x.jpg" } } },
            ],
          },
        },
      },
    };
    expect(anilistCredits(body)).toEqual([
      { role: "author", id: "96881", name: "Eiichiro Oda", image: "https://s4.anilist.co/file/anilistcdn/staff/medium/n96881-abc.jpg" },
      { role: "author", id: "2", name: "Artist", image: null },
    ]);
    expect(anilistCredits({ data: { Media: { id: 1 } } })).toBeNull();
  });

  it("takes a game's developers from RAWG", () => {
    expect(rawgCredits(rawgWitcher)).toEqual([{ role: "developer", id: "9023", name: "CD PROJEKT RED", image: null }]);
    expect(catalogCredits("rawg", "game", rawgWitcher)).toEqual(rawgCredits(rawgWitcher));
    expect(catalogCredits("tmdb", "movie", parasite)).toEqual(tmdbCredits("movie", parasite));
  });
});

describe("stored credits", () => {
  it("drops malformed items and keeps null as not fetched", () => {
    expect(parseCredits(null)).toBeNull();
    expect(parseCredits([{ role: "actor", id: "1", name: "A", image: null }, { role: "grip", id: "2", name: "B" }, { role: "actor", name: "C" }])).toEqual([
      { role: "actor", id: "1", name: "A", image: null },
    ]);
  });

  it("builds photo URLs only from catalog images", () => {
    expect(creditImageUrl("tmdb", "/lSaBxfxKIOdz3pqZxY8k8sLtXXW.jpg")).toBe("https://image.tmdb.org/t/p/w185/lSaBxfxKIOdz3pqZxY8k8sLtXXW.jpg");
    expect(creditImageUrl("tmdb", "https://evil.example/x.jpg")).toBeNull();
    expect(creditImageUrl("anilist", "https://s4.anilist.co/file/anilistcdn/staff/medium/n96881-abc.jpg")).toContain("anilistcdn/staff");
    expect(creditImageUrl("rawg", "/x.jpg")).toBeNull();
    expect(creditImageUrl("tmdb", null)).toBeNull();
  });
});
