"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { CountryCode } from "@/core/countries";
import { REGION_MAPS_VERSION, type RegionKind } from "@/core/regions";
import { cn } from "@/lib/utils";
import { PAGE_PALETTE, type MapPalette } from "./world-map";

/** A country's region map, as scripts/atlas-regions.mjs writes it to `public/atlas/regions/<version>/<CC>.json`. */
export type RegionMapData = {
  kind: RegionKind;
  w: number;
  h: number;
  /** Frames around far-off parts drawn under the main map (Alaska, the Canaries), as [x, y, w, h]. */
  insets?: [number, number, number, number][];
  regions: { id: string; en: string; th?: string | null; d: string; dot?: [number, number] }[];
};

const loaded = new Map<CountryCode, RegionMapData>();
const loading = new Map<CountryCode, Promise<RegionMapData>>();

/** Loads a country's region map (a few to 35 KB of JSON, cached by the browser), once per page. */
export function loadRegionMap(country: CountryCode): Promise<RegionMapData> {
  let promise = loading.get(country);
  if (!promise) {
    promise = fetch(`/atlas/regions/${REGION_MAPS_VERSION}/${country}.json`).then(async (res) => {
      if (!res.ok) throw new Error(`region map ${country}: ${res.status}`);
      const data = (await res.json()) as RegionMapData;
      loaded.set(country, data);
      return data;
    });
    promise.catch(() => loading.delete(country));
    loading.set(country, promise);
  }
  return promise;
}

/** A country's region map once loaded: null while loading, "error" when it couldn't be (offline, say). */
export function useRegionMap(country: CountryCode): RegionMapData | null | "error" {
  const [state, setState] = useState<{ country: CountryCode; data: RegionMapData | "error" } | null>(() => {
    const data = loaded.get(country);
    return data ? { country, data } : null;
  });
  useEffect(() => {
    if (loaded.has(country)) return;
    let live = true;
    loadRegionMap(country).then(
      (data) => live && setState({ country, data }),
      (error: unknown) => {
        console.error(error);
        if (live) setState({ country, data: "error" });
      },
    );
    return () => {
      live = false;
    };
  }, [country]);
  return state?.country === country ? state.data : (loaded.get(country) ?? null);
}

/** The region's name in the viewer's language (Thai from Wikidata where it has one), else English. */
export const regionName = (region: RegionMapData["regions"][number], locale: string) => (locale === "th" && region.th ? region.th : region.en);

/**
 * One country's regions (stage 4 Atlas, ADR 0060): the ones you've been to in the accent, far-off parts in dashed
 * frames underneath, regions too small to see as dots. With `onToggle`, tapping a region marks or unmarks it (the page's
 * list is the keyboard and screen-reader way to the same regions, so the map itself is one labelled image).
 */
export function RegionMap({
  map,
  marked,
  palette = PAGE_PALETTE,
  flash,
  onToggle,
  label,
  className,
}: {
  map: RegionMapData;
  marked: ReadonlySet<string>;
  palette?: MapPalette;
  /** A region just changed: outlined for a moment, so a tap on a small one shows which it was. */
  flash?: string | null;
  onToggle?: (id: string) => void;
  label: string;
  className?: string;
}) {
  const pad = Math.max(map.w, map.h) * 0.02;
  const box = `${-pad} ${-pad} ${map.w + 2 * pad} ${map.h + 2 * pad}`;
  const unit = Math.max(map.w, map.h) / 1000;

  function click(event: MouseEvent<SVGSVGElement>) {
    const id = (event.target as Element).closest("[data-region]")?.getAttribute("data-region");
    if (id && onToggle) onToggle(id);
  }

  const flashed = flash ? map.regions.find((r) => r.id === flash) : null;
  return (
    <svg
      viewBox={box}
      role="img"
      aria-label={label}
      onClick={onToggle ? click : undefined}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block h-auto w-full", onToggle && "cursor-pointer", className)}
      style={{ aspectRatio: `${map.w + 2 * pad} / ${map.h + 2 * pad}`, background: palette.sea }}
    >
      {map.insets?.map(([x, y, w, h]) => (
        <rect
          key={`${x} ${y}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={8 * unit}
          vectorEffect="non-scaling-stroke"
          strokeWidth={1}
          strokeDasharray="5 4"
          style={{ fill: "none", stroke: palette.land }}
        />
      ))}
      <g style={{ stroke: palette.edge }} strokeWidth={0.8} strokeLinejoin="round">
        {map.regions.map((r) =>
          r.d ? (
            <path
              key={r.id}
              d={r.d}
              fillRule="evenodd"
              data-region={r.id}
              data-marked={marked.has(r.id) || undefined}
              vectorEffect="non-scaling-stroke"
              style={{ fill: marked.has(r.id) ? palette.been : palette.land }}
            />
          ) : null,
        )}
        {map.regions.map((r) =>
          r.dot ? (
            <g key={r.id} data-region={r.id}>
              <circle
                cx={r.dot[0]}
                cy={r.dot[1]}
                r={(marked.has(r.id) ? 9 : 7) * unit}
                vectorEffect="non-scaling-stroke"
                style={{ fill: marked.has(r.id) ? palette.been : palette.land, stroke: palette.sea }}
              />
              {/* A finger-sized target around the dot. */}
              {onToggle && <circle cx={r.dot[0]} cy={r.dot[1]} r={26 * unit} style={{ fill: "transparent", stroke: "none" }} />}
            </g>
          ) : null,
        )}
        {flashed && (
          <g pointerEvents="none" style={{ fill: "none", stroke: "currentColor" }} strokeWidth={2.5}>
            {flashed.d && <path d={flashed.d} fillRule="evenodd" vectorEffect="non-scaling-stroke" className="animate-pulse" />}
            {flashed.dot && (
              <circle cx={flashed.dot[0]} cy={flashed.dot[1]} r={14 * unit} vectorEffect="non-scaling-stroke" className="animate-pulse" />
            )}
          </g>
        )}
      </g>
    </svg>
  );
}
