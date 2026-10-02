"use client";

import { CheckIcon, Share2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Celebration } from "@/components/celebration";
import { StonieHop } from "@/components/motion/stonie-hop";
import { PaperCard } from "@/components/paper-card";
import { isVisited, searchRegions, type Place } from "@/core/atlas";
import type { CardData } from "@/core/cards/types";
import type { CountryCode } from "@/core/countries";
import type { RegionKind } from "@/core/regions";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { RegionMap, regionName, useRegionMap } from "./region-map";

/**
 * A country's page of the Atlas (stage 4, ADR 0060): its states, provinces or regions on its own map. A tap on the
 * map or in the list marks one as been there (or unmarks it), saved at once and undoable; marking the first puts the
 * country on the Atlas. The map zooms in (scrolling inside its frame) for small regions, and the list can be searched.
 */
export function RegionsView({
  country,
  name,
  kind,
  total,
  initialMarked,
  initialPlace,
  username,
  host,
}: {
  country: CountryCode;
  /** The country's name in the viewer's language. */
  name: string;
  kind: RegionKind;
  total: number;
  initialMarked: string[];
  initialPlace: Place | null;
  username: string | null;
  host: string;
}) {
  const t = useTranslations("Atlas");
  const format = useFormatter();
  const locale = useLocale();
  const id = useId();
  const map = useRegionMap(country);
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set(initialMarked));
  const [place, setPlace] = useState(initialPlace);
  const [last, setLast] = useState<{ id: string; visited: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [query, setQuery] = useState("");
  const [sharing, setSharing] = useState<CardData | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  const one = t("kindOne", { kind });
  const many = t("kindMany", { kind });
  const regions = useMemo(() => (map && map !== "error" ? map.regions : []), [map]);
  const byId = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);
  const nameOf = (rid: string) => {
    const r = byId.get(rid);
    return r ? regionName(r, locale) : rid;
  };
  const sorted = useMemo(() => {
    const collator = new Intl.Collator(locale);
    return regions.map((r) => [r.id, regionName(r, locale), r.en] as const).sort((a, b) => collator.compare(a[1], b[1]));
  }, [regions, locale]);
  const shown = useMemo(() => {
    const ids = new Set(searchRegions(query, sorted));
    return sorted.filter(([rid]) => ids.has(rid));
  }, [query, sorted]);
  const done = [...marked].filter((rid) => !map || map === "error" || byId.has(rid)).length;

  // Zooming in keeps the middle of the map in view.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoomed]);

  async function toggle(rid: string, via: "map" | "list") {
    const visited = !marked.has(rid);
    const flip = (set: ReadonlySet<string>, on: boolean) => {
      const next = new Set(set);
      if (on) next.add(rid);
      else next.delete(rid);
      return next;
    };
    const placeBefore = place;
    setMarked((m) => flip(m, visited));
    // Marking one puts the country on the Atlas (or moves it from Want to go), as the server does.
    if (visited && (!place || !isVisited(place))) setPlace({ country, status: "been", firstYear: null });
    setLast({ id: rid, visited });
    setError(false);
    track("region_saved", { visited, via });
    const res = await fetch("/api/places/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: rid, visited }),
    }).catch(() => null);
    if (!res?.ok) {
      setMarked((m) => flip(m, !visited));
      setPlace(placeBefore);
      setLast(null);
      setError(true);
    }
  }

  function share() {
    const order = map && map !== "error" ? map.regions.map((r) => r.id) : [];
    setSharing({
      kind: "movie",
      name,
      posterUrl: null,
      finishedOn: new Date().toLocaleDateString("en-CA"),
      atlas: {
        countries: [country],
        stories: 0,
        regions: { country, kind, total, ids: [...marked].filter((rid) => order.includes(rid)).sort((a, b) => order.indexOf(a) - order.indexOf(b)) },
      },
    });
  }

  const share100 = total > 0 ? done / total : 0;
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${id}-progress`} className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <p id={`${id}-progress`} className="flex flex-col">
            <span className="font-display text-5xl leading-none font-extrabold tabular-nums">{t("regionsDone", { done, total })}</span>
            <span className="mt-1 text-sm text-muted-foreground">{t("regionsDoneLabel", { many })}</span>
          </p>
          <p className="font-hand text-3xl leading-none text-brand">{format.number(share100, { style: "percent" })}</p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${share100 * 100}%` }} />
        </div>
        {(!place || !isVisited(place)) && (
          <p className="text-sm text-muted-foreground">{t(place ? "regionsWantHint" : "regionsJoinHint", { country: name })}</p>
        )}
      </section>

      <section aria-label={t("regionsMapLabel", { country: name })} className="flex flex-col gap-2">
        <div className="relative">
          <div ref={frame} className="max-h-[64vh] overflow-auto overscroll-contain rounded-2xl bg-[var(--atlas-sea)] ring-1 ring-border">
            {map && map !== "error" ? (
              <div style={{ width: zoomed ? "240%" : "100%" }}>
                <RegionMap
                  map={map}
                  marked={marked}
                  flash={last?.id ?? null}
                  onToggle={(rid) => toggle(rid, "map")}
                  label={t("regionsMapAlt", { country: name, done, total, many })}
                  className={cn("text-foreground", !zoomed && "max-h-[64vh]")}
                />
              </div>
            ) : (
              <p className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                {map !== "error" && <StonieHop />}
                {map === "error" ? t("regionsMapError") : t("loadingMap")}
              </p>
            )}
          </div>
          {map && map !== "error" && (
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              aria-pressed={zoomed}
              aria-label={t(zoomed ? "zoomOut" : "zoomIn")}
              className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full bg-card/95 shadow-sm ring-1 ring-border hover:bg-muted"
            >
              {zoomed ? <ZoomOutIcon className="size-5" aria-hidden="true" /> : <ZoomInIcon className="size-5" aria-hidden="true" />}
            </button>
          )}
        </div>
        <p aria-live="polite" className="flex min-h-11 items-center gap-3 text-sm">
          {error ? (
            <span className="text-destructive">{t("saveError")}</span>
          ) : last ? (
            <>
              <span className="min-w-0 truncate">{t(last.visited ? "regionMarked" : "regionUnmarked", { region: nameOf(last.id) })}</span>
              <button
                type="button"
                onClick={() => toggle(last.id, "list")}
                className="flex min-h-11 shrink-0 items-center font-semibold text-brand underline-offset-2 hover:underline"
              >
                {t("undo")}
              </button>
            </>
          ) : (
            <span className="text-muted-foreground">{t("regionsMapHint", { many })}</span>
          )}
        </p>
      </section>

      {sorted.length > 0 && (
        <section aria-labelledby={`${id}-list`} className="flex flex-col gap-3">
          <h2 id={`${id}-list`} className="font-display text-xl font-extrabold">
            {t("regionsAll", { title: t("kindTitle", { kind }), total })}
          </h2>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-find`} className="sr-only">
              {t("regionsFind", { one })}
            </label>
            <input
              id={`${id}-find`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("regionsFind", { one })}
              autoComplete="off"
              className="h-12 rounded-xl bg-card px-4 text-base ring-1 ring-border placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("regionsNoMatch", { many, query: query.trim() })}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {shown.map(([rid, label]) => {
                const on = marked.has(rid);
                return (
                  <li key={rid}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(rid, "list")}
                      className={cn(
                        "flex min-h-11 items-center gap-1.5 rounded-full py-1 pr-4 pl-3 text-sm font-semibold ring-1 transition-colors",
                        on ? "bg-brand text-brand-foreground ring-brand" : "bg-card ring-border hover:bg-muted",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full",
                          on ? "bg-brand-foreground/25" : "ring-1 ring-border",
                        )}
                      >
                        {on && <CheckIcon className="size-3" />}
                      </span>
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <PaperCard className="flex flex-col gap-2">
        <button
          type="button"
          onClick={share}
          disabled={done === 0 || !map || map === "error"}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50"
        >
          <Share2Icon className="size-4" aria-hidden="true" />
          {t("regionsShare", { country: name })}
        </button>
        {done === 0 && <p className="text-sm text-muted-foreground">{t("regionsShareEmpty", { many })}</p>}
      </PaperCard>

      {sharing && (
        <Celebration data={sharing} source={{ kind: "atlas", ready: true }} username={username} host={host} onClose={() => setSharing(null)} />
      )}
    </div>
  );
}
