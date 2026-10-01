import { describe, expect, it } from "vitest";
import { searchRegions } from "./atlas";
import { isRegionId, parseRegionWrite, regionCountry, regionsByCountry, regionsOf } from "./atlas-regions";
import { COUNTRY_CODES } from "./countries";
import { COUNTRY_REGIONS, REGION_KINDS } from "./regions";

describe("the region list", () => {
  it("has the regions travellers think in", () => {
    expect(regionsOf("TH")).toMatchObject({ kind: "province" });
    expect(regionsOf("TH")!.ids).toHaveLength(77);
    expect(regionsOf("US")!.ids).toHaveLength(51);
    expect(regionsOf("JP")).toMatchObject({ kind: "prefecture" });
    expect(regionsOf("JP")!.ids).toHaveLength(47);
    // The UK as its four nations, France and Italy as regions, not their councils and departments.
    expect(regionsOf("GB")).toEqual({ kind: "nation", ids: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"] });
    expect(regionsOf("FR")!.ids).toHaveLength(13);
    expect(regionsOf("IT")!.ids).toHaveLength(20);
  });

  it("only has countries of the map, each with two regions or more, ids that start with the country", () => {
    for (const [country, entry] of Object.entries(COUNTRY_REGIONS)) {
      expect(COUNTRY_CODES).toContain(country);
      expect(REGION_KINDS).toContain(entry!.kind);
      const ids = entry!.ids.split(" ");
      expect(ids.length).toBeGreaterThan(1);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(new RegExp(`^${country}-[A-Z0-9]{1,8}$`));
    }
  });

  it("has no regions for a country without any", () => {
    expect(regionsOf("SG")).toBeNull();
    expect(regionsOf("VA")).toBeNull();
  });

  it("knows real ids from look-alikes", () => {
    expect(isRegionId("TH-10")).toBe(true);
    expect(isRegionId("TH-99")).toBe(false);
    expect(isRegionId("th-10")).toBe(false);
    expect(isRegionId("SG-01")).toBe(false);
    expect(isRegionId(10)).toBe(false);
    expect(regionCountry("JP-13")).toBe("JP");
  });
});

describe("parseRegionWrite", () => {
  it("takes a region and whether it's visited, and works out its country", () => {
    expect(parseRegionWrite({ region: "JP-13", visited: true })).toEqual({ region: "JP-13", country: "JP", visited: true });
    expect(parseRegionWrite({ region: "GB-SCT", visited: false })).toEqual({ region: "GB-SCT", country: "GB", visited: false });
  });

  it("refuses anything else", () => {
    for (const body of [
      null,
      [],
      "JP-13",
      { region: "JP-13" },
      { region: "JP-13", visited: "yes" },
      { region: "JP-99", visited: true },
      { region: "XX-1", visited: true },
    ]) {
      expect(parseRegionWrite(body)).toBeNull();
    }
  });
});

describe("regionsByCountry", () => {
  it("groups marked regions by country in the map's order, and drops ids no longer on the map", () => {
    const grouped = regionsByCountry(["TH-50", "JP-13", "TH-10", "TH-50", "TH-99"]);
    expect([...grouped]).toEqual([
      ["TH", ["TH-10", "TH-50"]],
      ["JP", ["JP-13"]],
    ]);
  });
});

describe("searchRegions", () => {
  const options = [
    ["TH-10", "กรุงเทพมหานคร", "Bangkok"],
    ["TH-50", "เชียงใหม่", "Chiang Mai"],
    ["TH-57", "เชียงราย", "Chiang Rai"],
    ["TH-83", "ภูเก็ต", "Phuket"],
  ] as const;

  it("lists every region for an empty query, and ranks matches in either language", () => {
    expect(searchRegions(" ", options)).toEqual(["TH-10", "TH-50", "TH-57", "TH-83"]);
    expect(searchRegions("chiang", options)).toEqual(["TH-50", "TH-57"]);
    expect(searchRegions("rai", options)).toEqual(["TH-57"]);
    expect(searchRegions("เชียงใ", options)).toEqual(["TH-50"]);
    expect(searchRegions("PHU", options)).toEqual(["TH-83"]);
  });
});
