"use client";

import { useEffect, useId, useState, type MouseEvent } from "react";
import type { Continent } from "@/core/continents";
import { cn } from "@/lib/utils";

type MapData = typeof import("./world-map-data");

let loaded: MapData | null = null;
let loading: Promise<MapData> | null = null;

/** Loads the map's outlines (about 80 KB, a chunk of their own), once per page. */
export function loadWorldMap(): Promise<MapData> {
  loading ??= import("./world-map-data").then((data) => (loaded = data));
  return loading;
}

/** The map's outlines once loaded (null until then; loading starts on mount). */
export function useWorldMap(): MapData | null {
  const [data, setData] = useState<MapData | null>(loaded);
  useEffect(() => {
    if (data) return;
    let live = true;
    loadWorldMap().then(
      (d) => live && setData(d),
      (error: unknown) => console.error(error),
    );
    return () => {
      live = false;
    };
  }, [data]);
  return data;
}

/**
 * A viewBox around `codes` with room to spare, `aspect` wide per unit high and at least a fifth of the world wide (so one
 * small country still shows its neighbours), kept inside the map. Null for no known country or when the box would be
 * as wide as the world.
 */
export function focusBox(map: MapData, codes: readonly string[], aspect: number): string | null {
  const boxes = codes.flatMap((code) => (map.COUNTRY_BOXES[code] ? [map.COUNTRY_BOXES[code]] : []));
  if (boxes.length === 0) return null;
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[2]));
  const y1 = Math.max(...boxes.map((b) => b[3]));
  const pad = Math.max(x1 - x0, y1 - y0) * 0.3 + 20;
  let w = Math.max(x1 - x0 + 2 * pad, map.WORLD_WIDTH / 5);
  let h = y1 - y0 + 2 * pad;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  if (w >= map.WORLD_WIDTH * 0.9 || h >= map.WORLD_HEIGHT) return null;
  const cx = Math.min(Math.max((x0 + x1) / 2, w / 2), map.WORLD_WIDTH - w / 2);
  const cy = Math.min(Math.max((y0 + y1) / 2, h / 2), map.WORLD_HEIGHT - h / 2);
  const r = (n: number) => Math.round(n * 10) / 10;
  return `${r(cx - w / 2)} ${r(cy - h / 2)} ${r(w)} ${r(h)}`;
}

/** How a country is coloured: visited, lived in, wanted, or one of the four steps of the Stories layer. */
export type MapTone = "been" | "lived" | "want" | 1 | 2 | 3 | 4;

/** The map's colours: any CSS colour, `var(--…)` included (the page's theme) or fixed (a card's palette). */
export type MapPalette = {
  sea: string;
  land: string;
  edge: string;
  been: string;
  lived: string;
  want: string;
  stories: readonly [string, string, string, string];
};

/** The page's map colours, from the theme (`--atlas-*` in globals.css). */
export const PAGE_PALETTE: MapPalette = {
  sea: "var(--atlas-sea)",
  land: "var(--atlas-land)",
  edge: "var(--atlas-edge)",
  been: "var(--brand)",
  lived: "var(--atlas-lived)",
  want: "var(--brand)",
  stories: ["var(--atlas-story-1)", "var(--atlas-story-2)", "var(--atlas-story-3)", "var(--atlas-story-4)"],
};

export type MapView = "world" | Exclude<Continent, "antarctica">;

/**
 * The world map (stage 4 Atlas, ADR 0059): Natural Earth outlines with each country coloured by `tones`, small
 * countries as dots. Without the outlines yet it keeps its size, so nothing jumps. With `onSelect`, tapping a country
 * selects it (the Atlas's list and search are the keyboard and screen-reader way to the same countries, so the map
 * itself is one labelled image).
 */
export function WorldMap({
  map,
  tones,
  palette = PAGE_PALETTE,
  view = "world",
  focus,
  selected,
  onSelect,
  label,
  className,
}: {
  map: MapData | null;
  tones: ReadonlyMap<string, MapTone>;
  palette?: MapPalette;
  view?: MapView;
  /** Zoom to these countries in a box of this width-to-height ratio (the Atlas card); the whole world when they spread too far. */
  focus?: { codes: readonly string[]; aspect: number };
  selected?: string | null;
  onSelect?: (code: string) => void;
  label: string;
  className?: string;
}) {
  const hatch = useId().replace(/:/g, "");
  const width = map?.WORLD_WIDTH ?? 1000;
  const height = map?.WORLD_HEIGHT ?? 435;
  const focused = map && focus ? focusBox(map, focus.codes, focus.aspect) : null;
  const box = focused ?? (view === "world" || !map ? `0 0 ${width} ${height}` : map.CONTINENT_VIEWS[view]);
  const [, , boxWidth, boxHeight] = box.split(" ").map(Number);
  const scale = boxWidth / width;
  const fill = (tone: MapTone | undefined) =>
    tone === undefined ? undefined : tone === "want" ? `url(#${hatch})` : typeof tone === "number" ? palette.stories[tone - 1] : palette[tone];

  function click(event: MouseEvent<SVGSVGElement>) {
    const code = (event.target as Element).closest("[data-code]")?.getAttribute("data-code");
    if (code && onSelect) onSelect(code);
  }

  return (
    <svg
      viewBox={box}
      role="img"
      aria-label={label}
      onClick={onSelect ? click : undefined}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block h-auto w-full", onSelect && "cursor-pointer", className)}
      style={{ aspectRatio: focused ? `${boxWidth} / ${boxHeight}` : `${width} / ${height}`, background: palette.sea }}
    >
      <defs>
        <pattern id={hatch} patternUnits="userSpaceOnUse" width={4 * scale} height={4 * scale} patternTransform="rotate(45)">
          <rect width={4 * scale} height={4 * scale} style={{ fill: palette.land }} />
          <rect width={1.6 * scale} height={4 * scale} style={{ fill: palette.want }} />
        </pattern>
      </defs>
      {map && (
        <g style={{ fill: palette.land, stroke: palette.edge }} strokeWidth={0.6} strokeLinejoin="round">
          <path d={map.OTHER_LAND} vectorEffect="non-scaling-stroke" />
          {Object.entries(map.COUNTRY_PATHS).map(([code, d]) => (
            <path
              key={code}
              d={d}
              data-code={code}
              data-tone={tones.get(code)}
              vectorEffect="non-scaling-stroke"
              style={{ fill: fill(tones.get(code)) }}
            />
          ))}
          {Object.entries(map.COUNTRY_DOTS).map(([code, [x, y]]) => {
            const tone = tones.get(code);
            return (
              <circle
                key={code}
                cx={x}
                cy={y}
                r={(tone === undefined ? 2.6 : 5.5) * Math.max(scale, 0.35)}
                data-code={code}
                data-tone={tone}
                vectorEffect="non-scaling-stroke"
                style={{ fill: tone === "want" ? palette.want : fill(tone), opacity: tone === undefined ? 0.7 : 1 }}
              />
            );
          })}
          {selected && map.COUNTRY_PATHS[selected] && (
            <path
              d={map.COUNTRY_PATHS[selected]}
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              style={{ fill: "none", stroke: "currentColor" }}
              pointerEvents="none"
            />
          )}
          {selected && map.COUNTRY_DOTS[selected] && (
            <circle
              cx={map.COUNTRY_DOTS[selected][0]}
              cy={map.COUNTRY_DOTS[selected][1]}
              r={9 * Math.max(scale, 0.35)}
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              style={{ fill: "none", stroke: "currentColor" }}
              pointerEvents="none"
            />
          )}
        </g>
      )}
    </svg>
  );
}
