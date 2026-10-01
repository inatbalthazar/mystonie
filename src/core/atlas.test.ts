import { describe, expect, it } from "vitest";
import {
  atlasCardCountries,
  atlasSummary,
  continentCount,
  parsePlaceWrite,
  placesByContinent,
  searchCountries,
  storiesByCountry,
  storyLevel,
  titleCountries,
  type Place,
  type StoryTitle,
} from "./atlas";
import { CONTINENT_OF } from "./continents";
import { COUNTRY_CODES, countryName, type CountryCode } from "./countries";

describe("parsePlaceWrite", () => {
  it("takes a status, a year with a visit, and null to take a country off", () => {
    expect(parsePlaceWrite({ country: "JP", status: "been", firstYear: 2019 }, 2026)).toEqual({ country: "JP", status: "been", firstYear: 2019 });
    expect(parsePlaceWrite({ country: "JP", status: "want" }, 2026)).toEqual({ country: "JP", status: "want", firstYear: null });
    expect(parsePlaceWrite({ country: "JP", status: null }, 2026)).toEqual({ country: "JP", status: null, firstYear: null });
    expect(parsePlaceWrite({ country: "PT", status: "lived", firstYear: null }, 2026)).toEqual({ country: "PT", status: "lived", firstYear: null });
  });

  it("refuses unknown countries and statuses, future or odd years, and a year without a visit", () => {
    for (const body of [
      null,
      [],
      { country: "jp", status: "been" },
      { country: "ZZ", status: "been" },
      { country: "JP", status: "visited" },
      { country: "JP" },
      { country: "JP", status: "been", firstYear: 2027 },
      { country: "JP", status: "been", firstYear: 1899 },
      { country: "JP", status: "been", firstYear: 2019.5 },
      { country: "JP", status: "been", firstYear: "2019" },
      { country: "JP", status: "want", firstYear: 2019 },
      { country: "JP", status: null, firstYear: 2019 },
    ]) {
      expect(parsePlaceWrite(body, 2026)).toBeNull();
    }
  });
});

describe("titleCountries", () => {
  it("reads TMDB's origin countries first, then the production countries", () => {
    expect(titleCountries("tmdb", { origin_country: ["KR"], production_countries: [{ iso_3166_1: "US" }] })).toEqual(["KR"]);
    expect(
      titleCountries("tmdb", { origin_country: [], production_countries: [{ iso_3166_1: "GB" }, { iso_3166_1: "FR" }, { iso_3166_1: "GB" }] }),
    ).toEqual(["GB", "FR"]);
    expect(titleCountries("tmdb", { origin_country: ["US", "XX", 7] })).toEqual(["US"]);
  });

  it("reads AniList's country of origin, and nothing for books, games or broken bodies", () => {
    expect(titleCountries("anilist", { countryOfOrigin: "JP" })).toEqual(["JP"]);
    expect(titleCountries("anilist", { countryOfOrigin: "jp" })).toEqual([]);
    expect(titleCountries("google_books", { volumeInfo: { language: "en" } })).toEqual([]);
    expect(titleCountries("rawg", { id: 1 })).toEqual([]);
    expect(titleCountries("tmdb", null)).toEqual([]);
    expect(titleCountries("tmdb", { origin_country: "US" })).toEqual([]);
  });
});

const story = (id: string, countries: CountryCode[]): StoryTitle => ({
  id,
  kind: "movie",
  name: id,
  posterUrl: null,
  href: `/title/movie/${id}`,
  countries,
});

describe("storiesByCountry and storyLevel", () => {
  it("counts a co-production for each country, most stories first", () => {
    const by = storiesByCountry([story("a", ["KR"]), story("b", ["US", "KR"]), story("c", ["JP"])]);
    expect([...by.keys()]).toEqual(["KR", "JP", "US"]);
    expect(by.get("KR")!.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("colours more stories more strongly", () => {
    expect([1, 2, 3, 4, 9, 10, 50].map(storyLevel)).toEqual([1, 2, 2, 3, 3, 4, 4]);
  });
});

const place = (country: CountryCode, status: Place["status"], firstYear: number | null = null): Place => ({ country, status, firstYear });

describe("atlasSummary", () => {
  it("counts visits (lived included), wants, continents and the overlap with the stories", () => {
    const places = [place("JP", "been"), place("TH", "lived"), place("FR", "been"), place("BR", "want"), place("PE", "want")];
    const summary = atlasSummary(places, ["JP", "KR", "US", "BR"]);
    expect(summary).toMatchObject({ been: 3, lived: 1, want: 2, continents: 2, stories: 4, both: 1 });
    expect(summary.byContinent).toMatchObject({ asia: 2, europe: 1, south_america: 0, antarctica: 0 });
  });

  it("is all zeros for an empty atlas", () => {
    expect(atlasSummary([], [])).toMatchObject({ been: 0, lived: 0, want: 0, continents: 0, stories: 0, both: 0 });
  });
});

describe("continents", () => {
  it("gives every country code a continent", () => {
    for (const code of COUNTRY_CODES) expect(CONTINENT_OF[code]).toBeTruthy();
    expect([CONTINENT_OF.MX, CONTINENT_OF.JM, CONTINENT_OF.BR, CONTINENT_OF.XK, CONTINENT_OF.TW, CONTINENT_OF.AQ]).toEqual([
      "north_america",
      "north_america",
      "south_america",
      "europe",
      "asia",
      "antarctica",
    ]);
  });

  it("groups places by continent in the Atlas's order, each sorted by name", () => {
    const name = (code: CountryCode) => countryName(code, "en");
    const groups = placesByContinent([place("JP", "been"), place("FR", "been"), place("CN", "been"), place("KE", "been")], name, "en");
    expect(groups.map(([c, list]) => [c, list.map((p) => p.country)])).toEqual([
      ["africa", ["KE"]],
      ["asia", ["CN", "JP"]],
      ["europe", ["FR"]],
    ]);
  });

  it("puts visited countries on the card, and counts their continents", () => {
    const countries = atlasCardCountries([place("JP", "been"), place("BR", "want"), place("FR", "lived"), place("TH", "been")]);
    expect(countries).toEqual(["FR", "JP", "TH"]);
    expect(continentCount(countries)).toBe(2);
  });
});

describe("searchCountries", () => {
  const options = COUNTRY_CODES.map((code) => [code, countryName(code, "th"), countryName(code, "en")] as const);

  it("finds countries by the start of their name in either language, then by a word, then anywhere", () => {
    expect(searchCountries("jap", options)[0]).toBe("JP");
    expect(searchCountries("ญี่", options)[0]).toBe("JP");
    expect(searchCountries("korea", options).slice(0, 2).sort()).toEqual(["KP", "KR"]);
    expect(searchCountries("zealand", options)).toContain("NZ");
  });

  it("ignores accents and case, and knows codes and short names", () => {
    expect(searchCountries("cote", options)).toContain("CI");
    expect(searchCountries("UK", options)[0]).toBe("GB");
    expect(searchCountries("usa", options)[0]).toBe("US");
    expect(searchCountries("th", options)[0]).toBe("TH");
  });

  it("returns nothing for an empty query and keeps to the limit", () => {
    expect(searchCountries("  ", options)).toEqual([]);
    expect(searchCountries("a", options, 5)).toHaveLength(5);
  });
});
