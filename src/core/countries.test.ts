import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryFromRequest, countryName, countryOptions, isCountryCode } from "./countries";

describe("COUNTRY_CODES", () => {
  it("lists each ISO 3166-1 code once, plus Kosovo", () => {
    expect(COUNTRY_CODES).toHaveLength(250);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
  });

  it("checks codes", () => {
    expect(isCountryCode("TH")).toBe(true);
    expect(isCountryCode("th")).toBe(false);
    expect(isCountryCode("ZZ")).toBe(false);
    expect(isCountryCode(null)).toBe(false);
  });
});

describe("countryFromRequest", () => {
  it("prefers the edge's IP country", () => {
    expect(countryFromRequest({ ipCountry: "TH", acceptLanguage: "en-US,en;q=0.9" })).toBe("TH");
    expect(countryFromRequest({ ipCountry: "gb" })).toBe("GB");
  });

  it("falls back to the first region in Accept-Language", () => {
    expect(countryFromRequest({ ipCountry: null, acceptLanguage: "th-TH,th;q=0.9,en;q=0.8" })).toBe("TH");
    expect(countryFromRequest({ ipCountry: "T1", acceptLanguage: "en;q=0.9, pt-BR;q=0.8" })).toBe("BR");
    expect(countryFromRequest({ acceptLanguage: "zh-Hant-TW" })).toBe("TW");
  });

  it("is null when nothing names a country", () => {
    expect(countryFromRequest({})).toBeNull();
    expect(countryFromRequest({ ipCountry: "", acceptLanguage: "en, es-419" })).toBeNull();
    expect(countryFromRequest({ acceptLanguage: "*" })).toBeNull();
  });
});

describe("country names", () => {
  it("names countries in the viewer's language", () => {
    expect(countryName("TH", "en")).toBe("Thailand");
    expect(countryName("US", "th")).toBe("สหรัฐอเมริกา");
    expect(countryName("TH", "not a locale!")).toBe("TH");
  });

  it("sorts the picker by name", () => {
    const options = countryOptions("en");
    expect(options).toHaveLength(250);
    expect(options[0]).toEqual(["AF", "Afghanistan"]);
    const names = options.map(([, name]) => name);
    expect(names.indexOf("Thailand")).toBeLessThan(names.indexOf("United States"));
  });
});
