// Builds the Atlas world map (stage 4, ADR 0059) from Natural Earth's 1:50m countries (public domain) and the UN M49
// regions (ISO 3166 list by Luke Duncalfe, CC BY-SA 4.0, used here only to derive each country's continent).
// No packages: the Natural Earth I projection, simplification and path encoding are done here.
//
//   node scripts/atlas-map.mjs
//
// Writes src/components/atlas/world-map-data.ts (outlines, dots, continent views) and src/core/continents.ts.
// Run it again only to change the map (another scale, tolerance or source version); commit both outputs.
import { readFileSync, writeFileSync } from "node:fs";

const NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson";
const M49_URL = "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/v10.0/all/all.json";

const WIDTH = 1000;
/** Douglas–Peucker tolerance and the smallest island kept, in map units (the map is 1000 wide). */
const TOLERANCE = 0.45;
const MIN_RING_AREA = 0.8;
/** A country whose outline is smaller than this (both sides) also gets a dot, so it can be seen and tapped. */
const DOT_BELOW = 7;
/** Rings entirely south of this are left out (Antarctica): the map stops at the Southern Ocean. */
const SOUTH_LIMIT = -58;

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};

const [ne, m49] = await Promise.all([fetchJson(NE_URL), fetchJson(M49_URL)]);

// ── Projection: Natural Earth I (Šavrič et al.), as d3-geo's geoNaturalEarth1Raw ──
const rad = Math.PI / 180;
function raw(lon, lat) {
  const l = lon * rad;
  const p = lat * rad;
  const p2 = p * p;
  const p4 = p2 * p2;
  return [
    l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
    p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))),
  ];
}
const scale = WIDTH / (2 * raw(180, 0)[0]);
const top = raw(0, 84)[1];
const project = (lon, lat) => {
  const [x, y] = raw(lon, lat);
  return [WIDTH / 2 + x * scale, (top - y) * scale];
};

// ── Geometry helpers ──
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
    const len = Math.hypot(dx, dy) || 1;
    let max = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = len === 1 && dx === 0 && dy === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > max) {
        max = d;
        at = i;
      }
    }
    if (max > tolerance && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const area = (ring) => Math.abs(ring.reduce((sum, [x, y], i) => {
  const [nx, ny] = ring[(i + 1) % ring.length];
  return sum + x * ny - nx * y;
}, 0)) / 2;

const r1 = (n) => Math.round(n * 10) / 10;
const num = (n) => {
  const s = String(r1(n));
  return s.replace(/^(-?)0\./, "$1.");
};

/** A ring as a relative SVG subpath ("M x y l dx dy …z"), coordinates rounded to 0.1. */
function ringPath(ring) {
  const pts = ring.map(([x, y]) => [r1(x), r1(y)]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  if (pts.length < 3) return "";
  let out = `M${num(pts[0][0])} ${num(pts[0][1])}l`;
  const parts = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = r1(pts[i][0] - pts[i - 1][0]);
    const dy = r1(pts[i][1] - pts[i - 1][1]);
    parts.push(`${num(dx)} ${num(dy)}`);
  }
  out += parts.join(" ").replace(/ -/g, "-") + "z";
  return out;
}

function polygonsOf(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

// ── Countries ──
// Natural Earth's own codes where ISO has none: XK (Kosovo) comes through ISO_A2_EH. Its Indian Ocean territories
// (Christmas and Cocos Islands) are one feature: drawn as Christmas Island. Somaliland, Northern Cyprus and the
// Siachen Glacier have no ISO code: drawn as land that never lights up.
const OVERRIDES = { "Indian Ocean Ter.": "CX" };

/**
 * Overseas parts drawn inside their country's feature but with ISO codes of their own (French Guiana, Svalbard, …):
 * each ring goes to the code whose box holds its first point, so visiting France doesn't light up South America.
 */
const OVERSEAS = {
  FR: [["GF", -55, 1, -51, 6.5], ["GP", -62, 15.8, -60.9, 16.6], ["MQ", -61.3, 14.3, -60.7, 15], ["RE", 55, -21.5, 56, -20.8], ["YT", 44.9, -13.1, 45.4, -12.5]],
  NO: [["SJ", 5, 74, 35, 81]],
  NL: [["BQ", -69, 11.9, -62.9, 17.7]],
};
const ringCode = (code, [lon, lat]) =>
  OVERSEAS[code]?.find(([, w, s, e, n]) => lon >= w && lon <= e && lat >= s && lat <= n)?.[0] ?? code;

const rings = new Map(); // code → projected rings
const labels = new Map(); // code → [lon, lat]
const other = [];
for (const f of ne.features) {
  const p = f.properties;
  const code = OVERRIDES[p.NAME] ?? (p.ISO_A2_EH && p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : null);
  if (code === "AQ") continue;
  for (const polygon of polygonsOf(f.geometry)) {
    const outer = polygon[0];
    if (outer.every(([, lat]) => lat < SOUTH_LIMIT)) continue;
    // Holes are left out: at this scale they are lakes and enclaves, and an enclave is drawn by its own country.
    const ring = simplify(outer.map(([lon, lat]) => project(lon, lat)), TOLERANCE);
    if (!code) {
      other.push(ring);
      continue;
    }
    const own = ringCode(code, outer[0]);
    rings.set(own, [...(rings.get(own) ?? []), ring]);
    // An overseas part's dot sits on its own first point.
    if (own !== code && !labels.has(own)) labels.set(own, outer[0]);
  }
  if (code && (!labels.has(code) || p.HOMEPART === 1)) labels.set(code, [p.LABEL_X, p.LABEL_Y]);
}

const paths = {};
const dots = {};
const boxes = {};
let maxY = 0;
for (const [code, list] of [...rings].sort(([a], [b]) => a.localeCompare(b))) {
  const sorted = [...list].sort((a, b) => area(b) - area(a));
  const kept = sorted.filter((ring, i) => i === 0 || area(ring) >= MIN_RING_AREA);
  const d = kept.map(ringPath).join("");
  if (d) paths[code] = d;
  const xs = kept.flat().map(([x]) => x);
  const ys = kept.flat().map(([, y]) => y);
  maxY = Math.max(maxY, ...ys);
  // The box a card zooms to: the main land and the big islands, not the far-flung small ones.
  const main = kept.filter((ring) => area(ring) >= area(kept[0]) * 0.1).flat();
  const mx = main.map(([x]) => x);
  const my = main.map(([, y]) => y);
  boxes[code] = [Math.floor(Math.min(...mx)), Math.floor(Math.min(...my)), Math.ceil(Math.max(...mx)), Math.ceil(Math.max(...my))];
  if (Math.max(...xs) - Math.min(...xs) < DOT_BELOW && Math.max(...ys) - Math.min(...ys) < DOT_BELOW) {
    const [x, y] = project(...labels.get(code));
    dots[code] = [r1(x), r1(y)];
  }
}
const otherPath = other.filter((ring) => area(ring) >= MIN_RING_AREA).map(ringPath).join("");
const HEIGHT = Math.ceil(maxY + 4);

// ── Continents (UN M49 regions, the Americas split at Central America) ──
const countriesTs = readFileSync(new URL("../src/core/countries.ts", import.meta.url), "utf8");
const codes = [...countriesTs.slice(countriesTs.indexOf("COUNTRY_CODES = ["), countriesTs.indexOf("] as const")).matchAll(/"([A-Z]{2})"/g)].map((m) => m[1]);
const byCode = new Map(m49.map((c) => [c["alpha-2"], c]));
function continentOf(code) {
  if (code === "XK") return "europe";
  if (code === "AQ") return "antarctica";
  // The list leaves Taiwan's region empty; geographically it is in East Asia.
  if (code === "TW") return "asia";
  const c = byCode.get(code);
  if (!c) throw new Error(`no M49 region for ${code}`);
  switch (c.region) {
    case "Africa":
      return "africa";
    case "Asia":
      return "asia";
    case "Europe":
      return "europe";
    case "Oceania":
      return "oceania";
    case "Americas":
      return c["intermediate-region"] === "South America" ? "south_america" : "north_america";
    default:
      throw new Error(`unknown region for ${code}: ${c.region}`);
  }
}
const continents = Object.fromEntries(codes.map((code) => [code, continentOf(code)]));

// ── Continent views: a viewBox around each continent's main lands ──
const BOUNDS = {
  africa: [-19, -36, 53, 38],
  asia: [26, -11, 150, 56],
  europe: [-25, 34, 45, 71],
  north_america: [-168, 6, -52, 72],
  oceania: [112, -48, 180, 0],
  south_america: [-92, -56, -33, 13],
};
const views = {};
for (const [name, [w, s, e, n]] of Object.entries(BOUNDS)) {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const lon = w + ((e - w) * i) / 20;
    const lat = s + ((n - s) * i) / 20;
    pts.push(project(lon, s), project(lon, n), project(w, lat), project(e, lat));
  }
  const x0 = Math.min(...pts.map((p) => p[0]));
  const x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1]));
  const y1 = Math.max(...pts.map((p) => p[1]));
  views[name] = `${Math.round(x0)} ${Math.round(y0)} ${Math.round(x1 - x0)} ${Math.round(y1 - y0)}`;
}

// ── Output ──
const header = (what) =>
  `// Generated by scripts/atlas-map.mjs (stage 4 Atlas, ADR 0059) ${what}. Don't edit by hand: change the script and run it again.\n`;

const mapTs = `${header("from Natural Earth 1:50m countries (public domain), Natural Earth I projection")}import type { Continent } from "@/core/continents";

export const WORLD_WIDTH = ${WIDTH};
export const WORLD_HEIGHT = ${HEIGHT};

/** Each country's outline as one SVG path, by ISO 3166-1 alpha-2 code (Antarctica left out). */
export const COUNTRY_PATHS: Record<string, string> = {
${Object.entries(paths).map(([code, d]) => `  ${code}: "${d}",`).join("\n")}
};

/** Land without an ISO code of its own (Somaliland, Northern Cyprus, the Siachen Glacier): drawn, never lit. */
export const OTHER_LAND = "${otherPath}";

/** Countries too small to see or tap on the world map: a dot at their label point. */
export const COUNTRY_DOTS: Record<string, readonly [number, number]> = {
${Object.entries(dots).map(([code, [x, y]]) => `  ${code}: [${x}, ${y}],`).join("\n")}
};

/** Each country's main land as [x0, y0, x1, y1], for a map zoomed to a few countries (the Atlas card). */
export const COUNTRY_BOXES: Record<string, readonly [number, number, number, number]> = {
${Object.entries(boxes).map(([code, b]) => `  ${code}: [${b.join(", ")}],`).join("\n")}
};

/** A viewBox around each continent's main lands (Antarctica has none: it isn't drawn). */
export const CONTINENT_VIEWS: Record<Exclude<Continent, "antarctica">, string> = {
${Object.entries(views).map(([name, v]) => `  ${name}: "${v}",`).join("\n")}
};
`;

const groups = Object.entries(continents);
const lines = [];
for (let i = 0; i < groups.length; i += 6) lines.push("  " + groups.slice(i, i + 6).map(([c, n]) => `${c}: "${n}",`).join(" "));
const continentsTs = `${header("from the UN M49 regions (via lukes/ISO-3166-Countries-with-Regional-Codes)")}// Each country's continent, for the Atlas: the M49 regions, with the Americas split into North America (Northern and
// Central America, the Caribbean) and South America. Kosovo (XK, not in M49) is Europe, Taiwan (no region there) Asia.
import type { CountryCode } from "./countries";

export const CONTINENTS = ["africa", "antarctica", "asia", "europe", "north_america", "oceania", "south_america"] as const;
export type Continent = (typeof CONTINENTS)[number];

export const CONTINENT_OF: Record<CountryCode, Continent> = {
${lines.join("\n")}
};
`;

writeFileSync(new URL("../src/components/atlas/world-map-data.ts", import.meta.url), mapTs);
writeFileSync(new URL("../src/core/continents.ts", import.meta.url), continentsTs);
console.log(
  `map ${WIDTH}×${HEIGHT}: ${Object.keys(paths).length} countries, ${Object.keys(dots).length} dots, ${(mapTs.length / 1024).toFixed(0)} KB; ` +
    `${codes.length} continents`,
);
