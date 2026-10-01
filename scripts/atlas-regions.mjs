// Builds the Atlas's regions (stage 4, ADR 0060): each country's states, provinces or regions, from Natural Earth's
// 1:10m admin-1 states and provinces (public domain), named in English and Thai from Wikidata (CC0). No packages:
// the merging, projection, simplification and path encoding are done here.
//
//   node scripts/atlas-regions.mjs           (ATLAS_NE_FILE=<path> reads a downloaded copy of the Natural Earth file)
//
// Writes public/atlas/regions/v1/<CC>.json (one country's map and names, loaded when its page opens) and
// src/core/regions.ts (every country's region ids and kind, for the server to check and count). Region ids are kept in
// place_regions, so a run on another source version must keep them: it stops when an id it wrote before is gone
// (ATLAS_ALLOW_REMOVED=1 to go on anyway, with a migration for the rows). Run it again only to change the regions.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson";
const SPARQL_URL = "https://query.wikidata.org/sparql";
const API_URL = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "MystonieAtlasBuilder/1.0 (https://github.com/inatbalthazar/mystonie)";
const VERSION = "v1";

/** A country's main map is this long on its longer side; insets sit in a strip under it. */
const SIZE = 1000;
/** Douglas–Peucker tolerance and the smallest island or hole kept, in map units. */
const TOLERANCE = 0.8;
const MIN_RING_AREA = 3;
/** A region smaller than this (both sides) also gets a dot, so it can be seen and tapped. */
const DOT_BELOW = 14;
/** An inset's longer side, as a share of the main map's longer side: shrunk to the most, enlarged to the least. */
const INSET_MAX = 0.34;
const INSET_MIN = 0.2;
const GAP = 28;

const OUT_DIR = new URL(`../public/atlas/regions/${VERSION}/`, import.meta.url);
const CORE_FILE = new URL("../src/core/regions.ts", import.meta.url);

const fetchJson = async (url, init) => {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init?.headers } });
    if (res.ok) return res.json();
    if (attempt >= 4 || (res.status !== 429 && res.status < 500)) throw new Error(`${url.slice(0, 80)}: ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
};

const countriesTs = readFileSync(new URL("../src/core/countries.ts", import.meta.url), "utf8");
const COUNTRIES = new Set(
  [...countriesTs.slice(countriesTs.indexOf("COUNTRY_CODES = ["), countriesTs.indexOf("] as const")).matchAll(/"([A-Z]{2})"/g)].map((m) => m[1]),
);

const ne = process.env.ATLAS_NE_FILE ? JSON.parse(readFileSync(process.env.ATLAS_NE_FILE, "utf8")) : await fetchJson(NE_URL);

// ── Which features, grouped into which regions ──
const ISO = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;
/** Parts drawn as countries of their own on the world map (France's overseas regions, Svalbard): not regions. */
const OWN_COUNTRY = new Set(["Svalbard", "Bouvet Island", "French Guiana", "Martinique", "Guadeloupe", "Reunion", "Mayotte"]);

const slug = (cc, name) =>
  `${cc}-${name
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 6)}`;
const ES_CODES = { "ES.PM": "ES-IB", "ES.NA": "ES-NC", "ES.MU": "ES-MC", "ES.LO": "ES-RI" };
/**
 * Countries whose admin-1 in Natural Earth is finer than what travellers think in: grouped into the level above. The
 * UK's 232 council areas into its four nations, France's departments, Italy's and Spain's provinces into regions,
 * the Philippines' provinces and cities into its 17 regions, and Slovenia's and Latvia's municipalities
 * into their statistical regions.
 */
const MERGE = {
  GB: (p) => ({ England: "GB-ENG", Scotland: "GB-SCT", Wales: "GB-WLS", "Northern Ireland": "GB-NIR" })[p.geonunit],
  FR: (p) => p.region_cod?.trim(),
  IT: (p) => p.region_cod?.trim(),
  ES: (p) => (p.name === "Melilla" ? "ES-ML" : (ES_CODES[p.region_cod] ?? p.region_cod?.replace(".", "-"))),
  PH: (p) => p.region_cod?.trim(),
  SI: (p) => slug("SI", p.region),
  LV: (p) => slug("LV", p.region),
};
const MERGED_KIND = { GB: "nation", FR: "region", IT: "region", ES: "region", PH: "region", SI: "region", LV: "region" };

function regionId(p) {
  const cc = p.iso_a2;
  if (MERGE[cc]) {
    const id = MERGE[cc](p);
    if (!id || !/^[A-Z]{2}-[A-Z0-9]{1,8}$/.test(id)) throw new Error(`no merged region for ${cc} ${p.name}`);
    return id;
  }
  const iso = (p.iso_3166_2 ?? "").trim();
  if (ISO.test(iso) && iso.startsWith(`${cc}-`)) return iso;
  // No ISO code of its own: Natural Earth's id, which no ISO code (at most three characters) can be.
  return `${cc}-Z${p.adm1_code
    .split("-")
    .pop()
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()}`;
}

function kindOfType(type) {
  const t = (type ?? "").toLowerCase();
  for (const [kind, re] of [
    ["prefecture", /prefecture|préfecture/],
    ["state", /state/],
    ["province", /province/],
    ["county", /county/],
    ["department", /department|departamento/],
    ["governorate", /governorate|governarate/],
    ["canton", /canton/],
    ["district", /district/],
    ["municipality", /municipalit/],
    ["parish", /parish/],
    ["emirate", /emirate/],
  ]) {
    if (re.test(t)) return kind;
  }
  return "region";
}

const byCountry = new Map(); // cc → Map(id → features)
const typeCounts = new Map(); // cc → Map(kind → n)
for (const f of ne.features) {
  const p = f.properties;
  if (!COUNTRIES.has(p.iso_a2) || p.iso_3166_2?.endsWith("~") || OWN_COUNTRY.has(p.geonunit)) continue;
  const id = regionId(p);
  const groups = byCountry.get(p.iso_a2) ?? new Map();
  groups.set(id, [...(groups.get(id) ?? []), f]);
  byCountry.set(p.iso_a2, groups);
  const kinds = typeCounts.get(p.iso_a2) ?? new Map();
  const kind = kindOfType(p.type_en);
  kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  typeCounts.set(p.iso_a2, kinds);
}
// A country of one region has nothing to mark, and neither has one too small to see on the world map (a dot there:
// Singapore, Andorra, Malta).
const worldMap = readFileSync(new URL("../src/components/atlas/world-map-data.ts", import.meta.url), "utf8");
const dotted = worldMap.slice(worldMap.indexOf("COUNTRY_DOTS"), worldMap.indexOf("COUNTRY_BOXES"));
for (const [cc, groups] of byCountry) if (groups.size < 2 || dotted.includes(`  ${cc}: [`)) byCountry.delete(cc);
const kindOf = (cc) => MERGED_KIND[cc] ?? [...typeCounts.get(cc)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

// ── Names: English and Thai from Wikidata (by ISO 3166-2 code, else the feature's own item), else Natural Earth ──
// ATLAS_LABELS_FILE=<path> keeps what Wikidata answered there, for runs that only change the maps.
const labelsFile = process.env.ATLAS_LABELS_FILE;
const cached = labelsFile && existsSync(labelsFile) ? JSON.parse(readFileSync(labelsFile, "utf8")) : null;
const sparql =
  cached?.sparql ??
  (await fetchJson(
    `${SPARQL_URL}?query=${encodeURIComponent(`SELECT ?code ?en ?th WHERE {
  ?item wdt:P300 ?code .
  FILTER NOT EXISTS { ?item wdt:P576 ?ended }
  OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?th FILTER(lang(?th) = "th") }
}`)}`,
    { headers: { Accept: "application/sparql-results+json" } },
  ));
const byCode = new Map();
for (const b of sparql.results.bindings) {
  const code = b.code.value;
  const seen = byCode.get(code);
  // Several items can share a code (a city and its province): the one with a Thai name, else the first.
  if (!seen || (!seen.th && b.th)) byCode.set(code, { en: b.en?.value ?? seen?.en ?? null, th: b.th?.value ?? null });
}

const qids = [
  ...new Set([...byCountry.values()].flatMap((g) => [...g.values()].filter((fs) => fs.length === 1).map((fs) => fs[0].properties.wikidataid))),
].filter((q) => /^Q\d+$/.test(q ?? ""));
const byItem = new Map(cached?.items ?? []);
for (let i = 0; i < qids.length; i += 50) {
  if (qids.slice(i, i + 50).every((q) => byItem.has(q))) continue;
  const ids = qids.slice(i, i + 50).join("|");
  const res = await fetchJson(`${API_URL}?action=wbgetentities&format=json&props=labels&languages=en|th&ids=${ids}`);
  for (const [q, e] of Object.entries(res.entities ?? {})) byItem.set(q, { en: e.labels?.en?.value ?? null, th: e.labels?.th?.value ?? null });
}

if (labelsFile) writeFileSync(labelsFile, JSON.stringify({ sparql, items: [...byItem] }));

/** "จังหวัดเชียงใหม่" → "เชียงใหม่": the list's heading already says what kind of region it is. */
const thaiName = (name) => {
  if (!name || !/[฀-๿]/.test(name)) return null;
  const short = name.replace(/^(จังหวัด|รัฐ|แคว้น|มณฑล|ประเทศ)\s*/, "").trim();
  return short || name;
};

/** "Kyoto Prefecture" → "Kyoto", for the same reason (Oblast and Krai stay: Moscow Oblast isn't Moscow). */
const englishName = (name) => name.replace(/ (Prefecture|Province|Governorate|State)$/, "");

/** Names neither source has well. */
const NAMES = { "FR-COR": { en: "Corsica", th: "คอร์ซิกา" }, "JP-01": { en: "Hokkaido", th: "ฮกไกโด" } };

/**
 * A region's names, full and short. One feature: its own Wikidata item (the names English speakers use: Kyoto, not
 * Kyōto), else Natural Earth. Several merged into one: the item with the region's ISO code, else Natural Earth's
 * region name. Codes alone aren't trusted for one feature: where ISO renumbered (Iran, Vietnam) they name another.
 */
function namesOf(id, features) {
  if (NAMES[id]) return { ...NAMES[id], full: NAMES[id] };
  const p = features[0].properties;
  const code = byCode.get(id);
  const item = features.length === 1 ? byItem.get(p.wikidataid) : code;
  const en = item?.en ?? (features.length === 1 ? p.name_en || p.name : (p.region ?? p.name));
  const th = item?.th && /[฀-๿]/.test(item.th) ? item.th : null;
  return { en: englishName(en), th: thaiName(th), full: { en, th } };
}

/** Short names, unless shortening makes two regions of a country share one (then those keep their full names). */
function shortNames(list) {
  for (const lang of ["en", "th"]) {
    const count = new Map();
    for (const r of list) if (r[lang]) count.set(r[lang], (count.get(r[lang]) ?? 0) + 1);
    for (const r of list) if (r[lang] && count.get(r[lang]) > 1) r[lang] = r.full[lang];
  }
  for (const r of list) delete r.full;
  return list;
}

// ── Geometry ──
const polygonsOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);

/**
 * The outline of several neighbouring features as one: every edge two of them share cancels out, and what is left is
 * walked back into rings (outer edges, and holes no member fills). Natural Earth's neighbours share their vertices.
 */
function union(rings) {
  const edges = new Map();
  const key = (pt) => `${pt[0]},${pt[1]}`;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [a, b] = [ring[i], ring[i + 1]];
      const ka = key(a);
      const kb = key(b);
      if (ka === kb) continue;
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = edges.get(k);
      if (e) e.n += 1;
      else edges.set(k, { a, b, ka, kb, n: 1 });
    }
  }
  const left = [...edges.values()].filter((e) => e.n % 2 === 1);
  const at = new Map();
  for (const e of left) {
    for (const k of [e.ka, e.kb]) at.set(k, [...(at.get(k) ?? []), e]);
  }
  const out = [];
  for (const first of left) {
    if (first.used) continue;
    first.used = true;
    const ring = [first.a, first.b];
    let cur = first.kb;
    while (cur !== first.ka) {
      const next = at.get(cur).find((e) => !e.used);
      if (!next) break;
      next.used = true;
      const forward = next.ka === cur;
      ring.push(forward ? next.b : next.a);
      cur = forward ? next.kb : next.ka;
    }
    if (ring.length >= 4) out.push(ring);
  }
  return out;
}

function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const area = (ring) =>
  Math.abs(
    ring.reduce((sum, [x, y], i) => {
      const [nx, ny] = ring[(i + 1) % ring.length];
      return sum + x * ny - nx * y;
    }, 0),
  ) / 2;

const boxOf = (points) => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

/** A ring as a relative SVG subpath in whole map units ("M x y l dx dy …z"). */
function ringPath(ring) {
  const pts = ring.map(([x, y]) => [Math.round(x), Math.round(y)]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
  if (pts.length < 3) return "";
  const steps = [];
  for (let i = 1; i < pts.length; i++) steps.push(`${pts[i][0] - pts[i - 1][0]} ${pts[i][1] - pts[i - 1][1]}`);
  return `M${pts[0][0]} ${pts[0][1]}l${steps.join(" ").replace(/ -/g, "-")}z`;
}

/** Far-off parts drawn in a strip under the main map, each in its own frame, instead of making the country tiny. */
const INSETS = {
  US: ["US-AK", "US-HI"],
  ES: ["ES-CN"],
  PT: ["PT-20", "PT-30"],
  JP: ["JP-47"],
  EC: ["EC-W"],
  CO: ["CO-SAP"],
  NZ: ["NZ-CIT"],
};

function buildCountry(cc, groups) {
  // Lon/lat rings per region (unioned when several features make one), across the antimeridian in one piece.
  const raw = new Map();
  for (const [id, features] of groups) {
    const rings = features.flatMap((f) => polygonsOf(f.geometry).flat());
    raw.set(id, features.length > 1 ? union(rings) : rings);
  }
  const lons = [...raw.values()].flat(2).map((p) => p[0]);
  const wraps = lons.some((l) => l < -150) && lons.some((l) => l > 150);
  if (wraps) for (const rings of raw.values()) for (const ring of rings) for (const p of ring) if (p[0] < 0) p[0] += 360;

  const insetIds = new Set((INSETS[cc] ?? []).filter((id) => raw.has(id)));
  // Each region's significant rings (a tenth of its biggest at least) set the main map's box.
  const significant = (rings) => {
    const big = Math.max(...rings.map(area));
    return rings.filter((r) => area(r) >= big * 0.1);
  };
  const mainPts = [...raw].filter(([id]) => !insetIds.has(id)).flatMap(([, rings]) => significant(rings).flat());
  const [, s0, , n0] = boxOf(mainPts);
  const k = Math.cos((((s0 + n0) / 2) * Math.PI) / 180);
  const proj = (rings) => rings.map((ring) => ring.map(([lon, lat]) => [lon * k, -lat]));
  const [x0, y0, x1, y1] = boxOf(mainPts.map(([lon, lat]) => [lon * k, -lat]));
  const scale = SIZE / Math.max(x1 - x0, y1 - y0);
  const W = Math.round((x1 - x0) * scale);
  const H = Math.round((y1 - y0) * scale);
  const margin = Math.max(W, H) * 0.02;

  const regions = new Map(); // id → transformed rings
  for (const [id, rings] of raw) {
    if (insetIds.has(id)) continue;
    const placed = proj(rings)
      .map((ring) => ring.map(([x, y]) => [(x - x0) * scale, (y - y0) * scale]))
      // Far-flung bits of a main region (Easter Island, the Ogasawara Islands) stay off the map.
      .filter((ring) => {
        const [a, b, c, d] = boxOf(ring);
        return c >= -margin && a <= W + margin && d >= -margin && b <= H + margin;
      });
    regions.set(id, placed);
  }

  const insets = [];
  let cx = 0;
  let cy = H + GAP;
  let rowH = 0;
  const longest = Math.max(W, H * 0.6);
  for (const id of insetIds) {
    const rings = proj(significant(raw.get(id)));
    const [a, b, c, d] = boxOf(rings.flat());
    // Alaska shrinks, Hawaii and the Azores grow: each inset between a fifth and a third of the map.
    const native = Math.max(c - a, d - b) * scale;
    const s = (scale * Math.min(Math.max(native, INSET_MIN * longest), INSET_MAX * longest)) / native;
    const w = (c - a) * s;
    const h = (d - b) * s;
    if (cx > 0 && cx + w > W) {
      cx = 0;
      cy += rowH + GAP;
      rowH = 0;
    }
    const pad = 10;
    regions.set(
      id,
      rings.map((ring) => ring.map(([x, y]) => [cx + pad + (x - a) * s, cy + pad + (y - b) * s])),
    );
    insets.push([Math.round(cx), Math.round(cy), Math.round(w + 2 * pad), Math.round(h + 2 * pad)]);
    cx += w + 2 * pad + GAP;
    rowH = Math.max(rowH, h + 2 * pad);
  }
  const height = insets.length ? Math.round(cy + rowH) : H;

  const out = [];
  for (const [id, rings] of regions) {
    const simple = rings.map((r) => simplify(r, TOLERANCE));
    const big = Math.max(...simple.map(area));
    const kept = simple.filter((r) => area(r) === big || area(r) >= MIN_RING_AREA);
    // Islands too small to draw at all (Lakshadweep) are only a dot.
    const d = kept.map(ringPath).join("");
    const [a, b, c, e] = boxOf(kept.flat());
    const largest = kept.find((r) => area(r) === big) ?? kept[0];
    const [la, lb, lc, ld] = boxOf(largest);
    const dot = !d || (c - a < DOT_BELOW && e - b < DOT_BELOW) ? [Math.round((la + lc) / 2), Math.round((lb + ld) / 2)] : null;
    out.push({ id, ...namesOf(id, groups.get(id)), d, ...(dot ? { dot } : {}) });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return { kind: kindOf(cc), w: W, h: height, ...(insets.length ? { insets } : {}), regions: shortNames(out) };
}

// ── Output ──
const previous = existsSync(CORE_FILE) ? [...readFileSync(CORE_FILE, "utf8").matchAll(/\b[A-Z]{2}-[A-Z0-9]{1,8}\b/g)].map((m) => m[0]) : [];
if (existsSync(OUT_DIR)) for (const f of readdirSync(OUT_DIR)) rmSync(new URL(f, OUT_DIR));
mkdirSync(OUT_DIR, { recursive: true });

const index = [];
let bytes = 0;
let largest = ["", 0];
for (const cc of [...byCountry.keys()].sort()) {
  const country = buildCountry(cc, byCountry.get(cc));
  const json = JSON.stringify(country);
  writeFileSync(new URL(`${cc}.json`, OUT_DIR), json);
  bytes += json.length;
  if (json.length > largest[1]) largest = [cc, json.length];
  index.push([cc, country.kind, country.regions.map((r) => r.id)]);
}

const ids = new Set(index.flatMap(([, , list]) => list));
const gone = previous.filter((id) => !ids.has(id));
if (gone.length > 0 && process.env.ATLAS_ALLOW_REMOVED !== "1") {
  throw new Error(`region ids would disappear (people may have them in place_regions): ${gone.slice(0, 20).join(" ")}…`);
}

const kinds = [...new Set(index.map(([, kind]) => kind))].sort();
const coreTs = `// Generated by scripts/atlas-regions.mjs (stage 4 Atlas regions, ADR 0060) from Natural Earth 1:10m admin-1 (public
// domain). Don't edit by hand: change the script and run it again.
// Each country's regions (ISO 3166-2 codes where there is one), what they are called, and where their map is.
import type { CountryCode } from "./countries";

export const REGION_KINDS = [${kinds.map((k) => `"${k}"`).join(", ")}] as const;
export type RegionKind = (typeof REGION_KINDS)[number];

/** The version of the region maps under \`public/atlas/regions/\`: \`/atlas/regions/${VERSION}/<CC>.json\`. */
export const REGION_MAPS_VERSION = "${VERSION}";

/** Countries with regions: what they are (states, provinces, …) and their ids, space-separated. */
export const COUNTRY_REGIONS: Partial<Record<CountryCode, { kind: RegionKind; ids: string }>> = {
${index.map(([cc, kind, list]) => `  ${cc}: { kind: "${kind}", ids: "${list.join(" ")}" },`).join("\n")}
};
`;
writeFileSync(CORE_FILE, coreTs);
console.log(
  `${index.length} countries, ${ids.size} regions, ${(bytes / 1024).toFixed(0)} KB of maps (largest ${largest[0]} ${(largest[1] / 1024).toFixed(0)} KB); ` +
    `kinds ${kinds.join(", ")}`,
);
