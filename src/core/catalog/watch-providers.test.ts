import { describe, expect, it } from "vitest";
import movie from "./fixtures/tmdb-movie-496243-providers.json";
import tv from "./fixtures/tmdb-tv-66732-providers.json";
import { GROUP_MAX, normalizeTmdbWatchProviders, parseCountryOffers, tmdbWatchUrl } from "./watch-providers";

describe("normalizeTmdbWatchProviders", () => {
  it("gives each country its own services (a US and a TH viewer see different lists)", () => {
    const series = normalizeTmdbWatchProviders(tv);
    expect(Object.keys(series).sort()).toEqual(["TH", "US"]);
    expect(series.TH).toEqual({ stream: [{ id: 8, name: "Netflix", logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png" }] });
    expect(series.US!.stream!.map((p) => p.name)).toEqual(["Netflix", "Netflix Standard with Ads"]);
  });

  it("groups streaming, free (with or without ads) and rent-or-buy, by display priority", () => {
    const film = normalizeTmdbWatchProviders(movie);
    expect(film.US!.stream).toBeUndefined();
    expect(film.US!.free!.map((p) => p.name)).toEqual(["Kanopy"]);
    // Rent and buy share a group; a store in both appears once.
    expect(film.US!.buy!.map((p) => p.name)).toEqual(["Amazon Video", "Apple TV Store", "Google Play Movies", "YouTube", "Fandango At Home", "FlixFling"]);
    expect(film.GB!.free!.map((p) => p.name)).toEqual(["ITVX"]);
    expect(film.KR!.stream!.map((p) => p.name)).toEqual(["Netflix", "Watcha", "Netflix Standard with Ads", "TVING"]);
    expect(film.TH).toBeUndefined();
  });

  it("keeps at most GROUP_MAX services per group", () => {
    const film = normalizeTmdbWatchProviders(movie);
    expect(film.GB!.stream).toHaveLength(7);
    const many = Array.from({ length: 12 }, (_, i) => ({ provider_id: i + 1, provider_name: `S${i}`, logo_path: `/s${i}.png`, display_priority: 12 - i }));
    const out = normalizeTmdbWatchProviders({ results: { US: { flatrate: many } } });
    expect(out.US!.stream).toHaveLength(GROUP_MAX);
    expect(out.US!.stream![0]!.name).toBe("S11");
  });

  it("drops what isn't a country or a usable service", () => {
    expect(normalizeTmdbWatchProviders(null)).toEqual({});
    expect(normalizeTmdbWatchProviders({ results: [] })).toEqual({});
    const out = normalizeTmdbWatchProviders({
      results: {
        us: { flatrate: [{ provider_id: 1, provider_name: "Lower", logo_path: "/a.png" }] },
        ZZ: { flatrate: [{ provider_id: 1, provider_name: "Unknown", logo_path: "/a.png" }] },
        FR: {
          link: "https://example.com",
          flatrate: [
            { provider_id: "2", provider_name: "String id", logo_path: "/b.png" },
            { provider_id: 3, provider_name: "", logo_path: "/c.png" },
            { provider_id: 4, provider_name: "Bad logo", logo_path: "https://evil.example/x.png" },
            { provider_id: 5, provider_name: "Good", logo_path: "/e.jpg" },
          ],
          cinema: [{ provider_id: 6, provider_name: "Unknown type", logo_path: "/f.png" }],
        },
        DE: { flatrate: [] },
      },
    });
    expect(out).toEqual({ FR: { stream: [{ id: 5, name: "Good", logo: "/e.jpg" }] } });
  });
});

describe("parseCountryOffers", () => {
  it("reads back what was cached", () => {
    const film = normalizeTmdbWatchProviders(movie);
    expect(parseCountryOffers(JSON.parse(JSON.stringify(film.GB)))).toEqual(film.GB);
  });

  it("is null for a missing country and drops tampered entries", () => {
    expect(parseCountryOffers(null)).toBeNull();
    expect(parseCountryOffers({})).toBeNull();
    expect(parseCountryOffers({ stream: [{ id: 1, name: "X", logo: "javascript:alert(1)" }] })).toBeNull();
    expect(parseCountryOffers({ buy: [{ id: 2, name: "Y", logo: "/y.png" }], other: [] })).toEqual({ buy: [{ id: 2, name: "Y", logo: "/y.png" }] });
  });
});

describe("tmdbWatchUrl", () => {
  it("points at TMDB's watch page for the country", () => {
    expect(tmdbWatchUrl("movie", "496243", "TH")).toBe("https://www.themoviedb.org/movie/496243/watch?locale=TH");
    expect(tmdbWatchUrl("series", "66732", "US")).toBe("https://www.themoviedb.org/tv/66732/watch?locale=US");
  });
});
