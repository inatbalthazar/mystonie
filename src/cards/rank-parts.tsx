"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRegionMap } from "@/components/atlas/region-map";
import { useWorldMap } from "@/components/atlas/world-map";
import type { CardData } from "@/core/cards/types";
import type { CountryCode } from "@/core/countries";
import { parseRef, type RankItem } from "@/core/rankings";
import { cn } from "@/lib/utils";
import { Poster } from "./parts";

/** What a ranking card shows: its items, and whether the owner hid the ✓ marks or the notes (ADR 0099). */
export function useRanking(data: CardData) {
  const hide = data.hide ?? [];
  return { items: data.ranking?.items ?? [], showDone: !hide.includes("done"), showNotes: !hide.includes("notes") };
}

/**
 * One thing on a ranking, at a 2:3 poster's shape: the title's poster, or a place's own outline (a country from the
 * world map, a region from its country's map) filled with `fill` on `paper`. The maps load with the page that makes
 * the card (`/rank`), before it's drawn.
 */
export function RankThumb({
  item,
  fill,
  paper,
  className,
  caption,
}: {
  item: RankItem;
  fill: string;
  paper: string;
  className?: string;
  /** Tier lists print no names: a place, or a title without a poster, then names itself on the tile, at this size (px). */
  caption?: { size: number; color: string };
}) {
  const label = caption && (
    <span
      className="absolute inset-x-0 bottom-[6%] line-clamp-2 max-h-[2.1em] overflow-hidden px-[6%] text-center leading-[1.05] font-bold [overflow-wrap:anywhere]"
      style={{ fontSize: caption.size, color: caption.color }}
    >
      {item.name}
    </span>
  );
  if (item.kind === "country" || item.kind === "region") {
    return (
      <div className={cn("relative flex aspect-[2/3] items-center justify-center overflow-hidden", caption && "pb-[18%]", className)} style={{ background: paper }}>
        <PlaceShape item={item} fill={fill} />
        {label}
      </div>
    );
  }
  return (
    <div className={cn("relative aspect-[2/3] overflow-hidden", className)}>
      <Poster url={item.posterUrl} className="absolute inset-0" />
      {!item.posterUrl && label}
    </div>
  );
}

function PlaceShape({ item, fill }: { item: RankItem; fill: string }) {
  const ref = parseRef(item.ref);
  if (ref?.type === "country") return <CountryShape code={ref.code} fill={fill} />;
  if (ref?.type === "region") return <RegionShape id={ref.id} country={ref.country as CountryCode} fill={fill} />;
  return null;
}

function CountryShape({ code, fill }: { code: string; fill: string }) {
  const world = useWorldMap();
  const d = world?.COUNTRY_PATHS[code];
  const b = world?.COUNTRY_BOXES[code];
  if (!d || !b) return null;
  return <Shape d={d} box={viewBox(b[0], b[1], b[2] - b[0], b[3] - b[1])} fill={fill} />;
}

function RegionShape({ id, country, fill }: { id: string; country: CountryCode; fill: string }) {
  const map = useRegionMap(country);
  const d = map && map !== "error" ? map.regions.find((r) => r.id === id)?.d : undefined;
  return d ? <Shape d={d} box={null} fill={fill} /> : null;
}

/**
 * An outline in its own box. A region's map has no boxes, so its outline is measured once it's drawn, and the box is its
 * biggest piece of land: Tokyo is its city, not the islands a thousand kilometres south that belong to it.
 */
function Shape({ d, box, fill }: { d: string; box: string | null; fill: string }) {
  const group = useRef<SVGGElement>(null);
  const [measured, setMeasured] = useState<string | null>(null);
  const pieces = box ? [d] : d.split(/(?=M)/).filter(Boolean);
  useLayoutEffect(() => {
    if (box || !group.current) return;
    let best: DOMRect | null = null;
    for (const piece of group.current.querySelectorAll("path")) {
      const b = piece.getBBox();
      if (!best || b.width * b.height > best.width * best.height) best = b;
    }
    if (best && best.width > 0 && best.height > 0) setMeasured(viewBox(best.x, best.y, best.width, best.height));
  }, [d, box]);
  return (
    <svg viewBox={box ?? measured ?? "0 0 1000 1000"} preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="h-[76%] w-[82%]">
      <g ref={group} fill={fill}>
        {pieces.map((piece, i) => (
          <path key={i} d={piece} />
        ))}
      </g>
    </svg>
  );
}

/** A box around an outline with a little room to breathe (the svg keeps its shape, centred). */
function viewBox(x: number, y: number, w: number, h: number): string {
  const pad = Math.max(w, h) * 0.06;
  return `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`;
}

/** A tier list's rows, top to bottom: the colours every tier list uses (S red, A orange, B yellow…). */
export const TIER_COLOURS = ["#ff7f7f", "#ffbf7f", "#ffdf7f", "#bfff7f", "#7fbfff", "#bf7fff"] as const;

/** A row label's size (px) on a card: a letter fills its note, a word wraps smaller. */
export function labelSize(label: string, poster: number): number {
  const base = label.length <= 2 ? 96 : label.length <= 5 ? 50 : 38;
  return Math.max(20, Math.min(base, poster * (label.length <= 2 ? 0.5 : 0.24)));
}

/** The ✓ for something the owner finished or has been to, set by the server (ADR 0099). */
export function DoneMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}
