// Countries for region-dependent data (where to watch, S2). ISO 3166-1 alpha-2 codes, matching
// `profiles.country` (`^[A-Z]{2}$`) and TMDB's watch-provider regions. Names come from `Intl`, in the
// viewer's language, so no list here signals a home country.

/** Every officially assigned ISO 3166-1 alpha-2 code, plus XK (Kosovo, which TMDB and JustWatch use). */
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "XK",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const CODES = new Set<string>(COUNTRY_CODES);

export const isCountryCode = (v: unknown): v is CountryCode => typeof v === "string" && CODES.has(v);

/**
 * The best guess at where a request comes from, for a profile without a country: the edge's IP country
 * (Vercel's `x-vercel-ip-country`), else the first region in `Accept-Language` (`th-TH` → TH). Null when neither
 * names a country (no header, `en`, `es-419`, Tor's `T1`).
 */
export function countryFromRequest({ ipCountry, acceptLanguage }: { ipCountry?: string | null; acceptLanguage?: string | null }): CountryCode | null {
  const ip = ipCountry?.trim().toUpperCase();
  if (isCountryCode(ip)) return ip;
  for (const part of (acceptLanguage ?? "").split(",").slice(0, 10)) {
    const tag = part.split(";")[0]!.trim();
    const region = tag.split("-").slice(1).find((sub) => /^[A-Za-z]{2}$/.test(sub))?.toUpperCase();
    if (isCountryCode(region)) return region;
  }
  return null;
}

/** The country's name in `locale` (falls back to the code). */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every country as `[code, name]`, sorted by name in `locale` (for pickers; computed on the server). */
export function countryOptions(locale: string): [CountryCode, string][] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    // an unknown locale: codes only
  }
  const collator = new Intl.Collator(locale);
  return COUNTRY_CODES.map((code): [CountryCode, string] => [code, names?.of(code) ?? code]).sort((a, b) => collator.compare(a[1], b[1]));
}
